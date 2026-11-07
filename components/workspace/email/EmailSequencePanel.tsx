"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { QuietErrorBoundary, WhenConvexReady } from "@/components/platform/client-gates";
import { ArtifactReviewCard, type ReviewDecide } from "@/components/workspace/review/ArtifactReviewCard";
import { EmptyState, ErrorState, LoadingState } from "@/components/workspace/kit/states";
import { CARD, EYEBROW } from "@/components/workspace/kit/styles";
import { cn } from "@/lib/utils";
import {
  EMAIL_APPROVED_NOTE,
  EMAIL_KIND_LABELS,
  EMAIL_NONE_COPY,
  EMAIL_UNAVAILABLE_COPY,
  emailBodyParagraphs,
  emailCtaCopy,
  emailDelayCopy,
  SEQUENCE_STATUS_LABELS,
  splitMergeTags,
  type PreviewState,
} from "@/lib/workspace/emailPage";

type EmailDraftView = FunctionReturnType<typeof api.growth.drafts.emailSequence.emailSequenceDraft>;

/**
 * WP76-S1b: the Email page. The founder reads the crew's four emails and
 * approves the sequence or asks for changes. Nothing here sends.
 *
 * Accessibility:
 * - the route is the h1; the sequence is the h2; each email is an h3 in an
 *   ordered list; the facts of an email are a description list;
 * - everything from the server is a React text node (paragraphs split on
 *   blank lines, never HTML or markdown); `{first name}` shows as written;
 * - Approve and Ask for changes stay focusable while a decision is in flight
 *   (`aria-disabled`). Ask for changes opens a labelled field with its limit
 *   in the description; a refusal sits under it (`role="alert"`, tied by
 *   `aria-describedby`) and focus goes to the field. Escape or Cancel closes
 *   it and focus returns to the Ask for changes button;
 * - when the decision lands (or the card leaves `pending` while focus was in
 *   the card's controls) focus moves to the status line (`tabIndex={-1}`), and
 *   the outcome is read from one always-mounted polite live region;
 * - status is always in words, never colour alone.
 */

type ReadyView = Extract<EmailDraftView, { state: "ready" }>;
export type EmailDecide = ReviewDecide;

const EMAIL_ARTIFACT = { plural: "emails", approvedNote: EMAIL_APPROVED_NOTE } as const;

function ReviewCard({ card, decide, preview }: { card: NonNullable<ReadyView["card"]>; decide: EmailDecide; preview: PreviewState }) {
  return <ArtifactReviewCard card={card} decide={decide} preview={preview} artifact={EMAIL_ARTIFACT} />;
}

function MergeText({ text }: { text: string }) {
  return (
    <>
      {splitMergeTags(text).map((piece, index) =>
        piece.tag ? (
          <span key={index} className="rounded bg-home-sunk px-1 font-mono text-[0.9em]">
            {piece.text}<span className="sr-only"> (merge tag)</span>
          </span>
        ) : (
          <span key={index}>{piece.text}</span>
        ),
      )}
    </>
  );
}

function EmailItem({ email, index, total }: { email: ReadyView["emails"][number]; index: number; total: number }) {
  const cta = email.cta === undefined ? null : emailCtaCopy(email.cta);
  const paragraphs = emailBodyParagraphs(email.body);
  const row = "grid gap-0.5 sm:grid-cols-[9rem_1fr] sm:gap-3";
  const term = "text-[13px] font-medium text-home-ink-2";
  return (
    <li className={cn(CARD, "flex flex-col gap-3 p-4")}>
      <div className="flex flex-col gap-0.5">
        <p className={EYEBROW}>Email {index + 1} of {total}</p>
        <h3 className="text-base font-medium text-home-ink">{EMAIL_KIND_LABELS[email.kind]}</h3>
      </div>
      <dl className="flex flex-col gap-2 text-sm text-home-ink">
        <div className={row}><dt className={term}>When it goes</dt><dd>{emailDelayCopy(email.delayHours)}</dd></div>
        <div className={row}><dt className={term}>Subject</dt><dd><MergeText text={email.subject} /></dd></div>
        <div className={row}><dt className={term}>Preview text</dt><dd><MergeText text={email.preview} /></dd></div>
        <div className={row}>
          <dt className={term}>Message</dt>
          <dd className="flex flex-col gap-2">
            {paragraphs.map((text, i) => (
              <p key={i} className="whitespace-pre-line"><MergeText text={text} /></p>
            ))}
          </dd>
        </div>
        {cta === null ? null : (
          <div className={row}><dt className={term}>Button</dt><dd>“{cta.label}”, goes to {cta.destination}</dd></div>
        )}
        <div className={row}><dt className={term}>Goal</dt><dd>{email.goal}</dd></div>
      </dl>
    </li>
  );
}

function LiveReview({ projectId, card, decide }: { projectId: Id<"projects">; card: NonNullable<ReadyView["card"]>; decide: EmailDecide }) {
  const asks = card.status === "pending" || card.status === "changes_requested";
  const preview = useQuery(
    api.workspace.changeRounds.previewChangeRound,
    asks ? { projectId, approvalId: card.approvalId } : "skip",
  );
  const state: PreviewState = preview === undefined ? { kind: "loading" } : { kind: "ready", preview };
  return <ReviewCard card={card} decide={decide} preview={state} />;
}

function EmailSequenceView({ projectId, view, decide }: { projectId: Id<"projects">; view: EmailDraftView; decide: EmailDecide }) {
  if (view.state === "none") return <EmptyState>{EMAIL_NONE_COPY}</EmptyState>;
  if (view.state === "unavailable") return <EmptyState>{EMAIL_UNAVAILABLE_COPY}</EmptyState>;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-medium text-home-ink">{view.name}</h2>
        <p className="text-[13px] text-home-ink-2">
          Sent from {view.senderName}. Sequence status: {SEQUENCE_STATUS_LABELS[view.status]}.
        </p>
      </div>
      {view.card === null ? null : (
        <QuietErrorBoundary
          key={view.card.approvalId}
          fallback={<ReviewCard card={view.card} decide={decide} preview={{ kind: "failed" }} />}
        >
          <LiveReview projectId={projectId} card={view.card} decide={decide} />
        </QuietErrorBoundary>
      )}
      <ol aria-label="The emails, in order" className="flex flex-col gap-3">
        {view.emails.map((email, index) => (
          <EmailItem key={email.kind} email={email} index={index} total={view.emails.length} />
        ))}
      </ol>
    </div>
  );
}

function LiveEmail({ projectId }: { projectId: Id<"projects"> }) {
  const view = useQuery(api.growth.drafts.emailSequence.emailSequenceDraft, { projectId });
  const decideApproval = useMutation(api.workspace.approvals.decideApproval);
  if (view === undefined) return <LoadingState label="Loading your emails…" />;
  const approvalId = view.state === "ready" && view.card !== null ? view.card.approvalId : null;
  const decide: EmailDecide = async (decision, note) => {
    if (approvalId === null) throw new Error("no card");
    return await decideApproval({ projectId, approvalId, decision, ...(note === undefined ? {} : { note }) });
  };
  return <EmailSequenceView projectId={projectId} view={view} decide={decide} />;
}

export function EmailSequencePanel({ projectId }: { projectId: Id<"projects"> }) {
  const failed = <ErrorState message="Your emails couldn't load right now. Reload the page to try again." />;
  return (
    <WhenConvexReady fallback={<LoadingState label="Loading your emails…" />} unavailable={failed}>
      <QuietErrorBoundary fallback={failed}>
        <LiveEmail projectId={projectId} />
      </QuietErrorBoundary>
    </WhenConvexReady>
  );
}
