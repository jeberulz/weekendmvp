import { ConvexError, v } from "convex/values";
import { internalMutation } from "../../_generated/server";
import { assertFeatureEnabled } from "../../ops/settings";
import { requireBusinessAccess } from "../../platform/authz";
import { assertApproved } from "../../workspace/approvals";

/**
 * C-EMAIL fixture. The caller must carry the founder's live session.
 * This endpoint never activates a sequence or queues a send.
 */
export const activateSequence = internalMutation({
  args: { sequenceId: v.id("sequences"), approvalId: v.id("approvals") },
  returns: v.null(),
  handler: async (ctx, { sequenceId, approvalId }) => {
    await assertFeatureEnabled(ctx, "email");
    const sequence = await ctx.db.get("sequences", sequenceId);
    if (sequence === null) throw new ConvexError({ code: "RESOURCE_NOT_FOUND" });
    const project = await requireBusinessAccess(ctx, sequence.projectId, "owner");
    if (sequence.ownerId !== project.ownerId) {
      throw new ConvexError({ code: "RESOURCE_NOT_FOUND" });
    }

    await assertApproved(ctx, approvalId, {
      ownerId: project.ownerId,
      projectId: project._id,
      kind: "send",
      subjectTable: "sequences",
      subjectId: sequenceId,
    });

    throw new ConvexError({ code: "SEQUENCE_ACTIVATION_UNAVAILABLE" });
  },
});
