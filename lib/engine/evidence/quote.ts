/**
 * Quotes: contiguous source matching, strict rendered-quote comparison and
 * the one MDX escape/unescape pair shared by the compiler and the auditor
 * (WP54, contract §5).
 *
 * Source matching is word-level: a word is a run of Unicode letters, marks
 * and digits (an apostrophe between letters joins a word, so "don't" and
 * "don’t" are one word "dont"); words compare after NFKC and lowercasing, so
 * case, punctuation and whitespace never matter. A candidate matches only as
 * one contiguous run of source words. Leading/trailing ellipses are
 * truncation marks and are stripped; an internal ellipsis is rejected, so
 * fragments can never be joined into a new assertion. The matched span is
 * returned in the SOURCE's own characters, so the stored excerpt never
 * carries the candidate's punctuation, digits separators or currency signs.
 *
 * Rendered-quote comparison is strict: only presentation differences are
 * folded (NFC, typographic quotes/apostrophes/dashes/ellipsis, invisible
 * characters, whitespace including line breaks). Case, digits, word order
 * and all other punctuation are preserved and the whole strings must match.
 */

/** Original [start, end) UTF-16 indices of one matched word. */
export type MatchWord = { start: number; end: number };

/** Word-level match form of a text; `words[i]` spans `map[i]` in the input. */
export type SourceMatchForm = {
  /** Words joined by single spaces. */
  normalized: string;
  words: string[];
  map: MatchWord[];
};

/** A source text prepared once for repeated contiguous matching. */
export type PreparedSource = { text: string; form: SourceMatchForm };

/** Result of contiguous matching; `text` is the source's own characters. */
export type SpanResult =
  | { ok: true; start: number; end: number; text: string }
  | { ok: false; reason: "span_not_found" | "internal_ellipsis" | "span_bounds" };

