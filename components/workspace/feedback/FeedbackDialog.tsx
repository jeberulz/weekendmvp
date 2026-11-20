"use client";

import { useConvex, useMutation } from "convex/react";
import { X } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { BUILD_VERSION } from "@/components/workspace/feedback/buildVersion";
import { reportClientError } from "@/components/workspace/feedback/clientErrors";
import {
  checkNoteForSubmit,
  noteCountLabel,
  sendErrorCopy,
} from "@/components/workspace/feedback/feedbackForm";
import { BTN_PRIMARY, BTN_SECONDARY, FOCUS } from "@/components/workspace/kit/styles";
import {
  FEEDBACK_RATING_MAX,
  FEEDBACK_RATING_MIN,
  errorClassOf,
  sanitizeRoute,
  type FeedbackSurface,
  type StepState,
} from "@/lib/feedback/contracts";
import { cn } from "@/lib/utils";

const RATINGS = Array.from({ length: FEEDBACK_RATING_MAX - FEEDBACK_RATING_MIN + 1 }, (_, index) => FEEDBACK_RATING_MIN + index);

/**
 * WP95-S2. The feedback dialog: a note, an optional 1 to 5 rating, and a plain
 * list of what is attached. It is a native modal `<dialog>`, so the browser
 * traps Tab, inerts the page and closes on Escape.
 *
 * What is attached is built here, from the page's own state: the masked route,
 * the business id, the launch step states (read with the founder's own
 * `launchProgress` query, skipped if it fails) and the build version. Chat text
 * is never read.
 *
 * It renders into `document.body`, outside the sidebar that holds its button,
 * so the sidebar's own Escape handling and `display: none` panel never touch it.
 */
