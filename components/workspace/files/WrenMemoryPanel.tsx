"use client";

import { useMutation, useQuery } from "convex/react";
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent, type RefObject } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { MemoryEditResult, WrenMemoryView } from "@/convex/workspace/memory";
import { QuietErrorBoundary, WhenConvexReady } from "@/components/platform/client-gates";
import { EmptyState, ErrorState, LoadingState } from "@/components/workspace/kit/states";
import { copyText, type CopyState } from "@/components/workspace/kit/BuildPackPromptCard";
import { BTN_PRIMARY, BTN_SECONDARY, EYEBROW, FOCUS } from "@/components/workspace/kit/styles";
import { cn } from "@/lib/utils";
import {
  checkFounderFact,
  checkFounderSummary,
  cleanedMemoryLength,
  memoryRefusalCopy,
  WREN_MEMORY_STALE_COPY,
} from "@/lib/workspace/wrenMemory";
import { memoryCopyText, memoryMetaLine } from "@/lib/workspace/reviewPages";

/**
 * WP77-S5 — "What Wren knows" on the Files page: Wren's rolling summary and
 * its facts about the business, as plain text the founder can edit or delete
 * (`convex/workspace/memory.ts`).
 *
 * Accessibility:
 * - every fact and the summary render as React text nodes, never HTML;
 * - Edit opens an inline form with a visible label, a character count and
 *   the rules in its description. Escape or Cancel closes it and focus
 *   returns to that Edit button; after a save focus returns there too;
 * - Delete asks first, in place (a labelled group). Focus moves to "Keep it",
 *   the safe choice; Escape keeps the fact. After a delete, focus moves to
 *   the next fact's Edit button (or the previous one, or the Facts heading
 *   when none is left);
 * - outcomes ("Fact saved", "This changed since you opened it") go to one
 *   polite status line, rendered in every state so the last delete is
 *   announced too; a refused edit shows its reason under the field
 *   (`role="alert"`, tied by `aria-describedby`) and focus goes back to it;
 * - an open edit or delete question is tied to the fact's index AND its text.
 *   If the list moves under it (Wren, or another tab), it closes, the status
 *   line says so, and focus moves to the Facts heading instead of the form
 *   reappearing under another fact.
 */

export type MemoryActions = {
  readonly editFact: (index: number, expected: string, text: string) => Promise<MemoryEditResult>;
  readonly deleteFact: (index: number, expected: string) => Promise<MemoryEditResult>;
  readonly editSummary: (expected: string, text: string) => Promise<MemoryEditResult>;
};

type Editing =
  | { readonly target: "summary"; readonly expected: string }
  | { readonly target: "fact"; readonly index: number; readonly expected: string };

type FocusTarget =
  | { readonly kind: "edit_fact"; readonly index: number }
  | { readonly kind: "delete_fact"; readonly index: number }
  | { readonly kind: "summary" }
  | { readonly kind: "facts_heading" }
  | { readonly kind: "field" };

/**
 * Where focus goes next. `after`: wait until the live memory is no longer
 * this value (a delete: the row it named is about to leave the list).
 */
type FocusRequest = FocusTarget & { readonly after?: WrenMemoryView };

const FAILED_COPY = "That didn't go through. Nothing was changed. Try again in a moment.";

const FIELD = cn(
  "w-full rounded-lg border border-home-ink-3 bg-home-card px-3 py-2 text-sm text-home-ink placeholder:text-home-ink-3",
  FOCUS,
);
const LINK_BUTTON = cn(
  "min-h-10 rounded px-2 text-[13px] font-medium text-home-ink underline underline-offset-2",
  FOCUS,
);
const MONO_TEXT = "whitespace-pre-wrap break-words font-mono text-sm leading-[1.7] text-home-ink";
const READER = "min-w-0 flex-1 overflow-hidden rounded-xl border border-home-rule bg-home-card";
const READER_HEADING_ID = "wren-memory-heading";

function ReaderHeader({ name, meta, action }: { name: string; meta?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-home-sunk px-[18px] py-3.5">
      <div className="min-w-0">
        <h2 id={READER_HEADING_ID} className="font-mono text-[15px] font-medium text-home-ink">
          What {name} knows
        </h2>
        {meta === undefined ? null : <p className="mt-0.5 text-[13px] text-home-ink-3">{meta}</p>}
      </div>
      {action}
    </div>
  );
}

