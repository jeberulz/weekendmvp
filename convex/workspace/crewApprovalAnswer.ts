import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { newestDraftDocument, newestReviewCard, parseDraftBody, type ReviewCard } from "../growth/drafts/documentDraft";
import { readEmailSequenceDraft } from "../growth/drafts/emailSequence";
import { blueprintSchema, brandKitSchema, socialPackSchema } from "../../lib/workspace/contracts/artifacts";
import type { ArtifactReviewTarget } from "../../lib/workspace/crewAssignment";
import { readSubjectState, subjectRefusal } from "./approvals";

const surfaces = {
  brand: { artifact: "brand kit", kind: "brand_kit", route: "brand", location: "Brand kit", button: "Approve" },
  social: { artifact: "social pack", kind: "social_pack", route: "social", location: "Social", button: "Approve all 7" },
  blueprint: { artifact: "blueprint", kind: "blueprint", route: "team", location: "Team HQ, under Your blueprint", button: "Approve" },
  email: { artifact: "email sequence", kind: "email_sequence", route: "email", location: "Email", button: "Approve all 4" },
} as const;

/** Select the artifact using its own workspace page's version and content rules. */
async function reviewFor(ctx: QueryCtx, project: Doc<"projects">, target: ArtifactReviewTarget): Promise<
  { state: "none" | "unavailable" } | { state: "ready"; card: ReviewCard }
> {
  if (target === "email") return await readEmailSequenceDraft(ctx, project);
  const business = { ownerId: project.ownerId, projectId: project._id };
  const doc = await newestDraftDocument(ctx, business, surfaces[target].kind);
  if (doc === null) return { state: "none" };
  const valid = target === "brand" ? parseDraftBody(doc.body, brandKitSchema) :
    target === "social" ? parseDraftBody(doc.body, socialPackSchema) : parseDraftBody(doc.body, blueprintSchema);
  if (valid === null) return { state: "unavailable" };
  return { state: "ready", card: await newestReviewCard(ctx, business, doc._id) };
}

export async function readCrewApprovalAnswer(ctx: QueryCtx, project: Doc<"projects">, target: ArtifactReviewTarget, now: number) {
  const { artifact, route, location, button } = surfaces[target];
  const view = await reviewFor(ctx, project, target);
  const answer = (body: string) => ({ status: "answer" as const, route, body });
  if (view.state === "none") return answer(`There is no saved ${artifact} to approve yet. Its review will appear on ${location}.`);
  if (view.state !== "ready") return answer(`The current ${artifact} is unavailable on ${location}. I cannot verify its approval.`);
  if (view.card === null) return answer(`The current ${artifact} has no recorded review. There is no approval button for this draft on ${location} yet.`);
  const card = await ctx.db.get("approvals", view.card.approvalId);
  if (card === null || card.ownerId !== project.ownerId || card.projectId !== project._id ||
    card.kind !== "artifact_review" || card.subjectTable !== "documents") {
    return answer(`I cannot verify a review for the current ${artifact} on ${location}.`);
  }
  const subject = await readSubjectState(ctx, project.ownerId, project._id, "documents", card.subjectId);
  if (subjectRefusal(subject, card.kind, card.createdAt, card._id) !== null) {
    return answer(`The recorded review does not cover the current version of the ${artifact}. A fresh review is needed on ${location}.`);
  }
  const version = card.changeRound > 0n ? ` (change round ${card.changeRound})` : "";
  const current = `The current ${artifact}${version}`;
  const status = card.status === "pending" && view.card.expiresAt <= now ? "expired" : card.status;
  switch (status) {
    case "approved": return answer(`${current} is already approved. Open ${location} and find Your review to see the decision. The approval button only appears on a pending review.`);
    case "pending": return answer(`${current} is awaiting your approval. Open ${location}, find Your review and choose “${button}”.`);
    case "changes_requested": return answer(`You requested changes to the current ${artifact}${version}. You can see that decision in Your review on ${location}. A revised draft needs its own review.`);
    case "expired": return answer(`The review for the current ${artifact}${version} expired. You can see the expired decision on ${location}. A fresh review is needed before you can approve.`);
    case "cancelled": return answer(`The review for the current ${artifact}${version} was cancelled. You can see the decision on ${location}. A fresh review is needed before you can approve.`);
  }
}
