import { convexTest, type TestConvex } from "convex-test";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { api } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import schema from "../../schema";
import { LEAD_RETENTION_WINDOW_MS } from "./retention";

const modules = import.meta.glob("/convex/**/*.ts");
const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => { process.env.TENANT_LEAD_DELETE_REQUESTS_ENABLED = "true"; });
afterEach(() => { delete process.env.TENANT_LEAD_DELETE_REQUESTS_ENABLED; });

function asUser(t: TestConvex<typeof schema>, userId: Id<"users">, sessionId: Id<"authSessions">) {
  return t.withIdentity({ subject: `${userId}|${sessionId}`, issuer: "https://local.test" });
}

async function seed(t: TestConvex<typeof schema>, archivedAt?: number) {
  return await t.run(async (ctx) => {
    const now = Date.now();
    const ownerId = await ctx.db.insert("users", { email: "owner@example.test" });
    const otherId = await ctx.db.insert("users", { email: "other@example.test" });
    const ownerSession = await ctx.db.insert("authSessions", {
      userId: ownerId, expirationTime: now + 60_000,
    });
    const otherSession = await ctx.db.insert("authSessions", {
      userId: otherId, expirationTime: now + 60_000,
    });
    const settingsId = await ctx.db.insert("ops_settings", {
      ownerId, singletonKey: "workspace", workspaceEnabled: true,
      cohortMode: "open", freeSignupsOpen: false,
      globalDailyBudgetMicroUsd: 0n, paidGlobalDailyBudgetMicroUsd: 0n,
      killSwitches: {
        ai: true, studioVideo: true, publish: true, email: true, social: true, ads: true,
      },
      updatedAt: now,
    });
    const projectId = await ctx.db.insert("projects", {
      ownerId, title: "HydroTrail", source: "own_idea", status: "draft",
      idempotencyKey: "wp78:delete-request:test", createdAt: now, updatedAt: now,
      ...(archivedAt === undefined ? {} : { archivedAt }),
    });
    const siteConfigId = await ctx.db.insert("site_configs", {
      ownerId, projectId, status: "published", hostname: "hydrotrail.weekendmvp.app",
      createdAt: now, updatedAt: now,
    });
    const leadId = await ctx.db.insert("leads", {
      ownerId, projectId, siteConfigId, synthetic: true, createdAt: now,
    });
    return { ownerId, otherId, ownerSession, otherSession, settingsId, projectId, leadId };
  });
}

async function jobs(t: TestConvex<typeof schema>) {
  return await t.run((ctx) => ctx.db.query("lead_retention_jobs").collect());
}

