import { register as registerResend } from "@convex-dev/resend/test";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { components, internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import crons from "../../crons";
import schema from "../../schema";
import { LEAD_RETENTION_WINDOW_MS } from "../../platform/sites/retention";

const modules = import.meta.glob("/convex/**/*.ts");
const driver = internal.growth.email.retentionDriver;
const closure = internal.platform.sites.accountClosure;
const HOUR = 60 * 60 * 1000;
const START = Date.parse("2026-11-07T12:00:00Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function setup() {
  const t = convexTest(schema, modules);
  registerResend(t);
  return t;
}

async function seedOwner(t: ReturnType<typeof setup>, requestedAt?: number) {
  return await t.run(async (ctx) => {
    const ownerId = await ctx.db.insert("users", {
      email: "founder@example.test", accountClosureRequestedAt: requestedAt,
    });
    await ctx.db.insert("ops_settings", {
      ownerId, singletonKey: "workspace", workspaceEnabled: false,
      cohortMode: "allowlist", freeSignupsOpen: false,
      globalDailyBudgetMicroUsd: 0n, paidGlobalDailyBudgetMicroUsd: 0n,
      killSwitches: { ai: true, studioVideo: true, publish: true, email: true, social: true, ads: true },
      updatedAt: START,
    });
    return ownerId;
  });
}

async function seedProject(t: ReturnType<typeof setup>, ownerId: Id<"users">, key: string, epoch?: number) {
  return await t.run(async (ctx) => {
    const projectId = await ctx.db.insert("projects", {
      ownerId, source: "own_idea", title: "Business", status: "draft",
      idempotencyKey: key, createdAt: START, updatedAt: START,
      archivedAt: epoch, deletionRequestedAt: epoch,
    });
    const siteConfigId = await ctx.db.insert("site_configs", {
      ownerId, projectId, status: "draft", createdAt: START, updatedAt: START,
    });
    return { projectId, siteConfigId };
  });
}

async function seedLeadJob(
  t: ReturnType<typeof setup>, ownerId: Id<"users">, key: string,
  { dueAt, nextAttemptAt = dueAt, count = 1, invalidSite = false }: {
    dueAt: number; nextAttemptAt?: number; count?: number; invalidSite?: boolean;
  },
) {
  const epoch = dueAt - LEAD_RETENTION_WINDOW_MS;
  const { projectId, siteConfigId } = await seedProject(t, ownerId, key, epoch);
  return await t.run(async (ctx) => {
    if (invalidSite) await ctx.db.delete("site_configs", siteConfigId);
    const jobId = await ctx.db.insert("lead_retention_jobs", {
      ownerId, projectId, deletionRequestedAt: epoch, deleteDueAt: dueAt, nextAttemptAt,
      state: "scheduled", attempts: 0, processedCount: 0,
      createdAt: epoch, updatedAt: epoch,
    });
    const leadIds: Id<"leads">[] = [];
    for (let i = 0; i < count; i += 1) {
      leadIds.push(await ctx.db.insert("leads", {
        ownerId, projectId, siteConfigId, email: "contact@example.test", synthetic: false,
        createdAt: START + i,
      }));
    }
    return { jobId, projectId, leadIds };
  });
}

async function runSweep(t: ReturnType<typeof setup>) {
  await t.mutation(driver.sweep, {});
  await t.finishAllScheduledFunctions(vi.runAllTimers);
}

describe("WP79 hourly privacy driver", () => {
  test("registers the shared restore and hourly entry point", () => {
    const specs = JSON.parse((crons as unknown as { export: () => string }).export());
    expect(specs["tenant lead retention and closure recovery"]).toMatchObject({
      name: "growth/email/retentionDriver:sweep",
      schedule: { type: "interval", hours: 1 },
    });
  });

  test("walks past an entire page of archive-only jobs, drains due leads, and preserves the 30-day boundary", async () => {
    const t = setup();
    const fetch = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network disabled"));
    const owner = await seedOwner(t);
    const legacy = await seedProject(t, owner, "archive-only");
    const legacyLead = await t.run(async (ctx) => {
      const archivedAt = START - LEAD_RETENTION_WINDOW_MS - HOUR;
      await ctx.db.patch("projects", legacy.projectId, { archivedAt });
      for (let i = 0; i < 25; i += 1) {
        await ctx.db.insert("lead_retention_jobs", {
          ownerId: owner, projectId: legacy.projectId, archivedAt,
          deleteDueAt: START - HOUR, nextAttemptAt: START - HOUR,
          state: "scheduled", attempts: 0, processedCount: 0,
          createdAt: archivedAt, updatedAt: archivedAt,
        });
      }
      return await ctx.db.insert("leads", {
        ownerId: owner, projectId: legacy.projectId, siteConfigId: legacy.siteConfigId,
        synthetic: true, createdAt: archivedAt,
      });
    });
    const due = await seedLeadJob(t, owner, "due", { dueAt: START, count: 2 });
    const future = await seedLeadJob(t, owner, "future", { dueAt: START + 1 });
    const confirmationId = await t.mutation(components.resend.lib.createManualEmail, {
      from: "test@example.test", to: "contact@example.test", subject: "Confirmation",
    });
    await t.run(async (ctx) => {
      await ctx.db.insert("lead_email_tokens", {
        ownerId: owner, projectId: due.projectId, leadId: due.leadIds[0],
        tokenHash: "sha256:driver", purpose: "opt_in", componentEmailId: confirmationId,
        createdAt: START,
      });
      const sequenceId = await ctx.db.insert("sequences", {
        ownerId: owner, projectId: due.projectId,
        title: "Welcome", status: "draft", createdAt: START, updatedAt: START,
      });
      for (let i = 0; i < 17; i += 1) {
        await ctx.db.insert("enrollments", {
          ownerId: owner, projectId: due.projectId, leadId: due.leadIds[0],
          sequenceId, state: "completed", nextStepAt: START, createdAt: START, updatedAt: START,
        });
      }
    });
    expect(await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect()))
      .toHaveLength(0);

    await runSweep(t);

    expect(await t.run((ctx) => ctx.db.get(due.jobId)))
      .toMatchObject({ state: "complete", processedCount: 2, deleteDueAt: START });
    expect(await t.run((ctx) => ctx.db.get(legacyLead))).not.toBeNull();
    expect(await t.run((ctx) => ctx.db.get(future.leadIds[0]))).not.toBeNull();
    expect(await t.query(components.resend.lib.getStatus, { emailId: confirmationId }))
      .toMatchObject({ status: "cancelled" });
    expect(fetch).not.toHaveBeenCalled();
  });

  test("alerts on original deadlines through backoff, deduplicates, and keeps failed leads", async () => {
    const t = setup();
    const epoch = START - 2 * HOUR;
    const owner = await seedOwner(t, epoch);
    const dueAt = START - 2 * HOUR;
    const failed = await seedLeadJob(t, owner, "invalid-site", { dueAt, invalidSite: true });
    const backingOff = await seedLeadJob(t, owner, "backoff", { dueAt, nextAttemptAt: START + HOUR });
    const closureId = await t.run((ctx) => ctx.db.insert("account_closure_jobs", {
      ownerId: owner, requestedAt: epoch, nextAttemptAt: START + HOUR,
      state: "scheduled", attempts: 3, projectsProcessed: 0,
      createdAt: epoch, updatedAt: START,
    }));

    await runSweep(t);
    vi.advanceTimersByTime(1);
    await runSweep(t);

    expect(await t.run((ctx) => ctx.db.get(failed.jobId))).toMatchObject({
      state: "scheduled", attempts: 1, processedCount: 0, deleteDueAt: dueAt,
      nextAttemptAt: START + 60_000, lastErrorCode: "LEAD_RETENTION_SITE_MISMATCH",
    });
    expect(await t.run((ctx) => ctx.db.get(failed.leadIds[0]))).not.toBeNull();
    expect(await t.run((ctx) => ctx.db.get(backingOff.jobId)))
      .toMatchObject({ attempts: 0, nextAttemptAt: START + HOUR });
    expect(await t.run((ctx) => ctx.db.get(closureId)))
      .toMatchObject({ attempts: 3, nextAttemptAt: START + HOUR });
    const events = await t.run((ctx) => ctx.db.query("audit_events").collect());
    expect(events.map((event) => event.subjectId).sort())
      .toEqual([failed.jobId, backingOff.jobId, closureId].sort());
    for (const event of events) {
      expect(event).toMatchObject({
        ownerId: owner, actorType: "system",
        action: event.subjectId === closureId ? "ops.account_closure.overdue" : "ops.lead_retention.overdue",
        metadata: JSON.stringify({ deadline: dueAt, detectedAt: START }),
      });
    }
  });

  test("resumes a persisted closure cursor through the hourly entry point after its pending call is lost", async () => {
    const t = setup();
    const epoch = START - 2 * HOUR;
    const owner = await seedOwner(t, epoch);
    const projects = await Promise.all(["a", "b", "c"].map((key) => seedProject(t, owner, key)));
    const other = await t.run((ctx) => ctx.db.insert("users", {}));
    const foreign = await seedProject(t, other, "other");
    const jobId = await t.run((ctx) => ctx.db.insert("account_closure_jobs", {
      ownerId: owner, requestedAt: epoch, nextAttemptAt: epoch, state: "scheduled",
      attempts: 0, projectsProcessed: 0, createdAt: epoch, updatedAt: epoch,
    }));
    await t.mutation(closure.processNext, { jobId, wake: { attempts: 0, updatedAt: epoch } });
    const saved = await t.run(async (ctx) => {
      for (const call of await ctx.db.system.query("_scheduled_functions").collect()) {
        await ctx.scheduler.cancel(call._id);
      }
      return await ctx.db.get(jobId);
    });
    expect(saved).toMatchObject({ state: "scheduled", projectsProcessed: 1 });
    expect(saved?.cursor).toBeTypeOf("string");
    await runSweep(t);
    expect(await t.run((ctx) => ctx.db.get(jobId))).toMatchObject({ projectsProcessed: 1 });
    vi.setSystemTime(START + 6 * 60 * 1000);
    await runSweep(t);
    expect(await t.run((ctx) => ctx.db.get(jobId))).toMatchObject({
      state: "complete", projectsProcessed: 3, requestedAt: epoch,
    });
    const jobs = await t.run((ctx) => ctx.db.query("lead_retention_jobs").collect());
    expect(jobs.map((job) => job.projectId).sort()).toEqual(projects.map((p) => p.projectId).sort());
    expect(jobs.every((job) => job.deleteDueAt === epoch + LEAD_RETENTION_WINDOW_MS)).toBe(true);
    expect((await t.run((ctx) => ctx.db.get(foreign.projectId)))?.archivedAt).toBeUndefined();
  });
});
