/**
 * WP100. "Improve with AI" on wizard Step 1: the request rules and the checks
 * every model suggestion passes before a founder sees it
 * (`docs/design/wizard-idea-ai-improve.md` §6).
 *
 * The prompt asks for all of this; code checks it anyway. A suggestion that
 * fails any check comes back `rejected` ("Yours stands"), never as text, so a
 * founder never sees an invented number, a hype word or an idea that is no
 * longer theirs.
 *
 * Pure: no env, no network, no clock.
 */

import { singleLineText } from "../contracts/roster.ts";
import { WIZARD_LIMITS } from "../contracts/wizard.ts";
import { hasMarketClaim } from "../contracts/marketClaims.ts";
import { cleanOwnIdeaHints, type OwnIdeaHints } from "./idea-hints.ts";
import { IDEA_IMPROVE_NOTE_MAX, type IdeaImproveOutput } from "./idea-improve-output.ts";

export { IDEA_IMPROVE_NOTE_MAX, IDEA_IMPROVE_STATUSES, IDEA_TEXT_MAX, ideaImproveOutputSchema, type IdeaImproveOutput } from "./idea-improve-output.ts";

export const IDEA_IMPROVE_PROMPT_ID = "wizard-idea-improve";
/** Fewer words than this and there is nothing to improve yet. */
export const IDEA_IMPROVE_MIN_WORDS = 3;
/** C-LIMITS `ideaImprove`: improve calls per founder per UTC day (owner decision 1). */
export const IDEA_IMPROVE_DAILY_CAP = 20;
export const IDEA_IMPROVE_DEFAULT_NOTE = "Kept your idea and made it clearer.";

export const IDEA_IMPROVE_MODES = ["whole", "selection"] as const;
export type IdeaImproveMode = (typeof IDEA_IMPROVE_MODES)[number];

// ---------------------------------------------------------------------------
// The request
// ---------------------------------------------------------------------------

export type IdeaSelection = { readonly start: number; readonly end: number };

export type IdeaImproveRequest = {
  readonly text: string;
  readonly selection: IdeaSelection | null;
};

export type IdeaImproveRequestError = "too_short" | "invalid_text" | "invalid_selection";

const ideaTextSchema = singleLineText(WIZARD_LIMITS.ownIdea);

export function wordCount(text: string): number {
  return text.trim().split(/\s+/u).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}

/**
 * The request as the server will run it, or why it cannot run. The text is
 * the field exactly as typed (not trimmed), so selection offsets line up with
 * what the founder selected; a selection that covers the whole text is the
 * whole-idea mode.
 */
export function parseIdeaImproveRequest(
  text: string,
  selection: IdeaSelection | null | undefined,
): { ok: true; request: IdeaImproveRequest } | { ok: false; error: IdeaImproveRequestError } {
  if (typeof text !== "string" || text.length > WIZARD_LIMITS.ownIdea || !ideaTextSchema.safeParse(text).success) {
    return { ok: false, error: "invalid_text" };
  }
  if (wordCount(text) < IDEA_IMPROVE_MIN_WORDS) return { ok: false, error: "too_short" };
  if (selection === null || selection === undefined) return { ok: true, request: { text, selection: null } };
  const { start, end } = selection;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end > text.length || end <= start) {
    return { ok: false, error: "invalid_selection" };
  }
  const picked = text.slice(start, end);
  if (!/[\p{L}\p{N}]/u.test(picked)) return { ok: false, error: "invalid_selection" };
  if (text.slice(0, start).trim() === "" && text.slice(end).trim() === "") {
    return { ok: true, request: { text, selection: null } };
  }
  return { ok: true, request: { text, selection: { start, end } } };
}

export function modeOf(request: IdeaImproveRequest): IdeaImproveMode {
  return request.selection === null ? "whole" : "selection";
}

// ---------------------------------------------------------------------------
// The checks
// ---------------------------------------------------------------------------

