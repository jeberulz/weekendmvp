/**
 * WP77-S5 — Wren memory: the sanitiser, the refusal rules and the pure state
 * changes behind `wren_memory` (facts plus a rolling summary). Pure: no
 * Convex, no I/O, no clock. Used by the server (`convex/workspace/wrenMemory.ts`)
 * and by the Files page for instant form feedback.
 *
 * Memory is a persistence vector for prompt injection: a fact Wren writes is
 * model output, which can echo founder text, document text or an injected
 * instruction, and it is read back into every later chat. So the rules
 * depend on who wrote the text.
 *
 * Every note, from anyone:
 * - cleaned: Unicode NFKC, lone surrogates and invisible / bidi / tag
 *   characters dropped, control characters and runs of whitespace folded to
 *   one space, trimmed;
 * - bounded: `WREN_MEMORY_FACT_MAX_CHARS` per fact, `WREN_MEMORY_SUMMARY_MAX_CHARS`
 *   for the summary (counted in characters after cleaning; refused, never
 *   cut), `WREN_MEMORY_FACTS_MAX` facts;
 * - refused when it holds a scheme URL (`https://`, `javascript:`), a markup
 *   tag (`<` then a letter, `/` or `!`, so "<500 words" passes) or a chat role
 *   tag (`system:`, `assistant:`, a leading `user:`).
 *
 * The founder's own edits stop there: they are the founder's words, as trusted
 * as their chat messages, so bare domains and emails ("peakpace.co",
 * "sam@peakpace.co") and imperative phrasing are allowed.
 *
 * Wren's notes (model output) are held to more, conservatively:
 * - no link of any kind: bare domains, "dot com" spellings, emails;
 * - no other markup: backticks, template braces, markdown links, entities;
 * - no text that reads like an instruction or is about Wren's own powers:
 *   ignore / override phrasing, "always approve", "you must", anything about
 *   approvals or cards, rules, priority, policy or guidance, earlier
 *   messages, skipping, pre-approval or the founder having approved, Wren
 *   itself, "when asked", "going forward", spelled-out letters
 *   ("I-g-n-o-r-e") and encoded blobs (base64);
 * - provenance (`WREN_NOTE_MIN_OVERLAP`): a fact must come from this turn's
 *   founder message, a summary from that message plus the business's own
 *   notes. At least 60% of the note's content words (letters or digits, 3 or
 *   more long, not a stop word, NFKC and lower case) must appear in the
 *   sources, compared on their first 5 characters so "launching" matches
 *   "launch". A note with no content word fails. This stops an injected
 *   instruction that the founder never wrote from being stored, whatever its
 *   wording.
 *
 * These filters are a first line, not the control. The controls are that
 * memory reaches the model only as quoted JSON inside `<business_context>`
 * (escaped, labelled as notes, not instructions), and that nothing Wren writes
 * can act: cards are only proposals (WP77-S4) and every side effect needs the
 * founder's click.
 *
 * Provenance in storage: `wren_memory` has no field saying who wrote a fact,
 * so a founder-edited fact cannot be told apart from Wren's. To never drop a
 * founder's fact silently, nothing is evicted: once the list is full, a new
 * fact from Wren is refused (`memory_full`) and the Files page asks the
 * founder to delete one. With a provenance field (WP77 Needs from Codex #15)
 * the oldest Wren-written facts could be evicted first instead.
 */

import {
  WREN_FACTS_PER_TURN,
  WREN_MEMORY_FACT_MAX_CHARS,
  WREN_MEMORY_FACT_MIN_CHARS,
  WREN_MEMORY_FACTS_MAX,
  WREN_MEMORY_SUMMARY_MAX_CHARS,
} from "./contracts/wrenMemory";
import { dropLoneSurrogates, isControlChar, isInvisibleChar } from "./plainText";

