import { ConvexError, v } from "convex/values";
import { internal } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import { env, internalMutation, mutation, type MutationCtx } from "../../_generated/server";
import { assertFeatureEnabled } from "../../ops/settings";
import { requireCurrentPlatformUserForMutation } from "../authz";
import { LEAD_RETENTION_WINDOW_MS } from "./retention";

const PAGE_SIZE = 1;
const RETRY_BASE_MS = 60 * 1000;
const RETRY_MAX_MS = 60 * RETRY_BASE_MS;
const REPLAY_WAKE_AFTER_MS = 5 * RETRY_BASE_MS;

function fail(code: string): never {
  throw new ConvexError({ code });
}

async function matchingClosureJob(ctx: MutationCtx, ownerId: Id<"users">) {
  const jobs = await ctx.db.query("account_closure_jobs")
    .withIndex("by_ownerId", (q) => q.eq("ownerId", ownerId))
    .take(2);
  if (jobs.length > 1) fail("ACCOUNT_CLOSURE_DUPLICATE_JOB");
  return jobs[0] ?? null;
}

function validEpoch(epoch: number): boolean {
  return Number.isSafeInteger(epoch) && epoch > 0 &&
    Number.isSafeInteger(epoch + LEAD_RETENTION_WINDOW_MS);
}

function retryDelayMs(job: Doc<"account_closure_jobs">): number {
  if (job.lastErrorCode !== "ACCOUNT_CLOSURE_PROJECT_RETRY" ||
      job.lastAttemptAt === undefined) return RETRY_BASE_MS;
  return Math.min(RETRY_MAX_MS,
    Math.max(RETRY_BASE_MS, job.nextAttemptAt - job.lastAttemptAt) * 2);
}

/**
 * Founder account-closure request. The D5 flag remains unset until the full
 * lead privacy gate; no production user can start this path in this slice.
 */
export const requestAccountClosure = mutation({
  args: {},
  returns: v.object({ requestedAt: v.number(), alreadyRequested: v.boolean() }),
  handler: async (ctx) => {
    await assertFeatureEnabled(ctx, "workspace");
    const user = await requireCurrentPlatformUserForMutation(ctx);
    if (env.TENANT_LEAD_DELETE_REQUESTS_ENABLED !== "true") {
      fail("LEAD_RETENTION_NOT_ACTIVE");
    }
    const job = await matchingClosureJob(ctx, user._id);
    const prior = user.accountClosureRequestedAt;
    if (prior !== undefined) {
      if (!validEpoch(prior) || job === null || job.requestedAt !== prior ||
          job.ownerId !== user._id ||
          (job.state === "scheduled" && job.completedAt !== undefined) ||
          (job.state === "complete" && job.completedAt === undefined)) {
        fail("ACCOUNT_CLOSURE_JOB_INCONSISTENT");
      }
      if (job.state === "scheduled" && Date.now() - job.updatedAt >= REPLAY_WAKE_AFTER_MS) {
        await ctx.scheduler.runAfter(0, internal.platform.sites.accountClosure.processNext, {
          jobId: job._id,
        });
      }
      return { requestedAt: prior, alreadyRequested: true };
    }
    if (job !== null) fail("ACCOUNT_CLOSURE_JOB_INCONSISTENT");

    const now = Date.now();
    if (!validEpoch(now)) fail("ACCOUNT_CLOSURE_JOB_INCONSISTENT");
    await ctx.db.patch("users", user._id, { accountClosureRequestedAt: now });
    const jobId = await ctx.db.insert("account_closure_jobs", {
      ownerId: user._id, requestedAt: now, nextAttemptAt: now,
      state: "scheduled", attempts: 0, projectsProcessed: 0,
      createdAt: now, updatedAt: now,
    });
    await ctx.db.insert("audit_events", {
      ownerId: user._id, actorType: "user", actorUserId: user._id,
      action: "account.closure_requested", subjectType: "user",
      subjectId: user._id, createdAt: now,
    });
    await ctx.scheduler.runAfter(0, internal.platform.sites.accountClosure.processNext, { jobId });
    return { requestedAt: now, alreadyRequested: false };
  },
});

