import { v, type Infer } from "convex/values";
import { internal } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../../_generated/server";
import { LEAD_RETENTION_WINDOW_MS } from "../../platform/sites/retention";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const CLOSURE_WAKE_GRACE_MS = 5 * 60 * 1000;
const PAGE_SIZE = 24;
const AUDIT_READ_LIMIT = 512;
const queueValidator = v.union(v.literal("lead"), v.literal("closure"));

function explicitLeadJob(job: Doc<"lead_retention_jobs">): boolean {
  return job.archivedAt === undefined &&
    job.deletionRequestedAt !== undefined &&
    Number.isSafeInteger(job.deletionRequestedAt) && job.deletionRequestedAt > 0 &&
    Number.isSafeInteger(job.deleteDueAt) &&
    job.deleteDueAt === job.deletionRequestedAt + LEAD_RETENTION_WINDOW_MS;
}

function archiveOnlyJob(job: Doc<"lead_retention_jobs">): boolean {
  return job.archivedAt !== undefined && job.deletionRequestedAt === undefined;
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
 * could monopolize. Both workers cap backoff at one hour, so include that
 * window for alarms without reading pending jobs whose deadline is weeks away.
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
    const retryHorizon = at + HOUR_MS;
    const page = queue === "lead"
      ? await ctx.db.query("lead_retention_jobs")
        .withIndex("by_state_and_nextAttemptAt", (q) =>
          q.eq("state", "scheduled").lte("nextAttemptAt", retryHorizon))
        .paginate(options)
      : await ctx.db.query("account_closure_jobs")
        .withIndex("by_state_and_nextAttemptAt", (q) =>
          q.eq("state", "scheduled").lte("nextAttemptAt", retryHorizon))
        .paginate(options);

    for (const job of page.page) {
      if ("deleteDueAt" in job) {
        if (archiveOnlyJob(job)) continue;
        if (!explicitLeadJob(job) || job.deleteDueAt <= at - HOUR_MS ||
          (job.deleteDueAt <= at && (job.lastAttemptAt === undefined || job.lastAttemptAt < at))) {
          await ctx.scheduler.runAfter(0, internal.growth.email.retentionDriver.driveLead, {
            jobId: job._id, at,
          });
        }
      } else if (!Number.isSafeInteger(job.requestedAt) ||
        job.requestedAt <= at - HOUR_MS || closureWakeDue(job, at)) {
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

const alertSubject = v.union(
  v.object({ subjectType: v.literal("lead_retention_job"), jobId: v.id("lead_retention_jobs") }),
  v.object({ subjectType: v.literal("account_closure_job"), jobId: v.id("account_closure_jobs") }),
);
const alertDetails = v.union(
  v.object({ deadline: v.number() }),
  v.object({ code: v.union(
    v.literal("LEAD_RETENTION_EPOCH_INVALID"),
    v.literal("LEAD_RETENTION_PROJECT_MISMATCH"),
    v.literal("LEAD_RETENTION_DRIVER_REJECTED"),
    v.literal("ACCOUNT_CLOSURE_EPOCH_MISMATCH"),
    v.literal("ACCOUNT_CLOSURE_DRIVER_REJECTED"),
  ) }),
);
type AlertSubject = Infer<typeof alertSubject>;
type AlertDetails = Infer<typeof alertDetails>;

async function recordAlert(
  ctx: MutationCtx,
  target: AlertSubject & { ownerId: Id<"users">; projectId?: Id<"projects"> },
  details: AlertDetails,
) {
  const { ownerId, projectId, ...subject } = target;
  try {
    await ctx.runMutation(internal.growth.email.retentionDriver.writeAlert,
      { ownerId, projectId, subject, details },
      { transactionLimits: { documentsRead: AUDIT_READ_LIMIT, bytesRead: 512 * 1024 } });
  } catch {
    // A busy audit history or broken audit write must not block erasure.
    console.warn("PRIVACY_CLEANUP_AUDIT_UNAVAILABLE", subject.jobId, details);
  }
}

export const writeAlert = internalMutation({
  args: {
    ownerId: v.id("users"), projectId: v.optional(v.id("projects")),
    subject: alertSubject, details: alertDetails,
  },
  returns: v.null(),
  handler: async (ctx, { ownerId, projectId, subject, details }) => {
    const queue = subject.subjectType === "lead_retention_job" ? "lead_retention" : "account_closure";
    const kind = "deadline" in details ? "overdue" : "inconsistent";
    const action = `ops.${queue}.${kind}`;
    const now = Date.now();
    const day = Math.floor(now / DAY_MS) * DAY_MS;
    const audit = projectId !== undefined
      ? ctx.db.query("audit_events").withIndex("by_projectId_and_createdAt",
        (q) => q.eq("projectId", projectId).gte("createdAt", day).lt("createdAt", day + DAY_MS))
      : ctx.db.query("audit_events").withIndex("by_ownerId_and_createdAt",
        (q) => q.eq("ownerId", ownerId).gte("createdAt", day).lt("createdAt", day + DAY_MS));
    const recent = await audit.take(AUDIT_READ_LIMIT);
    if (recent.some((event) => event.ownerId === ownerId && event.action === action &&
      event.subjectId === subject.jobId)) return null;
    if (recent.length === AUDIT_READ_LIMIT) throw new Error("PRIVACY_CLEANUP_AUDIT_LIMIT");

    await ctx.db.insert("audit_events", {
      ownerId, projectId,
      actorType: "system", action,
      subjectType: subject.subjectType, subjectId: subject.jobId,
      metadata: JSON.stringify(details),
      createdAt: now,
    });
    return null;
  },
});

async function recordInconsistent(
  ctx: MutationCtx, target: AlertSubject, code: Extract<AlertDetails, { code: string }>["code"],
) {
  // An invalid graph must never decide which tenant owns its alert.
  const settings = await ctx.db.query("ops_settings")
    .withIndex("by_singletonKey", (q) => q.eq("singletonKey", "workspace")).take(2);
  if (settings.length === 1) {
    await recordAlert(ctx, { ...target, ownerId: settings[0].ownerId }, { code });
  } else {
    console.warn(code, target.jobId);
  }
}

const leadWake = v.object({
  lastAttemptAt: v.optional(v.number()), nextAttemptAt: v.number(),
});

async function scheduleLeadStep(
  ctx: MutationCtx, job: Doc<"lead_retention_jobs">, at: number,
) {
  if (Number.isSafeInteger(job.nextAttemptAt) && job.nextAttemptAt < at + HOUR_MS) {
    await ctx.scheduler.runAt(job.nextAttemptAt, internal.growth.email.retentionDriver.driveLead, {
      jobId: job._id, at, wake: { lastAttemptAt: job.lastAttemptAt, nextAttemptAt: job.nextAttemptAt },
    });
  }
}

export const driveLead = internalMutation({
  args: { jobId: v.id("lead_retention_jobs"), at: v.number(), wake: v.optional(leadWake) },
  returns: v.null(),
  handler: async (ctx, { jobId, at, wake }): Promise<null> => {
    const now = Date.now();
    if (!withinSweep(at, now)) return null;
    const job = await ctx.db.get("lead_retention_jobs", jobId);
    if (job === null || job.state !== "scheduled" || archiveOnlyJob(job)) return null;
    const subject = { subjectType: "lead_retention_job", jobId } as const;
    if (!explicitLeadJob(job)) {
      await recordInconsistent(ctx, subject, "LEAD_RETENTION_EPOCH_INVALID");
      return null;
    }

    if (wake === undefined) {
      const project = await ctx.db.get("projects", job.projectId);
      if (project?.ownerId !== job.ownerId || project.archivedAt === undefined ||
          project.deletionRequestedAt !== job.deletionRequestedAt) {
        await recordInconsistent(ctx, subject, "LEAD_RETENTION_PROJECT_MISMATCH");
        return null;
      }
      if (job.deleteDueAt <= at - HOUR_MS) {
        await recordAlert(ctx, { ...subject, ownerId: job.ownerId, projectId: job.projectId },
          { deadline: job.deleteDueAt });
      }
      if (job.lastAttemptAt !== undefined && job.lastAttemptAt >= at) return null;
      if (job.deleteDueAt <= at && job.nextAttemptAt > now) {
        // A restored job may have a retry inside this hour and no pending call.
        await scheduleLeadStep(ctx, job, at);
        return null;
      }
    } else if (job.lastAttemptAt !== wake.lastAttemptAt || job.nextAttemptAt !== wake.nextAttemptAt) {
      return null;
    }
    if (job.nextAttemptAt > now || job.deleteDueAt > now) return null;

    let more: boolean;
    try {
      ({ more } = await ctx.runMutation(internal.platform.sites.retention.purgeDueProjectLeads, { jobId }));
    } catch {
      // The worker rolls back independently. Persist a fixed code only.
      await recordInconsistent(ctx, subject, "LEAD_RETENTION_DRIVER_REJECTED");
      return null;
    }
    if (more) {
      const current = await ctx.db.get("lead_retention_jobs", jobId);
      if (current?.state === "scheduled" && current.lastAttemptAt !== undefined) {
        // Partial revocation can continue immediately, even with zero deletes.
        await scheduleLeadStep(ctx, current, at);
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
    const subject = { subjectType: "account_closure_job", jobId } as const;
    const user = await ctx.db.get("users", job.ownerId);
    if (!Number.isSafeInteger(job.requestedAt) || job.requestedAt <= 0 ||
        user?.accountClosureRequestedAt !== job.requestedAt) {
      await recordInconsistent(ctx, subject, "ACCOUNT_CLOSURE_EPOCH_MISMATCH");
      return null;
    }
    if (job.requestedAt <= at - HOUR_MS) {
      await recordAlert(ctx, { ...subject, ownerId: job.ownerId },
        { deadline: job.requestedAt });
    }
    if (closureWakeDue(job, at)) {
      try {
        await ctx.runMutation(internal.platform.sites.accountClosure.processNext, {
          jobId, wake: { attempts: job.attempts, updatedAt: job.updatedAt },
        });
      } catch {
        await recordInconsistent(ctx, subject, "ACCOUNT_CLOSURE_DRIVER_REJECTED");
      }
    }
    return null;
  },
});
