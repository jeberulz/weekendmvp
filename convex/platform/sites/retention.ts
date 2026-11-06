import { ConvexError, v } from "convex/values";
import { env, internalMutation, mutation } from "../../_generated/server";
import { assertFeatureEnabled } from "../../ops/settings";
import { requireCurrentPlatformUserForMutation } from "../authz";

export const LEAD_RETENTION_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

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
 * C-DATA fixture for the future bounded due worker. It proves the new call
 * contract while refusing every deletion until the reviewed revocation and
 * per-lead cleanup implementation replaces this body. Privacy cleanup is
 * allowed with the workspace off under the owner's D5 ruling.
 */
export const purgeDueProjectLeads = internalMutation({
  args: { jobId: v.id("lead_retention_jobs") },
  returns: v.object({ deleted: v.number(), more: v.boolean() }),
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get("lead_retention_jobs", jobId);
    if (job === null) throw new ConvexError({ code: "RESOURCE_NOT_FOUND" });
    const project = await ctx.db.get("projects", job.projectId);
    if (project === null || project.ownerId !== job.ownerId ||
        project.deletionRequestedAt === undefined ||
        job.deletionRequestedAt !== project.deletionRequestedAt ||
        job.deleteDueAt !== job.deletionRequestedAt + LEAD_RETENTION_WINDOW_MS) {
      throw new ConvexError({ code: "LEAD_DELETE_REQUEST_REQUIRED" });
    }
    if (job.state !== "scheduled") {
      throw new ConvexError({ code: "LEAD_RETENTION_NOT_SCHEDULED" });
    }
    if (job.deleteDueAt > Date.now() || job.nextAttemptAt > Date.now()) {
      throw new ConvexError({ code: "LEAD_RETENTION_NOT_DUE" });
    }
    throw new ConvexError({ code: "LEAD_RETENTION_NOT_ACTIVE" });
  },
});
