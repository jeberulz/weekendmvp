import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import schema from "../../schema";
import { csvCell, leadCsvRow } from "../../../lib/tenant-lead-csv";

const modules = import.meta.glob("/convex/**/*.ts");

async function seed(t: TestConvex<typeof schema>) {
  return await t.run(async (ctx) => {
    const ownerId = await ctx.db.insert("users", { email: "owner@example.test" });
    const otherId = await ctx.db.insert("users", { email: "other@example.test" });
    const ownerSession = await ctx.db.insert("authSessions", { userId: ownerId, expirationTime: Date.now() + 60_000 });
    const otherSession = await ctx.db.insert("authSessions", { userId: otherId, expirationTime: Date.now() + 60_000 });
    await ctx.db.insert("ops_settings", {
      ownerId, singletonKey: "workspace", workspaceEnabled: true,
      cohortMode: "open", freeSignupsOpen: false,
      globalDailyBudgetMicroUsd: 0n, paidGlobalDailyBudgetMicroUsd: 0n,
      killSwitches: { ai: true, studioVideo: true, publish: true, email: true, social: true, ads: true },
      updatedAt: Date.now(),
    });
    const projectId = await ctx.db.insert("projects", {
      ownerId, title: "HydroTrail", source: "own_idea", status: "draft",
      idempotencyKey: "wp78:leads:test", createdAt: Date.now(), updatedAt: Date.now(),
    });
    const siteConfigId = await ctx.db.insert("site_configs", {
      ownerId, projectId, status: "published", hostname: "hydrotrail.weekendmvp.app",
      createdAt: Date.now(), updatedAt: Date.now(),
    });
    const leadId = await ctx.db.insert("leads", {
      ownerId, projectId, siteConfigId, synthetic: false,
      email: "lead@example.test", consentText: "Join the waitlist", consentVersion: "v1",
      source: "landing", createdAt: 1,
    });
    await ctx.db.insert("leads", {
      ownerId, projectId, siteConfigId, synthetic: true, createdAt: 2,
    });
    await ctx.db.insert("leads", {
      ownerId, projectId, siteConfigId, synthetic: false,
      email: "next@example.test", consentText: "Join the waitlist", consentVersion: "v1",
      createdAt: 3,
    });
    return { ownerId, ownerSession, otherId, otherSession, projectId, leadId };
  });
}

function asUser(t: TestConvex<typeof schema>, userId: Id<"users">, sessionId: Id<"authSessions">) {
  return t.withIdentity({ subject: `${userId}|${sessionId}`, issuer: "https://local.test" });
}

