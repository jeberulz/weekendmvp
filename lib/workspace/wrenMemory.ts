/**
 * WP77-S5 — Wren memory: the sanitiser, the refusal rules and the pure state
 * changes behind `wren_memory` (facts plus a rolling summary). Pure: no
 * Convex, no I/O, no clock. Used by the server (`convex/workspace/wrenMemory.ts`)
 * and by the Files page for instant form feedback.
 *
 * Memory is a persistence vector for prompt injection: a fact Wren writes is
 * model output, which can echo founder text, document text or an injected
 * instruction, and it is read back into every later chat. So every fact and
 * summary, from Wren or from the founder, goes through the same rules:
 * - cleaned: Unicode NFKC, invisible / bidi / tag characters dropped, control
 *   characters and runs of whitespace folded to one space, trimmed;
 * - bounded: `WREN_MEMORY_FACT_MAX_CHARS` per fact, `WREN_MEMORY_SUMMARY_MAX_CHARS`
 *   for the summary, `WREN_MEMORY_FACTS_MAX` facts, `WREN_FACTS_PER_TURN` new
 *   facts per reply;
 * - refused, conservatively: links and email addresses, markup, role tags
 *   (`system:`, `assistant:`), and text that reads like an instruction to the
 *   assistant ("ignore previous instructions", "always approve", "you must").
 *
 * These filters are a first line, not the control. A homoglyph or a novel
 * phrasing can pass them. The controls are that memory reaches the model only
 * as quoted JSON inside `<business_context>` (escaped, labelled as notes, not
 * instructions), and that nothing Wren writes can act: cards are only
 * proposals (WP77-S4) and every side effect needs the founder's click.
 *
 * Provenance: `wren_memory` has no field saying who wrote a fact, so a
 * founder-edited fact cannot be told apart from Wren's. To never drop a
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
import { isControlChar, isInvisibleChar } from "./plainText";

export const WREN_MEMORY_TEXT_REFUSALS = [
  /** Nothing left after cleaning. */
  "empty",
  /** Shorter than `WREN_MEMORY_FACT_MIN_CHARS`. */
  "too_short",
  /** Longer than the fact or summary limit. */
  "too_long",
  /** A URL, a bare domain, a scheme or an email address. */
  "has_link",
  /** Angle brackets, backticks, template braces, markdown links, HTML entities. */
  "has_markup",
  /** A chat role tag (`system:`, `assistant:`, `developer:`, a leading `user:`). */
  "has_role_tag",
  /** Reads like an instruction to the assistant. */
  "looks_like_instruction",
] as const;
export type WrenMemoryTextRefusal = (typeof WREN_MEMORY_TEXT_REFUSALS)[number];

/** Why one proposed fact was not stored. */
export type WrenFactRefusal =
  | WrenMemoryTextRefusal
  /** Already in memory, or twice in one reply. */
  | "duplicate"
  /** Memory holds `WREN_MEMORY_FACTS_MAX` facts. */
  | "memory_full"
  /** Past `WREN_FACTS_PER_TURN` in one reply. */
  | "over_cap";

export type WrenMemoryState = { readonly facts: readonly string[]; readonly summary: string };

export const EMPTY_WREN_MEMORY: WrenMemoryState = { facts: [], summary: "" };

