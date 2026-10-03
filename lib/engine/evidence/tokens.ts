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
 * A FIGURE (rulings R6 and R13), after NFKC normalisation (so fullwidth
 * "４７" and mathematical "𝟏𝟐" read as 47 and 12; other scripts' digits are
 * \p{Nd} too):
 *   - any decimal digit run, with "." "," ":" "/" between digit groups and
 *     any currency sign or code, "%", magnitude or unit attached to it —
 *     EXCEPT
 *       · a standard or version name (STANDARD_AND_VERSION_NAMES: SOC 2,
 *         ISO 27001, OAuth 2.0, TLS 1.3, 24/7, Microsoft 365, Form 1099,
 *         Next.js 15, Claude 3.5, …) with no percent, magnitude or currency
 *         after it;
 *       · a letter-adjacent name: digits glued to a letter before them
 *         (B2B, Web3, Q3, H1, x86), inside a snake_case identifier
 *         (tier_1_questionnaires), joined by a hyphen to a word before them
 *         (GPT-4o, COVID-19, W-9) unless that word is a quantity word
 *         (sub-10, top-5, under-30, up-to-10, about-15% are figures), or
 *         glued to a letter word after them that is not a unit, magnitude,
 *         plural or ordinal (3D, 2FA, 5G); while 10x, $5k, 5GB, 200ms, 24h,
 *         3rd, 1000s and 4K are figures (FIGURE_SUFFIXES);
 *       · a bare year 1990–2039 (and a decade 1990s–2030s) with no currency,
 *         percent or magnitude next to it;
 *   - any currency sign (\p{Sc}) outside a token, with or without digits
 *     ("$lOk", a lone "€");
 *   - a standalone number word: two to nineteen, twenty to ninety (with
 *     their compounds, "forty seven", "twenty-five"), hundred, thousand,
 *     million, billion, trillion (and their plurals), dozen(s); "one" and
 *     "zero" only count inside such a compound; a number word glued to
 *     digits ("Five9") is a name;
 *   - "percent", "per cent" or "%", with or without a number.
 * A QUOTED SPAN (rulings R6 and R13) is text of three or more words between
 * quotation marks: double ones (straight, typographic, low-9, guillemets
 * « »), single guillemets ‹…› and corner brackets 「…」 and 『…』 (any of
 * these runs to the end of the text when unclosed), and single quotes
 * (straight or typographic) at word boundaries. Apostrophes inside or at the
 * end of a word (don't, teams', '90s) are not quotation marks, and an
 * unclosed single quote opens nothing. Quotations reach the page only as
 * quote evidence, so writer text may hold none.
 *
 * findRevenueTotals and findComputations (ruling R13) are the final audit's
 * revenue-total and Year-One-style computation rules, shared so the record
 * parser can apply them to the numeric proposal slots.
 *
 * Every guard reads the text with each `[[ev:…]]` token masked out, and
 * reports indices into the ORIGINAL text.
 */

import { COUNT_MODIFIERS, COUNT_NOUNS, formatAmount, formatPriceTerms } from "./amount.ts";
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

/** Software names whose version number is part of the name (ruling R13). */
const VERSIONED_SOFTWARE = String.raw`Next\.js|React|Node(?:\.js)?|PostgreSQL|Postgres|MySQL|Python|Ruby|Rails|Django|Vue(?:\.js)?|Angular|SvelteKit|Svelte|Tailwind(?: CSS)?|TypeScript|Swift|Kotlin|Java|PHP|iOS|Android|macOS|Windows|Ubuntu|Claude|GPT|Gemini|Llama|Mistral`;

/**
 * A version as a name carries one (review P3-3): at most two integer digits,
 * optionally with decimal parts ("15", "3.5", "24.04", "22.11.0"). A longer
 * number ("Python 4000") is a figure.
 */
const VERSION = String.raw`\p{Nd}{1,2}(?:\.\p{Nd}+)*`;

/** The version after a curated software name (VERSIONED_SOFTWARE): "Next.js 15", "GPT-4o", "Tailwind v4". */
const VERSIONED_NAME_RE = new RegExp(
  String.raw`(?<![\p{L}\p{N}])(?:${VERSIONED_SOFTWARE})(?:[ \u00A0]|-)?v?${VERSION}[a-z]?(?![\p{N}])`,
  "gu",
);

/**
 * Ruling R13: standard and version names whose digits are part of the name,
 * not a figure. One list, read by the record parser and the auditor through
 * findUnboundFigures (applied to the NFKC text):
 *   SOC 1/2/3; ISO and ISO/IEC numbers (ISO 27001, ISO/IEC 27001:2022);
 *   PCI DSS, WCAG, OAuth, TLS, SSL and HTTP versions; IPv4/IPv6; 24/7;
 *   Microsoft 365 and Office 365; US tax forms (Form 1099, 1099-NEC, W-2,
 *   W-9); and the version after a curated software name (VERSIONED_SOFTWARE:
 *   Next.js 15, Postgres 16, Claude 3.5, GPT 5, Llama 3.1, Tailwind v4, …).
 * A version is at most two integer digits with optional decimals (VERSION),
 * and a software version followed by a count ("Claude 47 teams", "React 300
 * times", COUNTED_AFTER_VERSION) is a figure (review P3-3). A name followed
 * by a percent, magnitude or currency code is still a figure.
 */
export const STANDARD_AND_VERSION_NAMES: readonly RegExp[] = [
  /(?<![\p{L}\p{N}])SOC[ \u00A0]?[123](?![\p{L}\p{N}])/gu,
  /(?<![\p{L}\p{N}])ISO(?:\/IEC)?[ \u00A0]?\p{Nd}{3,5}(?:[-:]\p{Nd}{1,4})*(?![\p{L}\p{N}])/gu,
  new RegExp(String.raw`(?<![\p{L}\p{N}])PCI[ \u00A0-]?DSS[ \u00A0]?v?${VERSION}(?![\p{L}\p{N}])`, "gu"),
  new RegExp(String.raw`(?<![\p{L}\p{N}])(?:WCAG|OAuth|TLS|SSL)[ \u00A0]?v?${VERSION}a?(?![\p{L}\p{N}])`, "gu"),
  /(?<![\p{L}\p{N}])HTTP(?:\/|[ \u00A0])?\p{Nd}(?:\.\p{Nd})?(?![\p{L}\p{N}])/gu,
  /(?<![\p{L}\p{N}])IPv[46](?![\p{L}\p{N}])/gu,
  /(?<![\p{L}\p{N}/])24\/7(?![\p{L}\p{N}/])/gu,
  /(?<![\p{L}\p{N}])(?:Microsoft|Office)[ \u00A0]365(?![\p{L}\p{N}])/gu,
  /(?<![\p{L}\p{N}])Form[ \u00A0](?:1099|1098|1095|1040|1065|1120|941|940|990|W-\p{Nd})(?:-[A-Z]{1,4})?(?![\p{L}\p{N}])/gu,
  /(?<![\p{L}\p{N}])(?:1099|1098|1095)-[A-Z]{1,4}(?![\p{L}\p{N}])/gu,
  VERSIONED_NAME_RE,
];

/** What a number counts when it stands right before one of these (review P3-3: "Claude 47 teams", "React 300 times"). */
const COUNTED_AFTER_VERSION: readonly string[] = [
  ...COUNT_NOUNS,
  "time", "times", "second", "seconds", "minute", "minutes", "hour", "hours", "day", "days", "week", "weeks",
  "month", "months", "year", "years",
];

/** A count right after a version: up to two count modifiers, then a counted noun ("47 active teams"). */
const COUNT_AFTER_VERSION_SOURCE = String.raw`(?:[ \u00A0]+(?:${COUNT_MODIFIERS.join("|")})){0,2}[ \u00A0]+(?:${COUNTED_AFTER_VERSION.join("|")})(?![\p{L}\p{N}])`;

/** 1 at every position of the text that STANDARD_AND_VERSION_NAMES match (one pass per pattern). */
function standardNameMask(text: string): Uint8Array {
  const mask = new Uint8Array(text.length);
  const countAfter = new RegExp(COUNT_AFTER_VERSION_SOURCE, "iuy");
  for (const re of STANDARD_AND_VERSION_NAMES) {
    for (const m of text.matchAll(new RegExp(re.source, re.flags))) {
      const start = m.index ?? 0;
      const end = start + m[0].length;
      if (re === VERSIONED_NAME_RE) {
        // Review P3-3: a software "version" that counts something is a figure.
        countAfter.lastIndex = end;
        if (countAfter.test(text)) continue;
      }
      mask.fill(1, start, end);
    }
  }
  return mask;
}

/** True when every position in [start, end) is part of a standard or version name. */
function inStandardName(mask: Uint8Array, start: number, end: number): boolean {
  for (let k = start; k < end; k += 1) if (mask[k] !== 1) return false;
  return true;
}

/** A word before "-N" that makes N a quantity, not part of a name (ruling R13). */
const QUANTITY_PREFIXES: ReadonlySet<string> = new Set([
  "sub", "top", "under", "over", "up", "upto", "to", "about", "around", "approx", "approximately", "nearly",
  "almost", "by", "min", "max", "minimum", "maximum", "more", "less", "least", "most", "below", "above", "within",
]);

/** The letters directly before index `end` (a word ending there), lowercased. */
function wordBefore(text: string, end: number): string {
  let start = end;
  while (start > 0 && LETTER_RE.test(text[start - 1] ?? "")) start -= 1;
  return text.slice(start, end).toLowerCase();
}

/** 1 at every position of a snake_case identifier that holds a letter and an underscore (tier_1_questionnaires). */
function snakeCaseMask(text: string): Uint8Array {
  const mask = new Uint8Array(text.length);
  for (const m of text.matchAll(/[\p{L}\p{N}_]+/gu)) {
    if (!m[0].includes("_") || !/\p{L}/u.test(m[0])) continue;
    const start = m.index ?? 0;
    mask.fill(1, start, start + m[0].length);
  }
  return mask;
}

/** True when the digits at [start, end) touch an underscore inside such an identifier. */
function inSnakeCaseIdentifier(text: string, mask: Uint8Array, start: number, end: number): boolean {
  return (text[start - 1] === "_" || text[end] === "_") && mask[start] === 1;
}
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
  const names = standardNameMask(text);
  const snake = snakeCaseMask(text);
  for (const m of text.matchAll(DIGIT_RUN_RE)) {
    const runStart = m.index ?? 0;
    const runEnd = runStart + m[0].length;
    const before = text[runStart - 1] ?? "";
    const currency = CURRENCY_BEFORE_RE.exec(text.slice(Math.max(0, runStart - 6), runStart));
    const start = currency ? runStart - currency[0].length : runStart;
    let end = runEnd;

    const suffix = letterRunAt(text, runEnd);
    const quantityAfter = AFTER_NUMBER_RE.test(text.slice(runEnd));
    if (!currency && !quantityAfter) {
      // Standard and version names (ruling R13): SOC 2, ISO 27001, Next.js 15, 24/7, …
      if (inStandardName(names, runStart, runEnd)) continue;
      // snake_case identifiers: tier_1_questionnaires (ruling R13).
      if (inSnakeCaseIdentifier(text, snake, runStart, runEnd)) continue;
    }
    if (!currency) {
      // Letter-adjacent names: Q3, B2B, Web3, x86 (letter before).
      if (LETTER_RE.test(before)) continue;
      // GPT-4o, COVID-19, W-9 (a hyphen after a word), but not sub-10, top-5, up-to-10 or about-15%.
      if (
        (before === "-" || before === "\u2011") &&
        LETTER_RE.test(text[runStart - 2] ?? "") &&
        !quantityAfter &&
        !QUANTITY_PREFIXES.has(wordBefore(text, runStart - 1))
      ) {
        continue;
      }
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
    // A word glued to digits ("Five9") is part of a name, never a number word.
    if (/\p{N}/u.test(text[start + m[0].length] ?? "") || /\p{N}/u.test(text[start - 1] ?? "")) {
      words.push({ start, end: start + m[0].length, kind: "other" });
      continue;
    }
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
  // Ruling R13: any currency sign outside a token, with what is glued to it ("$lOk", "€").
  for (const m of text.matchAll(/\p{Sc}[^\s.,;:!?)\]}]*/gu)) {
    const at = m.index ?? 0;
    out.push({ start: at, end: at + m[0].length });
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
// Quoted spans (rulings R6 and R13)
// ---------------------------------------------------------------------------

/** Writer text may hold no quoted span of this many words or more. */
export const QUOTED_SPAN_MIN_WORDS = 3;

/**
 * A quoted span of QUOTED_SPAN_MIN_WORDS or more words. `span` holds its
 * quotation marks (an unclosed double quote has no closing mark), `inner`
 * the text between them; `index` is in the original text.
 */
export type QuotedSpan = { span: string; inner: string; index: number; words: number };

/**
 * Quotation marks that pair with each other, after NFKC (fullwidth ＂ becomes
 * ", halfwidth ｢ becomes 「). Double marks and single guillemets open and
 * close one another (either way round, as in « » and » «); corner brackets
 * nest. An unclosed mark of these families runs to the end of the text.
 */
const PAIRED_QUOTE_FAMILIES: ReadonlyArray<{ opens: RegExp; closes: RegExp }> = [
  { opens: /["“”„‟«»〝〞〟]/u, closes: /["“”„‟«»〝〞〟]/u },
  { opens: /[‹›]/u, closes: /[‹›]/u },
  { opens: /[「『]/u, closes: /[」』]/u },
];

/**
 * Single quotation marks (straight, typographic, low-9, reversed), which are
 * also apostrophes. One opens a span only at a word start (no letter or digit
 * before it, a letter after it) and closes it only at a word end (no space
 * before it, no letter or digit after it); an unclosed one opens nothing, so
 * don't, teams', '90s and rock 'n' roll are never quotations.
 */
const SINGLE_QUOTE_RE = /['‘’‚‛]/u;
const WORD_CHAR_RE = /[\p{L}\p{N}]/u;

function wordsIn(text: string): number {
  return (text.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? []).length;
}

/** A quoted span as a normalised [start, end) range; `closed` when it ends on its closing mark. */
type QuoteRange = { start: number; end: number; closed: boolean };

/** Spans of one paired family (corner brackets nest). */
function pairedSpans(text: string, family: { opens: RegExp; closes: RegExp }): QuoteRange[] {
  const out: QuoteRange[] = [];
  const symmetric = family.opens.source === family.closes.source;
  let open = -1;
  let depth = 0;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i] ?? "";
    if (open < 0) {
      if (family.opens.test(c)) {
        open = i;
        depth = 1;
      }
      continue;
    }
    if (!symmetric && family.opens.test(c)) {
      depth += 1;
    } else if (family.closes.test(c)) {
      depth -= 1;
      if (symmetric || depth === 0) {
        out.push({ start: open, end: i + 1, closed: true });
        open = -1;
      }
    }
  }
  if (open >= 0) out.push({ start: open, end: text.length, closed: false });
  return out;
}