export const IDEA_IMPROVE_REJECT_REASONS = [
  "empty",
  "too_long",
  "not_single_line",
  "more_sentences",
  "new_number",
  "new_market_claim",
  "new_proper_noun",
  "hype",
  "lost_meaning",
  "selection_overflow",
] as const;
export type IdeaImproveRejectReason = (typeof IDEA_IMPROVE_REJECT_REASONS)[number];

export type IdeaImproveVerdict =
  | { readonly status: "suggested"; readonly text: string; readonly changeNote: string; readonly hints: OwnIdeaHints }
  | { readonly status: "already_clear" }
  | { readonly status: "not_an_idea" }
  | { readonly status: "rejected"; readonly reason: IdeaImproveRejectReason };

/** Words that make a founder's sentence read like an ad (copy rules, `crewShared.ts`). */
const HYPE = [
  "revolutionize", "revolutionise", "revolutionary", "game-changer", "game changer", "game-changing", "seamless",
  "seamlessly", "unlock", "unlocks", "cutting-edge", "cutting edge", "next-gen", "next-generation", "world-class",
  "best-in-class", "disrupt", "disruptive", "supercharge", "effortless", "effortlessly", "ultimate", "leverage",
  "synergy", "empower", "empowers", "skyrocket", "10x",
] as const;

const STOP_WORDS = new Set([
  "about", "after", "again", "also", "and", "app", "apps", "basically", "because", "been", "before", "being",
  "both", "could", "does", "doing", "each", "every", "from", "have", "help", "helps", "into", "just", "kind",
  "like", "make", "makes", "more", "most", "much", "only", "other", "over", "really", "some", "something", "sort",
  "stuff", "such", "than", "that", "their", "them", "then", "there", "these", "they", "thing", "things", "this",
  "those", "through", "tool", "very", "want", "what", "when", "where", "which", "while", "will", "with", "would",
  "your", "website", "platform", "service",
]);

const CALENDAR = new Set([
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "january", "february", "march",
  "april", "may", "june", "july", "august", "september", "october", "november", "december", "i",
]);

const EMOJI = /\p{Extended_Pictographic}/u;
/** A sentence end followed by more text: "Plans. For nurses". */
const MID_SENTENCE_END = /[.!?]+["')\]]?\s+\S/gu;

function normalised(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/gu, " ").trim();
}

function numbersIn(text: string): string[] {
  return (text.match(/\d+(?:[.,]\d+)*/gu) ?? []).map((n) => n.replace(/,/gu, ""));
}

function contentWords(text: string): string[] {
  return normalised(text).split(" ").filter((word) => word.length >= 4 && !STOP_WORDS.has(word));
}