/** Unicode NFKC, invisible characters dropped, control characters and whitespace folded to one space, trimmed. */
export function cleanMemoryText(raw: string): string {
  let out = "";
  let gap = false;
  for (const char of raw.normalize("NFKC")) {
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

const LINK_PATTERNS: readonly RegExp[] = [
  /\b[a-z][a-z0-9+.-]*:\/\//u,
  /\bwww\./u,
  /\b(?:mailto|javascript|vbscript|data|file|tel):/u,
  /[^\s@]+@[^\s@]+\.[a-z]{2,}/u,
  /\b[a-z0-9-]+\.(?:com|net|org|io|ai|co|app|dev|xyz|me|info|biz|ly|gg|sh|link|site|online|store|shop|so|to|tv|us|uk|ru|cn|page|live|click|top)\b/u,
];

const MARKUP_PATTERNS: readonly RegExp[] = [
  /[<>`]/u,
  /\{\{|\}\}|\{%|%\}/u,
  /\[[^\]]*\]\s*\(/u,
  /&(?:#\d+|#x[0-9a-f]+|[a-z]+);/u,
  /\[\/?inst\]|<<\/?sys>>/u,
];

const ROLE_TAG_PATTERNS: readonly RegExp[] = [
  /\b(?:system|assistant|developer|tool|model)\s*:/u,
  /^(?:user|human|ai)\s*:/u,
];

const INSTRUCTION_PATTERNS: readonly RegExp[] = [
  /\b(?:ignore|disregard|forget|override|bypass)\b.{0,40}\b(?:instructions?|rules?|prompts?|previous|prior|above|earlier|everything|guidelines?)\b/u,
  /\b(?:system|developer|hidden)\s+(?:prompt|message|instructions?|rules?)\b/u,
  /\bnew\s+(?:instructions?|rules?|orders)\b/u,
  /\bfrom\s+now\s+on\b/u,
  /\b(?:always|automatically|auto|silently|immediately)[\s-]+(?:approve|publish|send|post|spend|launch|delete|accept|confirm|click|buy|pay|charge|raise|create)\b/u,
  /\b(?:approve|publish|send|post|spend|delete|accept|confirm)\s+(?:all|every|everything|anything|each)\b/u,
  /\bwithout\s+(?:asking|approval|permission|confirmation|consent|checking)\b/u,
  /\b(?:you|wren|assistant|ai)\s+(?:must|should|shall|will\s+now|are\s+to|have\s+to|need\s+to|may\s+now)\b/u,
  /\b(?:act|behave|respond)\s+as\b/u,
  /\bpretend\b|\bjailbreak\b|\broleplay\b/u,
  /\b(?:admin|developer|god|debug|sudo)\s+mode\b/u,
  /\breveal\b.{0,30}\b(?:rules|prompt|instructions)\b/u,
  /\bdo\s+not\s+(?:tell|ask|show|mention|warn)\b|\bdon't\s+(?:tell|ask|show|mention|warn)\b/u,
];

/** The first refusal for already-cleaned text, or null. Matched on a lower-case copy. */
function refusalFor(text: string): WrenMemoryTextRefusal | null {
  const lower = text.toLowerCase();
  if (LINK_PATTERNS.some((pattern) => pattern.test(lower))) return "has_link";
  if (MARKUP_PATTERNS.some((pattern) => pattern.test(lower))) return "has_markup";
  if (ROLE_TAG_PATTERNS.some((pattern) => pattern.test(lower))) return "has_role_tag";
  if (INSTRUCTION_PATTERNS.some((pattern) => pattern.test(lower))) return "looks_like_instruction";
  return null;
}

export type MemoryTextCheck =
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly code: WrenMemoryTextRefusal };

/** Cleans and checks one fact (see the file header). */
export function checkMemoryFact(raw: string): MemoryTextCheck {
  return checkText(raw, WREN_MEMORY_FACT_MIN_CHARS, WREN_MEMORY_FACT_MAX_CHARS);
}

/** Cleans and checks a summary. An empty summary is allowed here (the founder may clear it). */
export function checkMemorySummary(raw: string): MemoryTextCheck {
  const text = cleanMemoryText(raw);
  if (text.length === 0) return { ok: true, text: "" };
  return checkText(text, 1, WREN_MEMORY_SUMMARY_MAX_CHARS);
}

function checkText(raw: string, min: number, max: number): MemoryTextCheck {
  // Bound the work before cleaning: far past the limit is refused unread.
  if (raw.length > max * 8) return { ok: false, code: "too_long" };
  const text = cleanMemoryText(raw);
  const length = memoryTextLength(text);
  if (length === 0) return { ok: false, code: "empty" };
  if (length < min) return { ok: false, code: "too_short" };
  if (length > max) return { ok: false, code: "too_long" };
  const refusal = refusalFor(text);
  return refusal === null ? { ok: true, text } : { ok: false, code: refusal };
}

/** The dedupe key: cleaned, lower-case, trailing punctuation dropped. */
export function factKey(text: string): string {
  return cleanMemoryText(text).toLowerCase().replace(/[\s.!?;:,]+$/u, "");
}

// ---------------------------------------------------------------------------
// Wren's update (from one reply)
// ---------------------------------------------------------------------------

/** What one reply proposed, already bounded by the action (untrusted). */
export type WrenMemoryProposal = { readonly remember?: readonly string[]; readonly summary?: string };

export type WrenMemoryPlan = {
  readonly next: WrenMemoryState;
  /** Facts added this turn. */
  readonly added: number;
  readonly summaryChanged: boolean;
  readonly refused: readonly { readonly index: number; readonly code: WrenFactRefusal }[];
  /** Why a proposed summary was not stored, or null (none proposed, or stored, or unchanged). */
  readonly summaryRefused: WrenMemoryTextRefusal | null;
};

/**
 * Applies one reply's proposal to the current memory. New facts go to the
 * end (oldest first). Nothing is evicted (see the file header): past the
 * cap a fact is refused. A proposed summary replaces the old one whole; an
 * empty proposed summary is ignored (only the founder can clear it).
 */
export function planWrenMemoryUpdate(current: WrenMemoryState, proposal: WrenMemoryProposal): WrenMemoryPlan {
  const facts = [...current.facts];
  const keys = new Set(facts.map(factKey));
  const refused: { index: number; code: WrenFactRefusal }[] = [];
  let added = 0;
  (proposal.remember ?? []).forEach((raw, index) => {
    if (index >= WREN_FACTS_PER_TURN) {
      refused.push({ index, code: "over_cap" });
      return;
    }
    const checked = checkMemoryFact(raw);
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
  let summaryRefused: WrenMemoryTextRefusal | null = null;
  if (proposal.summary !== undefined && cleanMemoryText(proposal.summary).length > 0) {
    const checked = checkMemorySummary(proposal.summary);
    if (checked.ok) summary = checked.text;
    else summaryRefused = checked.code;
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

export type FounderMemoryRefusal = WrenMemoryTextRefusal | "duplicate";

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
  const checked = checkMemoryFact(text);
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
  const checked = checkMemorySummary(text);
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
      return "Wren keeps notes as plain text. Remove links and email addresses.";
    case "has_markup":
      return "Wren keeps notes as plain text. Remove code, brackets and markup.";
    case "has_role_tag":
    case "looks_like_instruction":
      return "Wren keeps notes, not instructions. Write it as a fact about your business.";
    case "duplicate":
      return "Wren already has that fact.";
  }
}

export const WREN_MEMORY_STALE_COPY = "This changed since you opened it. The list now shows the latest. Try again if you still need to.";
