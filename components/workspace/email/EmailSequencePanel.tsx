"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Clock } from "lucide-react";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { QuietErrorBoundary, WhenConvexReady } from "@/components/platform/client-gates";
import { type ReviewDecide } from "@/components/workspace/review/ArtifactReviewCard";
import { LiveArtifactReview } from "@/components/workspace/review/LiveArtifactReview";
import { StatusPill } from "@/components/workspace/kit/StatusPill";
import { EmptyState, ErrorState, LoadingState } from "@/components/workspace/kit/states";
import { CARD, EYEBROW, FOCUS } from "@/components/workspace/kit/styles";
import { cn } from "@/lib/utils";
import {
  EMAIL_APPROVED_NOTE,
  EMAIL_DRAFTS_ONLY_COPY,
  EMAIL_DRAFTS_ONLY_TITLE,
  EMAIL_KIND_LABELS,
  EMAIL_NONE_COPY,
  EMAIL_TRIGGER_COPY,
  EMAIL_UNAVAILABLE_COPY,
  emailBodyParagraphs,
  emailCtaCopy,
  emailDelayCopy,
  emailDelayShort,
  reviewPill,
  splitMergeTags,
} from "@/lib/workspace/emailPage";

type EmailDraftView = FunctionReturnType<typeof api.growth.drafts.emailSequence.emailSequenceDraft>;

/**
 * WP76-S1b / L1 UI fidelity: the Email page. The founder reads the crew's four
 * emails and approves the sequence or asks for changes. Nothing here sends.
 *
 * Layout: a four-step rail plus one detail panel for the selected email. The
 * rail is a tablist (the board's rail is a set of mutually exclusive views of
 * one panel, which is the tabs pattern): roving tabindex, arrow keys, Home and
 * End move and select, `aria-selected`, and the panel is the labelled tabpanel.
 * Layout reflows by container width (the main column is narrower now that the
 * Wren chat is a column): one column of steps, then two, then four.
 *
 * Accessibility:
 * - the route is the h1; the sequence is the h2; the review card and the
 *   selected email are h3;
 * - everything from the server is a React text node (paragraphs split on
 *   blank lines, never HTML or markdown); `{first name}` shows as written;
 * - the status pill is words (never colour alone) and follows the review card;
 * - Approve and Ask for changes live in the shared review card.
 */

type ReadyView = Extract<EmailDraftView, { state: "ready" }>;
type EmailView = ReadyView["emails"][number];
export type EmailDecide = ReviewDecide;

const EMAIL_ARTIFACT = { plural: "emails", approvedNote: EMAIL_APPROVED_NOTE, approvalKind: "send" } as const;

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

function DraftsOnlyStrip() {
  return (
    <div className={cn(CARD, "rounded-[10px] px-4 py-3.5")}>
      <p className="text-[15px] font-semibold text-home-ink">{EMAIL_DRAFTS_ONLY_TITLE}</p>
      <p className="mt-0.5 text-[13px] text-home-ink-2">{EMAIL_DRAFTS_ONLY_COPY}</p>
    </div>
  );
}

function EmailDetail({
  email,
  index,
  senderName,
  panelId,
  tabId,
}: {
  email: EmailView;
  index: number;
  senderName: string;
  panelId: string;
  tabId: string;
}) {
  const cta = email.cta === undefined ? null : emailCtaCopy(email.cta);
  const paragraphs = emailBodyParagraphs(email.body);
  const headingId = `${panelId}-h`;
  const term = "text-[13px] font-medium text-home-ink";
  return (
    <div
      role="tabpanel"
      id={panelId}
      aria-labelledby={tabId}
      tabIndex={0}
      className={cn(CARD, "grid @3xl:grid-cols-[minmax(0,1fr)_240px]", FOCUS)}
    >
      <div className="flex min-w-0 flex-col gap-3 border-b border-home-sunk p-5 @3xl:border-b-0 @3xl:border-r">
        <h3 id={headingId} className={EYEBROW}>
          Email {index + 1} · {EMAIL_KIND_LABELS[email.kind]} · {emailDelayCopy(email.delayHours)}
        </h3>
        <dl className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <dt className={term}>Subject</dt>
            <dd className="text-[15px] font-medium text-home-ink"><MergeText text={email.subject} /></dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className={term}>Preview text</dt>
            <dd className="text-sm text-home-ink"><MergeText text={email.preview} /></dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className={term}>Message</dt>
            <dd className="flex flex-col gap-3 rounded-lg border border-home-sunk bg-home-paper p-4 text-[15px] text-home-ink">
              {paragraphs.map((text, i) => (
                <p key={i} className="whitespace-pre-line"><MergeText text={text} /></p>
              ))}
            </dd>
          </div>
        </dl>
      </div>
      <div className="flex min-w-0 flex-col gap-2.5 p-5 text-sm text-home-ink-2">
        <p>From <span className="font-medium text-home-ink">{senderName}</span></p>
        <p>Goal: <span className="font-medium text-home-ink">{email.goal}</span></p>
        {cta === null ? null : <p>Button: “{cta.label}”, goes to {cta.destination}</p>}
      </div>
    </div>
  );
}

