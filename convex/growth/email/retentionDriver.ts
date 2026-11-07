import { v } from "convex/values";
import { internal } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../../_generated/server";
import { LEAD_RETENTION_WINDOW_MS } from "../../platform/sites/retention";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const CLOSURE_WAKE_GRACE_MS = 5 * 60 * 1000;
const PAGE_SIZE = 24;
const LEAD_BATCHES_PER_SWEEP = 16;
const queueValidator = v.union(v.literal("lead"), v.literal("closure"));

function explicitLeadJob(job: Doc<"lead_retention_jobs">): boolean {
  return job.archivedAt === undefined &&
    job.deletionRequestedAt !== undefined &&
    Number.isSafeInteger(job.deletionRequestedAt) && job.deletionRequestedAt > 0 &&
    Number.isSafeInteger(job.deleteDueAt) &&
    job.deleteDueAt === job.deletionRequestedAt + LEAD_RETENTION_WINDOW_MS;
}

function closureWakeDue(job: Doc<"account_closure_jobs">, at: number): boolean {
  // Give the original scheduled call time to run before replacing it.
  return Math.max(job.nextAttemptAt, job.updatedAt) <= at - CLOSURE_WAKE_GRACE_MS;
}

function withinSweep(at: number, now: number): boolean {
  return Number.isSafeInteger(at) && at <= now && now - at < HOUR_MS;
}

/** Launch the same recovery pass on the hour or manually after restore. */
export const sweep = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const at = Date.now();
    for (const queue of ["lead", "closure"] as const) {
      await ctx.scheduler.runAfter(0, internal.growth.email.retentionDriver.scan, {
        queue, at, cursor: null,
      });
    }
    return null;
  },
});

/**
 * Page scheduled jobs rather than keeping a head batch that a corrupt row
 * could monopolize. Alert eligibility includes jobs currently in backoff.
 */
