import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { isPendingApprovalStale } from "../../lib/workspace/contracts/approvals";
import { crewRequestKey } from "./changeRounds";

type ReceiptView = { body: string; route: "brand" | "email" | "team" };

async function isIrisKit(ctx: QueryCtx, iris: Doc<"tasks">, documentId: Id<"documents">): Promise<boolean> {
  const kit = await ctx.db.get("documents", documentId);
  return kit?.ownerId === iris.ownerId && kit.projectId === iris.projectId && kit.kind === "brand_kit" && kit.taskId === iris._id;
}

/** A chat receipt follows only the brand task created by this founder message and its own linked email task. */
export async function readWrenHandoffReceipt(ctx: QueryCtx, row: Doc<"chat_messages">): Promise<ReceiptView | null> {
  if (row.author !== "wren" || row.status !== "done" || row.focusRole !== "brand" || !row.replyTo) return null;
  const key = crewRequestKey(row.projectId, row.replyTo);
  const iris = row.crewRevisionTaskId
    ? await ctx.db.get("tasks", row.crewRevisionTaskId)
    : await ctx.db.query("tasks").withIndex("by_ownerId_and_idempotencyKey", (q) =>
      q.eq("ownerId", row.ownerId).eq("idempotencyKey", key)).unique();
  if (!iris || iris.idempotencyKey !== key || iris.projectId !== row.projectId || iris.ownerId !== row.ownerId ||
      iris.archivedAt !== undefined || iris.type !== "crew_brand_kit" || !iris.emailHandoff) return null;
  const receipt = iris.emailHandoff;
  if (receipt.state === "requested") {
    if (iris.status === "succeeded") return { body: "Iris finished the brand revision. Elle can start the email rewrite once you approve this kit.", route: "brand" };
    if (iris.status === "failed" || iris.status === "cancelled") return { body: "Iris’s brand revision stopped before Elle could start the email rewrite. Open Brand kit to check the revision.", route: "brand" };
    return null;
  }
  if (receipt.state === "not_available") return { body: "Elle could not start the email rewrite from this kit. Open Team HQ to check the handoff.", route: "team" };

  let elle = receipt.taskId ? await ctx.db.get("tasks", receipt.taskId) : null;
  if (receipt.state === "spend_required") {
    const card = receipt.approvalId ? await ctx.db.get("approvals", receipt.approvalId) : null;
    if (!card || card.ownerId !== row.ownerId || card.projectId !== row.projectId || card.kind !== "spend" ||
        !card.crewRevision?.requestId || !card.crewRevision.requiresBrandDocumentId) return null;
    const childKey = crewRequestKey(row.projectId, card.crewRevision.requestId);
    elle = await ctx.db.query("tasks").withIndex("by_ownerId_and_idempotencyKey", (q) =>
      q.eq("ownerId", row.ownerId).eq("idempotencyKey", childKey)).unique();
    if (!elle) {
      if (!await isIrisKit(ctx, iris, card.crewRevision.requiresBrandDocumentId)) return null;
      if (card.status === "pending" && !isPendingApprovalStale(card.createdAt, Date.now())) {
        return { body: "Iris finished the brand revision. Elle’s email rewrite needs spending approval in Team HQ.", route: "team" };
      }
      return { body: "Elle’s email rewrite has not started. Check the spending approval in Team HQ.", route: "team" };
    }
    // Refunding a failed paid task closes its spend card. The task is still the outcome of this request.
    if (elle.approvalId !== card._id || elle.requiresBrandDocumentId !== card.crewRevision.requiresBrandDocumentId) return null;
  }
  if (!elle || elle.ownerId !== row.ownerId || elle.projectId !== row.projectId || elle.archivedAt !== undefined ||
      elle.type !== "crew_email_sequence" || !elle.requiresBrandDocumentId ||
      !await isIrisKit(ctx, iris, elle.requiresBrandDocumentId)) return null;
  switch (elle.status) {
    case "queued": return { body: "You approved Iris’s revised kit. Elle’s email rewrite is queued.", route: "email" };
    case "running": return { body: "Elle is rewriting the email copy using Iris’s approved kit.", route: "email" };
    case "blocked": return { body: "Elle’s email rewrite is blocked. Open Team HQ for its status.", route: "team" };
    case "cancelled": return { body: "Elle’s email rewrite was cancelled.", route: "email" };
    case "failed": return { body: `Elle’s email rewrite failed. ${elle.crewFailureReason ?? "Check the rewrite on the Email page."}`, route: "email" };
    case "succeeded": return { body: "Elle saved the revised email copy using Iris’s approved kit. Open Email to see the sequence.", route: "email" };
  }
}
