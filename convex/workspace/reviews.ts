import { v } from "convex/values";

import { query } from "../_generated/server";
import { assertFeatureEnabled } from "../ops/settings";
import { requireBusinessAccess } from "../platform/authz";
import { APPROVAL_LIST_LIMIT, approvalExpiresAt } from "../../lib/workspace/contracts/approvals";
import { ARTIFACT_KINDS } from "../../lib/workspace/contracts/artifacts";
import { REVIEW_TARGETS, isArtifactKind, reviewHref } from "../../lib/workspace/reviews";

/**
 * L1-C6 — the "Waiting on you" list for Team HQ. The crew's `artifact_review`
 * cards reach the chat only when a Wren reply attaches one, so without this
 * list the blueprint and brand kit cards are never shown.
 *
 * Owner only, behind C-OPS `workspace` (the same guard as
 * `listPendingApprovals`; listing cards calls no model, so AI need not be on).
 * Reads the business's pending cards newest first, at most
 * `APPROVAL_LIST_LIMIT`, and keeps `artifact_review` cards on a live
 * (non-archived) artifact document of this business. Every other card kind
 * (`send`, `spend`, ...) is left to its own screen. Queries never read the
 * clock: the client hides a card past `expiresAt`.
 */

const pendingReviewValidator = v.object({
  approvalId: v.id("approvals"),
  kind: v.union(...ARTIFACT_KINDS.map((kind) => v.literal(kind))),
  /** A human title, e.g. "Brand kit". */
  title: v.string(),
  changeRound: v.int64(),
  expiresAt: v.number(),
  /** The workspace route where the artifact is reviewed (`lib/workspace/reviews.ts`). */
  href: v.string(),
});

export const pendingReviews = query({
  args: { projectId: v.id("projects") },
  returns: v.array(pendingReviewValidator),
  handler: async (ctx, args) => {
    await assertFeatureEnabled(ctx, "workspace");
    const project = await requireBusinessAccess(ctx, args.projectId, "owner");
    const cards = await ctx.db.query("approvals")
      .withIndex("by_projectId_and_status", (q) => q.eq("projectId", project._id).eq("status", "pending"))
      .order("desc")
      .take(APPROVAL_LIST_LIMIT);
    const reviews = [];
    for (const card of cards) {
      if (card.ownerId !== project.ownerId || card.kind !== "artifact_review" || card.subjectTable !== "documents") continue;
      const documentId = ctx.db.normalizeId("documents", card.subjectId);
      const document = documentId === null ? null : await ctx.db.get("documents", documentId);
      if (document === null || document.ownerId !== project.ownerId || document.projectId !== project._id ||
        document.archivedAt !== undefined || !isArtifactKind(document.kind)) continue;
      reviews.push({
        approvalId: card._id,
        kind: document.kind,
        title: REVIEW_TARGETS[document.kind].title,
        changeRound: card.changeRound,
        expiresAt: approvalExpiresAt(card.createdAt),
        href: reviewHref(project._id, document.kind),
      });
    }
    return reviews;
  },
});
