import { ConvexError, v } from "convex/values";
import { internal } from "../../_generated/api";
import { env, internalMutation, mutation } from "../../_generated/server";
import { assertFeatureEnabled } from "../../ops/settings";
import { requireCurrentPlatformUserForMutation } from "../authz";

export const LEAD_RETENTION_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const RETRY_BASE_MS = 60 * 1000;
const RETRY_MAX_MS = 60 * 60 * 1000;

function retryDelayMs(lastErrorCode: string | undefined, lastAttemptAt: number | undefined, nextAttemptAt: number) {
  if (lastErrorCode === undefined || lastAttemptAt === undefined) return RETRY_BASE_MS;
  const previousDelay = Math.max(RETRY_BASE_MS, nextAttemptAt - lastAttemptAt);
  return Math.min(RETRY_MAX_MS, previousDelay * 2);
}

/**
 * The only founder-initiated business deletion request. No due worker or cron
 * is active yet, so the optional activation switch keeps this path dormant.
 * It accepts archived projects too: ordinary archive did not start a timer.
 */
export const requestBusinessDeletion = mutation({
  args: { projectId: v.id("projects") },
  returns: v.object({
    deletionRequestedAt: v.number(),
    deleteDueAt: v.number(),
    alreadyRequested: v.boolean(),
  }),
  handler: async (ctx, { projectId }) => {
    await assertFeatureEnabled(ctx, "workspace");
    const user = await requireCurrentPlatformUserForMutation(ctx);
    if (env.TENANT_LEAD_DELETE_REQUESTS_ENABLED !== "true") {
      throw new ConvexError({ code: "LEAD_RETENTION_NOT_ACTIVE" });
    }
    if (user.accountClosureRequestedAt !== undefined) {
      throw new ConvexError({ code: "ACCOUNT_CLOSURE_ALREADY_REQUESTED" });
    }
    const project = await ctx.db.get("projects", projectId);
    if (project === null || project.ownerId !== user._id) {
      throw new ConvexError({ code: "RESOURCE_NOT_FOUND" });
    }

    const jobs = await ctx.db.query("lead_retention_jobs")
      .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
      .take(2);
    if (jobs.length > 1) {
      throw new ConvexError({ code: "LEAD_RETENTION_DUPLICATE_JOB" });
    }
    const job = jobs[0] ?? null;
    const prior = project.deletionRequestedAt;
    if (prior !== undefined) {
      if (project.archivedAt === undefined || job === null ||
          job.ownerId !== user._id || job.deletionRequestedAt !== prior ||
          job.deleteDueAt !== prior + LEAD_RETENTION_WINDOW_MS ||
          job.state === "cancelled") {
        throw new ConvexError({ code: "LEAD_RETENTION_JOB_INCONSISTENT" });
      }
      return {
        deletionRequestedAt: prior,
        deleteDueAt: job.deleteDueAt,
        alreadyRequested: true,
      };
    }

    if (job !== null && (
      job.ownerId !== user._id || job.deletionRequestedAt !== undefined ||
      job.archivedAt === undefined || job.state !== "scheduled" ||
      job.attempts !== 0 || job.processedCount !== 0 ||
      job.lastAttemptAt !== undefined || job.lastErrorCode !== undefined ||
      job.completedAt !== undefined || job.cancelledAt !== undefined
    )) {
      throw new ConvexError({ code: "LEAD_RETENTION_JOB_INCONSISTENT" });
    }

    const now = Date.now();
    const due = now + LEAD_RETENTION_WINDOW_MS;
    await ctx.db.patch("projects", projectId, {
      archivedAt: project.archivedAt ?? now,
      deletionRequestedAt: now,
      updatedAt: now,
    });
    if (job === null) {
      await ctx.db.insert("lead_retention_jobs", {
        ownerId: user._id, projectId,
        deletionRequestedAt: now, deleteDueAt: due, nextAttemptAt: due,
        state: "scheduled", attempts: 0, processedCount: 0,
        createdAt: now, updatedAt: now,
      });
    } else {
      await ctx.db.patch("lead_retention_jobs", job._id, {
        archivedAt: undefined, deletionRequestedAt: now,
        deleteDueAt: due, nextAttemptAt: due,
        state: "scheduled", attempts: 0, processedCount: 0,
        lastErrorCode: undefined, lastAttemptAt: undefined,
        completedAt: undefined, cancelledAt: undefined, updatedAt: now,
      });
    }
    await ctx.db.insert("audit_events", {
      ownerId: user._id, projectId,
      actorType: "user", actorUserId: user._id,
      action: "business.deletion_requested", subjectType: "project",
      subjectId: projectId, createdAt: now,
    });
    return { deletionRequestedAt: now, deleteDueAt: due, alreadyRequested: false };
  },
});

/**
 * Legacy archive-based entry point. Ordinary archive preserves leads under D5.
 * Keep this name fail-closed until an explicit deletion-request or account-
 * closure epoch and a bounded contact-revoking purge have a reviewed contract.
 */
export const purgeArchivedProjectLeads = internalMutation({
  args: { projectId: v.id("projects") },
  returns: v.object({ deleted: v.number(), more: v.boolean() }),
  handler: async (ctx, { projectId }) => {
    if (await ctx.db.get(projectId) === null) {
      throw new ConvexError({ code: "RESOURCE_NOT_FOUND" });
    }
    throw new ConvexError({ code: "LEAD_DELETE_REQUEST_REQUIRED" });
  },
});

