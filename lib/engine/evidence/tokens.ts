/**
 * Editorial evidence tokens (WP54, contract §5 "Editorial tokens", rulings
 * R6 and R7).
 *
 * Editorial text references accepted evidence as `[[ev:<id>]]`; the compiler
 * expands each token into canonical text rendered from the validated item
 * (renderEvidenceInline), so a figure on the page comes from the evidence,
 * not from the writer.
 *
 * findUnboundFigures and findQuotedSpans are GUARDS, not proof of truth
 * (ruling R6). They keep writer text free of figures and of quotations, so
 * source-backed numbers and quotes can only arrive through accepted
 * evidence. They cannot tell whether qualitative prose is accurate. Human
 * review of the rendered page remains required.
 *
 * A FIGURE (ruling R6), after NFKC normalisation (so fullwidth "４７" and
 * mathematical "𝟏𝟐" read as 47 and 12; other scripts' digits are \p{Nd} too):
 *   - any decimal digit run, with "." "," ":" "/" between digit groups and
 *     any currency sign or code, "%", magnitude or unit attached to it —
 *     EXCEPT
 *       · a letter-adjacent name: digits glued to a letter before them
 *         (B2B, Web3, Q3, H1, x86), joined by a hyphen to a word before them
 *         (GPT-4o, COVID-19), or glued to a letter word after them that is
 *         not a unit, magnitude, plural or ordinal (3D, 2FA, 5G); while 10x,
 *         $5k, 5GB, 200ms, 24h, 3rd, 1000s and 4K are figures (FIGURE_SUFFIXES);
 *       · a bare year 1990–2039 (and a decade 1990s–2030s) with no currency,
 *         percent or magnitude next to it;
 *   - a standalone number word: two to nineteen, twenty to ninety (with
 *     their compounds, "forty seven", "twenty-five"), hundred, thousand,
 *     million, billion, trillion (and their plurals), dozen(s); "one" and
 *     "zero" only count inside such a compound;
 *   - "percent", "per cent" or "%", with or without a number.
 * A QUOTED SPAN is text between double quotes (straight, typographic,
 * low-9 or guillemets « ») holding three or more words; an unclosed quote
 * runs to the end of the text. Quotations reach the page only as quote
 * evidence, so writer text may hold none.
 *
 * Both guards read the text with every `[[ev:…]]` token masked out, and
 * report indices into the ORIGINAL text.
 */

import { formatAmount, formatPriceTerms } from "./amount.ts";
import {
  EVIDENCE_TOKEN_RE,
  type AcceptedEvidence,
  type CompetitorPriceEvidence,
  type EvidenceKind,
  type MarketStatEvidence,
} from "./contract.ts";

/** Thrown by expandEvidenceTokens for an id that is not an accepted item. */
export class EvidenceReferenceError extends Error {
  readonly id: string;

  constructor(id: string) {
    super(`Unknown evidence id "${id}" in editorial text`);
    this.name = "EvidenceReferenceError";
    this.id = id;
  }
}

function tokenRe(): RegExp {
  return new RegExp(EVIDENCE_TOKEN_RE.source, "g");
}

/** Every `[[ev:<id>]]` id in order of appearance (repeats included). */
export function evidenceRefs(text: string): string[] {
  return [...text.matchAll(tokenRe())].map((m) => m[1] ?? "").filter((id) => id !== "");
}

/** Text with every valid token replaced by spaces, so indices stay aligned. */
function maskTokens(text: string): string {
  return text.replace(tokenRe(), (token) => " ".repeat(token.length));
}

// ---------------------------------------------------------------------------
// NFKC with a map back to the original text
// ---------------------------------------------------------------------------

/**
 * NFKC form of `text`, normalised code point by code point, with the
 * original [start, end) of the code point behind every normalised unit.
 * (Per code point, so a figure's original characters can always be shown;
 * composition across code points does not matter for digits and words.)
 */
type MappedText = { text: string; start: number[]; end: number[] };

