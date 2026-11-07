import { convexTest, type TestConvex } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import schema from "../../schema";
import { LEAD_RETENTION_WINDOW_MS } from "./retention";

const modules = import.meta.glob("/convex/**/*.ts");
const DAY = 24 * 60 * 60 * 1000;
const request = api.platform.sites.accountClosure.requestAccountClosure;
const next = internal.platform.sites.accountClosure.processNext;

beforeEach(() => {
  vi.useFakeTimers();
  process.env.TENANT_LEAD_DELETE_REQUESTS_ENABLED = "true";
});
afterEach(() => {
  delete process.env.TENANT_LEAD_DELETE_REQUESTS_ENABLED;
  vi.useRealTimers();
});

function asUser(t: TestConvex<typeof schema>, userId: Id<"users">, sessionId: Id<"authSessions">) {
  return t.withIdentity({ subject: `${userId}|${sessionId}`, issuer: "https://local.test" });
}

async function seed(t: TestConvex<typeof schema>, count = 0) {
  return await t.run(async (ctx) => {
    const now = Date.now();
    const ownerId = await ctx.db.insert("users", { email: "owner@example.test" });
    const otherId = await ctx.db.insert("users", { email: "other@example.test" });
    const sessionId = await ctx.db.insert("authSessions", {
      userId: ownerId, expirationTime: now + 60_000,
    });
    const otherSessionId = await ctx.db.insert("authSessions", {
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
    const projectIds: Id<"projects">[] = [];
    for (let n = 0; n < count; n += 1) {
      projectIds.push(await ctx.db.insert("projects", {
        ownerId, source: "own_idea", title: `Business ${n}`, status: "draft",
        idempotencyKey: `closure:${n}`, createdAt: now + n, updatedAt: now + n,
      }));
    }
    await ctx.db.insert("projects", {
      ownerId: otherId, source: "own_idea", title: "Other owner's business",
      status: "draft", idempotencyKey: "closure:other",
      createdAt: now, updatedAt: now,
    });
    return { ownerId, otherId, sessionId, otherSessionId, settingsId, projectIds };
  });
}

async function jobFor(t: TestConvex<typeof schema>, ownerId: Id<"users">) {
  return await t.run((ctx) => ctx.db.query("account_closure_jobs")
    .withIndex("by_ownerId", (q) => q.eq("ownerId", ownerId)).unique());
}

describe("WP78-S4e2b2 account closure", () => {
  test("request is dormant by default and requires a live session and enabled workspace", async () => {
    const t = convexTest(schema, modules);
    const ids = await seed(t, 1);
    delete process.env.TENANT_LEAD_DELETE_REQUESTS_ENABLED;
    await expect(asUser(t, ids.ownerId, ids.sessionId).mutation(request, {}))
      .rejects.toThrow("LEAD_RETENTION_NOT_ACTIVE");
    process.env.TENANT_LEAD_DELETE_REQUESTS_ENABLED = "true";
    await t.run((ctx) => ctx.db.patch(ids.sessionId, { expirationTime: Date.now() - 1 }));
    await expect(asUser(t, ids.ownerId, ids.sessionId).mutation(request, {}))
      .rejects.toThrow("UNAUTHENTICATED");
    await t.run(async (ctx) => {
      await ctx.db.patch(ids.sessionId, { expirationTime: Date.now() + 60_000 });
      await ctx.db.patch(ids.settingsId, { workspaceEnabled: false });
    });
    await expect(asUser(t, ids.ownerId, ids.sessionId).mutation(request, {}))
      .rejects.toThrow("WORKSPACE_DISABLED");
    expect(await jobFor(t, ids.ownerId)).toBeNull();
    expect((await t.run((ctx) => ctx.db.get(ids.ownerId)))?.accountClosureRequestedAt)
      .toBeUndefined();
  });

  test("one immutable owner epoch, one job and one audit survive replays", async () => {
    const t = convexTest(schema, modules);
    const ids = await seed(t, 1);
    const owner = asUser(t, ids.ownerId, ids.sessionId);
    const first = await owner.mutation(request, {});
    expect(first.alreadyRequested).toBe(false);
    const second = await owner.mutation(request, {});
    expect(second).toEqual({ ...first, alreadyRequested: true });
    expect((await t.run((ctx) => ctx.db.get(ids.ownerId)))?.accountClosureRequestedAt)
      .toBe(first.requestedAt);
    expect(await jobFor(t, ids.ownerId)).toMatchObject({
      requestedAt: first.requestedAt, state: "scheduled", projectsProcessed: 0,
    });
    const audit = await t.run((ctx) => ctx.db.query("audit_events").collect());
    expect(audit.map((row) => row.action)).toEqual(["account.closure_requested"]);
    expect(audit[0].ownerId).toBe(ids.ownerId);
    expect((await t.run((ctx) => ctx.db.get(ids.projectIds[0])))?.deletionRequestedAt)
      .toBeUndefined();
  });

  test("concurrent requests create one marker and the scheduled chain finishes", async () => {
    const t = convexTest(schema, modules);
    const ids = await seed(t, 2);
    const owner = asUser(t, ids.ownerId, ids.sessionId);
    const results = await Promise.all([owner.mutation(request, {}), owner.mutation(request, {})]);
    expect(results.filter((result) => !result.alreadyRequested)).toHaveLength(1);
    expect(new Set(results.map((result) => result.requestedAt)).size).toBe(1);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect((await jobFor(t, ids.ownerId))?.state).toBe("complete");
    const jobs = await t.run((ctx) => ctx.db.query("lead_retention_jobs")
      .withIndex("by_ownerId_and_projectId", (q) => q.eq("ownerId", ids.ownerId)).collect());
    expect(jobs).toHaveLength(2);
    expect(await t.run((ctx) => ctx.db.query("audit_events").collect()))
      .toHaveLength(3);
  });

  test("duplicate or mismatched jobs fail closed without changing the user marker", async () => {
    const t = convexTest(schema, modules);
    const ids = await seed(t);
    const owner = asUser(t, ids.ownerId, ids.sessionId);
    const first = await owner.mutation(request, {});
    const job = (await jobFor(t, ids.ownerId))!;
    await t.run((ctx) => ctx.db.patch(job._id, { requestedAt: first.requestedAt + 1 }));
    await expect(owner.mutation(request, {})).rejects.toThrow("ACCOUNT_CLOSURE_JOB_INCONSISTENT");
    await expect(t.mutation(next, { jobId: job._id }))
      .rejects.toThrow("ACCOUNT_CLOSURE_JOB_INCONSISTENT");
    await t.run(async (ctx) => {
      await ctx.db.patch(job._id, { requestedAt: first.requestedAt });
      await ctx.db.insert("account_closure_jobs", {
        ownerId: ids.ownerId, requestedAt: first.requestedAt,
        state: "scheduled", nextAttemptAt: first.requestedAt,
        attempts: 0, projectsProcessed: 0,
        createdAt: first.requestedAt, updatedAt: first.requestedAt,
      });
    });
    await expect(owner.mutation(request, {})).rejects.toThrow("ACCOUNT_CLOSURE_DUPLICATE_JOB");
    await expect(t.mutation(next, { jobId: job._id }))
      .rejects.toThrow("ACCOUNT_CLOSURE_DUPLICATE_JOB");
    expect((await t.run((ctx) => ctx.db.get(ids.ownerId)))?.accountClosureRequestedAt)
      .toBe(first.requestedAt);
  });

  test("replays and early worker calls cannot multiply a delayed retry chain", async () => {
    const t = convexTest(schema, modules);
    const ids = await seed(t, 1);
    const owner = asUser(t, ids.ownerId, ids.sessionId);
    await owner.mutation(request, {});
    const job = (await jobFor(t, ids.ownerId))!;
    const now = Date.now();
    await t.run((ctx) => ctx.db.patch(ids.sessionId, { expirationTime: now + 2 * 60 * 60_000 }));
    await t.run((ctx) => ctx.db.patch(job._id, {
      nextAttemptAt: now + 60 * 60_000, updatedAt: now - 10 * 60_000,
    }));
    const scheduledCount = () => t.run(async (ctx) =>
      (await ctx.db.system.query("_scheduled_functions").collect()).length);
    const before = await scheduledCount();
    for (let n = 0; n < 5; n += 1) {
      expect((await owner.mutation(request, {})).alreadyRequested).toBe(true);
      expect(await t.mutation(next, { jobId: job._id })).toEqual({ processed: 0, more: true });
    }
    expect(await scheduledCount()).toBe(before);
    vi.setSystemTime(now + 60 * 60_000);
    await owner.mutation(request, {});
    await owner.mutation(request, {});
    expect(await scheduledCount()).toBe(before + 1);
  });

  test("a superseded wake cannot advance the recovered chain", async () => {
    const t = convexTest(schema, modules);
    const ids = await seed(t, 3);
    await asUser(t, ids.ownerId, ids.sessionId).mutation(request, {});
    const job = (await jobFor(t, ids.ownerId))!;
    const args = { jobId: job._id, wake: { attempts: job.attempts, updatedAt: job.updatedAt } };

    await expect(t.mutation(next, args)).resolves.toEqual({ processed: 1, more: true });
    await expect(t.mutation(next, args)).resolves.toEqual({ processed: 0, more: true });
    expect(await jobFor(t, ids.ownerId)).toMatchObject({ projectsProcessed: 1, attempts: 1 });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await jobFor(t, ids.ownerId)).toMatchObject({ projectsProcessed: 3, state: "complete" });
  });

  test("bounded fan-out includes archived projects, converts legacy jobs, and preserves an earlier deadline while off", async () => {
    const t = convexTest(schema, modules);
    const ids = await seed(t, 3);
    const earlier = Date.now() - 5 * DAY;
    const archivedAt = Date.now() - 31 * DAY;
    const legacyId = await t.run(async (ctx) => {
      await ctx.db.patch(ids.projectIds[0], { archivedAt: earlier, deletionRequestedAt: earlier });
      await ctx.db.insert("lead_retention_jobs", {
        ownerId: ids.ownerId, projectId: ids.projectIds[0],
        deletionRequestedAt: earlier, deleteDueAt: earlier + LEAD_RETENTION_WINDOW_MS,
        nextAttemptAt: earlier + LEAD_RETENTION_WINDOW_MS,
        state: "scheduled", attempts: 0, processedCount: 0,
        createdAt: earlier, updatedAt: earlier,
      });
      await ctx.db.patch(ids.projectIds[1], { archivedAt });
      return await ctx.db.insert("lead_retention_jobs", {
        ownerId: ids.ownerId, projectId: ids.projectIds[1], archivedAt,
        deleteDueAt: archivedAt + LEAD_RETENTION_WINDOW_MS,
        nextAttemptAt: archivedAt + LEAD_RETENTION_WINDOW_MS,
        state: "scheduled", attempts: 0, processedCount: 0,
        createdAt: archivedAt, updatedAt: archivedAt,
      });
    });
    const requested = await asUser(t, ids.ownerId, ids.sessionId).mutation(request, {});
    await t.run((ctx) => ctx.db.patch(ids.settingsId, { workspaceEnabled: false }));
    const closure = (await jobFor(t, ids.ownerId))!;
    const pages = [];
    let page;
    do {
      page = await t.mutation(next, { jobId: closure._id });
      pages.push(page);
    } while (page.more && pages.length < 6);
    expect(pages.map((result) => result.processed)).toEqual([1, 1, 1, 0]);
    expect(pages.at(-1)?.more).toBe(false);
    const rows = await t.run(async (ctx) => Promise.all(ids.projectIds.map(async (id) => ({
      project: await ctx.db.get(id),
      jobs: await ctx.db.query("lead_retention_jobs")
        .withIndex("by_projectId", (q) => q.eq("projectId", id)).collect(),
    }))));
    expect(rows[0].project?.deletionRequestedAt).toBe(earlier);
    expect(rows[0].jobs[0].deleteDueAt).toBe(earlier + LEAD_RETENTION_WINDOW_MS);
    expect(rows[1].project?.archivedAt).toBe(archivedAt);
    expect(rows[1].project?.deletionRequestedAt).toBe(requested.requestedAt);
    expect(rows[1].jobs).toHaveLength(1);
    expect(rows[1].jobs[0]._id).toBe(legacyId);
    expect(rows[1].jobs[0].deleteDueAt).toBe(requested.requestedAt + LEAD_RETENTION_WINDOW_MS);
    expect(rows[2].project?.archivedAt).toBe(requested.requestedAt);
    expect(rows[2].jobs[0].deleteDueAt).toBe(requested.requestedAt + LEAD_RETENTION_WINDOW_MS);
    expect((await jobFor(t, ids.ownerId))?.state).toBe("complete");
    expect((await jobFor(t, ids.ownerId))?.projectsProcessed).toBe(3);
    const otherJobs = await t.run((ctx) => ctx.db.query("lead_retention_jobs")
      .withIndex("by_ownerId_and_projectId", (q) => q.eq("ownerId", ids.otherId)).collect());
    expect(otherJobs).toHaveLength(0);
  });

  test("a late project is seen by the continuing cursor after the first page", async () => {
    const t = convexTest(schema, modules);
    const ids = await seed(t, 2);
    await asUser(t, ids.ownerId, ids.sessionId).mutation(request, {});
    const closure = (await jobFor(t, ids.ownerId))!;
    await t.mutation(next, { jobId: closure._id });
    const lateId = await t.run((ctx) => ctx.db.insert("projects", {
      ownerId: ids.ownerId, source: "own_idea", title: "Late business", status: "draft",
      idempotencyKey: "closure:late", createdAt: Date.now(), updatedAt: Date.now(),
    }));
    let result;
    do { result = await t.mutation(next, { jobId: closure._id }); } while (result.more);
    expect((await t.run((ctx) => ctx.db.get(lateId)))?.deletionRequestedAt)
      .toBe(closure.requestedAt);
    expect((await jobFor(t, ids.ownerId))?.state).toBe("complete");
    const jobs = await t.run((ctx) => ctx.db.query("lead_retention_jobs")
      .withIndex("by_projectId", (q) => q.eq("projectId", ids.projectIds[0])).collect());
    expect(jobs).toHaveLength(1);
  });

  test("a corrupt cursor restarts once, then records a second failure without looping", async () => {
    const t = convexTest(schema, modules);
    const ids = await seed(t, 2);
    await asUser(t, ids.ownerId, ids.sessionId).mutation(request, {});
    const closure = (await jobFor(t, ids.ownerId))!;
    await t.mutation(next, { jobId: closure._id });
    await t.run((ctx) => ctx.db.patch(closure._id, { cursor: "invalid-cursor" }));
    expect(await t.mutation(next, { jobId: closure._id }))
      .toEqual({ processed: 0, more: true });
    expect((await jobFor(t, ids.ownerId))?.cursor).toBeUndefined();
    expect((await jobFor(t, ids.ownerId))?.cursorResetAt).toBeDefined();
    await t.mutation(next, { jobId: closure._id });
    await t.run((ctx) => ctx.db.patch(closure._id, { cursor: "invalid-again" }));
    expect(await t.mutation(next, { jobId: closure._id }))
      .toEqual({ processed: 0, more: true });
    expect((await jobFor(t, ids.ownerId))?.lastErrorCode)
      .toBe("ACCOUNT_CLOSURE_CURSOR_INVALID");
  });

  test("inconsistent per-project job records a bounded retry without advancing the cursor or archiving", async () => {
    const t = convexTest(schema, modules);
    const ids = await seed(t, 1);
    await asUser(t, ids.ownerId, ids.sessionId).mutation(request, {});
    const closure = (await jobFor(t, ids.ownerId))!;
    const badJobId = await t.run((ctx) => ctx.db.insert("lead_retention_jobs", {
      ownerId: ids.ownerId, projectId: ids.projectIds[0],
      deletionRequestedAt: Date.now() - DAY,
      deleteDueAt: Date.now() + 29 * DAY,
      nextAttemptAt: Date.now() + 29 * DAY,
      state: "scheduled", attempts: 0, processedCount: 0,
      createdAt: Date.now(), updatedAt: Date.now(),
    }));
    expect(await t.mutation(next, { jobId: closure._id }))
      .toEqual({ processed: 0, more: true });
    expect((await jobFor(t, ids.ownerId))?.cursor).toBeUndefined();
    expect((await jobFor(t, ids.ownerId))?.lastErrorCode)
      .toBe("ACCOUNT_CLOSURE_PROJECT_RETRY");
    expect((await jobFor(t, ids.ownerId))?.nextAttemptAt).toBe(Date.now() + 60_000);
    expect((await t.run((ctx) => ctx.db.get(ids.projectIds[0])))?.archivedAt)
      .toBeUndefined();
    await t.run((ctx) => ctx.db.delete(badJobId));
    vi.setSystemTime(Date.now() + 60_000);
    expect(await t.mutation(next, { jobId: closure._id }))
      .toEqual({ processed: 1, more: true });
    expect((await t.run((ctx) => ctx.db.get(ids.projectIds[0])))?.deletionRequestedAt)
      .toBe(closure.requestedAt);
  });
});
