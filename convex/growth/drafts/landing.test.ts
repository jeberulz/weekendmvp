/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import schema from "../../schema";
import { hydrotrailBlueprint, hydrotrailBrandKit, hydrotrailLandingSpec } from "../../../lib/workspace/contracts/fixtures/hydrotrail";
import { writePrivateLandingVersion } from "./landing";

const modules = import.meta.glob("/convex/**/*.ts");
const request1 = "51f33770-ac9d-4cbd-bc67-ce4faf192601";
const request2 = "51f33770-ac9d-4cbd-bc67-ce4faf192602";

async function setup() {
  const t = convexTest(schema, modules);
  const now = Date.now();
  const ids = await t.run(async (ctx) => {
    const ownerId = await ctx.db.insert("users", { email: "owner@example.test" });
    const other = await ctx.db.insert("users", { email: "other@example.test" });
    const ownerSession = await ctx.db.insert("authSessions", { userId: ownerId, expirationTime: now + 3600_000 });
    const otherSession = await ctx.db.insert("authSessions", { userId: other, expirationTime: now + 3600_000 });
    await ctx.db.insert("ops_settings", { ownerId, singletonKey: "workspace", workspaceEnabled: true, cohortMode: "open",
      freeSignupsOpen: false, globalDailyBudgetMicroUsd: 0n, paidGlobalDailyBudgetMicroUsd: 0n,
      killSwitches: { ai: false, studioVideo: true, publish: false, email: true, social: true, ads: true }, updatedAt: now });
    const base = { ownerId, title: "HydroTrail", source: "own_idea", status: "draft", createdAt: now, updatedAt: now } as const;
    const projectId = await ctx.db.insert("projects", { ...base, idempotencyKey: "one" });
    const otherProject = await ctx.db.insert("projects", { ...base, idempotencyKey: "two" });
    const doc = { ownerId, projectId, title: "Crew draft", format: "json", createdAt: now - 10, updatedAt: now - 10 } as const;
    const briefDocumentId = await ctx.db.insert("documents", { ...doc, kind: "blueprint", body: JSON.stringify(hydrotrailBlueprint) });
    const brandKitDocumentId = await ctx.db.insert("documents", { ...doc, kind: "brand_kit", body: JSON.stringify(hydrotrailBrandKit) });
    const landingDoc = { ...doc, kind: "landing_spec", briefDocumentId, brandKitDocumentId, body: JSON.stringify(hydrotrailLandingSpec) } as const;
    const documentId = await ctx.db.insert("documents", landingDoc);
    const card = { ownerId, projectId, kind: "artifact_review", subjectTable: "documents", status: "approved",
      changeRound: 0n, createdAt: now, updatedAt: now } as const;
    await ctx.db.insert("approvals", { ...card, subjectId: briefDocumentId });
    const brandApproval = await ctx.db.insert("approvals", { ...card, subjectId: brandKitDocumentId });
    const reviewId = await ctx.db.insert("approvals", { ...card, subjectId: documentId, status: "pending" });
    return { projectId, otherProject, ownerId, ownerSession, other, otherSession, documentId, landingDoc, reviewId, brandApproval };
  });
  const as = (userId: Id<"users">, sessionId: Id<"authSessions">) =>
    t.withIdentity({ subject: `${userId}|${sessionId}`, issuer: "https://local.test" });
  const owner = as(ids.ownerId, ids.ownerSession);
  const stranger = as(ids.other, ids.otherSession);
  const write = (id = ids.documentId) => t.run((ctx) => writePrivateLandingVersion(ctx, id));
  const view = () => owner.query(api.growth.drafts.landing.privateLandingPreview, { projectId: ids.projectId });
  const submit = (versionId: Id<"site_versions">, requestId = request1, email = "preview@example.test") =>
    owner.mutation(api.growth.drafts.landing.recordTestLead, { projectId: ids.projectId, versionId, email, requestId });
  return { t, owner, stranger, write, view, submit, ...ids };
}

