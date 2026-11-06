import type { EmailId } from "@convex-dev/resend";
import { v } from "convex/values";
import { internalMutation, type MutationCtx } from "../../_generated/server";
import { tenantResend } from "./provider";

/** Issuance and state transitions must enforce these limits before enqueue. */
export const MAX_ENROLLMENTS_PER_LEAD = 16;
export const MAX_SENDS_PER_ENROLLMENT = 4;
export const MAX_TOKENS_PER_PURPOSE = 1;

async function cancelLinkedEmail(
  ctx: MutationCtx,
  componentEmailId: string,
): Promise<"cancelled" | "submitted" | "already_final"> {
  const emailId = componentEmailId as EmailId;
  const componentStatus = await tenantResend.status(ctx, emailId);
  if (!componentStatus) {
    // The component row was already cleaned up; absent rows cannot be sent.
    return "already_final";
  }
  if (componentStatus.status === "waiting" || componentStatus.status === "queued") {
    // Any unexpected cancellation error aborts the outer deletion transaction.
    await tenantResend.cancelEmail(ctx, emailId);
    return "cancelled";
  }
  return componentStatus.status === "cancelled" ? "already_final" : "submitted";
}

/**
 * WP78 calls this from its owner-authorized deletion mutation before clearing
 * lead contact fields. The nested component cancellation shares that top-level
 * transaction. Already-submitted mail cannot be recalled and follows the
 * owner-approved component/provider retention windows.
 */
export const revokeLeadContact = internalMutation({
  args: { leadId: v.id("leads") },
  returns: v.object({
    tokensDeleted: v.number(),
    enrollmentsRevoked: v.number(),
    sendsChecked: v.number(),
    queuedEmailsCancelled: v.number(),
    submittedEmails: v.number(),
  }),
  handler: async (ctx, { leadId }) => {
    const lead = await ctx.db.get(leadId);
    if (!lead) throw new Error("LEAD_NOT_FOUND");
    const [project, site] = await Promise.all([
      ctx.db.get(lead.projectId),
      ctx.db.get(lead.siteConfigId),
    ]);
    if (!project || project.ownerId !== lead.ownerId ||
        !site || site.ownerId !== lead.ownerId || site.projectId !== lead.projectId) {
      throw new Error("LEAD_OWNERSHIP_GRAPH_MISMATCH");
    }

    const tokens = [];
    for (const purpose of ["opt_in", "unsubscribe"] as const) {
      const rows = await ctx.db.query("lead_email_tokens")
        .withIndex("by_leadId_and_purpose", (q) => q.eq("leadId", leadId).eq("purpose", purpose))
        .take(MAX_TOKENS_PER_PURPOSE + 1);
      if (rows.length > MAX_TOKENS_PER_PURPOSE) throw new Error("LEAD_TOKEN_LIMIT_EXCEEDED");
      tokens.push(...rows);
    }
    const enrollments = await ctx.db.query("enrollments")
      .withIndex("by_leadId", (q) => q.eq("leadId", leadId))
      .take(MAX_ENROLLMENTS_PER_LEAD + 1);
    if (enrollments.length > MAX_ENROLLMENTS_PER_LEAD) {
      throw new Error("LEAD_ENROLLMENT_LIMIT_EXCEEDED");
    }

    let enrollmentsRevoked = 0;
    let sendsChecked = 0;
    let queuedEmailsCancelled = 0;
    let submittedEmails = 0;
    for (const enrollment of enrollments) {
      if (enrollment.ownerId !== lead.ownerId || enrollment.projectId !== lead.projectId) {
        throw new Error("LEAD_ENROLLMENT_OWNERSHIP_MISMATCH");
      }
      const sends = await ctx.db.query("email_sends")
        .withIndex("by_enrollmentId", (q) => q.eq("enrollmentId", enrollment._id))
        .take(MAX_SENDS_PER_ENROLLMENT + 1);
      if (sends.length > MAX_SENDS_PER_ENROLLMENT) {
        throw new Error("LEAD_SEND_LIMIT_EXCEEDED");
      }
      for (const send of sends) {
        if (send.ownerId !== lead.ownerId || send.projectId !== lead.projectId) {
          throw new Error("LEAD_SEND_OWNERSHIP_MISMATCH");
        }
        if (send.componentEmailId) {
          const result = await cancelLinkedEmail(ctx, send.componentEmailId);
          if (result === "cancelled") {
            queuedEmailsCancelled += 1;
            await ctx.db.patch(send._id, { status: "cancelled", updatedAt: Date.now() });
          } else if (result === "submitted") {
            submittedEmails += 1;
          }
        } else if (send.status === "reserved") {
          await ctx.db.patch(send._id, { status: "cancelled", updatedAt: Date.now() });
        } else if (send.status !== "cancelled") {
          // A local queued/sent row without the component ID cannot be recalled.
          throw new Error("COMPONENT_EMAIL_ID_MISSING");
        }
        sendsChecked += 1;
      }
      if (enrollment.state !== "completed" && enrollment.state !== "revoked") {
        await ctx.db.patch(enrollment._id, { state: "revoked", updatedAt: Date.now() });
        enrollmentsRevoked += 1;
      }
    }

    for (const token of tokens) {
      if (token.ownerId !== lead.ownerId || token.projectId !== lead.projectId) {
        throw new Error("LEAD_TOKEN_OWNERSHIP_MISMATCH");
      }
      if (token.componentEmailId) {
        const result = await cancelLinkedEmail(ctx, token.componentEmailId);
        if (result === "cancelled") queuedEmailsCancelled += 1;
        if (result === "submitted") submittedEmails += 1;
      }
      await ctx.db.delete(token._id);
    }
    return {
      tokensDeleted: tokens.length,
      enrollmentsRevoked,
      sendsChecked,
      queuedEmailsCancelled,
      submittedEmails,
    };
  },
});