/**
 * Process one due lead per transaction. The explicit request switch remains
 * off and no cron calls this mutation yet. A revocation failure rolls back its
 * nested writes, then records a PII-free retry without deleting the lead.
 * Privacy cleanup is allowed while the workspace is off under D5.
 */
export const purgeDueProjectLeads = internalMutation({
  args: { jobId: v.id("lead_retention_jobs") },
  returns: v.object({ deleted: v.number(), more: v.boolean() }),
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get("lead_retention_jobs", jobId);
    if (job === null) throw new ConvexError({ code: "RESOURCE_NOT_FOUND" });
    const project = await ctx.db.get("projects", job.projectId);
    if (project === null || project.ownerId !== job.ownerId ||
        project.archivedAt === undefined ||
        project.deletionRequestedAt === undefined ||
        job.archivedAt !== undefined ||
        job.deletionRequestedAt !== project.deletionRequestedAt ||
        job.deleteDueAt !== job.deletionRequestedAt + LEAD_RETENTION_WINDOW_MS ||
        !Number.isSafeInteger(job.deleteDueAt) ||
        !Number.isSafeInteger(job.nextAttemptAt) ||
        !Number.isSafeInteger(job.attempts) || job.attempts < 0 ||
        job.attempts >= Number.MAX_SAFE_INTEGER ||
        (job.lastAttemptAt !== undefined && !Number.isSafeInteger(job.lastAttemptAt)) ||
        !Number.isSafeInteger(job.processedCount) || job.processedCount < 0) {
      throw new ConvexError({ code: "LEAD_DELETE_REQUEST_REQUIRED" });
    }
    const jobs = await ctx.db.query("lead_retention_jobs")
      .withIndex("by_projectId", (q) => q.eq("projectId", job.projectId))
      .take(2);
    if (jobs.length !== 1 || jobs[0]._id !== jobId) {
      throw new ConvexError({ code: "LEAD_RETENTION_DUPLICATE_JOB" });
    }
    if (job.state !== "scheduled") {
      throw new ConvexError({ code: "LEAD_RETENTION_NOT_SCHEDULED" });
    }
    if (job.completedAt !== undefined || job.cancelledAt !== undefined) {
      throw new ConvexError({ code: "LEAD_RETENTION_JOB_INCONSISTENT" });
    }
    const now = Date.now();
    if (job.deleteDueAt > now || job.nextAttemptAt > now) {
      throw new ConvexError({ code: "LEAD_RETENTION_NOT_DUE" });
    }
    const leads = await ctx.db.query("leads")
      .withIndex("by_projectId_and_createdAt", (q) => q.eq("projectId", job.projectId))
      .take(2);
    const lead = leads[0];
    const attempts = job.attempts + 1;
    if (lead === undefined) {
      await ctx.db.patch(jobId, {
        state: "complete", attempts, lastAttemptAt: now,
        lastErrorCode: undefined, completedAt: now, updatedAt: now,
      });
      return { deleted: 0, more: false };
    }

    let errorCode: string | undefined;
    if (lead.ownerId !== job.ownerId || lead.projectId !== job.projectId) {
      errorCode = "LEAD_RETENTION_OWNER_MISMATCH";
    } else {
      const site = await ctx.db.get("site_configs", lead.siteConfigId);
      if (site === null || site.ownerId !== job.ownerId || site.projectId !== job.projectId) {
        errorCode = "LEAD_RETENTION_SITE_MISMATCH";
      }
    }
    let revocationComplete = false;
    if (errorCode === undefined) {
      try {
        const revocation = await ctx.runMutation(internal.growth.email.contacts.revokeLeadContact, {
          leadId: lead._id,
          allowPartial: true,
        });
        revocationComplete = revocation.complete;
      } catch {
        // The nested revocation subtransaction rolls back all cancellations.
        // Never persist an exception message: it may contain contact data.
        errorCode = "LEAD_RETENTION_REVOCATION_FAILED";
      }
    }
    if (errorCode !== undefined) {
      await ctx.db.patch(jobId, {
        attempts, lastAttemptAt: now, lastErrorCode: errorCode,
        nextAttemptAt: now + retryDelayMs(
          job.lastErrorCode, job.lastAttemptAt, job.nextAttemptAt,
        ), updatedAt: now,
      });
      return { deleted: 0, more: true };
    }

    if (!revocationComplete) {
      await ctx.db.patch(jobId, {
        attempts, lastAttemptAt: now, lastErrorCode: undefined,
        nextAttemptAt: now, updatedAt: now,
      });
      return { deleted: 0, more: true };
    }

    await ctx.db.delete("leads", lead._id);
    const more = leads.length > 1;
    await ctx.db.patch(jobId, {
      state: more ? "scheduled" : "complete",
      attempts, processedCount: job.processedCount + 1,
      lastAttemptAt: now, lastErrorCode: undefined,
      nextAttemptAt: more ? now : job.nextAttemptAt,
      completedAt: more ? undefined : now,
      updatedAt: now,
    });
    return { deleted: 1, more };
  },
});
