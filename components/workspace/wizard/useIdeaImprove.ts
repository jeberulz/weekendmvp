"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import { IDEA_IMPROVE_MIN_WORDS, wordCount } from "@/lib/workspace/wizard/idea-improve";

/**
 * WP100-S4. "Improve with AI" for the own-idea field (`docs/design/wizard-idea-ai-improve.md`).
 *
 * `useIdeaImproveApi` binds the Convex functions; `WizardFlow` calls it and
 * passes the result down, so the Step 1 form and panel stay free of Convex
 * hooks (and render without a client in tests). `useIdeaImprove` is the state
 * machine the control renders: nothing in the field changes unless the
 * founder chooses Use this, Undo or Back to my words, or types.
 */

export type IdeaImproveArgs = FunctionArgs<typeof api.workspace.ideaImprove.improve>;
export type IdeaImproveResult = FunctionReturnType<typeof api.workspace.ideaImprove.improve>;
export type IdeaImproveId = Extract<IdeaImproveResult, { improvementId: unknown }>["improvementId"];
export type IdeaImproveOutcome = FunctionArgs<typeof api.workspace.ideaImprove.decide>["outcome"];

export type IdeaImproveApi = {
  /** False while the workspace or AI is off for this founder: the control does not render. */
  readonly enabled: boolean;
  readonly improve: (args: IdeaImproveArgs) => Promise<IdeaImproveResult>;
  readonly decide: (args: { improvementId: IdeaImproveId; outcome: IdeaImproveOutcome }) => Promise<unknown>;
};

/** The Convex binding. Call it where a Convex client is in scope. */
export function useIdeaImproveApi(): IdeaImproveApi {
  const availability = useQuery(api.workspace.ideaImprove.availability, {});
  const improve = useAction(api.workspace.ideaImprove.improve);
  const decide = useMutation(api.workspace.ideaImprove.decide);
  return {
    enabled: typeof availability === "object" && availability !== null && availability.enabled === true,
    improve,
    decide,
  };
}

/** Notices the control shows in place; each leaves the founder's text as it was. */
export type IdeaImproveNotice =
  | "already_clear"
  | "not_an_idea"
  | "rejected"
  | "failed"
  | "rate_limited"
  | "too_short"
  | "invalid"
  | "unavailable";

export const IDEA_IMPROVE_NOTICE_COPY: Record<IdeaImproveNotice, string> = {
  already_clear: "Your sentence is already clear. Nothing to change.",
  not_an_idea: "Say what you want to build and who it is for, then try again.",
  rejected: "We couldn't sharpen this without changing your idea, so yours stays as it is.",
  failed: "Couldn't improve it just now. Your idea is unchanged.",
  rate_limited: "You've used today's improvements. Your idea works as it is, so carry on.",
  too_short: "Write a few words first.",
  invalid: "Improve works on one line of up to 240 characters.",
  unavailable: "Improve isn't available right now. Your idea works as it is, so carry on.",
};

/** Notices after which Try again makes sense. */
const RETRYABLE: ReadonlySet<IdeaImproveNotice> = new Set(["failed", "rejected", "unavailable"]);

type Round = { readonly improvementId: IdeaImproveId; readonly before: string; readonly after: string };

export type IdeaImproveState =
  | { readonly phase: "idle" }
  | { readonly phase: "loading"; readonly mode: "whole" | "selection" }
  | {
      readonly phase: "suggestion";
      readonly improvementId: IdeaImproveId;
      readonly mode: "whole" | "selection";
      readonly before: string;
      readonly text: string;
      readonly changeNote: string;
      /** The founder typed after asking: the card stays, marked as based on the earlier text. */
      readonly stale: boolean;
    }
  | { readonly phase: "accepted" }
  | { readonly phase: "notice"; readonly notice: IdeaImproveNotice; readonly retryable: boolean };

type Options = {
  readonly api: IdeaImproveApi;
  readonly fieldId: string;
  readonly text: string;
  readonly setText: (text: string) => void;
};

function focusFieldAtEnd(fieldId: string) {
  const field = document.getElementById(fieldId);
  if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)) return;
  field.focus();
  const end = field.value.length;
  field.setSelectionRange(end, end);
}

function selectionIn(fieldId: string): { start: number; end: number } | null {
  const field = document.getElementById(fieldId);
  if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)) return null;
  const { selectionStart, selectionEnd } = field;
  if (selectionStart === null || selectionEnd === null || selectionEnd <= selectionStart) return null;
  if (field.value.slice(selectionStart, selectionEnd).trim() === "") return null;
  return { start: selectionStart, end: selectionEnd };
}