/** Refusals that apply to anyone's note (the founder's edits get only these, plus `duplicate`). */
export const WREN_MEMORY_TEXT_REFUSALS = [
  /** Nothing left after cleaning. */
  "empty",
  /** Shorter than `WREN_MEMORY_FACT_MIN_CHARS`. */
  "too_short",
  /** Longer than the fact or summary limit. */
  "too_long",
  /** A link. Founder: a scheme URL only. Wren: any URL, bare domain or email. */
  "has_link",
  /** Founder: a markup tag. Wren: also backticks, template braces, markdown links, HTML entities. */
  "has_markup",
  /** A chat role tag (`system:`, `assistant:`, `developer:`, a leading `user:`). */
  "has_role_tag",
] as const;
export type MemoryTextRefusal = (typeof WREN_MEMORY_TEXT_REFUSALS)[number];

/** Refusals for Wren's notes only. */
export const WREN_NOTE_REFUSALS = [
  /** Reads like an instruction to the assistant, or is about approvals, cards, rules or Wren itself. */
  "looks_like_instruction",
  /** Spelled-out letters or an encoded blob (base64). */
  "looks_encoded",
  /** Too few of its words come from the founder's message (and, for a summary, the business's notes). */
  "not_from_founder",
] as const;
export type WrenNoteRefusal = MemoryTextRefusal | (typeof WREN_NOTE_REFUSALS)[number];

/** Why one proposed fact was not stored. */
export type WrenFactRefusal =
  | WrenNoteRefusal
  /** Already in memory, or twice in one reply. */
  | "duplicate"
  /** Memory holds `WREN_MEMORY_FACTS_MAX` facts. */
  | "memory_full"
  /** At or past position `WREN_FACTS_PER_TURN` in the reply's `remember` list. */
  | "over_cap";

/** Why a proposed summary was not stored. */
export type WrenSummaryRefusal =
  | WrenNoteRefusal
  /** Memory changed after the turn loaded it (the founder edited it, or another write): Wren's rewrite is skipped. */
  | "stale";

export type WrenMemoryState = { readonly facts: readonly string[]; readonly summary: string };

export const EMPTY_WREN_MEMORY: WrenMemoryState = { facts: [], summary: "" };

/**
 * Unicode NFKC, lone surrogates and invisible characters dropped, control
 * characters and whitespace folded to one space, trimmed.
 */
export function cleanMemoryText(raw: string): string {
  let out = "";
  let gap = false;
  for (const char of dropLoneSurrogates(raw).normalize("NFKC")) {
    const code = char.codePointAt(0) ?? 0;
    if (isInvisibleChar(code)) continue;
    if (isControlChar(code) || char.trim() === "") {
      gap = out.length > 0;
      continue;
    }
    if (gap) out += " ";
    gap = false;
    out += char;
  }
  return out;
}

/** Length in code points (what the founder sees as characters). */
export function memoryTextLength(text: string): number {
  return Array.from(text).length;
}

/** The length the server will count: code points after cleaning (the Files page counter uses this). */
export function cleanedMemoryLength(raw: string): number {
  return memoryTextLength(cleanMemoryText(raw));
}

/**
 * Raw input longer than this many times the limit is refused unread. Generous,
 * so a short note padded with spaces or invisible characters is cleaned and
 * accepted, while the work stays bounded.
 */
const PRECLEAN_FACTOR = 32;

/** Links anyone's note may not hold: a scheme URL or a script / data scheme. */
const SCHEME_LINK_PATTERNS: readonly RegExp[] = [
  /\b[a-z][a-z0-9+.-]*:\/\//u,
  /\b(?:mailto|javascript|vbscript|data|file|tel):/u,
];

const TLD = "com|net|org|io|ai|co|app|dev|xyz|me|info|biz|ly|gg|sh|link|site|online|store|shop|so|to|tv|us|uk|ru|cn|page|live|click|top|de|fr|es|it|nl|eu|ca|au|in|example";

