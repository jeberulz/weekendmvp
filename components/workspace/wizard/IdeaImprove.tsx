"use client";

import { useEffect, useId, useRef } from "react";
import { Loader2, Sparkles, Undo2 } from "lucide-react";
import { BTN_PRIMARY, BTN_SECONDARY, FOCUS } from "@/components/workspace/kit/styles";
import { cn } from "@/lib/utils";
import { wordDiff } from "@/lib/workspace/wizard/idea-diff";
import { IDEA_IMPROVE_NOTICE_COPY, type IdeaImproveController } from "./useIdeaImprove";

/**
 * WP100-S4. The "Improve with AI" control under the own-idea field: one button
 * (its label follows the selection), the suggestion card, the Undo line and
 * the notices. Presentational: the state lives in `useIdeaImprove`.
 *
 * One live region announces every change; focus stays put when a suggestion
 * arrives and returns to the field after Use this, Keep mine and Undo.
 */

const SMALL_BTN = "min-h-11 px-3 text-[14px]";
const TEXT_BTN = cn(
  "inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-[14px] font-medium text-home-ink underline underline-offset-2 hover:text-home-ink-2",
  FOCUS,
);

export function IdeaImprove({ controller, fieldId }: { controller: IdeaImproveController; fieldId: string }) {
  const base = useId();
  const hintId = `${base}-hint`;
  const headingId = `${base}-heading`;
  const improveRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const { state, announcement, canImprove, hasSelection, rounds } = controller;
  const loading = state.phase === "loading";
  const label = loading ? "Improving…" : hasSelection ? "Improve selection" : "Improve";

  // Bring the card into view without moving focus (the founder may still be reading the field).
  useEffect(() => {
    if (state.phase === "suggestion") cardRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [state.phase]);

  // The field is read-only while a request runs.
  useEffect(() => {
    const field = document.getElementById(fieldId);
    if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)) return;
    field.readOnly = loading;
    if (loading) field.setAttribute("aria-busy", "true");
    else field.removeAttribute("aria-busy");
  }, [fieldId, loading]);

  // Ctrl/⌘ + Shift + Enter in the field runs Improve.
  useEffect(() => {
    const field = document.getElementById(fieldId);
    if (field === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Enter" && event.shiftKey && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        void controller.run();
      }
    };
    field.addEventListener("keydown", onKey);
    return () => field.removeEventListener("keydown", onKey);
  }, [controller, fieldId]);

  function stop() {
    controller.stop();
    improveRef.current?.focus();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          ref={improveRef}
          type="button"
          onClick={() => void controller.run()}
          aria-disabled={loading || !canImprove || undefined}
          aria-describedby={hintId}
          aria-keyshortcuts="Control+Shift+Enter Meta+Shift+Enter"
          title="Improve with AI (Ctrl or ⌘ + Shift + Enter)"
          className={cn(BTN_SECONDARY, SMALL_BTN, "gap-1.5", !canImprove && "text-home-ink-3")}
        >
          {loading ? (
            <Loader2 aria-hidden="true" className="size-4 motion-safe:animate-spin" />
          ) : (
            <Sparkles aria-hidden="true" className="size-4" />
          )}
          {label}
        </button>
        {loading ? (
          <button type="button" onClick={stop} className={TEXT_BTN}>
            Stop
          </button>
        ) : null}
        <p id={hintId} className="text-[13px] text-home-ink-3">
          {canImprove
            ? "AI suggests a clearer sentence. Nothing changes unless you choose it."
            : "Write a few words first, then AI can suggest a clearer sentence."}
        </p>
      </div>

      {state.phase === "suggestion" ? (
        <section
          ref={cardRef}
          aria-labelledby={headingId}
          className="flex flex-col gap-3 rounded-xl border border-home-rule bg-home-card p-4 motion-safe:animate-in motion-safe:fade-in"
        >
          <h2 id={headingId} className="text-sm font-medium text-home-ink">
            {state.mode === "selection" ? "A sharper version of the words you picked" : "A sharper version"}
          </h2>
          {state.stale ? <p className="text-[13px] text-home-ink-3">Based on your earlier text.</p> : null}
          <p className="font-editorial text-lg leading-snug text-home-ink">
            {wordDiff(state.before, state.text).map((part, index) =>
              part.added ? (
                <mark
                  key={index}
                  className="rounded-sm bg-home-ember-soft px-0.5 text-home-ink underline decoration-home-orange-ink decoration-2 underline-offset-4"
                >
                  <span className="sr-only">changed: </span>
                  {part.text}
                </mark>
              ) : (
                <span key={index}>{part.text}</span>
              ),
            )}
          </p>
          {state.changeNote ? <p className="text-[13px] text-home-ink-2">{state.changeNote}</p> : null}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={controller.accept} className={cn(BTN_PRIMARY, SMALL_BTN)}>
              Use this
            </button>
            <button type="button" onClick={() => void controller.run()} className={cn(BTN_SECONDARY, SMALL_BTN)}>
              Try again
            </button>
            <button type="button" onClick={controller.dismiss} className={TEXT_BTN}>
              Keep mine
            </button>
          </div>
          <p className="text-[13px] text-home-ink-3">You can still edit it after.</p>
        </section>
      ) : null}

      {state.phase === "accepted" && rounds > 0 ? (
        <p className="flex flex-wrap items-center gap-x-2 text-[13px] text-home-ink-2">
          <span>Sharpened with AI.</span>
          <button type="button" onClick={controller.undo} className={TEXT_BTN}>
            <Undo2 aria-hidden="true" className="size-4" />
            Undo
          </button>
          {rounds > 1 ? (
            <button type="button" onClick={controller.restoreOriginal} className={TEXT_BTN}>
              Back to my words
            </button>
          ) : null}
        </p>
      ) : null}

      {state.phase === "notice" ? (
        <p className="flex flex-wrap items-center gap-x-2 text-[13px] text-home-ink-2">
          <span>{IDEA_IMPROVE_NOTICE_COPY[state.notice]}</span>
          {state.retryable ? (
            <button type="button" onClick={() => void controller.run()} className={TEXT_BTN}>
              Try again
            </button>
          ) : null}
        </p>
      ) : null}

      <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