/**
 * Single-quoted spans as normalised ranges. A span stays inside the paired
 * span (double quotes, guillemets, brackets) its opening mark sits in, so an
 * apostrophe inside one quotation never pairs with one outside it.
 */
function singleQuotedSpans(text: string, paired: readonly QuoteRange[]): QuoteRange[] {
  // The innermost paired span at each position (-1: none).
  const region = new Int32Array(text.length).fill(-1);
  const byLength = paired.map((r, k) => ({ ...r, k })).sort((a, b) => b.end - b.start - (a.end - a.start));
  for (const r of byLength) region.fill(r.k, r.start, r.end);
  const inside = (k: number, i: number): boolean => {
    const r = paired[k];
    return r !== undefined && r.start <= i && i < r.end;
  };

  const out: QuoteRange[] = [];
  let open = -1;
  let openRegion = -1;
  for (let i = 0; i < text.length; i += 1) {
    if (!SINGLE_QUOTE_RE.test(text[i] ?? "")) continue;
    const before = text[i - 1] ?? "";
    const after = text[i + 1] ?? "";
    // Leaving the quotation the opening mark sat in abandons it.
    if (open >= 0 && openRegion >= 0 && !inside(openRegion, i)) open = -1;
    if (open < 0) {
      if (!WORD_CHAR_RE.test(before) && /\p{L}/u.test(after)) {
        open = i;
        openRegion = region[i] ?? -1;
      }
      continue;
    }
    // A closing mark counts only in the same region as the opening one.
    if ((region[i] ?? -1) !== openRegion) continue;
    if (i > open + 1 && !/\s/u.test(before) && !WORD_CHAR_RE.test(after)) {
      out.push({ start: open, end: i + 1, closed: true });
      open = -1;
    }
  }
  return out;
}