/** The reader card with no data yet (loading, unavailable or error): the header stays, the body says why. */
function ReaderShell({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <article id="wren-memory" aria-labelledby={READER_HEADING_ID} className={READER}>
      <ReaderHeader name={name} />
      <div className="p-4">{children}</div>
    </article>
  );
}

function MemoryEditForm({
  label,
  initial,
  max,
  hint,
  pending,
  error,
  fieldRef,
  onSave,
  onCancel,
}: {
  label: string;
  initial: string;
  max: number;
  hint: string;
  pending: boolean;
  error: string | null;
  fieldRef: RefObject<HTMLTextAreaElement | null>;
  onSave: (text: string) => void;
  onCancel: () => void;
}) {
  const uid = useId();
  const [text, setText] = useState(initial);
  const fieldId = `${uid}-field`;
  const hintId = `${uid}-hint`;
  const errorId = `${uid}-error`;
  // The server's own count: characters after cleaning.
  const length = cleanedMemoryLength(text);

  useEffect(() => {
    fieldRef.current?.focus();
  }, [fieldRef]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pending) onSave(text);
  }

  function keyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    }
  }

  return (
    <form onSubmit={submit} onKeyDown={keyDown} noValidate className="flex flex-col gap-2">
      <label htmlFor={fieldId} className="text-[13px] font-medium text-home-ink">
        {label}
      </label>
      <textarea
        id={fieldId}
        ref={fieldRef}
        rows={3}
        value={text}
        aria-invalid={error === null ? undefined : true}
        aria-describedby={error === null ? hintId : `${hintId} ${errorId}`}
        onChange={(event) => setText(event.target.value)}
        className={FIELD}
      />
      <p id={hintId} className="text-[12px] text-home-ink-2">
        {length.toString()} of {max.toString()} characters. {hint} Escape cancels.
      </p>
      {error === null ? null : (
        <p id={errorId} role="alert" className="text-[13px] text-home-clay-ink">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={BTN_PRIMARY} aria-disabled={pending || undefined}>
          {pending ? "Saving…" : "Save"}
        </button>
        <button type="button" className={BTN_SECONDARY} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function WrenMemoryView({ memory, actions, name = "Wren" }: { memory: WrenMemoryView; actions: MemoryActions; name?: string }) {
  const uid = useId();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [confirming, setConfirming] = useState<{ index: number; expected: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  // The pending focus move lives in a ref; the tick only asks for the render that shows its target.
  const focusRequest = useRef<FocusRequest | null>(null);
  const [, setFocusTick] = useState(0);
  const editButtons = useRef(new Map<number, HTMLButtonElement>());
  const deleteButtons = useRef(new Map<number, HTMLButtonElement>());
  const keepButton = useRef<HTMLButtonElement>(null);
  const summaryButton = useRef<HTMLButtonElement>(null);
  const factsHeading = useRef<HTMLHeadingElement>(null);
  const emptyRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const inFlight = useRef(false);
  const { facts, summary, limits } = memory;
  const [now] = useState(() => Date.now());
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // An open form or question still names what the founder opened it on (index plus text).
  const editingValid = editing === null ||
    (editing.target === "fact" ? facts.at(editing.index) === editing.expected : summary === editing.expected);
  const confirmingValid = confirming === null || facts.at(confirming.index) === confirming.expected;
  const openEdit = editingValid ? editing : null;
  const openConfirm = confirmingValid ? confirming : null;
  // While the founder's own change is in flight the list may move first; only a move from elsewhere is stale.
  const movedUnderneath = !pending && (!editingValid || !confirmingValid);
  const wasOpen = useRef(false);

  // Focus moves after the render that shows its target (an Edit button comes back once the form closes).
  // Runs after every commit and only reads and clears the ref: no state is set here.
  useEffect(() => {
    const request = focusRequest.current;
    if (request === null || request.after === memory) return;
    const target = (() => {
      switch (request.kind) {
        case "edit_fact":
          return editButtons.current.get(request.index) ?? factsHeading.current ?? emptyRef.current;
        case "delete_fact":
          return deleteButtons.current.get(request.index) ?? factsHeading.current ?? emptyRef.current;
        case "summary":
          return summaryButton.current;
        case "facts_heading":
          return factsHeading.current ?? emptyRef.current;
        case "field":
          return fieldRef.current;
      }
    })();
    focusRequest.current = null;
    target?.focus();
  });

  useEffect(
    () => () => {
      if (copyTimer.current !== null) clearTimeout(copyTimer.current);
    },
    [],
  );

  const nothingToCopy = facts.length === 0 && summary === "";
  async function copyAll() {
    if (nothingToCopy) return;
    const result = await copyText(memoryCopyText(name, summary, facts));
    setCopyState(result);
    setStatus(
      result === "copied"
        ? `Copied what ${name} knows.`
        : "Copy is blocked in this browser. Select the text and copy it by hand.",
    );
    if (copyTimer.current !== null) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopyState("idle"), 2500);
  }

  function requestFocus(request: FocusRequest) {
    focusRequest.current = request;
    setFocusTick((tick) => tick + 1);
  }

  useEffect(() => {
    if (openConfirm !== null) keepButton.current?.focus();
  }, [openConfirm]);

  // The form or question closed because the list moved: focus would fall to the page, so move it to the heading.
  useEffect(() => {
    if (movedUnderneath && wasOpen.current) (factsHeading.current ?? emptyRef.current)?.focus();
    wasOpen.current = !movedUnderneath && (openEdit !== null || openConfirm !== null);
  });

  async function run(action: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    try {
      await action();
    } catch {
      setStatus(FAILED_COPY);
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  function openFact(index: number, expected: string) {
    // aria-disabled keeps the button focusable, so the handler holds the line while a change is in flight.
    if (pending) return;
    setConfirming(null);
    setFormError(null);
    setStatus("");
    setEditing({ target: "fact", index, expected });
  }

  function openSummary() {
    if (pending) return;
    setConfirming(null);
    setFormError(null);
    setStatus("");
    setEditing({ target: "summary", expected: summary });
  }

  function returnFocusFrom(current: Editing): FocusRequest {
    return current.target === "fact" ? { kind: "edit_fact", index: current.index } : { kind: "summary" };
  }

  function cancelEdit() {
    if (openEdit === null) return;
    const from = openEdit;
    setEditing(null);
    setFormError(null);
    requestFocus(returnFocusFrom(from));
  }

  function save(text: string) {
    if (openEdit === null) return;
    const current = openEdit;
    const what = current.target;
    // Instant feedback with the server's own rules; the server checks again.
    const local = what === "fact" ? checkFounderFact(text) : checkFounderSummary(text);
    if (!local.ok) {
      setFormError(memoryRefusalCopy(local.code, what));
      requestFocus({ kind: "field" });
      return;
    }
    void run(async () => {
      const result = current.target === "fact"
        ? await actions.editFact(current.index, current.expected, text)
        : await actions.editSummary(current.expected, text);
      switch (result.kind) {
        case "saved":
        case "unchanged":
          setEditing(null);
          setFormError(null);
          setStatus(what === "fact" ? "Fact saved." : local.text === "" ? "Summary cleared." : "Summary saved.");
          requestFocus(returnFocusFrom(current));
          return;
        case "stale":
          setEditing(null);
          setFormError(null);
          setStatus(WREN_MEMORY_STALE_COPY);
          requestFocus(current.target === "fact" ? { kind: "facts_heading" } : { kind: "summary" });
          return;
        case "refused":
          setFormError(memoryRefusalCopy(result.code, what));
          requestFocus({ kind: "field" });
          return;
      }
    });
  }

  function askDelete(index: number, expected: string) {
    if (pending) return;
    setEditing(null);
    setStatus("");
    setConfirming({ index, expected });
  }

  function keep() {
    if (openConfirm === null) return;
    const { index } = openConfirm;
    setConfirming(null);
    requestFocus({ kind: "delete_fact", index });
  }

  function confirmDelete() {
    if (openConfirm === null || pending) return;
    const { index, expected } = openConfirm;
    void run(async () => {
      const result = await actions.deleteFact(index, expected);
      setConfirming(null);
      if (result.kind === "stale") {
        setStatus(WREN_MEMORY_STALE_COPY);
        requestFocus({ kind: "facts_heading" });
        return;
      }
      setStatus(`Fact deleted. ${name} will no longer use it.`);
      // Rows are keyed by position, so the Edit button at this index (or the one before, for the last
      // fact) survives the update and then names the next fact. Wait for the live list to drop the row.
      const left = facts.length - 1;
      const target: FocusTarget = left <= 0 ? { kind: "facts_heading" } : { kind: "edit_fact", index: Math.min(index, left - 1) };
      requestFocus({ ...target, after: memory });
    });
  }

  // One status line in every state (empty or not), so "Fact deleted" is heard when the last fact goes.
  const statusLine = (
    <p role="status" aria-live="polite" className="min-h-5 text-[13px] text-home-ink-2">
      {movedUnderneath ? WREN_MEMORY_STALE_COPY : status}
    </p>
  );

  const empty = facts.length === 0 && summary === "" && openEdit === null;
  const copyLabel = copyState === "copied" ? "Copied" : copyState === "blocked" ? "Copy blocked here" : "Copy";
  return (
    <article id="wren-memory" aria-labelledby={READER_HEADING_ID} className={READER}>
      <ReaderHeader
        name={name}
        meta={memoryMetaLine({
          name,
          updatedAt: memory.updatedAt,
          facts: facts.length,
          factsMax: limits.factsMax,
          now,
        })}
        action={
          <button
            type="button"
            onClick={() => void copyAll()}
            aria-disabled={nothingToCopy || undefined}
            className={cn(BTN_SECONDARY, "min-h-10 px-3.5")}
          >
            {copyLabel}
          </button>
        }
      />
      {empty ? renderEmpty() : renderMemory()}
      <div className="border-t border-home-sunk px-6 py-3">{statusLine}</div>
    </article>
  );

  function renderEmpty() {
    return (
      <div className="flex flex-col gap-3 px-6 py-5">
        <div ref={emptyRef} tabIndex={-1} className={cn("rounded-xl", FOCUS)}>
          <EmptyState title={`${name} hasn't noted anything yet`}>
            As you chat, {name} keeps a short summary and a few facts about your business here, so it remembers what
            matters. You can edit or delete any of them.
          </EmptyState>
        </div>
        <p>
          <button
            ref={summaryButton}
            type="button"
            onClick={openSummary}
            aria-disabled={pending || undefined}
            className={LINK_BUTTON}
          >
            Write a summary
          </button>
        </p>
      </div>
    );
  }

  function renderMemory() {
    const summaryHeadingId = `${uid}-summary`;
    const factsHeadingId = `${uid}-facts`;
    const full = facts.length >= limits.factsMax;

    return (
    <div className="flex flex-col">
      <section aria-labelledby={summaryHeadingId} className="flex flex-col gap-2 px-6 py-5">
        <h3 id={summaryHeadingId} className={EYEBROW}>
          Summary
        </h3>
        {openEdit?.target === "summary" ? (
          <MemoryEditForm
            label={`Edit ${name}'s summary`}
            initial={summary}
            max={limits.summaryMaxChars}
            hint="Plain prose, no links or instructions. Save it empty to clear it."
            pending={pending}
            error={formError}
            fieldRef={fieldRef}
            onSave={save}
            onCancel={cancelEdit}
          />
        ) : (
          <>
            {summary === "" ? (
              <p className="text-sm text-home-ink-2">No summary yet. {name} writes one as your plans take shape.</p>
            ) : (
              <p className={MONO_TEXT}>{summary}</p>
            )}
            <p>
              <button
                ref={summaryButton}
                type="button"
                onClick={openSummary}
                aria-disabled={pending || undefined}
                className={LINK_BUTTON}
              >
                {summary === "" ? "Write a summary" : "Edit summary"}
              </button>
            </p>
          </>
        )}
      </section>

      <section aria-labelledby={factsHeadingId} className="flex flex-col gap-2 border-t border-home-sunk px-6 py-5">
        <h3
          id={factsHeadingId}
          ref={factsHeading}
          tabIndex={-1}
          className={cn("w-fit rounded", EYEBROW, FOCUS)}
        >
          Facts{" "}
          <span className="font-normal normal-case tracking-normal">
            ({facts.length.toString()} of {limits.factsMax.toString()})
          </span>
        </h3>
        {full ? (
          <p className="text-[13px] text-home-ink-2">
            {name}&apos;s notes are full. Delete a fact you no longer need so {name} can remember new things.
          </p>
        ) : null}
        {facts.length === 0 ? (
          <p className="text-sm text-home-ink-2">No facts yet. {name} adds them when you share something worth keeping.</p>
        ) : (
          <ul className="divide-y divide-home-sunk">
            {facts.map((fact, index) => {
              const number = (index + 1).toString();
              const isEditing = openEdit?.target === "fact" && openEdit.index === index;
              const isConfirming = openConfirm?.index === index;
              const questionId = `${uid}-confirm-${number}`;
              return (
                // Keyed by position: after an edit or a delete the buttons stay mounted, so focus can land on them.
                <li key={number} className="flex flex-col gap-2 py-3 first:pt-1">
                  {isEditing ? (
                    <MemoryEditForm
                      label={`Edit fact ${number}`}
                      initial={fact}
                      max={limits.factMaxChars}
                      hint="One plain fact about your business, no links or instructions."
                      pending={pending}
                      error={formError}
                      fieldRef={fieldRef}
                      onSave={save}
                      onCancel={cancelEdit}
                    />
                  ) : (
                    <p className={MONO_TEXT}>{fact}</p>
                  )}
                  {isConfirming ? (
                    <div
                      role="group"
                      aria-labelledby={questionId}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") {
                          event.preventDefault();
                          keep();
                        }
                      }}
                      className="flex flex-wrap items-center gap-2"
                    >
                      <p id={questionId} className="text-[13px] font-medium text-home-ink">
                        Delete fact {number}? {name} will forget it.
                      </p>
                      <button
                        type="button"
                        onClick={confirmDelete}
                        aria-disabled={pending || undefined}
                        className={BTN_PRIMARY}
                      >
                        Delete fact
                      </button>
                      <button ref={keepButton} type="button" onClick={keep} className={BTN_SECONDARY}>
                        Keep it
                      </button>
                    </div>
                  ) : isEditing ? null : (
                    <div className="flex flex-wrap gap-1">
                      <button
                        ref={(element) => {
                          if (element === null) editButtons.current.delete(index);
                          else editButtons.current.set(index, element);
                        }}
                        type="button"
                        onClick={() => openFact(index, fact)}
                        aria-disabled={pending || undefined}
                        className={LINK_BUTTON}
                      >
                        Edit<span className="sr-only"> fact {number}</span>
                      </button>
                      <button
                        ref={(element) => {
                          if (element === null) deleteButtons.current.delete(index);
                          else deleteButtons.current.set(index, element);
                        }}
                        type="button"
                        onClick={() => askDelete(index, fact)}
                        aria-disabled={pending || undefined}
                        className={LINK_BUTTON}
                      >
                        Delete<span className="sr-only"> fact {number}</span>
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
    );
  }
}

function LiveWrenMemory({ projectId, name }: { projectId: Id<"projects">; name: string }) {
  const memory = useQuery(api.workspace.memory.getWrenMemory, { projectId });
  const editFact = useMutation(api.workspace.memory.editWrenMemoryFact);
  const deleteFact = useMutation(api.workspace.memory.deleteWrenMemoryFact);
  const editSummary = useMutation(api.workspace.memory.editWrenMemorySummary);
  if (memory === undefined) {
    return (
      <ReaderShell name={name}>
        <LoadingState label={`Loading what ${name} knows…`} />
      </ReaderShell>
    );
  }
  return (
    <WrenMemoryView
      name={name}
      memory={memory}
      actions={{
        editFact: async (index, expected, text) => await editFact({ projectId, index, expected, text }),
        deleteFact: async (index, expected) => await deleteFact({ projectId, index, expected }),
        editSummary: async (expected, text) => await editSummary({ projectId, expected, text }),
      }}
    />
  );
}

export function WrenMemoryPanel({ projectId, name = "Wren" }: { projectId: Id<"projects">; name?: string }) {
  const failed = (
    <ReaderShell name={name}>
      <ErrorState message={`What ${name} knows couldn't load right now. Reload the page to try again.`} />
    </ReaderShell>
  );
  return (
    <WhenConvexReady
      fallback={
        <ReaderShell name={name}>
          <LoadingState label={`Loading what ${name} knows…`} />
        </ReaderShell>
      }
      unavailable={failed}
    >
      <QuietErrorBoundary fallback={failed}>
        <LiveWrenMemory projectId={projectId} name={name} />
      </QuietErrorBoundary>
    </WhenConvexReady>
  );
}
