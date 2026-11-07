/**
 * The market-claim check (D15), shared by the own-idea light blueprint
 * (`lib/workspace/wizard/light-blueprint.ts`) and the WP90 idea seeds
 * (`seeds.ts`): no model-written money, percentages, market sizes, traction
 * counts or keyword metrics. Moved here unchanged from `light-blueprint.ts`
 * (WP90-S2) so prompt modules can import it: this file has no imports.
 *
 * Pure: no imports at all.
 */

/** A number not glued to a word before it ("B2B", "Web3", "v2" are not numbers). */
const NUM = String.raw`(?<![\p{L}\p{N}.,])\d[\d,.]*`;
/** A count of 100 or more ("250", "10,000", "50000") that is not a bare year (2025 is a date). */
const BIG_NUM = String.raw`(?<![\p{L}\p{N}.,])(?!(?:19|20)\d{2}(?![\d,.]))(?:\d{1,3}(?:,\d{3})+|\d{3,})(?:\.\d+)?(?![\d,])`;
/** Units of time and measure: "100 days", "10,000 steps" describe the product, not a market. */
const UNITS = String.raw`(?:ms|seconds?|secs?|minutes?|mins?|hours?|hrs?|days?|nights?|weeks?|months?|years?|yrs?|km|kms|kilometres?|kilometers?|miles?|metres?|meters?|kg|lbs?|calories|kcal|steps|reps|words|pages|pixels|px|mb|gb|tb|times)`;
/** Words that follow a race distance or a plan, not a counted noun ("Couch to 5k for beginners"). */
const FUNCTION_WORDS = String.raw`(?:for|to|in|on|at|of|with|and|or|a|an|the|run|runs|race|races|training|plan|plans|walk)`;
/** Currency codes. */
const CODES = String.raw`(?:usd|eur|gbp|cad|aud|nzd|inr|jpy|chf|sek|nok|dkk)`;
/** A following word that is a counted noun: any word except units and function words. */
const COUNTED_NOUN = String.raw`(?!(?:${UNITS}|${FUNCTION_WORDS})(?![\p{L}-]))[\p{L}][\p{L}-]*`;

/**
 * What counts as a market claim (D15: an own idea asserts no market numbers).
 *
 * Claims: money (symbols or codes, before or after the number), per-period
 * prices, percentages, market-size magnitudes (million/billion and a bare
 * M/B/bn after a number), revenue metrics with a number (MRR, ARR, GMV,
 * revenue, turnover), ratios ("1 in 5", "4 out of 5"), and traction counts: a
 * count of 100 or more, or a k-magnitude, followed by any noun ("500 waitlist
 * sign ups", "10k dentists"). Plus market and keyword metric words.
 *
 * Not claims: counts under 100 with a noun ("3 steps", "2 founders", "Top 10
 * tips"), numbers glued to letters ("B2B", "Web 3" stays, "v2"), "24/7",
 * years, counts of time or measure units ("100 days", "10,000 steps"), and a
 * k-distance followed by a function word ("Couch to 5k for beginners").
 * Known trade-off: "100 m sprint" reads as a magnitude and is stripped.
 */