/** Links Wren's notes also may not hold: bare domains, "dot com" spellings, emails. */
const WREN_LINK_PATTERNS: readonly RegExp[] = [
  ...SCHEME_LINK_PATTERNS,
  /\bwww\./u,
  /[^\s@]+\s*@\s*[^\s@]+\s*\.\s*[a-z]{2,}/u,
  new RegExp(`\\b[a-z0-9-]+\\s*[.\\u3002\\u2024]\\s*(?:${TLD})\\b`, "u"),
  new RegExp(`\\b[a-z0-9-]+\\s*(?:\\[\\.\\]|\\(\\.\\)|\\bdot\\b)\\s*(?:${TLD})\\b`, "u"),
  /\b[a-z0-9-]+\.[a-z]{2,}\/\S/u,
];

/** A markup tag: `<` then a letter, `/` or `!`. "<500 words" is not one. */
const TAG_PATTERNS: readonly RegExp[] = [/<[a-z/!]/u, /\[\/?inst\]|<<\/?sys>>/u];

const WREN_MARKUP_PATTERNS: readonly RegExp[] = [
  ...TAG_PATTERNS,
  /\b(?:business_context|founder_message)\b/u,
  /`/u,
  /\{\{|\}\}|\{%|%\}/u,
  /\[[^\]]*\]\s*\(/u,
  /&(?:#\d+|#x[0-9a-f]+|[a-z]+);/u,
];

const ROLE_TAG_PATTERNS: readonly RegExp[] = [
  /\b(?:system|assistant|developer|tool)\s*:/u,
  /\bsys\s*tem\s*:/u,
  /^(?:user|human|ai|model)\s*:/u,
  /[—–-]\s*(?:user|human)\s*:/u,
];

/** Phrasing that addresses the assistant, or is about what it may do. Wren's notes only. */
const INSTRUCTION_PATTERNS: readonly RegExp[] = [
  /\b(?:ignore|disregard|forget|override|bypass)\b.{0,40}\b(?:instructions?|rules?|prompts?|previous|prior|above|earlier|everything|guidelines?|before|limits?|restrictions?|safeguards?|checks?|founder|message)\b/u,
  /\b(?:system|developer|hidden)\s+(?:prompt|message|instructions?|rules?)\b/u,
  /\bnew\s+(?:instructions?|rules?|orders)\b/u,
  /\bfrom\s+now\s+on\b|\bgoing\s+forward\b|\bhenceforth\b|\bin\s+(?:all\s+)?future\s+(?:replies|chats|turns)\b/u,
  /\b(?:always|automatically|auto|silently|immediately)[\s-]+(?:approve|publish|send|post|spend|launch|delete|accept|confirm|click|buy|pay|charge|raise|create|add)\b/u,
  /\b(?:approve|publish|send|post|spend|delete|accept|confirm)\s+(?:all|every|everything|anything|each)\b/u,
  /\bwithout\s+(?:asking|approval|permission|confirmation|consent|checking|waiting)\b/u,
  /\b(?:you|wren|assistant|ai)\s+(?:must|should|shall|will\s+now|are\s+to|have\s+to|need\s+to|may\s+now|can|may|is\s+allowed)\b/u,
  /\b(?:act|behave|respond)\s+as\b/u,
  /\bpretend\b|\bjailbreak\b|\broleplay\b/u,
  /\b(?:admin|developer|god|debug|sudo|root)\s+(?:mode|access)\b|\byou\s+are\s+root\b/u,
  /\breveal\b.{0,30}\b(?:rules|prompt|instructions)\b/u,
  /\bdo\s+not\s+(?:tell|ask|show|mention|warn)\b|\bdon't\s+(?:tell|ask|show|mention|warn)\b/u,
  // About Wren's powers: approvals and cards, consent given in advance, skipping steps.
  /\b(?:approv\w*|pre-?approv\w*|cards?|authori[sz]\w*|consent\w*|permissions?|sign(?:ed)?[\s-]off|okayed|permitted|granted)\b/u,
  /\b(?:skip|skips|skipped|skipping|circumvent\w*)\b/u,
  // About rules, priority and earlier guidance.
  /\b(?:instructions?|rules?|polic(?:y|ies)|priority|priorities|precedence|directives?|guidance|guidelines?|prompts?|commands?)\b/u,
  /\bno\s+attention\b|\bpay\s+no\b|\bnever\s*mind\b/u,
  /\b(?:earlier|previous|prior|above|preceding)\s+(?:messages?|notes?|text|context|turns?)\b/u,
  /\btreat\b.{0,40}\bas\b/u,
  /\bwhen\s+(?:asked|prompted|told|requested)\b/u,
  // About Wren itself.
  /\b(?:wren|assistant|chatbot|claude|gpt|llm)\b/u,
];

/** Spelled-out letters ("i-g-n-o-r-e") and encoded blobs. Matched on the cleaned text, case kept. */
const ENCODED_PATTERNS: readonly RegExp[] = [
  /\\u[0-9a-fA-F]{4}|\\x[0-9a-fA-F]{2}|\\n|\\t/u,
  /(?:^|[^\p{L}\p{N}])(?:\p{L}[-_.*·•|/\\+~ ]){3,}\p{L}(?![\p{L}\p{N}])/u,
  /[A-Za-z0-9+/]{24,}={0,2}/u,
  /(?=[A-Za-z0-9+/]*\d)(?=[A-Za-z0-9+/]*[A-Z])(?=[A-Za-z0-9+/]*[a-z])[A-Za-z0-9+/]{16,}={0,2}/u,
];

/** Who wrote the note: the founder's own edit, or Wren (model output). */
export type MemoryAuthor = "founder" | "wren";

/** The first refusal for already-cleaned text, or null. Matched on a lower-case copy. */
function refusalFor(text: string, author: MemoryAuthor): WrenNoteRefusal | null {
  const lower = text.toLowerCase();
  const strict = author === "wren";
  if ((strict ? WREN_LINK_PATTERNS : SCHEME_LINK_PATTERNS).some((pattern) => pattern.test(lower))) return "has_link";
  if ((strict ? WREN_MARKUP_PATTERNS : TAG_PATTERNS).some((pattern) => pattern.test(lower))) return "has_markup";
  if (ROLE_TAG_PATTERNS.some((pattern) => pattern.test(lower))) return "has_role_tag";
  if (!strict) return null;
  if (ENCODED_PATTERNS.some((pattern) => pattern.test(text))) return "looks_encoded";
  if (INSTRUCTION_PATTERNS.some((pattern) => pattern.test(lower))) return "looks_like_instruction";
  return null;
}

/** Words that carry no fact on their own; never counted for provenance. */
const STOP_WORDS = new Set([
  "the", "and", "for", "are", "was", "were", "with", "that", "this", "these", "those", "from", "have", "has", "had",
  "our", "ours", "their", "they", "them", "its", "his", "her", "hers", "she", "him", "you", "your", "will", "would",
  "not", "but", "all", "any", "can", "could", "who", "what", "when", "where", "which", "why", "how", "into", "onto",
  "about", "than", "then", "there", "here", "also", "just", "very", "some", "more", "most", "such", "each", "only",
  "out", "over", "under", "again", "been", "being", "does", "did", "doing", "done", "should", "shall", "may", "might",
  "must", "per", "via", "yet", "still", "now", "too", "own", "same", "other", "both", "few", "nor", "off", "ever",
  "plan", "planned", "planning", "wants", "want", "wanted", "likes", "prefers", "founder", "founders", "business",
  "said", "says", "say", "told", "is", "it", "be", "we", "us", "me", "my", "mine",
]);

/** Content words: letters or digits, 3 or more long, not a stop word; NFKC, lower case. */
export function contentWords(text: string): string[] {
  const words = cleanMemoryText(text).toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  return words.filter((word) => memoryTextLength(word) >= 3 && !STOP_WORDS.has(word));
}

/** A word compared on its first 5 characters ("launching" and "launch" match). */
function stem(word: string): string {
  return Array.from(word).slice(0, 5).join("");
}

/** The least share of a Wren note's content words that must come from its sources. */
export const WREN_NOTE_MIN_OVERLAP = 0.6;

/** The share (0 to 1) of `note`'s content words found in `sources`; 0 when it has none. */
export function sourceOverlap(note: string, sources: readonly string[]): number {
  const words = contentWords(note);
  if (words.length === 0) return 0;
  const known = new Set(sources.flatMap(contentWords).map(stem));
  return words.filter((word) => known.has(stem(word))).length / words.length;
}

export type MemoryTextCheck =
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly code: MemoryTextRefusal };

export type WrenNoteCheck =
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly code: WrenNoteRefusal };

/** Cleans and checks one fact the founder wrote (see the file header). */
export function checkFounderFact(raw: string): MemoryTextCheck {
  return checkText(raw, WREN_MEMORY_FACT_MIN_CHARS, WREN_MEMORY_FACT_MAX_CHARS, "founder") as MemoryTextCheck;
}

/** Cleans and checks a summary the founder wrote. Empty is allowed (it clears the summary). */
export function checkFounderSummary(raw: string): MemoryTextCheck {
  if (raw.length <= WREN_MEMORY_SUMMARY_MAX_CHARS * PRECLEAN_FACTOR && cleanMemoryText(raw).length === 0) {
    return { ok: true, text: "" };
  }
  return checkText(raw, 1, WREN_MEMORY_SUMMARY_MAX_CHARS, "founder") as MemoryTextCheck;
}

/** Cleans and checks one fact Wren proposed: the strict rules, then provenance against the founder's message. */
export function checkWrenFact(raw: string, founderMessage: string): WrenNoteCheck {
  const checked = checkText(raw, WREN_MEMORY_FACT_MIN_CHARS, WREN_MEMORY_FACT_MAX_CHARS, "wren");
  if (!checked.ok) return checked;
  return sourceOverlap(checked.text, [founderMessage]) >= WREN_NOTE_MIN_OVERLAP
    ? checked
    : { ok: false, code: "not_from_founder" };
}

/**
 * Cleans and checks a summary Wren proposed: the strict rules, then provenance
 * against the founder's message plus the business's own notes (`sources`:
 * the current summary, the facts, the founder's idea text).
 */
export function checkWrenSummary(raw: string, founderMessage: string, sources: readonly string[]): WrenNoteCheck {
  const checked = checkText(raw, 1, WREN_MEMORY_SUMMARY_MAX_CHARS, "wren");
  if (!checked.ok) return checked;
  return sourceOverlap(checked.text, [founderMessage, ...sources]) >= WREN_NOTE_MIN_OVERLAP
    ? checked
    : { ok: false, code: "not_from_founder" };
}

function checkText(raw: string, min: number, max: number, author: MemoryAuthor): WrenNoteCheck {
  // Bound the work before cleaning: far past the limit is refused unread.
  if (raw.length > max * PRECLEAN_FACTOR) return { ok: false, code: "too_long" };
  const text = cleanMemoryText(raw);
  const length = memoryTextLength(text);
  if (length === 0) return { ok: false, code: "empty" };
  if (length < min) return { ok: false, code: "too_short" };
  if (length > max) return { ok: false, code: "too_long" };
  const refusal = refusalFor(text, author);
  return refusal === null ? { ok: true, text } : { ok: false, code: refusal };
}

/** The dedupe key: cleaned, lower-case, trailing punctuation dropped. */
export function factKey(text: string): string {
  return cleanMemoryText(text).toLowerCase().replace(/[\s.!?;:,]+$/u, "");
}

/**
 * A short, stable fingerprint of a memory row's content (FNV-1a over its
 * facts and summary). The turn records it when it loads memory; the writer
 * compares it before applying Wren's summary, so a founder edit made during
 * the turn is never overwritten. Content, not a timestamp, so two writes in
 * the same millisecond still differ.
 */
export function wrenMemoryVersion(state: WrenMemoryState | null): string {
  const text = state === null ? "" : JSON.stringify([state.summary, ...state.facts]);
  let hash = 0x811c9dc5;
  for (let at = 0; at < text.length; at += 1) {
    hash ^= text.charCodeAt(at);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${text.length.toString(36)}-${hash.toString(36)}`;
}

