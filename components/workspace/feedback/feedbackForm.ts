import { FEEDBACK_NOTE_MAX, checkNote, noteLength, type FeedbackSurface, type StepState } from "@/lib/feedback/contracts";

/**
 * Pure rules for the feedback dialog, kept out of the component so they can be
 * tested without a browser.
 */

export const NOTE_ERROR_COPY = {
  empty: "Write a few words first. What happened, or what would help?",
  too_long: `Keep it under ${FEEDBACK_NOTE_MAX.toLocaleString("en-US")} characters.`,
} as const;

export function noteCountLabel(raw: string): string {
  return `${noteLength(raw).toLocaleString("en-US")} of ${FEEDBACK_NOTE_MAX.toLocaleString("en-US")}`;
}

export function checkNoteForSubmit(raw: string): { ok: true; note: string } | { ok: false; message: string } {
  const checked = checkNote(raw);
  return checked.ok ? checked : { ok: false, message: NOTE_ERROR_COPY[checked.reason] };
}

/** The wording for a refused or failed send; nothing here reveals why beyond what the founder can act on. */
export function sendErrorCopy(code: string | null): string {
  if (code === "RATE_LIMITED") return "You have sent a lot of feedback this hour. Try again a little later. Your note is still here.";
  if (code === "INVALID_FEEDBACK") return "That note could not be saved. Check the length and try again.";
  return "That did not send. Your note is still here. Try again in a moment.";
}

export const SENT_COPY = "Thanks, your feedback was sent.";

/** "3 of 5 steps done" from the launch steps the workspace already shows. */
export function stepProgressSummary(states: readonly StepState[]): string | null {
  if (states.length === 0) return null;
  const done = states.filter((step) => step.state === "succeeded" || step.state === "skipped").length;
  return `${done} of ${states.length} launch steps done`;
}

export type FeedbackContext = {
  readonly surface: FeedbackSurface;
  readonly route: string;
  readonly projectId?: string;
  readonly stepStates: readonly StepState[];
  readonly buildVersion: string;
};