const MARKET_CLAIM_PATTERNS: readonly RegExp[] = Object.freeze([
  // Money, symbol first: "$5", "€ 10", "£2.99", "¥300", "₹99".
  new RegExp(String.raw`[$€£¥₹]\s?\d`, "u"),
  // Money, symbol after: "49€", "49 €/month".
  new RegExp(String.raw`${NUM}\s?[$€£¥₹]`, "u"),
  // Money, code first: "USD 49", "eur10".
  new RegExp(String.raw`(?<![\p{L}])${CODES}\s?\d`, "iu"),
  // Money, code or word after: "5 USD", "20 dollars".
  new RegExp(String.raw`${NUM}\s?(?:${CODES}|dollars?|euros?|pounds?|bucks)(?![\p{L}])`, "iu"),
  // Percentages: "30%", "12 percent".
  new RegExp(String.raw`${NUM}\s?(?:%|percent\b|per\s?cent\b)`, "iu"),
  // Market-size words in any form: "millions of", "a billion-dollar".
  /(?<![\p{L}])(?:millions?|billions?|trillions?)(?![\p{L}])/iu,
  // A bare M/B magnitude after a number: "2.3B market", "reach 1M", "4bn", "2m".
  new RegExp(String.raw`${NUM}\s?(?:mm|m|b|bn|tn)(?![\p{L}\p{N}])`, "iu"),
  // Revenue metrics with a number: "5k MRR", "ARR of 2m", "revenue of $3".
  new RegExp(String.raw`${NUM}\s?(?:k|m|b|bn)?\s+(?:mrr|arr|gmv|revenue|turnover)(?![\p{L}])`, "iu"),
  new RegExp(String.raw`(?<![\p{L}])(?:mrr|arr|gmv|revenue|turnover)\s+(?:(?:of|at|is|hit|hits|reached|reaches|over|near)\s+)?[$€£¥₹]?\s?\d`, "iu"),
  // Ratios: "1 in 5 people", "4 out of 5" (not "step 2 in 3 minutes").
  new RegExp(String.raw`${NUM}\s+(?:in|out\s+of)\s+\d[\d,.]*(?!\s*${UNITS}(?![\p{L}]))`, "iu"),
  // Traction counts: 100+ or a k-magnitude, then any counted noun.
  new RegExp(
    String.raw`(?:${BIG_NUM}|${NUM}\s?(?:k|thousand))\+?\s+${COUNTED_NOUN}`,
    "iu",
  ),
  // Per-period or per-seat prices: "9/month", "12 per seat", "5 a year".
  new RegExp(String.raw`${NUM}\s?(?:\/\s?|per\s+|a\s+)(?:month|mo|year|yr|seat|user)\b`, "iu"),
  // Market and keyword metrics, in words.
  /\b(?:market\s+size|market\s+share|search\s+volume|keyword\s+volume|monthly\s+searches|cost\s+per\s+click)\b/iu,
  // Market-sizing acronyms. Case-sensitive, so "Sam" and "som" stay words.
  /\b(?:TAM|SAM|SOM|CAGR|CPC)\b/u,
]);

/** True when the text carries a market number, a price or keyword data. */
export function hasMarketClaim(text: string): boolean {
  return MARKET_CLAIM_PATTERNS.some((pattern) => pattern.test(text));
}

export type StrippedText = {
  /** The text with every clause that carried a claim removed (may be empty). */
  readonly text: string;
  /** How many clauses were removed. */
  readonly removed: number;
};

/**
 * Removes every clause (comma, semicolon or dash separated, within a sentence)
 * that carries a market claim. Clauses without one keep the founder's words.
 */
export function stripMarketClaims(text: string): StrippedText {
  const sentences = text.trim().split(/(?<=[.!?])\s+/u);
  const kept: string[] = [];
  let removed = 0;
  for (const sentence of sentences) {
    if (!hasMarketClaim(sentence)) {
      if (sentence.length > 0) kept.push(sentence);
      continue;
    }
    const clauses = sentence.split(/,\s+|;\s+|\s+[–—-]\s+/u);
    const clean = clauses.filter((clause) => !hasMarketClaim(clause));
    removed += clauses.length - clean.length;
    let joined = clean.join(", ").trim().replace(/[,;:\s]+$/u, "");
    if (joined.length === 0) continue;
    const end = sentence.trimEnd().slice(-1);
    if (/[.!?]/u.test(end) && !/[.!?]$/u.test(joined)) joined += end;
    // A sentence that did not start lower-case still starts with a capital.
    if (!/^\p{Ll}/u.test(sentence)) joined = joined.charAt(0).toUpperCase() + joined.slice(1);
    kept.push(joined);
  }
  return { text: kept.join(" ").trim(), removed };
}