// ---------------------------------------------------------------------------
// Wren's update (from one reply)
// ---------------------------------------------------------------------------

/** What one reply proposed, already bounded by the action (untrusted). */
export type WrenMemoryProposal = { readonly remember?: readonly string[]; readonly summary?: string };

/** What the server read, not what the model said: the sources a note must come from. */
export type WrenNoteSources = {
  /** This turn's founder message (read by the writer from the paired row). */
  readonly founderMessage: string;
  /** Extra sources for the summary only: the founder's idea text and business name. */
  readonly businessText: readonly string[];
  /** Whether memory still matches what the turn loaded; false skips the summary (`stale`). */
  readonly memoryUnchanged: boolean;
};

export type WrenMemoryPlan = {
  readonly next: WrenMemoryState;
  /** Facts added this turn. */
  readonly added: number;
  readonly summaryChanged: boolean;
  readonly refused: readonly { readonly index: number; readonly code: WrenFactRefusal }[];
  /** Why a proposed summary was not stored, or null (none proposed, or stored, or unchanged). */
  readonly summaryRefused: WrenSummaryRefusal | null;
};

/**
 * Applies one reply's proposal to the current memory. New facts go to the
 * end (oldest first). Nothing is evicted (see the file header): past the
 * cap a fact is refused.
 *
 * The per-turn cap counts by position in the reply's `remember` list, not by
 * facts stored: entries at index `WREN_FACTS_PER_TURN` and later are refused
 * `over_cap` unread, even when an earlier entry was refused. Conservative on
 * purpose: a reply cannot pad the list with junk so that a later, chosen
 * entry is the one considered.
 *
 * A proposed summary replaces the old one whole, only if memory is unchanged
 * since the turn loaded it; an empty proposed summary is ignored (only the
 * founder can clear it).
 */
