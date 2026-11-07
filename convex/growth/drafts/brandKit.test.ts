/// <reference types="vite/client" />
/**
 * L1-C1. The owner-only brand kit read in convex-test, fixture mode: the
 * documents and cards are written directly from the HydroTrail fixture, so no
 * model is ever called. The launch writing a real kit that this query reads
 * is covered in `../../workspace/reviews.test.ts`.
 */
import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, test } from "vitest";

import { api } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import schema from "../../schema";
import { approvalExpiresAt } from "../../../lib/workspace/contracts/approvals";
import type { BrandKit } from "../../../lib/workspace/contracts/artifacts";
import { hydrotrailBrandKit, hydrotrailWizardAnswers } from "../../../lib/workspace/contracts/fixtures/hydrotrail";

const modules = import.meta.glob("/convex/**/*.ts");

type T = TestConvex<typeof schema>;
type Person = { readonly userId: Id<"users">; readonly sessionId: Id<"authSessions"> };
type World = { readonly t: T; readonly owner: Person; readonly opsId: Id<"ops_settings">; readonly projectId: Id<"projects"> };

async function person(t: T, email: string): Promise<Person> {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { email, emailVerificationTime: 1 });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: 9_999_999_999_999 });
    return { userId, sessionId };
  });
}

async function project(t: T, ownerId: Id<"users">, slug: string): Promise<Id<"projects">> {
  return await t.run(async (ctx) => {
    const wizardSessionId = await ctx.db.insert("wizard_sessions", {
      ownerId, ideaSlug: "hydrotrail", step: "partner_name", answers: hydrotrailWizardAnswers, startedAt: 1, updatedAt: 1, completedAt: 2,
    });
    const projectId = await ctx.db.insert("projects", {
      ownerId, source: "repository_idea", title: slug, status: "draft", idempotencyKey: `business:${slug}`,
      workspace: {
        version: 1, name: slug, slug, ideaSlug: "hydrotrail", platform: "web", commercialModel: "free",
        goal: "waitlist", partner: { personality: "strategist", name: "Wren" }, wizardSessionId, createdVia: "wizard",
      },
      createdAt: 1, updatedAt: 1,
    });
    await ctx.db.patch("wizard_sessions", wizardSessionId, { projectId });
    return projectId;
  });
}

async function world(): Promise<World> {
  const t = convexTest(schema, modules);
  const owner = await person(t, "owner@example.test");
  const opsId = await t.run(async (ctx) => {
    const adminId = await ctx.db.insert("users", { email: "admin@example.test" });
    return await ctx.db.insert("ops_settings", {
      ownerId: adminId, singletonKey: "workspace", workspaceEnabled: true, cohortMode: "open", freeSignupsOpen: false,
      globalDailyBudgetMicroUsd: 50_000_000n, paidGlobalDailyBudgetMicroUsd: 50_000_000n,
      killSwitches: { ai: false, studioVideo: true, publish: true, email: true, social: true, ads: true }, updatedAt: 1,
    });
  });
  return { t, owner, opsId, projectId: await project(t, owner.userId, "hydrotrail") };
}

const as = (w: World, who: Person = w.owner) =>
  w.t.withIdentity({ subject: `${who.userId}|${who.sessionId}`, issuer: "https://local.test" });

const view = async (w: World, who: Person = w.owner, projectId: Id<"projects"> = w.projectId) =>
  await as(w, who).query(api.growth.drafts.brandKit.brandKitDraft, { projectId });

type DocumentInput = { readonly body?: string; readonly at: number; readonly archivedAt?: number; readonly projectId?: Id<"projects"> };

async function kitDocument(w: World, input: DocumentInput): Promise<Id<"documents">> {
  return await w.t.run(async (ctx) => await ctx.db.insert("documents", {
    ownerId: w.owner.userId, projectId: input.projectId ?? w.projectId, kind: "brand_kit", format: "json", title: "Brand kit",
    body: input.body ?? JSON.stringify(hydrotrailBrandKit), createdAt: input.at, updatedAt: input.at,
    ...(input.archivedAt === undefined ? {} : { archivedAt: input.archivedAt }),
  }));
}

async function card(
  w: World,
  documentId: Id<"documents">,
  input: { readonly at: number; readonly status?: Doc<"approvals">["status"]; readonly round?: bigint; readonly kind?: Doc<"approvals">["kind"] },
): Promise<Id<"approvals">> {
  return await w.t.run(async (ctx) => await ctx.db.insert("approvals", {
    ownerId: w.owner.userId, projectId: w.projectId, kind: input.kind ?? "artifact_review", subjectTable: "documents",
    subjectId: documentId, status: input.status ?? "pending", changeRound: input.round ?? 0n, createdAt: input.at, updatedAt: input.at,
  }));
}

