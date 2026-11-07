"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { QuietErrorBoundary, WhenConvexReady } from "@/components/platform/client-gates";
import {
  focusLeftGroup,
  isFocusIn,
  returnFocusToStatus,
  type FocusFlags,
} from "@/components/workspace/chat/WrenChatCards";
import { EmptyState, ErrorState, LoadingState } from "@/components/workspace/kit/states";
import { BTN_PRIMARY, BTN_SECONDARY, CARD, EYEBROW, FOCUS } from "@/components/workspace/kit/styles";
import { cn } from "@/lib/utils";
import {
  canOfferAsk,
  changesOutcomeCopy,
  checkEmailNote,
  EMAIL_APPROVED_NOTE,
  EMAIL_CHANGES_PENDING_COPY,
  EMAIL_CLOSED_COPY,
  EMAIL_KIND_LABELS,
  EMAIL_NONE_COPY,
  EMAIL_NOTE_MAX_LENGTH,
  EMAIL_UNAVAILABLE_COPY,
  emailBodyParagraphs,
  emailCtaCopy,
  emailDecisionErrorCopy,
  emailDelayCopy,
  emailNoteLength,
  keepsFormOpen,
  previewIsBusy,
  previewLine,
  SEQUENCE_STATUS_LABELS,
  splitMergeTags,
  type ChangeRoundAnswer,
  type PreviewState,
} from "@/lib/workspace/emailPage";
import { approvalDecisionCopy, approvalDecisionErrorCopy, errorCode, STATUS_LABEL } from "@/lib/workspace/wrenCards";

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
type DecideResult = {
  status: string;
  changed: boolean;
  changeRound?: ChangeRoundAnswer;
};
export type EmailDecide = (decision: "approve" | "request_changes", note?: string) => Promise<DecideResult>;

function isRateLimited(error: unknown): boolean {
  if (!(error instanceof ConvexError)) return false;
  const data: unknown = error.data;
  return typeof data === "object" && data !== null && "kind" in data && data.kind === "RateLimited";
}