/** Words written with a capital (or in capitals) that are not the sentence's first word. */
function properNouns(text: string): string[] {
  const words = text.trim().split(/\s+/u);
  return words
    .slice(1)
    .map((word) => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
    .filter((word) => /^\p{Lu}/u.test(word));
}

function hasHype(text: string): boolean {
  const lower = ` ${text.toLowerCase()} `;
  return HYPE.some((word) => new RegExp(`(?<![\\p{L}-])${word.replace(/[-\s]/gu, "[-\\s]")}(?![\\p{L}-])`, "u").test(lower));
}

/**
 * Checks a candidate sentence against the founder's text it came from. `source`
 * is the founder's whole text before the change.
 */
export function rejectReason(source: string, candidate: string): IdeaImproveRejectReason | null {
  if (candidate.trim().length === 0) return "empty";
  if (candidate.length > WIZARD_LIMITS.ownIdea) return "too_long";
  if (!ideaTextSchema.safeParse(candidate).success) return "not_single_line";
  if ((candidate.match(MID_SENTENCE_END) ?? []).length > (source.match(MID_SENTENCE_END) ?? []).length) {
    return "more_sentences";
  }
  // Most specific first, so the stored reason says what actually went wrong.
  if (hasMarketClaim(candidate) && !hasMarketClaim(source)) return "new_market_claim";
  const sourceNumbers = new Set(numbersIn(source));
  if (numbersIn(candidate).some((n) => !sourceNumbers.has(n))) return "new_number";
  if (EMOJI.test(candidate) || candidate.includes("!")) return "hype";
  if (hasHype(candidate) && !hasHype(source)) return "hype";
  if (!/\bai\b/iu.test(source) && /\bai[-\s]?(powered|driven|based)\b/iu.test(candidate)) return "hype";
  const sourceWords = new Set(normalised(source).split(" "));
  const newNames = properNouns(candidate).filter((word) => {
    const lower = word.toLowerCase();
    return !sourceWords.has(lower) && !CALENDAR.has(lower);
  });
  if (newNames.length > 0) return "new_proper_noun";
  const kept = contentWords(source);
  if (kept.length > 0) {
    const candidateWords = contentWords(candidate);
    const shares = kept.some((word) => candidateWords.some((other) => other === word || other.slice(0, 4) === word.slice(0, 4)));
    if (!shares) return "lost_meaning";
  }
  return null;
}

function changeNoteFrom(raw: string): string {
  const note = raw.replace(/\s+/gu, " ").trim();
  if (note.length < 3 || note.length > IDEA_IMPROVE_NOTE_MAX) return IDEA_IMPROVE_DEFAULT_NOTE;
  if (hasMarketClaim(note) || hasHype(note) || EMOJI.test(note) || /[<>]/u.test(note)) return IDEA_IMPROVE_DEFAULT_NOTE;
  return note;
}

function sameSentence(a: string, b: string): boolean {
  return normalised(a) === normalised(b);
}

/** The full sentence a selection-mode replacement produces. */
export function spliceSelection(text: string, selection: IdeaSelection, replacement: string): string {
  const before = text.slice(0, selection.start);
  const after = text.slice(selection.end);
  const middle = replacement.trim();
  const left = before.length > 0 && !/\s$/u.test(before) && middle.length > 0 && /^[\p{L}\p{N}]/u.test(middle) && /[\p{L}\p{N}]$/u.test(before) ? `${before} ` : before;
  const right = after.length > 0 && !/^\s/u.test(after) && /^[\p{L}\p{N}]/u.test(after) && /[\p{L}\p{N}]$/u.test(middle) ? ` ${after}` : after;
  return `${left}${middle}${right}`.replace(/[ \t]{2,}/gu, " ").trim();
}

/** The verdict on one model output for one request. */
export function judgeIdeaImprovement(request: IdeaImproveRequest, output: IdeaImproveOutput): IdeaImproveVerdict {
  if (output.status === "not_an_idea") return { status: "not_an_idea" };
  if (output.status === "already_clear") return { status: "already_clear" };
  const source = request.text.trim();
  let candidate: string;
  if (request.selection === null) {
    candidate = output.text.replace(/\s+/gu, " ").trim();
  } else {
    const replacement = output.text.replace(/\s+/gu, " ").trim();
    if (replacement.length === 0) return { status: "rejected", reason: "empty" };
    // A model that returns the whole sentence instead of the selected words
    // would duplicate the text around the selection.
    const before = request.text.slice(0, request.selection.start).trim();
    const after = request.text.slice(request.selection.end).trim();
    const echoes = (part: string) => part.length >= 8 && replacement.toLowerCase().includes(part.toLowerCase());
    if (echoes(before) || echoes(after)) return { status: "rejected", reason: "selection_overflow" };
    candidate = spliceSelection(request.text, request.selection, replacement);
  }
  if (sameSentence(candidate, source)) return { status: "already_clear" };
  const reason = rejectReason(source, candidate);
  if (reason !== null) return { status: "rejected", reason };
  return {
    status: "suggested",
    text: candidate,
    changeNote: changeNoteFrom(output.changeNote),
    hints: cleanOwnIdeaHints(output.hints),
  };
}

// ---------------------------------------------------------------------------
// What the client sees
// ---------------------------------------------------------------------------

export type IdeaImproveResult =
  | {
      readonly status: "suggested";
      readonly improvementId: string;
      readonly mode: IdeaImproveMode;
      readonly text: string;
      readonly changeNote: string;
    }
  | { readonly status: "already_clear" | "not_an_idea" | "rejected" | "failed"; readonly improvementId: string }
  | { readonly status: "too_short" | "invalid" | "rate_limited" | "unavailable" };