export function FeedbackDialog({
  surface,
  route,
  projectId,
  extraStates,
  onClose,
}: {
  surface: FeedbackSurface;
  route: string;
  projectId?: string;
  extraStates: readonly StepState[];
  onClose: (sent: boolean) => void;
}) {
  const convex = useConvex();
  const submit = useMutation(api.feedback.entries.submit);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const [note, setNote] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const id = useId();
  const titleId = `${id}-title`;
  const descId = `${id}-desc`;
  const noteId = `${id}-note`;
  const hintId = `${id}-hint`;
  const countId = `${id}-count`;
  const noteErrorId = `${id}-note-error`;
  const ratingId = `${id}-rating`;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;
    if (typeof dialog.showModal === "function" && !dialog.open) dialog.showModal();
    noteRef.current?.focus();
  }, []);

  function close(sent: boolean) {
    const dialog = dialogRef.current;
    if (dialog?.open) dialog.close();
    onClose(sent);
  }

  async function launchStates(): Promise<StepState[]> {
    if (projectId === undefined) return [];
    try {
      const progress = await convex.query(api.crew.launch.launchProgress, { projectId: projectId as Id<"projects"> });
      return progress.steps.map((step) => ({ key: step.key, state: step.state }));
    } catch {
      // The launch read is context only: no steps beats no feedback.
      return [];
    }
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    const checked = checkNoteForSubmit(note);
    if (!checked.ok) {
      setNoteError(checked.message);
      noteRef.current?.focus();
      return;
    }
    setNoteError(null);
    setError(null);
    inFlight.current = true;
    setPending(true);
    try {
      const steps = [...(await launchStates()), ...extraStates];
      await submit({
        surface,
        note: checked.note,
        ...(rating === null ? {} : { rating }),
        route: sanitizeRoute(route),
        ...(projectId === undefined ? {} : { projectId: projectId as Id<"projects"> }),
        stepStates: steps.map((step) => ({ key: step.key, state: step.state })),
        buildVersion: BUILD_VERSION,
      });
      close(true);
    } catch (caught) {
      const code = errorClassOf(caught);
      reportClientError({ source: "action", error: caught });
      setError(sendErrorCopy(code));
      inFlight.current = false;
      setPending(false);
    }
  }

  function onKeyDown(event: KeyboardEvent) {
    // The sidebar that holds the button closes its mobile panel on Escape: this one is the dialog's.
    if (event.key === "Escape") event.stopPropagation();
  }

  const dialog = (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descId}
      onKeyDown={onKeyDown}
      onClose={() => onClose(false)}
      className="m-auto w-[min(92vw,30rem)] max-h-[92dvh] overflow-y-auto rounded-xl border border-home-rule bg-home-paper p-0 text-home-ink shadow-xl backdrop:bg-home-ink/40"
    >
      <form onSubmit={(event) => void send(event)} noValidate className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="font-editorial text-2xl font-normal leading-tight">
            Send feedback
          </h2>
          <button
            type="button"
            onClick={() => close(false)}
            aria-label="Close feedback"
            className={cn("inline-flex size-10 shrink-0 items-center justify-center rounded-full text-home-ink hover:bg-home-sunk", FOCUS)}
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
        <p id={descId} className="text-[13px] leading-[1.5] text-home-ink-2">
          A short note goes straight to the people building this. Attached automatically: the page you are on, your
          business, how far your launch has got and the app version ({BUILD_VERSION}). Your chat is never sent.
        </p>

        <fieldset className="flex flex-col gap-2">
          <legend id={ratingId} className="text-[13px] font-medium text-home-ink">
            How is it going? <span className="font-normal text-home-ink-2">Optional</span>
          </legend>
          <div className="flex flex-wrap items-center gap-2">
            {RATINGS.map((value) => (
              <label
                key={value}
                className={cn(
                  "inline-flex size-10 cursor-pointer items-center justify-center rounded-full border text-sm font-medium has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-home-orange-ink",
                  rating === value
                    ? "border-home-ink bg-home-ink text-home-card"
                    : "border-home-rule bg-home-card text-home-ink hover:bg-home-sunk",
                )}
              >
                <input
                  type="radio"
                  name={`${id}-rating`}
                  value={value}
                  checked={rating === value}
                  onChange={() => setRating(value)}
                  className="sr-only"
                />
                <span aria-hidden="true">{value}</span>
                <span className="sr-only">{`${value} out of ${FEEDBACK_RATING_MAX}`}</span>
              </label>
            ))}
            {rating === null ? null : (
              <button type="button" onClick={() => setRating(null)} className={cn("min-h-10 rounded px-2 text-[13px] underline", FOCUS)}>
                Clear rating
              </button>
            )}
          </div>
          <p className="text-[13px] text-home-ink-2">1 is rough, 5 is great.</p>
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={noteId} className="text-[13px] font-medium text-home-ink">
            What should we know?
          </label>
          <p id={hintId} className="text-[13px] text-home-ink-2">
            What happened, what confused you, or what would help.
          </p>
          <textarea
            ref={noteRef}
            id={noteId}
            rows={5}
            value={note}
            onChange={(event) => {
              setNote(event.target.value);
              setNoteError(null);
            }}
            aria-invalid={noteError === null ? undefined : true}
            aria-describedby={noteError === null ? `${hintId} ${countId}` : `${hintId} ${countId} ${noteErrorId}`}
            className={cn("w-full rounded-lg border border-home-ink-3 bg-home-card p-2.5 text-sm text-home-ink", FOCUS)}
          />
          <p id={countId} className="text-[13px] text-home-ink-2">
            {noteCountLabel(note)}
          </p>
          {noteError === null ? null : (
            <p id={noteErrorId} role="alert" className="text-[13px] text-home-clay-ink">
              {noteError}
            </p>
          )}
        </div>

        {error === null ? null : (
          <p role="alert" className="rounded-lg border border-home-clay-ink/30 bg-home-clay px-3 py-2 text-[13px] text-home-clay-ink">
            {error}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <button type="submit" aria-disabled={pending || undefined} className={BTN_PRIMARY}>
            {pending ? "Sending…" : "Send feedback"}
          </button>
          <button type="button" onClick={() => close(false)} className={BTN_SECONDARY}>
            Cancel
          </button>
        </div>
      </form>
    </dialog>
  );

  return createPortal(dialog, document.body);
}