export function planWrenMemoryUpdate(
  current: WrenMemoryState,
  proposal: WrenMemoryProposal,
  sources: WrenNoteSources,
): WrenMemoryPlan {
  const facts = [...current.facts];
  const keys = new Set(facts.map(factKey));
  const refused: { index: number; code: WrenFactRefusal }[] = [];
  let added = 0;
  (proposal.remember ?? []).forEach((raw, index) => {
    if (index >= WREN_FACTS_PER_TURN) {
      refused.push({ index, code: "over_cap" });
      return;
    }
    const checked = checkWrenFact(raw, sources.founderMessage);
    if (!checked.ok) {
      refused.push({ index, code: checked.code });
      return;
    }
    const key = factKey(checked.text);
    if (keys.has(key)) {
      refused.push({ index, code: "duplicate" });
      return;
    }
    if (facts.length >= WREN_MEMORY_FACTS_MAX) {
      refused.push({ index, code: "memory_full" });
      return;
    }
    keys.add(key);
    facts.push(checked.text);
    added += 1;
  });

  let summary = current.summary;
  let summaryRefused: WrenSummaryRefusal | null = null;
  if (proposal.summary !== undefined && cleanMemoryText(proposal.summary).length > 0) {
    if (!sources.memoryUnchanged) {
      summaryRefused = "stale";
    } else {
      // Sources: what the founder said this turn, the notes already kept (before this turn's facts), the idea text.
      const checked = checkWrenSummary(proposal.summary, sources.founderMessage, [
        current.summary, ...current.facts, ...sources.businessText,
      ]);
      if (checked.ok) summary = checked.text;
      else summaryRefused = checked.code;
    }
  }
  return {
    next: { facts, summary },
    added,
    summaryChanged: summary !== current.summary,
    refused,
    summaryRefused,
  };
}

