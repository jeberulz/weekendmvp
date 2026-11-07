"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { QuietErrorBoundary } from "@/components/platform/client-gates";
import {
  ArtifactReviewCard,
  type ArtifactReviewCardProps,
  type ReviewDecide,
} from "@/components/workspace/review/ArtifactReviewCard";
import type { PreviewState } from "@/lib/workspace/emailPage";

/**
 * The review card wired to the approvals mutation and the change-round preview,
 * exactly as the Social and Email panels wire it. Used by the Brand kit page and
 * Team HQ. The card comes from the page's own query.
 */

type Card = ArtifactReviewCardProps["card"] & { approvalId: Id<"approvals"> };

function Preview({
  projectId,
  card,
  decide,
  artifact,
  headingLevel,
}: {
  projectId: Id<"projects">;
  card: Card;
  decide: ReviewDecide;
  artifact: ArtifactReviewCardProps["artifact"];
  headingLevel?: 2 | 3;
}) {
  const asks = card.status === "pending" || card.status === "changes_requested";
  const preview = useQuery(
    api.workspace.changeRounds.previewChangeRound,
    asks ? { projectId, approvalId: card.approvalId } : "skip",
  );
  const state: PreviewState = preview === undefined ? { kind: "loading" } : { kind: "ready", preview };
  return <ArtifactReviewCard card={card} decide={decide} preview={state} artifact={artifact} headingLevel={headingLevel} />;
}

export function LiveArtifactReview({
  projectId,
  card,
  artifact,
  headingLevel,
}: {
  projectId: Id<"projects">;
  card: Card;
  artifact: ArtifactReviewCardProps["artifact"];
  headingLevel?: 2 | 3;
}) {
  const decideApproval = useMutation(api.workspace.approvals.decideApproval);
  const decide: ReviewDecide = async (decision, note) =>
    await decideApproval({ projectId, approvalId: card.approvalId, decision, ...(note === undefined ? {} : { note }) });
  return (
    <QuietErrorBoundary
      key={card.approvalId}
      fallback={<ArtifactReviewCard card={card} decide={decide} preview={{ kind: "failed" }} artifact={artifact} headingLevel={headingLevel} />}
    >
      <Preview projectId={projectId} card={card} decide={decide} artifact={artifact} headingLevel={headingLevel} />
    </QuietErrorBoundary>
  );
}