function nfkcMapped(text: string): MappedText {
  let out = "";
  const start: number[] = [];
  const end: number[] = [];
  let i = 0;
  for (const cp of text) {
    const normalized = cp.normalize("NFKC");
    for (let k = 0; k < normalized.length; k += 1) {
      start.push(i);
      end.push(i + cp.length);
    }
    out += normalized;
    i += cp.length;
  }
  return { text: out, start, end };
}

/** The original [start, end) behind the normalised range [from, to). */
function originalRange(mapped: MappedText, from: number, to: number): { start: number; end: number } {
  const start = mapped.start[from] ?? 0;
  const end = mapped.end[Math.max(from, to - 1)] ?? start;
  return { start, end };
}

// ---------------------------------------------------------------------------
// Figures (ruling R6)
// ---------------------------------------------------------------------------

/** A figure or quoted span found in text; `index` is in the original text. */
export type FigureHit = { figure: string; index: number };

const LETTER_RE = /[\p{L}\p{M}]/u;

/** Letters glued after digits that make a quantity, not a name. */
const FIGURE_SUFFIXES: ReadonlySet<string> = new Set([
  // magnitudes and multipliers
  "k", "m", "mm", "mn", "b", "bn", "t", "tn", "x",
  // plural ("1000s") and ordinals
  "s", "st", "nd", "rd", "th",
  // durations
  "ms", "sec", "secs", "min", "mins", "h", "hr", "hrs", "wk", "wks", "mo", "mos", "yr", "yrs",
  // data sizes and other units
  "kb", "mb", "gb", "tb", "pb", "kg", "km", "mi", "ft", "px", "fps", "mph", "kwh", "pct",
  // currency codes written after the number
  "usd", "eur", "gbp", "cad", "aud",
]);

const BARE_YEAR_RE = /^(?:199\d|20[0-3]\d)$/;
const DECADE_RE = /^(?:199|20[0-3])0$/;

/** A digit run with separators between digit groups ("1,400", "1.4", "24/7"). */
const DIGIT_RUN_RE = /\p{Nd}+(?:[.,:/]\p{Nd}+)*/gu;
/** Currency written before a number: a currency sign, or a code with an optional space. */
const CURRENCY_BEFORE_RE = /(?:\p{Sc}|(?<![\p{L}\p{N}])(?:USD|EUR|GBP|CAD|AUD|US|CA|AU|C|A)\p{Sc}|(?<![\p{L}\p{N}])(?:USD|EUR|GBP|CAD|AUD))[ \u00A0]?$/u;
/** Percent, magnitude or currency code written after a number (with one optional space). */
const AFTER_NUMBER_RE =
  /^(?:[ \u00A0]?(?:%|percent(?![\p{L}])|per[ \u00A0]cent(?![\p{L}])|thousand(?![\p{L}])|million(?![\p{L}])|billion(?![\p{L}])|trillion(?![\p{L}])|bn(?![\p{L}])|mn(?![\p{L}])|tn(?![\p{L}])|(?:USD|EUR|GBP|CAD|AUD)(?![\p{L}])))/iu;

function letterRunAt(text: string, index: number): string {
  let end = index;
  while (end < text.length && LETTER_RE.test(text[end] ?? "")) end += 1;
  return text.slice(index, end);
}

/** Digit-run figures in normalised text, as normalised [start, end) ranges. */
function digitFigures(text: string): Array<{ start: number; end: number }> {
  const out: Array<{ start: number; end: number }> = [];
  for (const m of text.matchAll(DIGIT_RUN_RE)) {
    const runStart = m.index ?? 0;
    const runEnd = runStart + m[0].length;
    const before = text[runStart - 1] ?? "";
    const currency = CURRENCY_BEFORE_RE.exec(text.slice(Math.max(0, runStart - 6), runStart));
    const start = currency ? runStart - currency[0].length : runStart;
    let end = runEnd;

    const suffix = letterRunAt(text, runEnd);
    if (!currency) {
      // Letter-adjacent names: Q3, B2B, Web3, x86 (letter before); GPT-4o, COVID-19 (hyphen after a word).
      if (LETTER_RE.test(before)) continue;
      if ((before === "-" || before === "\u2011") && LETTER_RE.test(text[runStart - 2] ?? "")) continue;
      // 3D, 2FA, 5G: a letter word after the digits that is not a unit or magnitude.
      if (suffix !== "" && !FIGURE_SUFFIXES.has(suffix.toLowerCase())) continue;
    }
    if (suffix !== "" && FIGURE_SUFFIXES.has(suffix.toLowerCase())) {
      // A decade such as "2020s" is a bare year.
      if (!currency && suffix.toLowerCase() === "s" && DECADE_RE.test(m[0]) && !AFTER_NUMBER_RE.test(text.slice(runEnd + 1))) {
        continue;
      }
      end = runEnd + suffix.length;
    } else {
      const after = AFTER_NUMBER_RE.exec(text.slice(runEnd));
      if (after) end = runEnd + after[0].length;
      else if (!currency && BARE_YEAR_RE.test(m[0])) continue;
    }
    out.push({ start, end });
  }
  return out;
}

