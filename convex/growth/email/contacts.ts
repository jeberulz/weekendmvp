import type { EmailId } from "@convex-dev/resend";
import { v } from "convex/values";
import { components } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../../_generated/server";
import { tenantResend } from "./provider";

/**
 * A future enroller must enforce this pending limit transactionally so
 * a normal contact delete can always revoke the remaining mail atomically.
 */
export const MAX_PENDING_ENROLLMENTS_PER_LEAD = 16;
/** Issuance and state transitions must enforce these limits before enqueue. */
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

async function requireLeadGraph(ctx: MutationCtx, leadId: Id<"leads">) {
  const lead = await ctx.db.get("leads", leadId);
  if (!lead) throw new Error("LEAD_NOT_FOUND");
  const [project, site] = await Promise.all([
    ctx.db.get("projects", lead.projectId),
    ctx.db.get("site_configs", lead.siteConfigId),
  ]);
  if (!project || project.ownerId !== lead.ownerId ||
      !site || site.ownerId !== lead.ownerId || site.projectId !== lead.projectId) {
    throw new Error("LEAD_OWNERSHIP_GRAPH_MISMATCH");
  }
  return lead;
}

function sameLeadScope(lead: Doc<"leads">, row: Pick<Doc<"leads">, "ownerId" | "projectId">) {
  return row.ownerId === lead.ownerId && row.projectId === lead.projectId;
}

/**
 * Only a completed batch permits erasure. The due worker and operator repair
 * can commit one partial batch at a time; owner deletion remains atomic.
 * Future enqueue writers must reject an enrollment carrying the proof.
 */
export const revokeLeadContact = internalMutation({
  args: { leadId: v.id("leads"), allowPartial: v.optional(v.boolean()) },
  returns: v.object({
    complete: v.boolean(),
    tokensDeleted: v.number(),
    enrollmentsRevoked: v.number(),
    sendsChecked: v.number(),
    queuedEmailsCancelled: v.number(),
    submittedEmails: v.number(),
  }),
  handler: async (ctx, { leadId, allowPartial }) => {
    const lead = await requireLeadGraph(ctx, leadId);
    const enrollments = await ctx.db.query("enrollments")
      .withIndex("by_leadId_and_contactRevokedAt", (q) =>
        q.eq("leadId", leadId).eq("contactRevokedAt", undefined))
      .take(MAX_PENDING_ENROLLMENTS_PER_LEAD + 1);
    const complete = enrollments.length <= MAX_PENDING_ENROLLMENTS_PER_LEAD;
    if (!complete && !allowPartial) {
      throw new Error("LEAD_ENROLLMENT_LIMIT_EXCEEDED");
    }

    const tokens = [];
    // Keep unsubscribe links usable while later batches still have mail.
    const purposes = complete ? ["opt_in", "unsubscribe"] as const : ["opt_in"] as const;
    for (const purpose of purposes) {
      const rows = await ctx.db.query("lead_email_tokens")
        .withIndex("by_leadId_and_purpose", (q) => q.eq("leadId", leadId).eq("purpose", purpose))
        .take(MAX_TOKENS_PER_PURPOSE + 1);
      if (rows.length > MAX_TOKENS_PER_PURPOSE) throw new Error("LEAD_TOKEN_LIMIT_EXCEEDED");
      tokens.push(...rows);
    }

    let enrollmentsRevoked = 0;
    let sendsChecked = 0;
    let queuedEmailsCancelled = 0;
    let submittedEmails = 0;
    for (const enrollment of enrollments.slice(0, MAX_PENDING_ENROLLMENTS_PER_LEAD)) {
      if (!sameLeadScope(lead, enrollment)) {
        throw new Error("LEAD_ENROLLMENT_OWNERSHIP_MISMATCH");
      }
      const sends = await ctx.db.query("email_sends")
        .withIndex("by_enrollmentId", (q) => q.eq("enrollmentId", enrollment._id))
        .take(MAX_SENDS_PER_ENROLLMENT + 1);
      if (sends.length > MAX_SENDS_PER_ENROLLMENT) {
        throw new Error("LEAD_SEND_LIMIT_EXCEEDED");
      }
      for (const send of sends) {
        if (!sameLeadScope(lead, send)) {
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
      const terminal = enrollment.state === "completed" || enrollment.state === "revoked";
      const now = Date.now();
      await ctx.db.patch("enrollments", enrollment._id, {
        state: terminal ? enrollment.state : "revoked",
        contactRevokedAt: now,
        updatedAt: now,
      });
      if (!terminal) enrollmentsRevoked += 1;
    }

    for (const token of tokens) {
      if (!sameLeadScope(lead, token)) {
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
      complete,
      tokensDeleted: tokens.length,
      enrollmentsRevoked,
      sendsChecked,
      queuedEmailsCancelled,
      submittedEmails,
    };
  },
});

/**
 * Support supplies a candidate ID from the component in the same deployment.
 * The stored enqueue key must prove it belongs to this exact send. This path
 * cannot enqueue or accept an operator's unverified assertion of cancellation.
 */
export const recoverLeadSendLink = internalMutation({
  args: { sendId: v.id("email_sends"), componentEmailId: v.string() },
  returns: v.null(),
  handler: async (ctx, { sendId, componentEmailId }) => {
    const send = await ctx.db.get("email_sends", sendId);
    const enrollment = send && await ctx.db.get("enrollments", send.enrollmentId);
    if (!send || !enrollment) throw new Error("LEAD_SEND_NOT_FOUND");
    const lead = await requireLeadGraph(ctx, enrollment.leadId);
    if (!sameLeadScope(lead, enrollment) || !sameLeadScope(lead, send)) {
      throw new Error("LEAD_SEND_OWNERSHIP_MISMATCH");
    }
    if (send.componentEmailId === componentEmailId) return null;
    if (send.componentEmailId !== undefined || enrollment.contactRevokedAt !== undefined) {
      throw new Error("LEAD_SEND_LINK_ALREADY_RESOLVED");
    }

    const key = `send:${enrollment._id}:${send.stepId}`;
    const [matchingSends, linkedSends] = await Promise.all([
      ctx.db.query("email_sends")
        .withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", key)).take(2),
      ctx.db.query("email_sends")
        .withIndex("by_componentEmailId", (q) => q.eq("componentEmailId", componentEmailId)).take(1),
    ]);
    if (matchingSends.length !== 1 || matchingSends[0]._id !== sendId || linkedSends.length !== 0) {
      throw new Error("LEAD_SEND_LINK_UNVERIFIED");
    }
    const emailId = componentEmailId as EmailId;
    const email = await ctx.runQuery(components.resend.lib.get, { emailId });
    if (!email || email.idempotencyKey !== key) throw new Error("LEAD_SEND_LINK_UNVERIFIED");
    if (lead.email !== undefined &&
        (email.to.length !== 1 || email.to[0].toLowerCase() !== lead.email.toLowerCase())) {
      throw new Error("LEAD_SEND_LINK_UNVERIFIED");
    }

    if (email.status === "waiting" || email.status === "queued") {
      await tenantResend.cancelEmail(ctx, emailId);
    }
    await ctx.db.patch("email_sends", sendId, {
      componentEmailId,
      status: ["waiting", "queued", "cancelled"].includes(email.status) ? "cancelled" : send.status,
      updatedAt: Date.now(),
    });
    return null;
  },
});
