/**
 * WP41-S3. Text normalisation shared by the verbatim guards.
 *
 * A model quoting a page or a source must reproduce the words, not the
 * markdown or typography. Both sides are reduced to the same plain form
 * before comparison: link URLs, emphasis and code ticks dropped, curly
 * quotes and dashes straightened, whitespace collapsed, lowercased.
 */

export function normaliseForMatch(text: string): string {
  return text
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\*\*|__|`/g, "")
    .replace(/(^|\s)[*_](\S)/g, "$1$2")
    .replace(/(\S)[*_](?=\s|$|[.,;:!?])/g, "$1")
    .replace(/[‘’′]/g, "'")
    .replace(/[“”″]/g, '"')
    .replace(/[‒–—―−]/g, "-")
    .replace(/ /g, " ")
    .replace(/\\([<{}>])/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * True when `quote` appears in `haystack` after normalisation. Leading and
 * trailing punctuation and quote marks are ignored: models close a clause
 * with "." where the page's sentence carries on.
 */
export function containsVerbatim(haystack: string, quote: string, minChars = 8): boolean {
  const trim = (s: string) => s.replace(/^[\s"'(\[.,;:!?…-]+|[\s"')\].,;:!?…-]+$/g, "");
  const hay = normaliseForMatch(haystack);
  const q = trim(normaliseForMatch(quote));
  if (q.length < minChars) return false;
  if (hay.includes(q)) return true;

  // An ellipsis marks an elision: accept when every part appears in order,
  // each within MAX_GAP characters of the previous one.
  const parts = q.split(/\s*(?:\.\.\.|…)\s*/).map(trim).filter(Boolean);
  if (parts.length < 2 || parts.some((p) => p.length < 4)) return false;
  let from = 0;
  let prevEnd = -1;
  for (const part of parts) {
    const at = hay.indexOf(part, from);
    if (at === -1 || (prevEnd !== -1 && at - prevEnd > MAX_GAP)) return false;
    prevEnd = at + part.length;
    from = prevEnd;
  }
  return true;
}

/** Longest elision an ellipsis in a quote may stand for. */
const MAX_GAP = 400;

/**
 * Numeric tokens in a claim, in the forms a source may print them:
 * "456,000" also yields "456000"; "$12.5 billion" yields "12.5".
 */
export function numberTokens(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
    const raw = m[0].replace(/[.,]$/, "");
    if (raw.replace(/\D/g, "").length < 2 && !/\./.test(raw)) continue; // skip "3", "4"
    out.add(raw);
    if (raw.includes(",")) out.add(raw.replace(/,/g, ""));
  }
  return [...out];
}

const STOPWORDS = new Set(
  "about above after again against among around because before being below between billion both could does doing during each from further have having into itself just million more most other over same should some such than that their theirs them then there these they this those through under until very were what when where which while with would year years your market users people percent".split(
    " ",
  ),
);

/** Content words (5+ letters, not stopwords) for passage scoring. */
export function keywords(text: string): string[] {
  const words = normaliseForMatch(text).match(/[a-z][a-z'-]{4,}/g) ?? [];
  return [...new Set(words.filter((w) => !STOPWORDS.has(w)))];
}