describe("WP78 lead lifecycle", () => {
  test("owner can paginate every real lead without synthetic rows", async () => {
    const t = convexTest(schema, modules);
    const ids = await seed(t);
    const owner = asUser(t, ids.ownerId, ids.ownerSession);
    let cursor: string | null = null;
    const emails: string[] = [];
    for (let i = 0; i < 4; i += 1) {
      const result: { page: Array<{ email: string }>; isDone: boolean; continueCursor: string } =
        await owner.query(api.platform.sites.leads.exportPage, {
        projectId: ids.projectId, paginationOpts: { cursor, numItems: 1 },
      });
      emails.push(...result.page.map((lead) => lead.email));
      if (result.isDone) break;
      cursor = result.continueCursor;
    }
    expect(emails).toEqual(["lead@example.test", "next@example.test"]);
    await expect(asUser(t, ids.otherId, ids.otherSession).query(
      api.platform.sites.leads.exportPage,
      { projectId: ids.projectId, paginationOpts: { cursor: null, numItems: 10 } },
    )).rejects.toThrow("RESOURCE_NOT_FOUND");
  });

  test("per-contact delete erases PII and blocks repeat export", async () => {
    const t = convexTest(schema, modules);
    const ids = await seed(t);
    const owner = asUser(t, ids.ownerId, ids.ownerSession);
    await expect(asUser(t, ids.otherId, ids.otherSession).mutation(
      api.platform.sites.leads.deleteContact, { leadId: ids.leadId },
    )).rejects.toThrow("RESOURCE_NOT_FOUND");
    expect(await owner.mutation(api.platform.sites.leads.deleteContact, { leadId: ids.leadId }))
      .toEqual({ deleted: true });
    expect(await owner.mutation(api.platform.sites.leads.deleteContact, { leadId: ids.leadId }))
      .toEqual({ deleted: false });
    const lead = await t.run(async (ctx) => await ctx.db.get(ids.leadId));
    expect(lead?.email).toBeUndefined();
    expect(lead?.source).toBeUndefined();
    expect(lead?.consentText).toBeUndefined();
    expect(lead?.deletedAt).toBeTypeOf("number");
    expect(lead?.unsubscribedAt).toBe(lead?.deletedAt);
    const exportResult = await owner.query(api.platform.sites.leads.exportPage, {
      projectId: ids.projectId, paginationOpts: { cursor: null, numItems: 20 },
    });
    expect(exportResult.page.map((row) => row.email)).toEqual(["next@example.test"]);
  });

  test("owner export and delete remain available after workspace shutdown", async () => {
    const t = convexTest(schema, modules);
    const ids = await seed(t);
    await t.run(async (ctx) => {
      const settings = await ctx.db.query("ops_settings").first();
      if (!settings) throw new Error("missing settings fixture");
      await ctx.db.patch(settings._id, { workspaceEnabled: false, cohortMode: "allowlist" });
    });
    const owner = asUser(t, ids.ownerId, ids.ownerSession);
    const before = await owner.query(api.platform.sites.leads.exportPage, {
      projectId: ids.projectId, paginationOpts: { cursor: null, numItems: 10 },
    });
    expect(before.page.map((row) => row.email)).toEqual(["lead@example.test", "next@example.test"]);
    expect(await owner.mutation(api.platform.sites.leads.deleteContact, {
      leadId: ids.leadId,
    })).toEqual({ deleted: true });
    const after = await owner.query(api.platform.sites.leads.exportPage, {
      projectId: ids.projectId, paginationOpts: { cursor: null, numItems: 10 },
    });
    expect(after.page.map((row) => row.email)).toEqual(["next@example.test"]);
    await expect(asUser(t, ids.otherId, ids.otherSession).mutation(
      api.platform.sites.leads.deleteContact, { leadId: ids.leadId },
    )).rejects.toThrow("RESOURCE_NOT_FOUND");
  });

  test("expired owner session cannot erase a contact", async () => {
    const t = convexTest(schema, modules);
    const ids = await seed(t);
    await t.run(async (ctx) => ctx.db.patch(ids.ownerSession, {
      expirationTime: Date.now() - 1,
    }));
    await expect(asUser(t, ids.ownerId, ids.ownerSession).mutation(
      api.platform.sites.leads.deleteContact, { leadId: ids.leadId },
    )).rejects.toThrow("UNAUTHENTICATED");
    expect((await t.run(async (ctx) => ctx.db.get(ids.leadId)))?.email).toBe("lead@example.test");
  });

  test("CSV escapes quotes, line breaks and spreadsheet formula fields", () => {
    expect(csvCell('He said "hello"\nagain')).toBe('"He said ""hello""\nagain"');
    const row = leadCsvRow({
      id: "lead-1", email: "lead@example.test", createdAt: 0,
      source: '=HYPERLINK("https://attacker.example")',
    });
    expect(row).toContain('"\'=HYPERLINK(""https://attacker.example"")"');
    expect(row.endsWith("\r\n")).toBe(true);
  });

  test("archived project purge waits 30 days and drains bounded batches", async () => {
    const t = convexTest(schema, modules);
    const ids = await seed(t);
    expect(await t.mutation(internal.platform.sites.retention.purgeArchivedProjectLeads,
      { projectId: ids.projectId })).toEqual({ deleted: 0, more: false });
    await t.run(async (ctx) => ctx.db.patch(ids.projectId, {
      archivedAt: Date.now() - 29 * 24 * 60 * 60 * 1000,
    }));
    expect(await t.mutation(internal.platform.sites.retention.purgeArchivedProjectLeads,
      { projectId: ids.projectId })).toEqual({ deleted: 0, more: false });
    await t.run(async (ctx) => {
      await ctx.db.patch(ids.projectId, {
        archivedAt: Date.now() - 31 * 24 * 60 * 60 * 1000,
      });
      const settings = await ctx.db.query("ops_settings").first();
      if (!settings) throw new Error("missing settings fixture");
      await ctx.db.patch(settings._id, { workspaceEnabled: false, cohortMode: "allowlist" });
      const site = await ctx.db.query("site_configs").first();
      if (!site) throw new Error("missing site fixture");
      for (let i = 0; i < 118; i += 1) {
        await ctx.db.insert("leads", {
          ownerId: ids.ownerId, projectId: ids.projectId, siteConfigId: site._id,
          synthetic: true, createdAt: 100 + i,
        });
      }
    });
    const purge = (projectId: Id<"projects">) =>
      t.mutation(internal.platform.sites.retention.purgeArchivedProjectLeads, { projectId });
    expect(await purge(ids.projectId)).toEqual({ deleted: 50, more: true });
    expect(await purge(ids.projectId)).toEqual({ deleted: 50, more: true });
    expect(await purge(ids.projectId)).toEqual({ deleted: 21, more: false });
    expect(await purge(ids.projectId)).toEqual({ deleted: 0, more: false });
    const remaining = await t.run(async (ctx) => ctx.db.query("leads")
      .withIndex("by_projectId_and_createdAt", (q) => q.eq("projectId", ids.projectId)).collect());
    expect(remaining).toHaveLength(0);
  });

  test("purge refuses cross-owner lead data and leaves the batch untouched", async () => {
    const t = convexTest(schema, modules);
    const ids = await seed(t);
    await t.run(async (ctx) => {
      await ctx.db.patch(ids.projectId, {
        archivedAt: Date.now() - 31 * 24 * 60 * 60 * 1000,
      });
      await ctx.db.patch(ids.leadId, { ownerId: ids.otherId });
    });
    await expect(t.mutation(internal.platform.sites.retention.purgeArchivedProjectLeads,
      { projectId: ids.projectId })).rejects.toThrow("LEAD_OWNER_MISMATCH");
    expect(await t.run(async (ctx) => ctx.db.get(ids.leadId))).not.toBeNull();
  });
});