async function scheduleProject(ctx: MutationCtx, job: Doc<"account_closure_jobs">, project: Doc<"projects">, now: number) {
  if (project.ownerId !== job.ownerId) fail("ACCOUNT_CLOSURE_PROJECT_MISMATCH");
  const jobs = await ctx.db.query("lead_retention_jobs")
    .withIndex("by_projectId", (q) => q.eq("projectId", project._id))
    .take(2);
  if (jobs.length > 1) fail("LEAD_RETENTION_DUPLICATE_JOB");
  const existing = jobs[0] ?? null;
  const prior = project.deletionRequestedAt;
  if (prior !== undefined) {
    if (!validEpoch(prior) || prior > job.requestedAt ||
        project.archivedAt === undefined || existing === null ||
        existing.ownerId !== job.ownerId || existing.deletionRequestedAt !== prior ||
        existing.archivedAt !== undefined ||
        existing.deleteDueAt !== prior + LEAD_RETENTION_WINDOW_MS ||
        existing.state === "cancelled" ||
        (existing.state === "complete" && existing.completedAt === undefined) ||
        (existing.state === "scheduled" && existing.completedAt !== undefined)) {
      fail("LEAD_RETENTION_JOB_INCONSISTENT");
    }
    return;
  }
  if (existing !== null && (
    existing.ownerId !== job.ownerId || project.archivedAt === undefined ||
    existing.deletionRequestedAt !== undefined ||
    existing.archivedAt !== project.archivedAt ||
    existing.deleteDueAt !== existing.archivedAt + LEAD_RETENTION_WINDOW_MS ||
    existing.state !== "scheduled" || existing.attempts !== 0 ||
    existing.processedCount !== 0 || existing.lastAttemptAt !== undefined ||
    existing.lastErrorCode !== undefined || existing.completedAt !== undefined ||
    existing.cancelledAt !== undefined
  )) fail("LEAD_RETENTION_JOB_INCONSISTENT");

  const due = job.requestedAt + LEAD_RETENTION_WINDOW_MS;
  await ctx.db.patch("projects", project._id, {
    archivedAt: project.archivedAt ?? job.requestedAt,
    deletionRequestedAt: job.requestedAt,
    updatedAt: now,
  });
  if (existing === null) {
    await ctx.db.insert("lead_retention_jobs", {
      ownerId: job.ownerId, projectId: project._id,
      deletionRequestedAt: job.requestedAt, deleteDueAt: due, nextAttemptAt: due,
      state: "scheduled", attempts: 0, processedCount: 0,
      createdAt: now, updatedAt: now,
    });
  } else {
    await ctx.db.patch("lead_retention_jobs", existing._id, {
      archivedAt: undefined, deletionRequestedAt: job.requestedAt,
      deleteDueAt: due, nextAttemptAt: due,
      state: "scheduled", attempts: 0, processedCount: 0,
      lastErrorCode: undefined, lastAttemptAt: undefined,
      completedAt: undefined, cancelledAt: undefined, updatedAt: now,
    });
  }
  await ctx.db.insert("audit_events", {
    ownerId: job.ownerId, projectId: project._id,
    actorType: "system",
    action: "business.deletion_requested_by_account_closure",
    subjectType: "project", subjectId: project._id,
    createdAt: now,
  });
}

/** Isolated project write: a failure rolls back before the cursor records a retry. */
export const processProject = internalMutation({
  args: { jobId: v.id("account_closure_jobs"), projectId: v.id("projects") },
  returns: v.null(),
  handler: async (ctx, { jobId, projectId }) => {
    const job = await ctx.db.get("account_closure_jobs", jobId);
    const project = await ctx.db.get("projects", projectId);
    if (job === null || project === null || job.state !== "scheduled" ||
        !validEpoch(job.requestedAt) ||
        (await ctx.db.get("users", job.ownerId))?.accountClosureRequestedAt !== job.requestedAt) {
      fail("ACCOUNT_CLOSURE_JOB_INCONSISTENT");
    }
    if ((await matchingClosureJob(ctx, job.ownerId))?._id !== jobId) {
      fail("ACCOUNT_CLOSURE_JOB_INCONSISTENT");
    }
    await scheduleProject(ctx, job, project, Date.now());
    return null;
  },
});