describe("Leo's private landing version", () => {
  test("creates one private version per document, preserves its brand snapshot and keeps each review tied to its own document", async () => {
    const w = await setup();
    expect(await w.view()).toEqual({ state: "none" });
    const versionId = await w.write();
    expect(await w.write()).toBe(versionId);
    expect(await w.view()).toMatchObject({ state: "ready", versionId, version: 1n, spec: hydrotrailLandingSpec,
      kit: hydrotrailBrandKit, card: { approvalId: w.reviewId }, lastReceipt: null, testLeadCount: 0 });
    await w.t.run(async (ctx) => {
      const site = await ctx.db.query("site_configs").unique();
      expect(site?.status).toBe("draft");
      expect(site?.hostname).toBeUndefined();
      expect(site?.currentVersionId).toBeUndefined();
      const rows = await ctx.db.query("site_versions").collect();
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe("draft");
      await ctx.db.patch("documents", w.landingDoc.brandKitDocumentId, {
        body: JSON.stringify({ ...hydrotrailBrandKit, name: "Edited kit" }), updatedAt: Date.now() + 1,
      });
    });
    expect(await w.view()).toMatchObject({ kit: hydrotrailBrandKit });
    const otherDoc = await w.t.run((ctx) => ctx.db.insert("documents", { ...w.landingDoc, supersedesDocumentId: w.documentId }));
    await expect(w.write(otherDoc)).rejects.toThrow(/APPROVAL_SUBJECT_CHANGED/);
    const at = Date.now() + 2;
    await w.t.run((ctx) => ctx.db.insert("approvals", { ownerId: w.ownerId, projectId: w.projectId,
      subjectTable: "documents", subjectId: w.landingDoc.brandKitDocumentId, kind: "artifact_review", status: "approved",
      changeRound: 1n, createdAt: at, updatedAt: at }));
    const v2 = await w.write(otherDoc);
    expect(await w.write()).toBe(versionId);
    expect(await w.view()).toMatchObject({ versionId: v2, version: 2n, documentId: otherDoc, card: null, kit: { name: "Edited kit" } });
  });

  test("two retries store one synthetic lead, persist the receipt, and scope a later revision's count and idempotency independently", async () => {
    const w = await setup();
    const version = await w.write();
    const [first, repeated] = await Promise.all([w.submit(version), w.submit(version)]);
    expect(first.leadId).toBe(repeated.leadId);
    expect([first.duplicate, repeated.duplicate].sort()).toEqual([false, true]);
    expect(await w.submit(version, request2)).toMatchObject({ testLeadCount: 2, duplicate: false });
    expect(await w.submit(version, request1)).toMatchObject({ leadId: first.leadId, testLeadCount: 2, duplicate: true });
    expect(await w.view()).toMatchObject({ testLeadCount: 2, lastReceipt: { createdAt: expect.any(Number) } });
    const leads = await w.t.run((ctx) => ctx.db.query("leads").collect());
    expect(leads).toHaveLength(2);
    for (const row of leads) {
      expect(row).toMatchObject({ ownerId: w.ownerId, projectId: w.projectId, synthetic: true, privateLandingVersionId: version });
      expect(row).not.toHaveProperty("email");
      expect(row).not.toHaveProperty("payload");
    }
    const exported = await w.owner.query(api.platform.sites.leads.exportPage,
      { projectId: w.projectId, paginationOpts: { cursor: null, numItems: 25 } });
    expect(exported.page).toEqual([]);
    expect(await w.t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect())).toEqual([]);
    const revised = await w.t.run((ctx) => ctx.db.insert("documents", { ...w.landingDoc, supersedesDocumentId: w.documentId }));
    const v2 = await w.write(revised);
    expect(await w.view()).toMatchObject({ version: 2n, lastReceipt: null, testLeadCount: 0 });
    await expect(w.submit(version)).rejects.toThrow(/LANDING_PREVIEW_UNAVAILABLE/);
    const newLead = await w.submit(v2);
    expect(newLead).toMatchObject({ duplicate: false, testLeadCount: 1 });
    expect(newLead.leadId).not.toBe(first.leadId);
  });

  test("refuses personal data, invalid request keys, stale source approvals and foreign scope", async () => {
    const w = await setup();
    const versionId = await w.write();
    await expect(w.submit(versionId, request1, "real@actual-company.org")).rejects.toThrow(/LANDING_TEST_EMAIL_REQUIRED/);
    await expect(w.submit(versionId, "arbitrary data")).rejects.toThrow(/LANDING_TEST_REQUEST_INVALID/);
    const args = { projectId: w.projectId, versionId, requestId: request1, email: "preview@example.test" };
    await expect(w.stranger.mutation(api.growth.drafts.landing.recordTestLead, args)).rejects.toThrow(/RESOURCE_NOT_FOUND/);
    await expect(w.stranger.query(api.growth.drafts.landing.privateLandingPreview, { projectId: w.projectId })).rejects.toThrow(/RESOURCE_NOT_FOUND/);
    await expect(w.owner.mutation(api.growth.drafts.landing.recordTestLead, { ...args, projectId: w.otherProject })).rejects.toThrow(/LANDING_PREVIEW_UNAVAILABLE/);
    const changed = await w.t.run(async (ctx) => {
      await ctx.db.patch("approvals", w.brandApproval, { status: "changes_requested" });
      return await ctx.db.insert("documents", { ...w.landingDoc });
    });
    await expect(w.write(changed)).rejects.toThrow(/APPROVAL_NOT_APPROVED/);
    const wrongProject = await w.t.run((ctx) => ctx.db.insert("documents", { ...w.landingDoc, projectId: w.otherProject }));
    await expect(w.write(wrongProject)).rejects.toThrow(/LANDING_INPUT_UNAVAILABLE/);
    expect(await w.t.run((ctx) => ctx.db.query("leads").collect())).toEqual([]);
    expect(await w.t.run((ctx) => ctx.db.query("site_versions").collect())).toHaveLength(1);
  });

  test("a changed review document or malformed saved snapshot cannot accept a signup", async () => {
    const w = await setup();
    const versionId = await w.write();
    await w.t.run((ctx) => ctx.db.patch("documents", w.documentId, { body: JSON.stringify({
      ...hydrotrailLandingSpec, footer: { ...hydrotrailLandingSpec.footer, closingLine: "Different final line" },
    }) }));
    expect(await w.view()).toEqual({ state: "unavailable" });
    await expect(w.submit(versionId)).rejects.toThrow(/LANDING_PREVIEW_UNAVAILABLE/);
    await w.t.run(async (ctx) => {
      await ctx.db.patch("documents", w.documentId, { body: JSON.stringify(hydrotrailLandingSpec) });
      const version = await ctx.db.get("site_versions", versionId);
      if (!version?.privateLanding) throw new Error("missing version snapshot");
      await ctx.db.patch("site_versions", versionId, { privateLanding: { ...version.privateLanding, brandKitSnapshot: "{}" } });
    });
    expect(await w.view()).toEqual({ state: "unavailable" });
    await expect(w.submit(versionId)).rejects.toThrow(/LANDING_PREVIEW_UNAVAILABLE/);
  });

  test("cannot publish a private version directly, via rollback or by selecting it as the latest draft", async () => {
    const w = await setup();
    const versionId = await w.write();
    const hostname = "hydrotrail.weekendmvp.app";
    await expect(w.owner.mutation(internal.platform.sites.publish.publishCore, { projectId: w.projectId, slug: "hydrotrail" }))
      .rejects.toThrow(/SITE_NOT_PUBLISHABLE/);
    const liveDocument = await w.t.run(async (ctx) => {
      const version = await ctx.db.get("site_versions", versionId);
      if (!version) throw new Error("missing first version");
      const doc = await ctx.db.insert("documents", { ...w.landingDoc, title: "Public site", body: "Already-published page" });
      const liveVersion = await ctx.db.insert("site_versions", { ownerId: w.ownerId, projectId: w.projectId,
        siteConfigId: version.siteConfigId, status: "published", version: 2n, documentId: doc, createdAt: Date.now() });
      await ctx.db.patch("site_configs", version.siteConfigId, { status: "published", hostname, currentVersionId: liveVersion });
      return doc;
    });
    const newer = await w.t.run((ctx) => ctx.db.insert("documents", { ...w.landingDoc, supersedesDocumentId: w.documentId }));
    await w.write(newer);
    await expect(w.owner.mutation(internal.platform.sites.publish.rollbackCore, { projectId: w.projectId, toVersion: 3n })).rejects.toThrow(/RESOURCE_NOT_FOUND/);
    expect(await w.owner.mutation(internal.platform.sites.publish.publishCore, { projectId: w.projectId, slug: "hydrotrail" }))
      .toMatchObject({ created: false, version: 2n });
    expect(await w.t.query(api.platform.sites.read.resolvePublishedSite, { hostname })).toEqual({ renderSpec: "Already-published page" });
    const versions = await w.t.run((ctx) => ctx.db.query("site_versions").collect());
    expect(versions.filter((v) => v.status === "published").map((v) => v.documentId)).toEqual([liveDocument]);
  });
});