function StepRail({ emails, selected, onSelect, baseId, panelId }: {
  emails: readonly EmailView[];
  selected: number;
  onSelect: (index: number) => void;
  baseId: string;
  panelId: string;
}) {
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  function move(to: number) {
    const next = (to + emails.length) % emails.length;
    onSelect(next);
    tabs.current[next]?.focus();
  }
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        move(selected + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        move(selected - 1);
        break;
      case "Home":
        event.preventDefault();
        move(0);
        break;
      case "End":
        event.preventDefault();
        move(emails.length - 1);
        break;
    }
  }
  return (
    <div
      role="tablist"
      aria-label="The four emails, in send order"
      onKeyDown={onKeyDown}
      className="grid grid-cols-1 gap-3 @md:grid-cols-2 @3xl:grid-cols-4"
    >
      {emails.map((email, i) => {
        const isSelected = i === selected;
        return (
          <button
            key={email.kind}
            ref={(node) => {
              tabs.current[i] = node;
            }}
            type="button"
            role="tab"
            id={`${baseId}-tab-${i}`}
            aria-selected={isSelected}
            aria-controls={panelId}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onSelect(i)}
            className={cn(
              "flex min-h-24 flex-col items-start gap-1.5 rounded-[10px] border bg-home-card p-3.5 text-left text-sm text-home-ink transition-colors hover:bg-home-paper motion-reduce:transition-none",
              FOCUS,
              isSelected ? "border-home-ink ring-1 ring-home-ink" : "border-home-rule",
            )}
          >
            <span className="flex items-center gap-1.5 font-mono text-xs text-home-ink-3">
              <Clock aria-hidden="true" className="size-3.5" />
              {emailDelayShort(email.delayHours)}
            </span>
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-home-orange-ink">
              {i + 1} · {EMAIL_KIND_LABELS[email.kind]}
            </span>
            <span className="font-semibold leading-[1.3]"><MergeText text={email.subject} /></span>
            <span className="text-[13px] text-home-ink-2"><MergeText text={email.preview} /></span>
          </button>
        );
      })}
    </div>
  );
}

function ReadyEmail({ projectId, view }: { projectId: Id<"projects">; view: ReadyView }) {
  const [selected, setSelected] = useState(0);
  // Read once on the client, the same way the review card reads its expiry.
  const [now] = useState(() => Date.now());
  const baseId = useId();
  const panelId = `${baseId}-panel`;
  const index = Math.min(selected, view.emails.length - 1);
  const email = view.emails[index];
  const pill = reviewPill(view.card, now);
  return (
    <div className="flex flex-col gap-4">
      <DraftsOnlyStrip />
      <section aria-labelledby={`${baseId}-seq`} className="@container flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id={`${baseId}-seq`} className="font-editorial text-[28px] font-normal leading-tight text-home-ink">
              {view.name}
            </h2>
            <p className="mt-1 text-sm text-home-ink-2">{EMAIL_TRIGGER_COPY}</p>
          </div>
          {pill === null ? null : <StatusPill set="output" status={pill.status} label={pill.label} />}
        </div>
        {view.card === null ? null : (
          <LiveArtifactReview
            projectId={projectId}
            card={view.card}
            artifact={EMAIL_ARTIFACT}
            headingLevel={3}
            approveLabel="Approve all 4"
          />
        )}
        <StepRail emails={view.emails} selected={index} onSelect={setSelected} baseId={baseId} panelId={panelId} />
        {email === undefined ? null : (
          <EmailDetail
            email={email}
            index={index}
            senderName={view.senderName}
            panelId={panelId}
            tabId={`${baseId}-tab-${index}`}
          />
        )}
      </section>
    </div>
  );
}

function EmailSequenceView({ projectId, view }: { projectId: Id<"projects">; view: EmailDraftView }) {
  if (view.state === "none") return <EmptyState>{EMAIL_NONE_COPY}</EmptyState>;
  if (view.state === "unavailable") return <EmptyState>{EMAIL_UNAVAILABLE_COPY}</EmptyState>;
  return <ReadyEmail projectId={projectId} view={view} />;
}

function LiveEmail({ projectId }: { projectId: Id<"projects"> }) {
  const view = useQuery(api.growth.drafts.emailSequence.emailSequenceDraft, { projectId });
  if (view === undefined) return <LoadingState label="Loading your emails…" />;
  return <EmailSequenceView projectId={projectId} view={view} />;
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