// ---------------------------------------------------------------------------
// The founder's edits (concurrency-safe: by index plus the text the founder saw)
// ---------------------------------------------------------------------------

export type FounderMemoryRefusal = MemoryTextRefusal | "duplicate";

export type FounderMemoryEdit =
  | { readonly kind: "saved"; readonly next: WrenMemoryState }
  | { readonly kind: "unchanged" }
  | { readonly kind: "stale" }
  | { readonly kind: "refused"; readonly code: FounderMemoryRefusal };

/** The fact at `index` is still exactly the text the founder was looking at. */
function factStillAt(current: WrenMemoryState, index: number, expected: string): boolean {
  return Number.isSafeInteger(index) && index >= 0 && index < current.facts.length && current.facts.at(index) === expected;
}

/** Replaces the fact at `index`, if it still reads `expected`. */
export function editFact(current: WrenMemoryState, index: number, expected: string, text: string): FounderMemoryEdit {
  if (!factStillAt(current, index, expected)) return { kind: "stale" };
  const checked = checkFounderFact(text);
  if (!checked.ok) return { kind: "refused", code: checked.code };
  if (checked.text === expected) return { kind: "unchanged" };
  const key = factKey(checked.text);
  if (current.facts.some((fact, at) => at !== index && factKey(fact) === key)) return { kind: "refused", code: "duplicate" };
  return { kind: "saved", next: { ...current, facts: current.facts.map((fact, at) => (at === index ? checked.text : fact)) } };
}