function ReviewCard({ card, decide, preview }: { card: NonNullable<ReadyView["card"]>; decide: EmailDecide; preview: PreviewState }) {
  const [now] = useState(() => Date.now());
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const controlsRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const askRef = useRef<HTMLButtonElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const focusAskOnClose = useRef(false);
  const focusFlags = useRef<FocusFlags>({ onButtons: false, decision: false });
  const id = useId();
  const noteId = `${id}-note`;
  const hintId = `${id}-hint`;
  const countId = `${id}-count`;
  const errorId = `${id}-error`;
  const canDecide = card.status === "pending" && now < card.expiresAt;
  const askable = canDecide || card.status === "changes_requested";
  const canAsk = askable && canOfferAsk(preview);
  const controlsShown = canDecide || canAsk;
  const shown = card.status === "pending" && !canDecide ? "expired" : card.status;
  const length = emailNoteLength(note);
  const working = shown === "changes_requested" && previewIsBusy(preview);
  const extraLine = working
    ? EMAIL_CHANGES_PENDING_COPY
    : shown === "pending" || shown === "changes_requested"
      ? previewLine(preview, shown)
      : null;

  useEffect(() => {
    if (asking) noteRef.current?.focus();
  }, [asking]);

  useEffect(() => {
    if (!asking && focusAskOnClose.current) {
      focusAskOnClose.current = false;
      askRef.current?.focus();
    }
  }, [asking]);

  // The card moved on (a live update) while focus was in its controls: the status line takes it.
  useEffect(() => {
    returnFocusToStatus(focusFlags, controlsRef, statusRef);
  }, [card.status]);

  useEffect(() => {
    if (!controlsShown) returnFocusToStatus(focusFlags, controlsRef, statusRef);
  }, [controlsShown]);

  // Ask for changes went away (the preview turned busy) while focus was on it.
  useEffect(() => {
    if (!canAsk) returnFocusToStatus(focusFlags, controlsRef, statusRef);
  }, [canAsk]);

  function close() {
    focusAskOnClose.current = true;
    setAsking(false);
    setNote("");
    setNoteError(null);
  }

  function send(decision: "approve" | "request_changes", text?: string) {
    if (inFlight.current) return;
    inFlight.current = true;
    focusFlags.current.decision = isFocusIn(controlsRef.current);
    setPending(true);
    let keepOpen = false;
    void decide(decision, text)
      .then((result) => {
        if (decision === "approve") {
          setMessage(approvalDecisionCopy(result.status));
          return;
        }
        setMessage(changesOutcomeCopy(result.changeRound, result.status, result.changed));
        keepOpen = keepsFormOpen(result.changeRound, result.status, result.changed);
        if (!keepOpen) {
          setAsking(false);
          setNote("");
        }
      })
      .catch((error: unknown) => {
        const code = errorCode(error);
        const copy = emailDecisionErrorCopy(code, isRateLimited(error));
        if (decision === "request_changes") {
          keepOpen = true;
          if (code === "APPROVAL_INVALID_NOTE") {
            setNoteError(copy);
            noteRef.current?.focus();
            return;
          }
        }
        setMessage(copy ?? approvalDecisionErrorCopy(code));
      })
      .finally(() => {
        inFlight.current = false;
        setPending(false);
        if (keepOpen) focusFlags.current.decision = false;
        else returnFocusToStatus(focusFlags, controlsRef, statusRef);
      });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    const checked = checkEmailNote(note);
    if (!checked.ok) {
      setNoteError(checked.error);
      noteRef.current?.focus();
      return;
    }
    setNoteError(null);
    send("request_changes", checked.note);
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape" && asking) {
      event.stopPropagation();
      close();
    }
  }

  return (
    <section aria-labelledby={`${id}-title`} className={cn(CARD, "flex flex-col gap-3 p-4")}>
      <h3 id={`${id}-title`} className="text-sm font-medium text-home-ink">Your review</h3>
      {canDecide ? (
        <p className="text-[13px] text-home-ink-2">
          Read the emails below. Approve them as they are, or ask your team for changes.
        </p>
      ) : null}
      <div ref={statusRef} tabIndex={-1} className={cn("flex flex-col gap-1 rounded text-[13px] text-home-ink-2", FOCUS)}>
        <p>
          Review status: {STATUS_LABEL[shown]}
          {shown === "approved" ? `. ${EMAIL_APPROVED_NOTE}` : ""}
        </p>
        {extraLine === null ? null : <p>{extraLine}</p>}
        {shown === "expired" || shown === "cancelled" ? <p>{EMAIL_CLOSED_COPY}</p> : null}
        <p role="status" aria-live="polite">{pending ? "Sending your decision…" : message}</p>
      </div>
      {controlsShown ? (
        <div
          ref={controlsRef}
          className="flex flex-col gap-3"
          onKeyDown={onKeyDown}
          onFocus={() => {
            focusFlags.current.onButtons = true;
          }}
          onBlur={(event) => {
            if (focusLeftGroup(event)) focusFlags.current.onButtons = false;
          }}
        >
          {asking ? (
            <form onSubmit={submit} noValidate className="flex flex-col gap-2">
              <label htmlFor={noteId} className="text-[13px] font-medium text-home-ink">What should change?</label>
              <p id={hintId} className="text-[13px] text-home-ink-2">
                Your team uses this to rewrite the emails. Up to {EMAIL_NOTE_MAX_LENGTH.toLocaleString("en-US")} characters.
              </p>
              <textarea
                ref={noteRef}
                id={noteId}
                rows={4}
                value={note}
                aria-invalid={noteError === null ? undefined : true}
                aria-describedby={noteError === null ? `${hintId} ${countId}` : `${hintId} ${countId} ${errorId}`}
                onChange={(event) => {
                  setNote(event.target.value);
                  setNoteError(null);
                }}
                className={cn("w-full rounded-lg border border-home-rule bg-home-card p-2 text-sm text-home-ink", FOCUS)}
              />
              <p id={countId} className="text-[13px] text-home-ink-2">
                {length.toLocaleString("en-US")} of {EMAIL_NOTE_MAX_LENGTH.toLocaleString("en-US")}
              </p>
              {noteError === null ? null : (
                <p id={errorId} role="alert" className="text-[13px] text-home-clay-ink">{noteError}</p>
              )}
              <div className="flex flex-wrap gap-2">
                <button type="submit" aria-disabled={pending || undefined} className={BTN_PRIMARY}>Send changes</button>
                <button type="button" className={BTN_SECONDARY} onClick={close}>Cancel</button>
              </div>
            </form>
          ) : (
            <div className="flex flex-wrap gap-2">
              {canDecide ? (
                <button type="button" aria-disabled={pending || undefined} className={BTN_PRIMARY} onClick={() => send("approve")}>
                  Approve
                </button>
              ) : null}
              {canAsk ? (
                <button
                  ref={askRef}
                  type="button"
                  aria-disabled={pending || undefined}
                  className={BTN_SECONDARY}
                  onClick={() => {
                    if (!inFlight.current) setAsking(true);
                  }}
                >
                  Ask for changes
                </button>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
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