const MATCH_WORD_RE = /[\p{L}\p{M}\p{N}]+(?:['’ʼ‘][\p{L}\p{M}\p{N}]+)*/gu;
const APOSTROPHES_RE = /['’ʼ‘]/g;

/**
 * Word-level form for source matching: Unicode letters/digits, NFKC,
 * lowercase, punctuation-insensitive, with a map back to original indices.
 */
export function normalizeForSourceMatch(text: string): SourceMatchForm {
  const words: string[] = [];
  const map: MatchWord[] = [];
  for (const m of text.matchAll(MATCH_WORD_RE)) {
    const start = m.index ?? 0;
    words.push(m[0].normalize("NFKC").toLowerCase().replace(APOSTROPHES_RE, ""));
    map.push({ start, end: start + m[0].length });
  }
  return { normalized: words.join(" "), words, map };
}

/** Normalize a source once so many candidates can be matched against it. */
export function prepareSourceForMatch(text: string): PreparedSource {
  return { text, form: normalizeForSourceMatch(text) };
}

const ELLIPSIS = String.raw`(?:\.\s*\.\s*\.|…)`;
const LEADING_TRUNCATION_RE = new RegExp(
  String.raw`^(?:[\s"'“”‘’«»(\[]*(?:\[\s*)?${ELLIPSIS}(?:\s*\])?)+`,
  "u",
);
const TRAILING_TRUNCATION_RE = new RegExp(
  String.raw`(?:(?:\[\s*)?${ELLIPSIS}(?:\s*\])?[\s"'“”‘’«»)\]]*)+$`,
  "u",
);
const ELLIPSIS_RE = new RegExp(ELLIPSIS, "u");

/** The candidate without truncation ellipses, or "internal_ellipsis". */
function stripTruncation(candidate: string): string | "internal_ellipsis" {
  const core = candidate.trim().replace(LEADING_TRUNCATION_RE, "").replace(TRAILING_TRUNCATION_RE, "");
  return ELLIPSIS_RE.test(core) ? "internal_ellipsis" : core;
}

function indexOfSequence(haystack: readonly string[], needle: readonly string[]): number {
  const last = haystack.length - needle.length;
  outer: for (let i = 0; i <= last; i += 1) {
    for (let j = 0; j < needle.length; j += 1) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

/** Keep a currency sign glued to the first matched word ("$500 a month"). */
function extendStart(text: string, start: number): number {
  const before = text[start - 1] ?? "";
  return before === "$" || before === "€" || before === "£" ? start - 1 : start;
}

/** Keep a glued "%" and sentence-ending punctuation (an ellipsis included) after the last word. */
function extendEnd(text: string, end: number): number {
  let i = end;
  if (text[i] === "%") i += 1;
  while (i < text.length && /[.!?…]/.test(text[i] ?? "")) i += 1;
  return i;
}

/** Contiguous match of `candidate` in a prepared source (see findContiguousSpan). */
export function findContiguousSpanIn(candidate: string, source: PreparedSource): SpanResult {
  const core = stripTruncation(candidate);
  if (core === "internal_ellipsis") return { ok: false, reason: "internal_ellipsis" };
  const wanted = normalizeForSourceMatch(core).words;
  if (wanted.length === 0) return { ok: false, reason: "span_bounds" };
  const index = indexOfSequence(source.form.words, wanted);
  const first = source.form.map[index];
  const last = source.form.map[index + wanted.length - 1];
  if (index < 0 || !first || !last) return { ok: false, reason: "span_not_found" };
  const start = extendStart(source.text, first.start);
  const end = extendEnd(source.text, last.end);
  return { ok: true, start, end, text: source.text.slice(start, end) };
}

/**
 * First contiguous word-level occurrence of `candidate` in `source`. Leading
 * and trailing ellipses are stripped; an internal ellipsis rejects; a
 * candidate without words is "span_bounds". `text` is the source's own
 * characters for the matched words (plus a glued currency sign before, and a
 * glued "%" or sentence punctuation after).
 */
export function findContiguousSpan(candidate: string, source: string): SpanResult {
  return findContiguousSpanIn(candidate, prepareSourceForMatch(source));
}

// ---------------------------------------------------------------------------
// Strict comparison
// ---------------------------------------------------------------------------

/** Presentation-only folding shared by both comparison entry points. */
function presentationForm(text: string): string {
  return text
    .normalize("NFC")
    .replace(/[\u200B\u2060\uFEFF\u00AD]/g, "")
    .replace(/[‘’‚‛′‹›]/g, "'")
    .replace(/[“”„‟″«»]/g, '"')
    .replace(/[‐‑‒–—―−]/g, "-")
    .replace(/…/g, "...")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Strict comparison form of RENDERED (MDX) quote text: MDX escapes undone,
 * NFC, typographic quotes/apostrophes/dashes folded, whitespace and line
 * breaks collapsed; case, digits, order and other punctuation preserved.
 */
export function normalizeQuoteForCompare(text: string): string {
  return presentationForm(unescapeMdxText(text));
}

/**
 * The same strict form for a RECORD excerpt, which is raw source text and
 * must not be unescaped. Equals normalizeQuoteForCompare(escapeMdxText(x)).
 */
export function normalizeExcerptForCompare(excerpt: string): string {
  return presentationForm(excerpt);
}

/** True when rendered MDX quote text is exactly the record excerpt (strict form). */
export function quoteMatchesExcerpt(renderedMdx: string, excerpt: string): boolean {
  const rendered = normalizeQuoteForCompare(renderedMdx);
  return rendered !== "" && rendered === normalizeExcerptForCompare(excerpt);
}

/**
 * Ruling R8: two quotes are distinct only when neither contains the other.
 * True when one quote's words (the source-match form: case and punctuation
 * insensitive) occur as a contiguous run of the other's.
 */
export function quoteTextsOverlap(a: string, b: string): boolean {
  const x = normalizeForSourceMatch(a).normalized;
  const y = normalizeForSourceMatch(b).normalized;
  if (x === "" || y === "") return false;
  return ` ${x} `.includes(` ${y} `) || ` ${y} `.includes(` ${x} `);
}

/**
 * How many quotes remain when every quote contained in another is dropped
 * (ruling R8): a quote and a longer quote that contains it count once.
 */
export function distinctQuoteCount(texts: ReadonlyArray<string>): number {
  const kept: string[] = [];
  const byLength = [...texts].sort(
    (a, b) => normalizeForSourceMatch(b).words.length - normalizeForSourceMatch(a).words.length,
  );
  for (const text of byLength) {
    if (normalizeForSourceMatch(text).words.length === 0) continue;
    if (!kept.some((other) => quoteTextsOverlap(other, text))) kept.push(text);
  }
  return kept.length;
}

// ---------------------------------------------------------------------------
// MDX escaping
// ---------------------------------------------------------------------------

/** Line starts MDX would parse as ESM ("import x from 'y'"). */
const ESM_KEYWORDS = new Set(["import ", "export "]);
/** Character references unescapeMdxText decodes when their "&" is not escaped. */
const CHARACTER_REFERENCE_RE = /^&(?:#(\d{1,7})|#[xX]([0-9a-fA-F]{1,6})|(amp|lt|gt|quot|apos|nbsp));/;
const NAMED_REFERENCES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00A0",
};

/** Escaped wherever they appear: MDX expressions/JSX and inline Markdown syntax. */
const ESCAPE_EVERYWHERE = new Set(["\\", "<", ">", "{", "}", "[", "]", "*", "_", "`", "~", "|", "&", "#", "@"]);
/**
 * Escaped at the start of a line (after optional spaces/tabs): block markers,
 * and ":" so no line can become a GFM table delimiter row (":-", ":-:").
 */
const ESCAPE_AT_LINE_START = new Set(["-", "+", "=", ":"]);
/** Every character escapeMdxText may put a backslash in front of. */
const UNESCAPABLE = new Set([...ESCAPE_EVERYWHERE, ...ESCAPE_AT_LINE_START, ".", ")", ":"]);
/** "http://" / "https://" (any case) that GFM would turn into a link. */
const URL_SCHEME_RE = /^https?:\/\//i;

/**
 * The autolink break (security S-P2b): a character reference for U+2060
 * WORD JOINER, which renders as nothing. remark-gfm links bare URLs, www
 * hosts and emails in TWO places: micromark's tokenizer reads the raw
 * source, and mdast-util-gfm-autolink-literal then searches the DECODED
 * text of every text node. A backslash escape or a character reference for
 * ":" "." or "@" only stops the first (the decoded text is the same
 * address), so the escape puts this invisible character inside the
 * pattern: "https&#x2060;://", "www&#x2060;.", "me&#x2060;\@example.com".
 * Neither pass can match it, and the visible text is unchanged.
 * unescapeMdxText drops this exact spelling (escapeMdxText escapes every
 * "&" of the input, so the unescaped reference can only be the break).
 */
export const AUTOLINK_BREAK = "&#x2060;";

/** The character AUTOLINK_BREAK renders as; text compared with rendered output may need it removed. */
export const AUTOLINK_BREAK_CHAR = "\u2060";

function isAsciiDigit(ch: string): boolean {
  return ch >= "0" && ch <= "9";
}

/**
 * Escape text so it renders literally in MDX prose and inside a blockquote:
 * backslash-escapes \ < > { } [ ] * _ ` ~ | & # @ everywhere; - + = : and
 * ordered-list markers ("1." / "1)") at the start of a line; writes the
 * first letter of a line-start "import " / "export " as a numeric character
 * reference so MDX cannot read the line as ESM; and puts AUTOLINK_BREAK
 * inside every "http(s)://", "www." and before every "@", so no bare URL,
 * www host or email becomes a link, while the visible text stays identical.
 * Newlines are kept (MDX has no indented code); prefix every line with "> "
 * inside a blockquote. unescapeMdxText is its exact inverse.
 */
export function escapeMdxText(text: string): string {
  let out = "";
  let lineStart = true;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i] ?? "";
    if (ch === "\n" || ch === "\r") {
      out += ch;
      lineStart = true;
      continue;
    }
    // Any whitespace keeps the line start open, not only spaces and tabs: a
    // caller may trim lines (the compiler's quoteBlock does, and JavaScript's
    // trim removes NBSP and other Unicode spaces), which would otherwise bare
    // a block marker such as "+", "-", "=" or "1." behind such a space.
    if (lineStart && /\s/.test(ch)) {
      out += ch;
      continue;
    }
    if (lineStart && ESCAPE_AT_LINE_START.has(ch)) {
      out += `\\${ch}`;
      lineStart = false;
      continue;
    }
    if (lineStart && (ch === "i" || ch === "e") && ESM_KEYWORDS.has(text.slice(i, i + 7))) {
      out += ch === "i" ? "&#105;" : "&#101;";
      lineStart = false;
      continue;
    }
    if (lineStart && isAsciiDigit(ch)) {
      let j = i;
      while (j < text.length && isAsciiDigit(text[j] ?? "")) j += 1;
      const marker = text[j] ?? "";
      if (marker === "." || marker === ")") {
        out += `${text.slice(i, j)}\\${marker}`;
        i = j;
        lineStart = false;
        continue;
      }
    }
    lineStart = false;
    if ((ch === "h" || ch === "H") && URL_SCHEME_RE.test(text.slice(i, i + 8))) {
      const scheme = text.slice(i, text.indexOf(":", i));
      out += `${scheme}${AUTOLINK_BREAK}`;
      i += scheme.length - 1;
      continue;
    }
    if ((ch === "w" || ch === "W") && text.slice(i, i + 4).toLowerCase() === "www.") {
      out += `${text.slice(i, i + 3)}${AUTOLINK_BREAK}`;
      i += 2;
      continue;
    }
    if (ch === "@") {
      out += `${AUTOLINK_BREAK}\\@`;
      continue;
    }
    out += ESCAPE_EVERYWHERE.has(ch) ? `\\${ch}` : ch;
  }
  return out;
}

function decodeReference(match: RegExpExecArray): string | null {
  const [, decimal, hex, name] = match;
  if (name) return NAMED_REFERENCES[name] ?? null;
  const code = decimal ? Number(decimal) : parseInt(hex ?? "", 16);
  return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : null;
}

/**
 * Exact inverse of escapeMdxText: unescapeMdxText(escapeMdxText(x)) === x.
 * Drops AUTOLINK_BREAK (that exact spelling) and decodes other character
 * references whose "&" is not escaped (numeric, and
 * amp/lt/gt/quot/apos/nbsp), which is what MDX renders for them.
 */
export function unescapeMdxText(text: string): string {
  let out = "";
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i] ?? "";
    const next = text[i + 1] ?? "";
    if (ch === "\\" && UNESCAPABLE.has(next)) {
      out += next;
      i += 1;
      continue;
    }
    if (ch === "&" && text.startsWith(AUTOLINK_BREAK, i)) {
      i += AUTOLINK_BREAK.length - 1;
      continue;
    }
    if (ch === "&") {
      const reference = CHARACTER_REFERENCE_RE.exec(text.slice(i, i + 12));
      const decoded = reference ? decodeReference(reference) : null;
      if (reference && decoded !== null) {
        out += decoded;
        i += reference[0].length - 1;
        continue;
      }
    }
    out += ch;
  }
  return out;
}

/** Whitespace-separated tokens that contain at least one letter or digit. */
export function wordCount(text: string): number {
  return text.split(/\s+/).filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
}
