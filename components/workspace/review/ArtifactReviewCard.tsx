"use client";

import { ConvexError } from "convex/values";
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import {
  focusLeftGroup,
  isFocusIn,
  returnFocusToStatus,
  type FocusFlags,
} from "@/components/workspace/chat/WrenChatCards";
import { BTN_PRIMARY, BTN_SECONDARY, CARD, FOCUS } from "@/components/workspace/kit/styles";
import { cn } from "@/lib/utils";
import {
  canOfferAsk,
  changesOutcomeCopy,
  checkEmailNote,
  closedCopy,
  EMAIL_CHANGES_PENDING_COPY as CHANGES_PENDING_COPY,
  EMAIL_NOTE_MAX_LENGTH,
  emailDecisionErrorCopy,
  emailNoteLength,
  keepsFormOpen,
  previewIsBusy,
  previewLine,
  type ChangeRoundAnswer,
  type PreviewState,
} from "@/lib/workspace/emailPage";
import { approvalDecisionCopy, approvalDecisionErrorCopy, errorCode, STATUS_LABEL } from "@/lib/workspace/wrenCards";

/**
 * Textarea border is home-ink-3 (4.9:1 on the card fill) so the field edge meets WCAG 1.4.11.
 *
 * The shared review card for a crew artifact (WP76-S2b, lifted from the Email
 * page without changing it). Email, Social and later the Brand kit page and
 * Team HQ use it: the founder approves the artifact or asks for changes.
 *
 * Accessibility:
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

export type ReviewDecideResult = {
  status: string;
  changed: boolean;
  changeRound?: ChangeRoundAnswer;
};
export type ReviewDecide = (decision: "approve" | "request_changes", note?: string) => Promise<ReviewDecideResult>;

export type ArtifactReviewCardProps = {
  card: { status: keyof typeof STATUS_LABEL; expiresAt: number };
  decide: ReviewDecide;
  preview: PreviewState;
  /**
   * Words for the artifact: `plural` is used in sentences ("emails", "posts"); `approvedNote` follows "Approved".
   * `readFrom` says where the thing to read sits relative to the card ("below" by default; the Brand kit page and
   * Team HQ put the card under what it reviews, so they say "above").
   */
  artifact: { plural: string; approvedNote: string; readFrom?: "above" | "below" };
  /** Level of the card's "Your review" heading: 3 by default (under a page section), 2 when no h2 sits above it. */
  headingLevel?: 2 | 3;
  /** Label of the approve button. "Approve" by default; Email and Social say "Approve all 4" and so on. */
  approveLabel?: string;
};

function isRateLimited(error: unknown): boolean {
  if (!(error instanceof ConvexError)) return false;
  const data: unknown = error.data;
  return typeof data === "object" && data !== null && "kind" in data && data.kind === "RateLimited";
}

export function ArtifactReviewCard({ card, decide, preview, artifact, headingLevel = 3, approveLabel = "Approve" }: ArtifactReviewCardProps) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const noun = artifact.plural;
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
    ? CHANGES_PENDING_COPY
    : shown === "pending" || shown === "changes_requested"
      ? previewLine(preview, shown, noun)
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
        setMessage(changesOutcomeCopy(result.changeRound, result.status, result.changed, noun));
        keepOpen = keepsFormOpen(result.changeRound, result.status, result.changed);
        if (!keepOpen) {
          setAsking(false);
          setNote("");
        }
      })
      .catch((error: unknown) => {
        const code = errorCode(error);
        const copy = emailDecisionErrorCopy(code, isRateLimited(error), noun);
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
      <Heading id={`${id}-title`} className="text-sm font-medium text-home-ink">Your review</Heading>
      {canDecide ? (
        <p className="text-[13px] text-home-ink-2">
          Read the {noun} {artifact.readFrom ?? "below"}. Approve them as they are, or ask your team for changes.
        </p>
      ) : null}
      <div ref={statusRef} tabIndex={-1} className={cn("flex flex-col gap-1 rounded text-[13px] text-home-ink-2", FOCUS)}>
        <p>
          Review status: {STATUS_LABEL[shown]}
          {shown === "approved" ? `. ${artifact.approvedNote}` : ""}
        </p>
        {extraLine === null ? null : <p>{extraLine}</p>}
        {shown === "expired" || shown === "cancelled" ? <p>{closedCopy(noun)}</p> : null}
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
                Your team uses this to rewrite the {noun}. Up to {EMAIL_NOTE_MAX_LENGTH.toLocaleString("en-US")} characters.
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
                className={cn("w-full rounded-lg border border-home-ink-3 bg-home-card p-2 text-sm text-home-ink", FOCUS)}
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
                  {approveLabel}
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
