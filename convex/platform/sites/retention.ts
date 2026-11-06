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
