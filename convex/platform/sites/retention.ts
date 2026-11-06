import { ConvexError, v } from "convex/values";
import { internalMutation } from "../../_generated/server";

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
    const job = await ctx.db.get(jobId);
    if (job === null) throw new ConvexError({ code: "RESOURCE_NOT_FOUND" });
    const project = await ctx.db.get(job.projectId);
    if (project === null || project.ownerId !== job.ownerId ||
        project.deletionRequestedAt === undefined ||
        job.deletionRequestedAt !== project.deletionRequestedAt ||
        job.deleteDueAt !== job.deletionRequestedAt + 30 * 24 * 60 * 60 * 1000) {
      throw new ConvexError({ code: "LEAD_DELETE_REQUEST_REQUIRED" });
    }
    throw new ConvexError({ code: "LEAD_RETENTION_NOT_ACTIVE" });
  },
});