const renamed = (name: string): BrandKit => ({ ...hydrotrailBrandKit, name });

describe("L1-C1 brandKitDraft", () => {
  test("the owner sees the kit's fields and its card; nothing more", async () => {
    const w = await world();
    const documentId = await kitDocument(w, { at: 10 });
    const approvalId = await card(w, documentId, { at: 11 });
    const ready = await view(w);
    if (ready.state !== "ready") throw new Error(`expected ready, got ${JSON.stringify(ready)}`);
    const { schemaVersion, ...fields } = hydrotrailBrandKit;
    expect(schemaVersion).toBe(1);
    expect(ready.kit).toEqual(fields);
    expect(ready.card).toEqual({ approvalId, status: "pending", changeRound: 0n, expiresAt: approvalExpiresAt(11) });
    expect(Object.keys(ready).sort()).toEqual(["card", "kit", "state"]);
  });

  test("none when the business has no brand kit; a kit with no card reads a null card", async () => {
    const w = await world();
    expect(await view(w)).toEqual({ state: "none" });
    await kitDocument(w, { at: 10 });
    expect(await view(w)).toMatchObject({ state: "ready", card: null });
  });

  test("a body that does not parse reads unavailable, never other text", async () => {
    const w = await world();
    await kitDocument(w, { at: 10, body: "{not json" });
    expect(await view(w)).toEqual({ state: "unavailable" });
    await kitDocument(w, { at: 20, body: JSON.stringify({ ...hydrotrailBrandKit, palette: undefined }) });
    expect(await view(w)).toEqual({ state: "unavailable" });
  });

  test("the newest revision and its newest card win", async () => {
    const w = await world();
    const first = await kitDocument(w, { at: 10, body: JSON.stringify(renamed("Draft One")) });
    await card(w, first, { at: 11, status: "changes_requested" });
    const revision = await kitDocument(w, { at: 20, body: JSON.stringify(renamed("Draft Two")) });
    await card(w, revision, { at: 21, status: "cancelled", round: 1n });
    const newest = await card(w, revision, { at: 22, status: "approved", round: 1n });
    // A later edit to the older document never puts it ahead of its revision.
    await w.t.run(async (ctx) => await ctx.db.patch("documents", first, { updatedAt: 99 }));
    const ready = await view(w);
    expect(ready).toMatchObject({ state: "ready", kit: { name: "Draft Two" }, card: { approvalId: newest, status: "approved", changeRound: 1n } });
  });

  test("other card kinds are not the review card", async () => {
    const w = await world();
    const documentId = await kitDocument(w, { at: 10 });
    const review = await card(w, documentId, { at: 11 });
    await card(w, documentId, { at: 12, kind: "spend", round: 3n });
    expect(await view(w)).toMatchObject({ state: "ready", card: { approvalId: review, changeRound: 0n } });
  });

  test("archived documents are ignored", async () => {
    const w = await world();
    await kitDocument(w, { at: 10, body: JSON.stringify(renamed("Kept")) });
    await kitDocument(w, { at: 20, body: JSON.stringify(renamed("Archived")), archivedAt: 30 });
    expect(await view(w)).toMatchObject({ state: "ready", kit: { name: "Kept" } });
    const w2 = await world();
    await kitDocument(w2, { at: 20, archivedAt: 30 });
    expect(await view(w2)).toEqual({ state: "none" });
  });

  test("never shows another business of the same owner", async () => {
    const w = await world();
    const otherId = await project(w.t, w.owner.userId, "other");
    await kitDocument(w, { at: 10 });
    expect(await view(w, w.owner, otherId)).toEqual({ state: "none" });
  });

  test("refuses another owner, the workspace off and AI off", async () => {
    const w = await world();
    await kitDocument(w, { at: 10 });
    const stranger = await person(w.t, "stranger@example.test");
    await expect(view(w, stranger)).rejects.toThrow(/RESOURCE_NOT_FOUND/);
    await w.t.run(async (ctx) => await ctx.db.patch("ops_settings", w.opsId, { workspaceEnabled: false }));
    await expect(view(w)).rejects.toThrow(/WORKSPACE_DISABLED/);
    await w.t.run(async (ctx) => {
      const ops = await ctx.db.get("ops_settings", w.opsId);
      if (ops === null) throw new Error("no ops");
      await ctx.db.patch("ops_settings", w.opsId, { workspaceEnabled: true, killSwitches: { ...ops.killSwitches, ai: true } });
    });
    await expect(view(w)).rejects.toThrow(/AI_DISABLED/);
  });
});