export function useIdeaImprove({ api, fieldId, text, setText }: Options) {
  const [state, setState] = useState<IdeaImproveState>({ phase: "idle" });
  const [announcement, setAnnouncement] = useState("");
  const [hasSelection, setHasSelection] = useState(false);
  /** Accepted rounds, oldest first: Undo pops one, Back to my words returns the first `before`. */
  const [rounds, setRounds] = useState<readonly Round[]>([]);
  /** Bumped by Stop and by each new request, so a late reply is ignored. */
  const requestRef = useRef(0);
  /** The text this hook last wrote, to tell the founder's typing from our own updates. */
  const writtenRef = useRef<string | null>(null);

  const canImprove = wordCount(text) >= IDEA_IMPROVE_MIN_WORDS;

  // Follow the selection so the button can say "Improve selection".
  useEffect(() => {
    const update = () => setHasSelection(selectionIn(fieldId) !== null);
    document.addEventListener("selectionchange", update);
    const field = document.getElementById(fieldId);
    field?.addEventListener("select", update);
    field?.addEventListener("keyup", update);
    field?.addEventListener("mouseup", update);
    return () => {
      document.removeEventListener("selectionchange", update);
      field?.removeEventListener("select", update);
      field?.removeEventListener("keyup", update);
      field?.removeEventListener("mouseup", update);
    };
  }, [fieldId]);

  // The founder typing: a suggestion goes stale, Undo no longer applies, a notice clears.
  useEffect(() => {
    if (writtenRef.current === text) return;
    writtenRef.current = null;
    setState((current) => {
      if (current.phase === "suggestion") return current.stale ? current : { ...current, stale: true };
      if (current.phase === "accepted" || current.phase === "notice") return { phase: "idle" };
      return current;
    });
    setRounds((current) => (current.length === 0 ? current : []));
  }, [text]);

  const write = useCallback(
    (next: string) => {
      writtenRef.current = next;
      setText(next);
    },
    [setText],
  );

  const run = useCallback(async () => {
    if (state.phase === "loading") return;
    if (!canImprove) {
      setState({ phase: "notice", notice: "too_short", retryable: false });
      setAnnouncement(IDEA_IMPROVE_NOTICE_COPY.too_short);
      return;
    }
    if (state.phase === "suggestion") void api.decide({ improvementId: state.improvementId, outcome: "retried" }).catch(() => undefined);
    const selection = selectionIn(fieldId);
    const before = text;
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setState({ phase: "loading", mode: selection === null ? "whole" : "selection" });
    setAnnouncement(selection === null ? "Improving your idea…" : "Improving the words you picked…");
    let result: IdeaImproveResult;
    try {
      const parent = rounds.at(-1)?.improvementId;
      result = await api.improve({
        text: before,
        ...(selection === null ? {} : { selection }),
        ...(parent === undefined ? {} : { parentId: parent }),
      });
    } catch {
      result = { status: "unavailable" };
    }
    if (requestRef.current !== requestId) return; // Stopped, or superseded.
    if (result.status === "suggested") {
      setState({
        phase: "suggestion",
        improvementId: result.improvementId,
        mode: result.mode,
        before,
        text: result.text,
        changeNote: result.changeNote,
        stale: false,
      });
      setAnnouncement(`Suggestion ready: ${result.text} Use this, try again or keep yours.`);
      return;
    }
    const notice: IdeaImproveNotice = result.status;
    setState({ phase: "notice", notice, retryable: RETRYABLE.has(notice) });
    setAnnouncement(IDEA_IMPROVE_NOTICE_COPY[notice]);
  }, [api, canImprove, fieldId, rounds, state, text]);

  const stop = useCallback(() => {
    requestRef.current += 1;
    setState({ phase: "idle" });
    setAnnouncement("Stopped. Your idea is unchanged.");
  }, []);

  const accept = useCallback(() => {
    if (state.phase !== "suggestion") return;
    // A stale card still replaces the field with the full suggested sentence; Undo returns what was there.
    const before = text;
    write(state.text);
    setRounds((current) => [...current, { improvementId: state.improvementId, before, after: state.text }]);
    setState({ phase: "accepted" });
    setAnnouncement(`Your idea now reads: ${state.text} Undo is available.`);
    void api.decide({ improvementId: state.improvementId, outcome: "accepted" }).catch(() => undefined);
    requestAnimationFrame(() => focusFieldAtEnd(fieldId));
  }, [api, fieldId, state, text, write]);

  const dismiss = useCallback(() => {
    if (state.phase === "suggestion") {
      void api.decide({ improvementId: state.improvementId, outcome: "dismissed" }).catch(() => undefined);
      setAnnouncement("Kept your words.");
    }
    setState({ phase: rounds.length > 0 ? "accepted" : "idle" });
    requestAnimationFrame(() => focusFieldAtEnd(fieldId));
  }, [api, fieldId, rounds.length, state]);

  const undo = useCallback(() => {
    const last = rounds.at(-1);
    if (last === undefined) return;
    write(last.before);
    const rest = rounds.slice(0, -1);
    setRounds(rest);
    setState({ phase: rest.length > 0 ? "accepted" : "idle" });
    setAnnouncement(rest.length > 0 ? `Undone. Your idea reads: ${last.before}` : "Restored your words.");
    void api.decide({ improvementId: last.improvementId, outcome: "undone" }).catch(() => undefined);
    requestAnimationFrame(() => focusFieldAtEnd(fieldId));
  }, [api, fieldId, rounds, write]);

  const restoreOriginal = useCallback(() => {
    const first = rounds[0];
    if (first === undefined) return;
    write(first.before);
    for (const round of rounds) void api.decide({ improvementId: round.improvementId, outcome: "undone" }).catch(() => undefined);
    setRounds([]);
    setState({ phase: "idle" });
    setAnnouncement("Restored your words.");
    requestAnimationFrame(() => focusFieldAtEnd(fieldId));
  }, [api, fieldId, rounds, write]);

  return {
    state,
    announcement,
    canImprove,
    hasSelection,
    rounds: rounds.length,
    /** The improvement behind the field's current text, if the founder kept one. */
    acceptedId: rounds.at(-1)?.after === text ? rounds.at(-1)?.improvementId ?? null : null,
    run,
    stop,
    accept,
    dismiss,
    undo,
    restoreOriginal,
  };
}

export type IdeaImproveController = ReturnType<typeof useIdeaImprove>;
