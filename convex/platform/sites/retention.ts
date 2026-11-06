import { ConvexError, v } from "convex/values";
import { internalMutation } from "../../_generated/server";

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const BATCH_SIZE = 50;

/**
 * One bounded drain step for an archived business. A persisted due job and
 * archive/account-closure hooks must invoke this repeatedly before D5's
 * automatic 30-day retention promise can be activated.
 */
export const purgeArchivedProjectLeads = internalMutation({
  args: { projectId: v.id("projects") },
  returns: v.object({ deleted: v.number(), more: v.boolean() }),
  handler: async (ctx, { projectId }) => {
    const project = await ctx.db.get(projectId);
    if (project === null) {
      throw new ConvexError({ code: "RESOURCE_NOT_FOUND" });
    }
    if (project.archivedAt === undefined ||
        project.archivedAt > Date.now() - RETENTION_MS) {
      return { deleted: 0, more: false };
    }

    // The earliest batch is deleted each time, so no cursor can skip rows if
    // another deletion or retry happens between invocations.
    const rows = await ctx.db.query("leads")
      .withIndex("by_projectId_and_createdAt", (q) => q.eq("projectId", projectId))
      .order("asc")
      .take(BATCH_SIZE + 1);
    const batch = rows.slice(0, BATCH_SIZE);
    if (batch.some((lead) => lead.ownerId !== project.ownerId)) {
      throw new ConvexError({ code: "LEAD_OWNER_MISMATCH" });
    }
    // Real leads can have WP79 tokens, enrollments and queued mail. A later
    // per-lead cleanup transaction must revoke those before hard deletion.
    if (batch.some((lead) => !lead.synthetic)) {
      throw new ConvexError({ code: "LEAD_REVOKE_REQUIRED" });
    }
    for (const lead of batch) await ctx.db.delete(lead._id);
    return { deleted: batch.length, more: rows.length > BATCH_SIZE };
  },
});