/** Number words of ruling R6 (plurals included); "one"/"zero" only join a compound. */
const NUMBER_WORDS: ReadonlySet<string> = new Set([
  "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve",
  "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen",
  "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety",
  "hundred", "hundreds", "thousand", "thousands", "million", "millions", "billion", "billions",
  "trillion", "trillions", "dozen", "dozens",
]);
const COMPOUND_ONLY_WORDS: ReadonlySet<string> = new Set(["one", "zero"]);

const WORD_RE = /[\p{L}\p{M}]+/gu;

/** Spelled figures in normalised text: number-word phrases and percent words. */
function wordFigures(text: string): Array<{ start: number; end: number }> {
  type Word = { start: number; end: number; kind: "number" | "joiner" | "percent" | "per" | "cent" | "other" };
  const words: Word[] = [];
  for (const m of text.matchAll(WORD_RE)) {
    const lower = m[0].toLowerCase();
    const start = m.index ?? 0;
    const kind: Word["kind"] = NUMBER_WORDS.has(lower)
      ? "number"
      : COMPOUND_ONLY_WORDS.has(lower)
        ? "joiner"
        : lower === "percent"
          ? "percent"
          : lower === "per"
            ? "per"
            : lower === "cent"
              ? "cent"
              : "other";
    words.push({ start, end: start + m[0].length, kind });
  }
  // Words are adjacent when only spaces or one hyphen separate them.
  const adjacent = (a: Word, b: Word) => /^(?:[ \u00A0]+|-|\u2011)$/.test(text.slice(a.end, b.start));
  const out: Array<{ start: number; end: number }> = [];
  for (let i = 0; i < words.length; i += 1) {
    const word = words[i];
    if (!word) continue;
    const isPerCent = word.kind === "per" && words[i + 1]?.kind === "cent" && adjacent(word, words[i + 1] as Word);
    if (word.kind !== "number" && word.kind !== "percent" && !isPerCent) continue;
    // Extend left over "one"/"zero" joined to the phrase ("one hundred").
    let first = i;
    const previous = words[i - 1];
    if (word.kind === "number" && previous?.kind === "joiner" && adjacent(previous, word)) first = i - 1;
    // Extend right over further number words, a joiner, and a percent word.
    let last = isPerCent ? i + 1 : i;
    for (;;) {
      const current = words[last];
      const next = words[last + 1];
      if (!current || !next || !adjacent(current, next)) break;
      if (next.kind === "number" || next.kind === "joiner" || next.kind === "percent") {
        last += 1;
        continue;
      }
      const cent = words[last + 2];
      if (next.kind === "per" && cent?.kind === "cent" && adjacent(next, cent)) {
        last += 2;
        continue;
      }
      break;
    }
    const from = words[first];
    const to = words[last];
    if (from && to) out.push({ start: from.start, end: to.end });
    i = last;
  }
  // A bare "%" that no digit run claimed.
  for (const m of text.matchAll(/%/g)) {
    const at = m.index ?? 0;
    out.push({ start: at, end: at + 1 });
  }
  return out;
}

/**
 * Figures outside `[[ev:…]]` tokens (ruling R6; see the top of this file):
 * digit runs that are not letter-adjacent names or bare years, number
 * words, and percent words. `index` and `figure` are in the original text.
 * A guard, not proof of truth.
 */