describe("requestBusinessDeletion", () => {
  test("is dormant by default and cannot create a job", async () => {
    const t = convexTest(schema, modules);
    const ids = await seed(t);
    for (const value of [undefined, "TRUE", "1"]) {
      if (value === undefined) delete process.env.TENANT_LEAD_DELETE_REQUESTS_ENABLED;
      else process.env.TENANT_LEAD_DELETE_REQUESTS_ENABLED = value;
      await expect(asUser(t, ids.ownerId, ids.ownerSession).mutation(
        api.platform.sites.retention.requestBusinessDeletion, { projectId: ids.projectId },
      )).rejects.toThrow("LEAD_RETENTION_NOT_ACTIVE");
    }
    expect(await jobs(t)).toHaveLength(0);
    expect((await t.run((ctx) => ctx.db.get(ids.projectId)))?.archivedAt).toBeUndefined();
  });

  test("sets one fixed deadline, archives the business and audits once on replay", async () => {
    const t = convexTest(schema, modules);
    const ids = await seed(t);
    const owner = asUser(t, ids.ownerId, ids.ownerSession);
    const first = await owner.mutation(api.platform.sites.retention.requestBusinessDeletion,
      { projectId: ids.projectId });
    expect(first.alreadyRequested).toBe(false);
    expect(first.deleteDueAt).toBe(first.deletionRequestedAt + LEAD_RETENTION_WINDOW_MS);
    const project = await t.run((ctx) => ctx.db.get(ids.projectId));
    expect(project?.deletionRequestedAt).toBe(first.deletionRequestedAt);
    expect(project?.archivedAt).toBe(first.deletionRequestedAt);
    const [job] = await jobs(t);
    expect(job.deletionRequestedAt).toBe(first.deletionRequestedAt);
    expect(job.deleteDueAt).toBe(first.deleteDueAt);
    expect(job.nextAttemptAt).toBe(first.deleteDueAt);
    expect(job.archivedAt).toBeUndefined();
    expect((await t.run((ctx) => ctx.db.get(ids.leadId)))?.synthetic).toBe(true);

    const replay = await owner.mutation(api.platform.sites.retention.requestBusinessDeletion,
      { projectId: ids.projectId });
    expect(replay).toEqual({ ...first, alreadyRequested: true });
    expect(await jobs(t)).toHaveLength(1);
    const audit = await t.run((ctx) => ctx.db.query("audit_events").collect());
    expect(audit).toHaveLength(1);
    expect(audit[0].action).toBe("business.deletion_requested");
    expect(audit[0].metadata).toBeUndefined();
  });

  test("founder can still export and erase a contact after the business is archived", async () => {
    const t = convexTest(schema, modules);
    const ids = await seed(t);
    const realLeadId = await t.run(async (ctx) => ctx.db.insert("leads", {
      ownerId: ids.ownerId, projectId: ids.projectId,
      siteConfigId: (await ctx.db.get(ids.leadId))!.siteConfigId,
      synthetic: false, email: "lead@example.test",
      consentText: "Join the waitlist", consentVersion: "v1", createdAt: Date.now(),
    }));
    const owner = asUser(t, ids.ownerId, ids.ownerSession);
    await owner.mutation(api.platform.sites.retention.requestBusinessDeletion,
      { projectId: ids.projectId });
    await t.run((ctx) => ctx.db.patch(ids.settingsId, { workspaceEnabled: false }));

    const exportPage = await owner.query(api.platform.sites.leads.exportPage, {
      projectId: ids.projectId, paginationOpts: { cursor: null, numItems: 100 },
    });
    expect(exportPage.page.map((row) => row.id)).toContain(realLeadId);
    expect(await owner.mutation(api.platform.sites.leads.deleteContact,
      { leadId: realLeadId })).toEqual({ deleted: true });
    expect((await t.run((ctx) => ctx.db.get(realLeadId)))?.email).toBeUndefined();
  });

  test("an ordinary archive does not start the clock; an explicit request resets a legacy job", async () => {
    const t = convexTest(schema, modules);
    const archivedAt = Date.now() - 31 * DAY;
    const ids = await seed(t, archivedAt);
    const oldJobId = await t.run(async (ctx) => await ctx.db.insert("lead_retention_jobs", {
      ownerId: ids.ownerId, projectId: ids.projectId, archivedAt,
      deleteDueAt: archivedAt + LEAD_RETENTION_WINDOW_MS,
      nextAttemptAt: archivedAt + LEAD_RETENTION_WINDOW_MS,
      state: "scheduled", attempts: 0, processedCount: 0,
      createdAt: archivedAt, updatedAt: archivedAt,
    }));
    expect((await t.run((ctx) => ctx.db.get(ids.projectId)))?.deletionRequestedAt).toBeUndefined();
    const result = await asUser(t, ids.ownerId, ids.ownerSession).mutation(
      api.platform.sites.retention.requestBusinessDeletion, { projectId: ids.projectId });
    expect(result.deletionRequestedAt).toBeGreaterThan(archivedAt);
    expect(result.deleteDueAt).toBe(result.deletionRequestedAt + LEAD_RETENTION_WINDOW_MS);
    const [job] = await jobs(t);
    expect(job._id).toBe(oldJobId);
    expect(job.archivedAt).toBeUndefined();
    expect(job.deleteDueAt).toBe(result.deleteDueAt);
    expect((await t.run((ctx) => ctx.db.get(ids.projectId)))?.archivedAt).toBe(archivedAt);
  });

  test("rejects another owner, expired session and a disabled workspace", async () => {
    const t = convexTest(schema, modules);
    const ids = await seed(t);
    await expect(asUser(t, ids.otherId, ids.otherSession).mutation(
      api.platform.sites.retention.requestBusinessDeletion, { projectId: ids.projectId },
    )).rejects.toThrow("RESOURCE_NOT_FOUND");
    await t.run((ctx) => ctx.db.patch(ids.ownerSession, { expirationTime: Date.now() - 1 }));
    await expect(asUser(t, ids.ownerId, ids.ownerSession).mutation(
      api.platform.sites.retention.requestBusinessDeletion, { projectId: ids.projectId },
    )).rejects.toThrow("UNAUTHENTICATED");
    await t.run(async (ctx) => {
      await ctx.db.patch(ids.ownerSession, { expirationTime: Date.now() + 60_000 });
      await ctx.db.patch(ids.settingsId, { workspaceEnabled: false });
    });
    await expect(asUser(t, ids.ownerId, ids.ownerSession).mutation(
      api.platform.sites.retention.requestBusinessDeletion, { projectId: ids.projectId },
    )).rejects.toThrow("WORKSPACE_DISABLED");
    expect(await jobs(t)).toHaveLength(0);
  });

  test("duplicate or inconsistent jobs refuse before any project write", async () => {
    const t = convexTest(schema, modules);
    const ids = await seed(t);
    const now = Date.now();
    const insertJob = () => t.run((ctx) => ctx.db.insert("lead_retention_jobs", {
      ownerId: ids.ownerId, projectId: ids.projectId, archivedAt: now,
      deleteDueAt: now + LEAD_RETENTION_WINDOW_MS,
      nextAttemptAt: now + LEAD_RETENTION_WINDOW_MS,
      state: "scheduled", attempts: 0, processedCount: 0,
      createdAt: now, updatedAt: now,
    }));
    const firstJobId = await insertJob();
    const secondJobId = await insertJob();
    await expect(asUser(t, ids.ownerId, ids.ownerSession).mutation(
      api.platform.sites.retention.requestBusinessDeletion, { projectId: ids.projectId },
    )).rejects.toThrow("LEAD_RETENTION_DUPLICATE_JOB");
    expect((await t.run((ctx) => ctx.db.get(ids.projectId)))?.deletionRequestedAt).toBeUndefined();

    await t.run(async (ctx) => {
      await ctx.db.delete(secondJobId);
      await ctx.db.patch(firstJobId, { attempts: 1 });
    });
    await expect(asUser(t, ids.ownerId, ids.ownerSession).mutation(
      api.platform.sites.retention.requestBusinessDeletion, { projectId: ids.projectId },
    )).rejects.toThrow("LEAD_RETENTION_JOB_INCONSISTENT");
    expect((await t.run((ctx) => ctx.db.get(ids.projectId)))?.deletionRequestedAt).toBeUndefined();
  });

  test("a mismatched replay never resets the original request or deadline", async () => {
    const t = convexTest(schema, modules);
    const ids = await seed(t);
    const owner = asUser(t, ids.ownerId, ids.ownerSession);
    const first = await owner.mutation(api.platform.sites.retention.requestBusinessDeletion,
      { projectId: ids.projectId });
    const [job] = await jobs(t);
    await t.run((ctx) => ctx.db.patch(job._id, { deleteDueAt: first.deleteDueAt + 1 }));

    await expect(owner.mutation(api.platform.sites.retention.requestBusinessDeletion,
      { projectId: ids.projectId })).rejects.toThrow("LEAD_RETENTION_JOB_INCONSISTENT");
    expect((await t.run((ctx) => ctx.db.get(ids.projectId)))?.deletionRequestedAt)
      .toBe(first.deletionRequestedAt);
    expect(await jobs(t)).toHaveLength(1);
    expect(await t.run((ctx) => ctx.db.query("audit_events").collect())).toHaveLength(1);
  });
});