export const scan = internalMutation({
  args: {
    queue: queueValidator,
    at: v.number(),
    cursor: v.union(v.string(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, { queue, at, cursor }): Promise<null> => {
    if (!withinSweep(at, Date.now())) return null;
    const options = { cursor, numItems: PAGE_SIZE, maximumRowsRead: PAGE_SIZE };
    const page = queue === "lead"
      ? await ctx.db.query("lead_retention_jobs")
        .withIndex("by_state_and_nextAttemptAt", (q) => q.eq("state", "scheduled"))
        .paginate(options)
      : await ctx.db.query("account_closure_jobs")
        .withIndex("by_state_and_nextAttemptAt", (q) => q.eq("state", "scheduled"))
        .paginate(options);

    for (const job of page.page) {
      if ("deleteDueAt" in job) {
        if (explicitLeadJob(job) && (
          job.deleteDueAt <= at - HOUR_MS ||
          (job.deleteDueAt <= at && job.nextAttemptAt <= at &&
            (job.lastAttemptAt === undefined || job.lastAttemptAt < at))
        )) {
          await ctx.scheduler.runAfter(0, internal.growth.email.retentionDriver.driveLead, {
            jobId: job._id, at, remaining: LEAD_BATCHES_PER_SWEEP,
          });
        }
      } else if (job.requestedAt <= at - HOUR_MS || closureWakeDue(job, at)) {
        await ctx.scheduler.runAfter(0, internal.growth.email.retentionDriver.recoverClosure, {
          jobId: job._id, at,
        });
      }
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.growth.email.retentionDriver.scan, {
        queue, at, cursor: page.continueCursor,
      });
    }
    return null;
  },
});

type AlertTarget =
  | { ownerId: Id<"users">; projectId: Id<"projects">; subjectType: "lead_retention_job"; jobId: Id<"lead_retention_jobs"> }
  | { ownerId: Id<"users">; projectId?: never; subjectType: "account_closure_job"; jobId: Id<"account_closure_jobs"> };

async function raiseOverdue(ctx: MutationCtx, target: AlertTarget, deadline: number, at: number) {
  if (deadline > at - HOUR_MS) return;
  const action = target.subjectType === "lead_retention_job"
    ? "ops.lead_retention.overdue" : "ops.account_closure.overdue";
  const day = Math.floor(at / DAY_MS) * DAY_MS;
  const audit = target.projectId !== undefined
    ? ctx.db.query("audit_events").withIndex("by_projectId_and_createdAt",
      (q) => q.eq("projectId", target.projectId).eq("createdAt", day))
    : ctx.db.query("audit_events").withIndex("by_ownerId_and_createdAt",
      (q) => q.eq("ownerId", target.ownerId).eq("createdAt", day));
  const existing = await audit.filter((q) => q.and(
    q.eq(q.field("ownerId"), target.ownerId),
    q.eq(q.field("action"), action),
    q.eq(q.field("subjectId"), target.jobId),
  )).first();
  if (existing) return;

  await ctx.db.insert("audit_events", {
    ownerId: target.ownerId, projectId: target.projectId,
    actorType: "system", action,
    subjectType: target.subjectType, subjectId: target.jobId,
    metadata: JSON.stringify({ deadline, detectedAt: at }),
    // Use the day bucket as the index key and record detection time above.
    createdAt: day,
  });
}

export const driveLead = internalMutation({
  args: { jobId: v.id("lead_retention_jobs"), at: v.number(), remaining: v.number() },
  returns: v.null(),
  handler: async (ctx, { jobId, at, remaining }): Promise<null> => {
    const now = Date.now();
    if (!withinSweep(at, now) || !Number.isInteger(remaining) ||
        remaining < 1 || remaining > LEAD_BATCHES_PER_SWEEP) return null;
    const job = await ctx.db.get("lead_retention_jobs", jobId);
    if (job === null || job.state !== "scheduled" || !explicitLeadJob(job)) return null;

    const first = remaining === LEAD_BATCHES_PER_SWEEP;
    if (first && job.deleteDueAt <= at - HOUR_MS) {
      const project = await ctx.db.get("projects", job.projectId);
      if (project?.ownerId === job.ownerId && project.archivedAt !== undefined &&
          project.deletionRequestedAt === job.deletionRequestedAt) {
        await raiseOverdue(ctx, {
          ownerId: job.ownerId, projectId: job.projectId,
          subjectType: "lead_retention_job", jobId,
        }, job.deleteDueAt, at);
      }
    }
    if (job.nextAttemptAt > now || job.deleteDueAt > now ||
        (first && job.lastAttemptAt !== undefined && job.lastAttemptAt >= at)) return null;

    let more: boolean;
    try {
      ({ more } = await ctx.runMutation(internal.platform.sites.retention.purgeDueProjectLeads, { jobId }));
    } catch {
      // The worker rolls back independently. Do not log exception or contact data.
      console.warn("LEAD_RETENTION_DRIVER_REJECTED", jobId);
      return null;
    }
    if (more && remaining > 1) {
      const current = await ctx.db.get("lead_retention_jobs", jobId);
      // Partial revocation can report deleted=0 but still be immediately due.
      if (current?.state === "scheduled" && current.nextAttemptAt <= now) {
        await ctx.scheduler.runAfter(0, internal.growth.email.retentionDriver.driveLead, {
          jobId, at, remaining: remaining - 1,
        });
      }
    }
    return null;
  },
});

export const recoverClosure = internalMutation({
  args: { jobId: v.id("account_closure_jobs"), at: v.number() },
  returns: v.null(),
  handler: async (ctx, { jobId, at }): Promise<null> => {
    if (!withinSweep(at, Date.now())) return null;
    const job = await ctx.db.get("account_closure_jobs", jobId);
    if (job === null || job.state !== "scheduled") return null;

    if (job.requestedAt <= at - HOUR_MS) {
      const user = await ctx.db.get("users", job.ownerId);
      if (user?.accountClosureRequestedAt === job.requestedAt) {
        await raiseOverdue(ctx, {
          ownerId: job.ownerId, subjectType: "account_closure_job", jobId,
        }, job.requestedAt, at);
      }
    }
    if (closureWakeDue(job, at)) {
      try {
        await ctx.runMutation(internal.platform.sites.accountClosure.processNext, {
          jobId, wake: { attempts: job.attempts, updatedAt: job.updatedAt },
        });
      } catch {
        console.warn("ACCOUNT_CLOSURE_DRIVER_REJECTED", jobId);
      }
    }
    return null;
  },
});