/**
 * Quoted spans of three or more words outside `[[ev:…]]` tokens (rulings R6
 * and R13): double quotes (straight, typographic, low-9, guillemets), single
 * guillemets and corner brackets, paired in order (an unclosed one runs to
 * the end of the text), and single quotes at word boundaries. A span inside
 * another span is part of it and not reported again. A guard, not proof of
 * truth.
 */
export function findQuotedSpans(text: string): QuotedSpan[] {
  const mapped = nfkcMapped(maskTokens(text));
  const paired = PAIRED_QUOTE_FAMILIES.flatMap((family) => pairedSpans(mapped.text, family));
  const ranges = [...paired, ...singleQuotedSpans(mapped.text, paired)];
  ranges.sort((a, b) => a.start - b.start || b.end - a.end);

  const out: QuotedSpan[] = [];
  let coveredUntil = -1;
  for (const range of ranges) {
    // Nested in an earlier span: part of that one.
    if (range.end <= coveredUntil) continue;
    coveredUntil = range.end;
    const innerStart = range.start + 1;
    const innerEnd = range.closed ? range.end - 1 : range.end;
    const words = wordsIn(mapped.text.slice(innerStart, innerEnd));
    if (words < QUOTED_SPAN_MIN_WORDS) continue;
    const original = originalRange(mapped, range.start, range.end);
    const originalInner = originalRange(mapped, innerStart, innerEnd);
    out.push({
      span: text.slice(original.start, original.end),
      inner: text.slice(originalInner.start, originalInner.end),
      index: original.start,
      words,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Revenue totals and computations (ruling R13: the auditor's rules, shared)
// ---------------------------------------------------------------------------

/** A match in text outside `[[ev:…]]` tokens; `index` is in the original text. */
export type TextMatch = { text: string; index: number };

/**
 * The final audit's revenue-total and computation rules (lib/engine/
 * artifact-audit.ts as of c97f6d0), restated so a search runs in linear
 * time on a 20,000-character field and finds the same first match:
 *   - a digit run starts a match only at its first digit (`(?<!\d,*)`): a
 *     match from a later digit of the same run implies one from the first;
 *   - "NOUN\s*X?\s*(of\s+)?~?\s*MONEY" becomes "NOUN\s*(X\s*)?(of\s+)?(~\s*)?MONEY"
 *     (the same language without three adjacent \s* to backtrack through);
 *   - a modifier chain is tried only from its first word.
 * tokens.test.ts checks the first match against the audit's own regular
 * expressions on generated text.
 */
const MONEY = String.raw`(?:(?:US|CA|AU|C|A)?[$€£]\s?\d[\d,]*(?:\.\d+)?|(?:USD|EUR|GBP|CAD|AUD)\s?\d[\d,]*(?:\.\d+)?|(?<!\d,*)\d[\d,]*(?:\.\d+)?\s?(?:USD|EUR|GBP|CAD|AUD)\b)(?:\s?(?:k|m|mn|bn|b|thousand|million|billion|trillion)\b)?`;
const REVENUE_NOUN = String.raw`(?:ARR|MRR|revenue|run[- ]?rate|sales|income)`;
const REVENUE_MODIFIER = String.raw`(?:annual|annualized|yearly|monthly|recurring|new|total|gross|net|projected|expected)`;
/**
 * A revenue total: a money amount beside revenue wording, either way round
 * ("$54,000 ARR", "$250k in annual sales", "ARR of $60,000", "Target ARR:
 * 5,400,000 USD", "annual run-rate of $250k"). Between the amount and the
 * wording only "in"/"of" and revenue modifiers may stand, so a tier whose
 * description mentions ARR after its price ("$12/month) — ARR dashboards")
 * is not one, and "annual" beside a price is a billing period.
 */
const REVENUE_TOTAL_SOURCE =
  String.raw`${MONEY}(?:\s*\/\s*(?:mo|month|yr|year))?(?:\s+(?:a|per)\s+(?:year|month))?(?:\s+(?:in|of))?(?:\s+${REVENUE_MODIFIER})*\s+${REVENUE_NOUN}\b` +
  String.raw`|\b(?<!\b${REVENUE_MODIFIER}\s+)(?:${REVENUE_MODIFIER}\s+)*${REVENUE_NOUN}\s*(?:(?:[:=]|of|at|is|was|reaches|reaching|hits|hitting|to|totals?|totaling|near|around|about|over|above)\s*)?(?:of\s+)?(?:~\s*)?${MONEY}`;

/** A Year-One-style computation: a count times a money amount (per period) equals an amount. */
const COMPUTATION_SOURCE = String.raw`(?<!\d,*)\d[\d,]*\s*[×xX*]\s*(?:US)?[$€£]\s?\d[\d,]*(?:\.\d+)?(?:\s*\/\s*[A-Za-z]+)*\s*=\s*(?:US)?[$€£]?\s?\d`;

function matchesOutsideTokens(text: string, re: RegExp): TextMatch[] {
  return [...maskTokens(text).matchAll(re)].map((m) => {
    const index = m.index ?? 0;
    return { text: text.slice(index, index + m[0].length), index };
  });
}

/**
 * Revenue totals outside `[[ev:…]]` tokens (ruling R13). Only the Year-One
 * Math base and downside lines may state one; the record parser applies
 * this to the numeric proposal slots, the final audit to the page.
 */
export function findRevenueTotals(text: string): TextMatch[] {
  return matchesOutsideTokens(text, new RegExp(REVENUE_TOTAL_SOURCE, "gi"));
}

/** Year-One-style computations ("15 × $100/month = $1,500") outside tokens (ruling R13). */
export function findComputations(text: string): TextMatch[] {
  return matchesOutsideTokens(text, new RegExp(COMPUTATION_SOURCE, "g"));
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
   * True for writer text (rulings R6 and R13, WRITER_TEXT_FIELDS): no
   * figures outside tokens and no quoted span of three or more words in any
   * quotation style.
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
        `${path}: quoted span ${clipText(span, 80)} (${words} words); quotations reach the page only as quote evidence ([[ev:<id>]]), so write no quotation marks`,
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