export function findUnboundFigures(text: string): FigureHit[] {
  const mapped = nfkcMapped(maskTokens(text));
  // Overlaps are resolved on original indices: one character ("½") can
  // normalise to several figures.
  const ranges = [...digitFigures(mapped.text), ...wordFigures(mapped.text)].map((r) =>
    originalRange(mapped, r.start, r.end),
  );
  ranges.sort((a, b) => a.start - b.start || b.end - a.end);
  const out: FigureHit[] = [];
  let coveredUntil = -1;
  for (const range of ranges) {
    if (range.start < coveredUntil) continue;
    coveredUntil = range.end;
    out.push({ figure: text.slice(range.start, range.end), index: range.start });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Quoted spans (ruling R6)
// ---------------------------------------------------------------------------

/** Writer text may hold no double-quoted span of this many words or more. */
export const QUOTED_SPAN_MIN_WORDS = 3;

/** Double quote marks after NFKC (fullwidth ＂ becomes "). */
const DOUBLE_QUOTE_RE = /["“”„‟«»〝〞〟]/u;

/** A double-quoted span of QUOTED_SPAN_MIN_WORDS or more words; `index` is in the original text. */
export type QuotedSpan = { span: string; index: number; words: number };

function wordsIn(text: string): number {
  return (text.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? []).length;
}

/**
 * Double-quoted spans of three or more words outside `[[ev:…]]` tokens:
 * straight, typographic, low-9 and guillemet quotes, paired in order (an
 * unclosed quote runs to the end of the text). A guard, not proof of truth.
 */
export function findQuotedSpans(text: string): QuotedSpan[] {
  const mapped = nfkcMapped(maskTokens(text));
  const out: QuotedSpan[] = [];
  let open = -1;
  for (let i = 0; i <= mapped.text.length; i += 1) {
    const atEnd = i === mapped.text.length;
    if (!atEnd && !DOUBLE_QUOTE_RE.test(mapped.text[i] ?? "")) continue;
    if (open < 0) {
      if (!atEnd) open = i;
      continue;
    }
    const inner = mapped.text.slice(open + 1, i);
    const words = wordsIn(inner);
    if (words >= QUOTED_SPAN_MIN_WORDS) {
      const original = originalRange(mapped, open, atEnd ? i : i + 1);
      out.push({ span: text.slice(original.start, original.end), index: original.start, words });
    }
    open = -1;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Validation of one editorial field
// ---------------------------------------------------------------------------

const MALFORMED_TOKEN_RE = /\[\[\s*ev\s*:[^\]]*\]?\]?/gi;

/** Input to validateEditorialText. */
export type EditorialTextInput = {
  /** Record path for messages, e.g. "market.summary". */
  path: string;
  text: string;
  /**
   * True for writer text (ruling R6, WRITER_TEXT_FIELDS): no figures outside
   * tokens and no double-quoted span of three or more words.
   */
  factBearing: boolean;
  accepted: ReadonlyMap<string, AcceptedEvidence>;
  /** Kinds this field may reference; every kind when omitted; [] forbids every token. */
  allowedKinds?: ReadonlyArray<EvidenceKind>;
  /** When given, the only accepted ids this field may reference (e.g. a competitor's own prices). */
  allowedIds?: ReadonlySet<string>;
};

function clipText(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

/**
 * Issues for one editorial field: malformed tokens, unknown (or rejected)
 * ids, kinds or ids not allowed here and, for writer text, unbound figures
 * and quoted spans.
 */
export function validateEditorialText(input: EditorialTextInput): string[] {
  const { path, text, factBearing, accepted, allowedKinds, allowedIds } = input;
  const issues: string[] = [];
  for (const m of maskTokens(text).matchAll(MALFORMED_TOKEN_RE)) {
    issues.push(`${path}: malformed evidence token "${m[0].slice(0, 40)}"`);
  }
  for (const id of new Set(evidenceRefs(text))) {
    const item = accepted.get(id);
    if (!item) {
      issues.push(`${path}: unknown evidence id "${id}" (not an accepted item)`);
      continue;
    }
    if (allowedKinds && allowedKinds.length === 0) {
      issues.push(`${path}: evidence ${id} cannot be cited here (this field takes no evidence tokens)`);
      continue;
    }
    if (allowedKinds && !allowedKinds.includes(item.kind)) {
      issues.push(`${path}: evidence ${id} is a ${item.kind}; allowed here: ${allowedKinds.join(", ")}`);
      continue;
    }
    if (allowedIds && !allowedIds.has(id)) {
      issues.push(`${path}: evidence ${id} is not one of the items this field may cite`);
    }
  }
  if (factBearing) {
    for (const { figure, index } of findUnboundFigures(text)) {
      issues.push(
        `${path}: unbound figure "${figure}" at ${index}; cite accepted evidence with [[ev:<id>]] or remove it`,
      );
    }
    for (const { span, words } of findQuotedSpans(text)) {
      issues.push(
        `${path}: double-quoted span "${clipText(span, 80)}" (${words} words); quotations reach the page only as quote evidence ([[ev:<id>]])`,
      );
    }
  }
  return issues;
}

// ---------------------------------------------------------------------------
// Canonical rendering (ruling R7)
// ---------------------------------------------------------------------------

const METRIC_LABEL: Record<MarketStatEvidence["metric"], string | null> = {
  market_size: "market size",
  growth_rate: "growth rate",
  spend: "spend",
  user_count: "user count",
  adoption: "adoption",
  other: null,
};

function renderStat(item: MarketStatEvidence): string {
  const projected = item.period.kind === "projected";
  const amount = `${formatAmount(item.amount)}${projected && item.period.toYear !== undefined ? ` by ${item.period.toYear}` : ""}`;
  const metric = METRIC_LABEL[item.metric];
  const period = projected ? "projected" : item.period.year !== undefined ? String(item.period.year) : null;
  const claim = [item.subject, metric, period].filter((part): part is string => part !== null && part !== "");
  return `${amount} (${claim.join(", ")})`;
}

function priceOwner(item: CompetitorPriceEvidence): string {
  const plan = item.plan?.trim();
  if (!plan) return item.vendor;
  const named = plan.toLowerCase().startsWith(item.vendor.toLowerCase()) ? plan : `${item.vendor} ${plan}`;
  return /(?<![\p{L}\p{N}])plan$/iu.test(plan) ? named : `${named} plan`;
}

/**
 * Canonical plain text for a token (ruling R7: the claim, not only the
 * figure). The compiler and the auditor always call this; nothing else
 * spells a rendering.
 *
 *   market_stat      "<amount>[ by <toYear>] (<subject>[, <metric>][, <year> | projected])"
 *                    "$1.9 billion (RFP response software market, market size, 2024)"
 *                    "$5.6 billion by 2032 (RFP response software market, market size, projected)"
 *                    "64% (B2B SaaS sales teams, adoption, 2025)"  (metric "other" has no label)
 *   competitor_price "<formatPriceTerms> (<vendor>[ <plan>][ plan])"
 *                    "$49/user/month, billed annually (Bidwell Starter plan)"
 *                    "$399/month (AnswerDeck)"  (no plan); a plan that already starts
 *                    with the vendor or ends in "plan" is not repeated
 *   community_quote  the excerpt in straight double quotes, whitespace collapsed
 */
export function renderEvidenceInline(item: AcceptedEvidence): string {
  if (item.kind === "market_stat") return renderStat(item);
  if (item.kind === "competitor_price") return `${formatPriceTerms(item.price)} (${priceOwner(item)})`;
  return `"${item.excerpt.replace(/\s+/g, " ").trim()}"`;
}

/** Replace every token with `render(item)`; throws EvidenceReferenceError on an unknown id. */
export function expandEvidenceTokens(
  text: string,
  accepted: ReadonlyMap<string, AcceptedEvidence>,
  render: (item: AcceptedEvidence) => string = renderEvidenceInline,
): string {
  return text.replace(tokenRe(), (_token, id: string) => {
    const item = accepted.get(id);
    if (!item) throw new EvidenceReferenceError(id);
    return render(item);
  });
}