/** Removes the fact at `index`, if it still reads `expected`. */
export function deleteFact(current: WrenMemoryState, index: number, expected: string): FounderMemoryEdit {
  if (!factStillAt(current, index, expected)) return { kind: "stale" };
  return { kind: "saved", next: { ...current, facts: current.facts.filter((_fact, at) => at !== index) } };
}

/** Replaces (or, with empty text, clears) the summary, if it still reads `expected`. */
export function editSummary(current: WrenMemoryState, expected: string, text: string): FounderMemoryEdit {
  if (current.summary !== expected) return { kind: "stale" };
  const checked = checkFounderSummary(text);
  if (!checked.ok) return { kind: "refused", code: checked.code };
  if (checked.text === current.summary) return { kind: "unchanged" };
  return { kind: "saved", next: { ...current, summary: checked.text } };
}

/** Plain copy for a refused founder edit (the Files page). */
export function memoryRefusalCopy(code: FounderMemoryRefusal, what: "fact" | "summary"): string {
  switch (code) {
    case "empty":
      return what === "fact" ? "Write the fact, or use Delete to remove it." : "Write the summary.";
    case "too_short":
      return `A fact needs at least ${WREN_MEMORY_FACT_MIN_CHARS.toString()} characters.`;
    case "too_long":
      return what === "fact"
        ? `Keep a fact to ${WREN_MEMORY_FACT_MAX_CHARS.toString()} characters or fewer.`
        : `Keep the summary to ${WREN_MEMORY_SUMMARY_MAX_CHARS.toString()} characters or fewer.`;
    case "has_link":
      return "Wren keeps notes as plain text. Write the address without https:// (for example peakpace.co).";
    case "has_markup":
      return "Wren keeps notes as plain text. Remove tags like <b> or <script>.";
    case "has_role_tag":
      return "Wren keeps notes, not chat lines. Remove labels like \"system:\" or \"assistant:\".";
    case "duplicate":
      return "Wren already has that fact.";
  }
}

export const WREN_MEMORY_STALE_COPY = "This changed since you opened it. The list now shows the latest. Try again if you still need to.";