/** One project per transaction. This is privacy cleanup, including while off. */
export const processNext = internalMutation({
  args: { jobId: v.id("account_closure_jobs") },
  returns: v.object({ processed: v.number(), more: v.boolean() }),
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get("account_closure_jobs", jobId);
    if (job === null) fail("RESOURCE_NOT_FOUND");
    const user = await ctx.db.get("users", job.ownerId);
    if (user === null || user.accountClosureRequestedAt !== job.requestedAt ||
        !validEpoch(job.requestedAt) || !Number.isSafeInteger(job.attempts) ||
        job.attempts < 0 || job.attempts >= Number.MAX_SAFE_INTEGER ||
        !Number.isSafeInteger(job.projectsProcessed) || job.projectsProcessed < 0 ||
        job.projectsProcessed >= Number.MAX_SAFE_INTEGER ||
        !Number.isSafeInteger(job.nextAttemptAt)) {
      fail("ACCOUNT_CLOSURE_JOB_INCONSISTENT");
    }
    const matching = await matchingClosureJob(ctx, job.ownerId);
    if (matching?._id !== job._id) fail("ACCOUNT_CLOSURE_JOB_INCONSISTENT");
    if (job.state === "complete") {
      if (job.completedAt === undefined) fail("ACCOUNT_CLOSURE_JOB_INCONSISTENT");
      return { processed: 0, more: false };
    }
    if (job.completedAt !== undefined) fail("ACCOUNT_CLOSURE_JOB_INCONSISTENT");
    const now = Date.now();
    if (job.nextAttemptAt > now) {
      await ctx.scheduler.runAfter(job.nextAttemptAt - now,
        internal.platform.sites.accountClosure.processNext, { jobId });
      return { processed: 0, more: true };
    }

    const query = () => ctx.db.query("projects")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", job.ownerId));
    let page;
    try {
      page = await query().paginate({ cursor: job.cursor ?? null, numItems: PAGE_SIZE,
        maximumRowsRead: PAGE_SIZE });
    } catch (error) {
      if (job.cursor === undefined) throw error;
      if (job.cursorResetAt !== undefined) {
        await ctx.db.patch("account_closure_jobs", jobId, {
          attempts: job.attempts + 1, lastAttemptAt: now,
          lastErrorCode: "ACCOUNT_CLOSURE_CURSOR_INVALID",
          nextAttemptAt: now + RETRY_MAX_MS, updatedAt: now,
        });
        return { processed: 0, more: true };
      }
      // A cursor can become invalid after an index repair. Replaying from the
      // start is safe because each per-project scheduling decision is idempotent.
      // Convex permits only one paginated query per function execution, so the
      // actual restart must happen in a new scheduled transaction.
      await ctx.db.patch("account_closure_jobs", jobId, {
        cursor: undefined, cursorResetAt: now, attempts: job.attempts + 1,
        lastAttemptAt: now, lastErrorCode: "ACCOUNT_CLOSURE_CURSOR_RESET",
        nextAttemptAt: now, updatedAt: now,
      });
      await ctx.scheduler.runAfter(0, internal.platform.sites.accountClosure.processNext, { jobId });
      return { processed: 0, more: true };
    }
    if (page.page.length > PAGE_SIZE || (page.page.length === 0 && !page.isDone)) {
      fail("ACCOUNT_CLOSURE_PAGE_INVALID");
    }
    const project = page.page[0];
    if (project !== undefined) {
      try {
        const result: null = await ctx.runMutation(
          internal.platform.sites.accountClosure.processProject,
          { jobId, projectId: project._id },
        );
        void result;
      } catch {
        // The nested write rolled back. Persist no exception text: it may hold
        // lead or project data. An hourly S4e3 cron will also recover stale jobs.
        const delay = retryDelayMs(job);
        await ctx.db.patch("account_closure_jobs", jobId, {
          attempts: job.attempts + 1, lastAttemptAt: now,
          lastErrorCode: "ACCOUNT_CLOSURE_PROJECT_RETRY",
          nextAttemptAt: now + delay, updatedAt: now,
        });
        await ctx.scheduler.runAfter(delay,
          internal.platform.sites.accountClosure.processNext, { jobId });
        return { processed: 0, more: true };
      }
    }
    const complete = page.isDone;
    await ctx.db.patch("account_closure_jobs", jobId, {
      cursor: complete ? undefined : page.continueCursor,
      state: complete ? "complete" : "scheduled",
      attempts: job.attempts + 1,
      projectsProcessed: job.projectsProcessed + (project === undefined ? 0 : 1),
      lastAttemptAt: now, lastErrorCode: undefined,
      nextAttemptAt: now,
      completedAt: complete ? now : undefined,
      updatedAt: now,
    });
    if (!complete) {
      await ctx.scheduler.runAfter(0, internal.platform.sites.accountClosure.processNext, { jobId });
    }
    return { processed: project === undefined ? 0 : 1, more: !complete };
  },
});
