/**
 * Amounts and prices — the one grammar shared by evidence acceptance, record
 * re-validation, the compiler and the auditor (WP54, contract §5).
 *
 * This is a deliberately small, documented grammar, not a universal parser.
 * Anything outside it is "not an amount" / "not a price", so a claim that
 * depends on it is rejected (ambiguity rejects). Exact decimal arithmetic
 * only: values stay decimal strings and compare as scaled BigInts.
 *
 * NUMBERS (English, ASCII digits)
 *   1,400,000 | 1400000 | 1.4 | 24.99. A comma is only a thousands
 *   separator (groups of exactly three digits). European forms (1.400.000,
 *   "1,4"), space-grouped digits (1 400 000) and ".99" are not numbers.
 * MAGNITUDE
 *   k K thousand | m M mn MM million | b B bn billion | t T tn trillion.
 *   Single letters attach directly ("$5k", "$1.4B"); words and bn/mn/tn/MM
 *   may follow one space ("$1.4 billion", "$1.4 bn").
 * CURRENCY
 *   Prefix: $ (USD), US$, USD, € EUR, £ GBP, C$ CA$ CAD, A$ AU$ AUD — one
 *   optional space before the number ("USD 30"). Suffix ISO code: "30 EUR",
 *   "1.4 billion USD". A bare "$" followed by a dollar suffix code takes that
 *   code ("$30 CAD" is CAD); any other prefix/suffix disagreement is not an
 *   amount. "<letters>$" (NZ$, HK$, R$) and other currencies (¥, ₹, CHF) are
 *   not amounts.
 * PERCENT
 *   number + "%" | "percent" | "per cent".
 * COUNT
 *   number [magnitude] [up to two of: active monthly daily weekly paying paid
 *   registered total unique global new enterprise business existing current]
 *   + a count noun (users, customers, developers, companies, …; see
 *   COUNT_NOUNS). A four-digit 1900–2099 number written without a separator
 *   is a year, never a count ("2,000 developers" is a count).
 * AMOUNT
 *   currency | percent | count. A bare number is not an amount; a bare year
 *   is never an amount.
 * NOT AMOUNTS (excluded wherever they appear)
 *   ranges     "$20-$30", "$20–30", "20-30%", "$20 to $30",
 *              "$24/month to $30/month", "between $1M and $2M"
 *   bounds     up to, as much/high/many as, more than, over, less/fewer than,
 *              under, at least/most, exceeding, in excess of, upwards of,
 *              above, below, just under/over, <, >, ≤, ≥; a directly attached
 *              "+" ("1M+"), "or more", "and up"
 *   negatives  "-5%", "−$3"
 *   Hedges (approximately, about, around, roughly, nearly, ~) are allowed and
 *   ignored; the stored excerpt keeps them for human review.
 *
 * PRICE EXPRESSIONS
 *   A currency amount followed by unit segments, optionally followed by
 *   qualifier phrases:
 *     "/x" | "per x" | "a x" | "an x"   x = a period or basis word
 *     monthly | annually | yearly | weekly | daily
 *     one-time | lifetime
 *   periods   month: mo, mth, month, monthly · year: yr, year, annum,
 *             annually, yearly · week: wk, week, weekly · day: day, daily ·
 *             one_time: one-time, onetime, lifetime
 *   basis     per_user: user seat member developer dev agent editor license
 *             licence person contributor · per_workspace: workspace team
 *             account organization organisation org company store site
 *             project location · no basis word: flat
 *   Exactly one period and at most one basis word. A second period/basis or
 *   any unknown unit ("per credit", "/1k tokens") invalidates the expression.
 *   No period → not a price ("$20,000", "$240 billed annually").
 *   After one line break, "/x", "per x", one-time/lifetime and qualifier
 *   phrases still continue the expression ("$24 /month" then "per seat,
 *   billed annually"); after one sentence-ending "." only a qualifier phrase
 *   does ("$24/mo. Billed annually."). A conflicting segment after a break
 *   ends the expression instead of invalidating it.
 *   QUALIFIERS are read from the expression's own clause (clauseAround,
 *   merged across the lines the expression spans):
 *     billed_annually  billed/paid annually|yearly, annual billing
 *     billed_monthly   billed/paid monthly, monthly billing
 *     introductory     introductory, promo, promotional, launch price/pricing,
 *                      for the first [N] months|years|weeks
 *     plus_usage       + usage, plus usage, overage(s)
 *     starting_at      starting/starts/start at|from, from, as low as — only
 *                      directly before the amount ("from just ~$9/month")
 *   A qualifier phrase preceded by no/not/without/never/zero is ignored.
 *   Every qualifier in the clause applies to every price in that clause, so
 *   a clause that names two billing terms makes each price claim need both.
 *
 * PROJECTIONS (contract §12, ruling R2)
 *   A projection cue (will, would, shall, could, might, should, lowercase
 *   "may", going to, set/likely/on track/on course to, poised, slated,
 *   expect*, projected, forecast*, predict*, anticipat*, outlook, "to reach/
 *   hit/grow/…") or a year after the retrieval year marks every amount after
 *   it in the same sentence; an amount is also projected when a year after
 *   the retrieval year follows it before the next amount ("$10.8 billion by
 *   2034", "(2034)"). See isProjectedAmount.
 *
 * SENTENCES AND CLAUSES
 *   Sentences end at . ! ? … followed by whitespace (closing quotes/brackets
 *   allowed in between). A "." after a single letter (U.S., J.) or a listed
 *   abbreviation (e.g., i.e., etc., vs., approx., est., inc., ltd., co.,
 *   corp., no., mr., dr., month names) does not end one. Line breaks:
 *     sentenceAround (stats and prices): every line break ends a sentence,
 *       so a claim never binds across lines of a pricing table or report;
 *     proseSentenceAround (quotes, ruling R14): a line break starts a
 *       sentence only after terminal punctuation or at a blank line
 *       ("\n[ \t]*\n", CRLF included, or a paragraph separator), so the
 *       second line of a soft-wrapped sentence is not a sentence of its own.
 *   Clauses also split at "|", tabs, ";" and before the contrast words while,
 *   whereas, but, versus, vs, compared to/with.
 *
 * COMPARISONS AND BILLING (rulings R9 and R14)
 *   comparisonCueFor: unlike, than, instead, versus/vs, compare(d)/comparison,
 *   alternative(s), competitor(s)/competing, switch(ed) from/to/away,
 *   move(d)/migrate(d) to/from, replace(d) by/with anywhere in the
 *   sentence(s) of a price's clause, or in the soft-wrapped line above it
 *   (bindingWindowStart). ambiguousBilling (page-scoped, ruling R14): a
 *   billing toggle line (only billing words: Monthly, Yearly, Annually,
 *   Billed monthly/yearly, optionally "save N%") or an annual-billing phrase
 *   (billed/paid annually, annual billing/plan/subscription/contract, …)
 *   anywhere above a per-month price, or on its line, needs the price's
 *   clause to state its billing; ordinary feature lines that mention
 *   "annual" do not count, a per-year or one-time price states its own
 *   term, and negated cues do not count.
 */

import type {
  Amount,
  CurrencyCode,
  Magnitude,
  PriceBasis,
  PricePeriod,
  PriceQualifier,
  PriceTerms,
  RejectionReason,
} from "./contract.ts";

// ---------------------------------------------------------------------------
// Public result shapes
// ---------------------------------------------------------------------------

/** An amount found in text; `start`/`end` cover prefix, number and unit. */
export type FoundAmount = {
  amount: Amount;
  start: number;
  end: number;
  raw: string;
  /** Index of the first digit (after any currency prefix). */
  numberStart: number;
};

/** A price expression found in text, with its (merged) clause. */
export type PriceExpression = {
  terms: PriceTerms;
  start: number;
  end: number;
  clause: string;
  clauseStart: number;
  clauseEnd: number;
};

/** A sentence or clause: `text === source.slice(start, end)`, trimmed. */
export type TextRange = { start: number; end: number; text: string };

// ---------------------------------------------------------------------------
// Character helpers
// ---------------------------------------------------------------------------

const WORD_CHAR_RE = /[\p{L}\p{N}_]/u;
const LETTER_RE = /\p{L}/u;
const DIGIT_RE = /[0-9]/;
const HSPACE_RE = /[ \t\u00A0]/;
const NEWLINE_RE = /[\n\r\u2028\u2029]/;
const SPACE_RE = /\s/;

/** Longest plausible number token; longer digit runs are not amounts. */
const MAX_NUMBER_CHARS = 30;
/** How far back/forward range and bound context is inspected. */
const CONTEXT_CHARS = 60;

function at(text: string, index: number): string {
  return index >= 0 && index < text.length ? (text[index] ?? "") : "";
}

function isWordChar(ch: string): boolean {
  return ch !== "" && WORD_CHAR_RE.test(ch);
}

// ---------------------------------------------------------------------------
// Currency prefixes and codes
// ---------------------------------------------------------------------------

type PrefixKind = "symbol" | "code" | "dollar";
type PrefixDef = { text: string; currency: CurrencyCode; kind: PrefixKind };

/** Longest first, so "US$" wins over "$" and "CA$" over "A$". */
const PREFIXES: readonly PrefixDef[] = [
  { text: "US$", currency: "USD", kind: "symbol" },
  { text: "CA$", currency: "CAD", kind: "symbol" },
  { text: "AU$", currency: "AUD", kind: "symbol" },
  { text: "USD", currency: "USD", kind: "code" },
  { text: "EUR", currency: "EUR", kind: "code" },
  { text: "GBP", currency: "GBP", kind: "code" },
  { text: "CAD", currency: "CAD", kind: "code" },
  { text: "AUD", currency: "AUD", kind: "code" },
  { text: "C$", currency: "CAD", kind: "symbol" },
  { text: "A$", currency: "AUD", kind: "symbol" },
  { text: "$", currency: "USD", kind: "dollar" },
  { text: "€", currency: "EUR", kind: "symbol" },
  { text: "£", currency: "GBP", kind: "symbol" },
];

const DOLLAR_CODES: ReadonlySet<CurrencyCode> = new Set(["USD", "CAD", "AUD"]);

const CURRENCY_SYMBOL: Record<CurrencyCode, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  CAD: "C$",
  AUD: "A$",
};

type PrefixMatch = { start: number; def: PrefixDef };

/**
 * The currency prefix ending right before a number (one optional space), or
 * "unsupported" for "<letters>$"-style prefixes such as NZ$ or R$.
 */
function prefixBefore(text: string, numberStart: number): PrefixMatch | "unsupported" | null {
  const ends = [numberStart];
  if (HSPACE_RE.test(at(text, numberStart - 1))) ends.push(numberStart - 1);
  for (const end of ends) {
    for (const def of PREFIXES) {
      const start = end - def.text.length;
      if (start < 0 || text.slice(start, end) !== def.text) continue;
      const before = at(text, start - 1);
      if (isWordChar(before) || before === "$" || before === "€" || before === "£") {
        // "XUSD 5" is just text; "NZ$5" is a currency we do not support.
        return def.kind === "code" ? null : "unsupported";
      }
      return { start, def };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Magnitudes, units and count nouns
// ---------------------------------------------------------------------------

const MAGNITUDE_WORDS: Record<string, Magnitude> = {
  thousand: "thousand",
  million: "million",
  billion: "billion",
  trillion: "trillion",
  k: "thousand",
  m: "million",
  b: "billion",
  t: "trillion",
  mn: "million",
  mm: "million",
  bn: "billion",
  tn: "trillion",
};

const MAGNITUDE_EXPONENT: Record<Magnitude, number> = {
  none: 0,
  thousand: 3,
  million: 6,
  billion: 9,
  trillion: 12,
};

const MAGNITUDE_WORD_RE = /^[ \u00A0]?(thousand|million|billion|trillion)(?![\p{L}\p{N}])/iu;
const MAGNITUDE_ABBR_RE = /^[ \u00A0]?(bn|mn|tn)(?![\p{L}\p{N}])/iu;
const MAGNITUDE_MM_RE = /^[ \u00A0]?MM(?![\p{L}\p{N}])/u;
const MAGNITUDE_LETTER_RE = /^([kKmMbBtT])(?![\p{L}\p{N}])/u;

function magnitudeAt(text: string, index: number): { magnitude: Magnitude; end: number } | null {
  const rest = text.slice(index, index + 12);
  for (const re of [MAGNITUDE_WORD_RE, MAGNITUDE_ABBR_RE, MAGNITUDE_MM_RE, MAGNITUDE_LETTER_RE]) {
    const m = re.exec(rest);
    if (!m) continue;
    const word = (m[1] ?? "mm").toLowerCase();
    const magnitude = MAGNITUDE_WORDS[word];
    if (magnitude) return { magnitude, end: index + m[0].length };
  }
  return null;
}

const ISO_SUFFIX_RE = /^[ \u00A0]?(USD|EUR|GBP|CAD|AUD)(?![\p{L}\p{N}])/u;
const DETACHED_LETTER_RE = /^[ \u00A0][kKmMbBtT](?![\p{L}\p{N}])/u;
const PERCENT_RE = /^[ \u00A0]?(?:%|percent(?!\p{L})|per[ \u00A0]cent(?!\p{L}))/iu;

const COUNT_MODIFIERS = [
  "active", "monthly", "daily", "weekly", "paying", "paid", "registered", "total",
  "unique", "global", "new", "enterprise", "business", "existing", "current",
];

/** Count nouns; each entry is matched as a whole word, case-insensitively. */
export const COUNT_NOUNS: readonly string[] = [
  "user", "users", "customer", "customers", "developer", "developers", "dev", "devs",
  "engineer", "engineers", "company", "companies", "business", "businesses",
  "organization", "organizations", "organisation", "organisations", "org", "orgs",
  "team", "teams", "merchant", "merchants", "store", "stores", "shop", "shops",
  "seller", "sellers", "member", "members", "subscriber", "subscribers", "download",
  "downloads", "install", "installs", "installation", "installations", "people",
  "person", "employee", "employees", "professional", "professionals", "account",
  "accounts", "seat", "seats", "startup", "startups", "enterprise", "enterprises",
  "agency", "agencies", "firm", "firms", "brand", "brands", "creator", "creators",
  "freelancer", "freelancers", "student", "students", "visitor", "visitors", "buyer",
  "buyers", "consumer", "consumers", "respondent", "respondents", "repository",
  "repositories", "repo", "repos", "project", "projects", "website", "websites",
  "site", "sites", "app", "apps", "worker", "workers", "marketer", "marketers",
  "designer", "designers", "writer", "writers", "researcher", "researchers",
  "practitioner", "practitioners", "reviewer", "reviewers",
];

const COUNT_RE = new RegExp(
  `^(?:[ \\u00A0]+(?:${COUNT_MODIFIERS.join("|")})){0,2}[ \\u00A0]+(?:${COUNT_NOUNS.join("|")})(?![\\p{L}\\p{N}])`,
  "iu",
);

const YEAR_TOKEN_RE = /^(?:19|20)\d{2}$/;

// ---------------------------------------------------------------------------
// Exclusions: bounds, ranges, negatives
// ---------------------------------------------------------------------------

const BOUND_BEFORE_RE =
  /(?:^|[^\p{L}\p{N}])(?:up\s+to|as\s+(?:much|high|many)\s+as|more\s+than|over|less\s+than|fewer\s+than|under|at\s+(?:least|most)|exceeding|in\s+excess\s+of|upwards\s+of|above|below|just\s+(?:under|over))\s*$|[<>≤≥]\s*$/iu;

const BOUND_AFTER_RE =
  /^(?:\+|\s*(?:or|and)\s+(?:more|less|fewer|higher|lower|above|below|over|up|greater)(?!\p{L})(?!\s+than))/iu;

const PREFIX_ALT = String.raw`US\$|CA\$|C\$|AU\$|A\$|\$|€|£|(?:USD|EUR|GBP|CAD|AUD)[ \u00A0]?`;
const MAGNITUDE_ALT = String.raw`k|m|b|t|bn|mn|tn|mm|thousand|million|billion|trillion|%|percent`;
const UNIT_SEGMENTS = String.raw`(?:[ \u00A0]*(?:\/[ \u00A0]*\p{L}+|per[ \u00A0]+\p{L}+))*`;
const RANGE_CONNECTOR = String.raw`(?:-|–|—|to|through)`;

const RANGE_BEFORE_RE = new RegExp(
  String.raw`(?:(${PREFIX_ALT})[ \u00A0]?)?(\d[\d,]*(?:\.\d+)?)[ \u00A0]?(${MAGNITUDE_ALT})?(${UNIT_SEGMENTS})[ \u00A0]*${RANGE_CONNECTOR}[ \u00A0]*$`,
  "iu",
);

const RANGE_AFTER_RE = new RegExp(
  String.raw`^(${UNIT_SEGMENTS})[ \u00A0]*${RANGE_CONNECTOR}[ \u00A0]*(${PREFIX_ALT})?(\d[\d,]*(?:\.\d+)?)(?:[ \u00A0]?(${MAGNITUDE_ALT})(?!\p{L}))?`,
  "iu",
);

const BETWEEN_RE = /(?:^|[^\p{L}])between[ \u00A0]+(?:\S+(?:[ \u00A0]+\S+){0,3}[ \u00A0]+and[ \u00A0]+)?$/iu;

function isBareYearToken(number: string, prefix: string | undefined, suffix: string | undefined): boolean {
  return !prefix && !suffix && YEAR_TOKEN_RE.test(number);
}

function isRangeEnd(text: string, start: number): boolean {
  const before = text.slice(Math.max(0, start - CONTEXT_CHARS), start);
  const m = RANGE_BEFORE_RE.exec(before);
  if (!m) return false;
  const units = (m[4] ?? "").trim();
  return !isBareYearToken(m[2] ?? "", m[1], m[3] || units || undefined);
}

function isRangeStart(text: string, end: number): boolean {
  const after = text.slice(end, end + CONTEXT_CHARS);
  const m = RANGE_AFTER_RE.exec(after);
  if (!m) return false;
  return !isBareYearToken(m[3] ?? "", m[2], m[4]);
}

function isNegative(text: string, start: number): boolean {
  const sign = at(text, start - 1);
  if (sign !== "-" && sign !== "−") return false;
  const before = at(text, start - 2);
  return before === "" || SPACE_RE.test(before) || before === "(" || before === "[";
}

function isExcluded(text: string, start: number, end: number): boolean {
  if (isNegative(text, start)) return true;
  if (BOUND_BEFORE_RE.test(text.slice(Math.max(0, start - CONTEXT_CHARS), start))) return true;
  if (BOUND_AFTER_RE.test(text.slice(end, end + 24))) return true;
  if (BETWEEN_RE.test(text.slice(Math.max(0, start - CONTEXT_CHARS), start))) return true;
  return isRangeEnd(text, start) || isRangeStart(text, end);
}

// ---------------------------------------------------------------------------
// Amount scanning
// ---------------------------------------------------------------------------

const NUMBER_RE = /\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g;

/** True when the number's left edge is a real token boundary. */
function numberStartsCleanly(text: string, numberStart: number): boolean {
  const prev = at(text, numberStart - 1);
  if (prev === "") return true;
  if (DIGIT_RE.test(prev)) return false;
  if ((prev === "." || prev === ",") && DIGIT_RE.test(at(text, numberStart - 2))) return false;
  return !isWordChar(prev);
}

/** True when the number's right edge does not continue as a number. */
function numberEndsCleanly(text: string, numberEnd: number): boolean {
  const next = at(text, numberEnd);
  if (DIGIT_RE.test(next)) return false;
  return !((next === "." || next === ",") && DIGIT_RE.test(at(text, numberEnd + 1)));
}

function readAmountAt(text: string, numberStart: number, numberText: string): FoundAmount | null {
  if (numberText.length > MAX_NUMBER_CHARS) return null;
  const numberEnd = numberStart + numberText.length;
  if (!numberEndsCleanly(text, numberEnd)) return null;

  const prefix = prefixBefore(text, numberStart);
  if (prefix === "unsupported") return null;
  if (!prefix && !numberStartsCleanly(text, numberStart)) return null;
  // A currency symbol we did not accept (e.g. "5$3") must not leave a bare number.
  if (!prefix && /[$€£]/.test(at(text, numberStart - 1))) return null;

  const value = numberText.replace(/,/g, "");
  const mag = magnitudeAt(text, numberEnd);
  // "$1.4 M": a detached single letter could be a magnitude or a word.
  if (!mag && DETACHED_LETTER_RE.test(text.slice(numberEnd, numberEnd + 3))) return null;
  const magnitude: Magnitude = mag ? mag.magnitude : "none";
  let end = mag ? mag.end : numberEnd;
  const start = prefix ? prefix.start : numberStart;

  let amount: Amount | null = null;
  const rest = text.slice(end, end + 160);
  const suffix = ISO_SUFFIX_RE.exec(rest);
  if (prefix) {
    if (PERCENT_RE.test(rest)) return null;
    let currency = prefix.def.currency;
    if (suffix) {
      const code = suffix[1] as CurrencyCode;
      if (prefix.def.kind === "dollar" && DOLLAR_CODES.has(code)) currency = code;
      else if (code !== prefix.def.currency) return null;
      end += suffix[0].length;
    }
    amount = { value, magnitude, unit: "currency", currency };
  } else if (suffix) {
    amount = { value, magnitude, unit: "currency", currency: suffix[1] as CurrencyCode };
    end += suffix[0].length;
  } else {
    const percent = PERCENT_RE.exec(rest);
    if (percent) {
      if (magnitude !== "none") return null;
      amount = { value, magnitude, unit: "percent" };
      end += percent[0].length;
    } else {
      const count = COUNT_RE.exec(rest);
      if (!count) return null;
      if (magnitude === "none" && YEAR_TOKEN_RE.test(numberText)) return null;
      amount = { value, magnitude, unit: "count" };
      end += count[0].length;
    }
  }
  if (amount.unit === "currency" && LETTER_RE.test(at(text, end)) && !suffix) {
    // "$30mo", "$5kg": the number runs into a word we do not understand.
    return null;
  }
  if (isExcluded(text, start, end)) return null;
  return { amount, start, end, raw: text.slice(start, end), numberStart };
}

/**
 * Amounts whose first digit lies in [from, to). Context outside the region
 * (prefixes, ranges, bounds) is still read from the full text.
 */
export function scanAmounts(text: string, from = 0, to = text.length): FoundAmount[] {
  const re = new RegExp(NUMBER_RE.source, "g");
  re.lastIndex = Math.max(0, from);
  const out: FoundAmount[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index >= to) break;
    const found = readAmountAt(text, m.index, m[0]);
    if (found) out.push(found);
  }
  return out;
}

/** Every amount expression in `text`, in order (see the grammar above). */
export function findAmounts(text: string): Array<{ amount: Amount; start: number; end: number; raw: string }> {
  return scanAmounts(text).map(({ amount, start, end, raw }) => ({ amount, start, end, raw }));
}

/** The single amount expression in `text`, or null when there are none or several. */
export function parseAmount(text: string): Amount | null {
  const found = scanAmounts(text);
  return found.length === 1 && found[0] ? found[0].amount : null;
}

// ---------------------------------------------------------------------------
// Exact decimal arithmetic
// ---------------------------------------------------------------------------

const DECIMAL_RE = /^(\d+)(?:\.(\d+))?$/;

/** value = mantissa × 10^exponent, exactly; null for a malformed value. */
function scaled(amount: Amount): { mantissa: bigint; exponent: number } | null {
  const m = DECIMAL_RE.exec(amount.value);
  if (!m) return null;
  const whole = m[1] ?? "0";
  const fraction = m[2] ?? "";
  const exponentOfMagnitude = MAGNITUDE_EXPONENT[amount.magnitude];
  if (exponentOfMagnitude === undefined) return null;
  return {
    mantissa: BigInt(`${whole}${fraction}`),
    exponent: exponentOfMagnitude - fraction.length,
  };
}

function pow10(n: number): bigint {
  return BigInt(10) ** BigInt(n);
}

/** True when both amounts are the same quantity: unit, currency and exact value. */
export function amountsEqual(a: Amount, b: Amount): boolean {
  if (a.unit !== b.unit) return false;
  if (a.unit === "currency" && (a.currency === undefined || a.currency !== b.currency)) return false;
  const x = scaled(a);
  const y = scaled(b);
  if (!x || !y) return false;
  const low = Math.min(x.exponent, y.exponent);
  return x.mantissa * pow10(x.exponent - low) === y.mantissa * pow10(y.exponent - low);
}

/** Exact integer cents for a currency amount; null for sub-cent precision or unsafe size. */
export function amountToCents(a: Amount): number | null {
  if (a.unit !== "currency") return null;
  const s = scaled(a);
  if (!s) return null;
  const shift = s.exponent + 2;
  let cents: bigint;
  if (shift >= 0) {
    cents = s.mantissa * pow10(shift);
  } else {
    const divisor = pow10(-shift);
    if (s.mantissa % divisor !== BigInt(0)) return null;
    cents = s.mantissa / divisor;
  }
  return cents <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(cents) : null;
}

/** Exact integer cents for a price's amount (see amountToCents). */
export function priceToCents(terms: PriceTerms): number | null {
  return amountToCents(terms.amount);
}

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Decimal text for mantissa × 10^exponent, without rounding or trailing zeros. */
function decimalText(mantissa: bigint, exponent: number): string {
  if (exponent >= 0) return groupThousands((mantissa * pow10(exponent)).toString());
  const digits = mantissa.toString().padStart(-exponent + 1, "0");
  const whole = digits.slice(0, digits.length + exponent);
  const fraction = digits.slice(digits.length + exponent).replace(/0+$/, "");
  return fraction ? `${groupThousands(whole)}.${fraction}` : groupThousands(whole);
}

function numberText(a: Amount): string {
  if (a.magnitude === "none" || a.magnitude === "thousand") {
    const s = scaled(a);
    if (!s) throw new TypeError(`invalid amount value "${a.value}"`);
    if (a.magnitude === "none") {
      const [whole = "0", fraction] = a.value.split(".");
      return fraction === undefined ? groupThousands(whole) : `${groupThousands(whole)}.${fraction}`;
    }
    return decimalText(s.mantissa, s.exponent);
  }
  const [whole = "0", fraction] = a.value.split(".");
  const value = fraction === undefined ? groupThousands(whole) : `${groupThousands(whole)}.${fraction}`;
  return `${value} ${a.magnitude}`;
}

/**
 * Canonical display that never rounds: "$1.4 million", "$20,000" (thousands
 * are written out), "20.2%", "4.2 million".
 */
export function formatAmount(a: Amount): string {
  if (!DECIMAL_RE.test(a.value)) throw new TypeError(`invalid amount value "${a.value}"`);
  const n = numberText(a);
  if (a.unit === "percent") return `${n}%`;
  if (a.unit === "count") return n;
  if (!a.currency) throw new TypeError("currency amount without a currency");
  return `${CURRENCY_SYMBOL[a.currency]}${n}`;
}

// ---------------------------------------------------------------------------
// Sentences and clauses
// ---------------------------------------------------------------------------

const TERMINAL_RE = /[.!?…]/;
const CLOSER_RE = /["'”’)\]»]/;
const ABBREVIATIONS = new Set([
  "e.g", "i.e", "etc", "vs", "approx", "est", "inc", "ltd", "co", "corp", "no", "mr",
  "mrs", "ms", "dr", "st", "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep",
  "sept", "oct", "nov", "dec", "fig", "al", "u.s", "u.k", "e.u", "jr", "sr",
]);

/** True when the terminal run starting at `index` really ends a sentence. */
function isRealTerminal(text: string, index: number): boolean {
  if (at(text, index) !== ".") return true;
  let k = index - 1;
  while (k >= 0 && (LETTER_RE.test(at(text, k)) || at(text, k) === ".")) k -= 1;
  const token = text.slice(k + 1, index).toLowerCase();
  // An initial ("J.", "U.") but not a magnitude letter after a digit ("$5M.").
  if (token.length === 1 && LETTER_RE.test(token) && !DIGIT_RE.test(at(text, k))) return false;
  if (token.includes(".")) return false;
  return !ABBREVIATIONS.has(token);
}

/** How line breaks bound sentences (see SENTENCES AND CLAUSES above). */
type LineBreaks = "line" | "prose";

const HORIZONTAL_SPACE_RE = /[ \t]/;

/**
 * True when the line break at `index` is part of a blank line: another line
 * break follows or precedes it with only spaces and tabs between ("\r\n"
 * counts as one break), or it is a paragraph separator.
 */
function isParagraphBreak(text: string, index: number): boolean {
  const ch = at(text, index);
  if (ch === "\u2029") return true;
  let j = index + 1;
  if (ch === "\r" && at(text, j) === "\n") j += 1;
  while (j < text.length && HORIZONTAL_SPACE_RE.test(at(text, j))) j += 1;
  if (j < text.length && NEWLINE_RE.test(at(text, j))) return true;
  let k = index - 1;
  if (ch === "\n" && at(text, k) === "\r") k -= 1;
  while (k >= 0 && HORIZONTAL_SPACE_RE.test(at(text, k))) k -= 1;
  return k >= 0 && NEWLINE_RE.test(at(text, k));
}

function breakEndsSentence(text: string, index: number, breaks: LineBreaks): boolean {
  return breaks === "line" || isParagraphBreak(text, index);
}

/** End of the sentence that contains `index` (exclusive, untrimmed). */
function sentenceEndFrom(text: string, index: number, breaks: LineBreaks = "line"): number {
  for (let i = index; i < text.length; i += 1) {
    const ch = at(text, i);
    if (NEWLINE_RE.test(ch) && breakEndsSentence(text, i, breaks)) return i;
    if (!TERMINAL_RE.test(ch)) continue;
    let j = i + 1;
    while (j < text.length && (TERMINAL_RE.test(at(text, j)) || CLOSER_RE.test(at(text, j)))) j += 1;
    if (j >= text.length) return text.length;
    if (SPACE_RE.test(at(text, j)) && isRealTerminal(text, i)) return j;
    i = j - 1;
  }
  return text.length;
}

/** Start of the sentence that contains `index` (inclusive, untrimmed). */
function sentenceStartFrom(text: string, index: number, breaks: LineBreaks = "line"): number {
  for (let i = Math.min(index, text.length) - 1; i >= 0; i -= 1) {
    const ch = at(text, i);
    if (NEWLINE_RE.test(ch) && breakEndsSentence(text, i, breaks)) return i + 1;
    if (!SPACE_RE.test(ch)) continue;
    let k = i - 1;
    while (k >= 0 && CLOSER_RE.test(at(text, k))) k -= 1;
    if (k < 0 || !TERMINAL_RE.test(at(text, k))) continue;
    let first = k;
    while (first - 1 >= 0 && TERMINAL_RE.test(at(text, first - 1))) first -= 1;
    if (isRealTerminal(text, first)) return i + 1;
  }
  return 0;
}

function trimmedRange(text: string, start: number, end: number): TextRange {
  let s = start;
  let e = end;
  while (s < e && SPACE_RE.test(at(text, s))) s += 1;
  while (e > s && SPACE_RE.test(at(text, e - 1))) e -= 1;
  return { start: s, end: e, text: text.slice(s, e) };
}

/** The sentence containing `index`; every line break ends one (see SENTENCES AND CLAUSES above). */
export function sentenceAround(text: string, index: number): TextRange {
  const i = Math.max(0, Math.min(index, text.length));
  return trimmedRange(text, sentenceStartFrom(text, i), sentenceEndFrom(text, i));
}

/**
 * Ruling R14: the sentence containing `index` when a line break starts a
 * sentence only after terminal punctuation or at a blank line (quotes).
 */
export function proseSentenceAround(text: string, index: number): TextRange {
  const i = Math.max(0, Math.min(index, text.length));
  return trimmedRange(text, sentenceStartFrom(text, i, "prose"), sentenceEndFrom(text, i, "prose"));
}

/** Every sentence of `text`, in order. */
export function splitSentences(text: string): TextRange[] {
  const out: TextRange[] = [];
  let i = 0;
  while (i < text.length) {
    const end = sentenceEndFrom(text, i);
    const range = trimmedRange(text, i, end);
    if (range.end > range.start) out.push(range);
    i = Math.max(end, i) + 1;
  }
  return out;
}

const CONTRAST_RE = /(?<![\p{L}\p{N}])(?:while|whereas|but|versus|vs\.?|compared[ \t\u00A0]+(?:to|with))(?![\p{L}\p{N}])/giu;

function clauseRanges(text: string, sentence: TextRange): TextRange[] {
  const cuts: Array<{ at: number; skip: number }> = [];
  for (let i = sentence.start; i < sentence.end; i += 1) {
    const ch = at(text, i);
    if (ch === "|" || ch === "\t" || ch === ";") cuts.push({ at: i, skip: 1 });
  }
  for (const m of sentence.text.matchAll(new RegExp(CONTRAST_RE.source, CONTRAST_RE.flags))) {
    const index = m.index ?? 0;
    if (index > 0) cuts.push({ at: sentence.start + index, skip: 0 });
  }
  cuts.sort((a, b) => a.at - b.at);
  const out: TextRange[] = [];
  let start = sentence.start;
  for (const cut of cuts) {
    if (cut.at < start) continue;
    out.push(trimmedRange(text, start, cut.at));
    start = cut.at + cut.skip;
  }
  out.push(trimmedRange(text, start, sentence.end));
  return out.filter((r) => r.end > r.start);
}

/** The clause containing `index` (or the next clause when `index` is a separator). */
export function clauseAround(text: string, index: number): TextRange {
  const sentence = sentenceAround(text, index);
  const ranges = clauseRanges(text, sentence);
  return ranges.find((r) => index < r.end) ?? ranges[ranges.length - 1] ?? sentence;
}

// ---------------------------------------------------------------------------
// Projections (contract §12, ruling R2)
// ---------------------------------------------------------------------------

/** Words and phrases that mark every amount AFTER them in the sentence as projected. */
const PROJECTION_CUE_RE = new RegExp(
  [
    String.raw`\b(?:will|would|shall|could|might|should)\b`,
    String.raw`\bgoing to\b`,
    String.raw`\b(?:set|likely|on track|on course) to\b`,
    String.raw`\b(?:poised|slated)\b`,
    String.raw`\bexpect(?:s|ed|ing|ation|ations)?\b`,
    String.raw`\bproject(?:ed|ing|ion|ions)\b`,
    String.raw`\bforecast(?:s|ed|ing|er|ers)?\b`,
    String.raw`\bpredict(?:s|ed|ing|ion|ions)?\b`,
    String.raw`\banticipat(?:e|es|ed|ing)\b`,
    String.raw`\boutlook\b`,
    String.raw`\bto (?:reach|hit|grow|surpass|exceed|touch|attain|climb|rise|increase|double|triple|top)\b`,
  ].join("|"),
  "i",
);

/** The modal "may" ("may reach"), lowercase so the month ("May 2024") is not a cue. */
const MAY_CUE_RE = /\bmay\b(?!\s+\d)/;

const YEAR_IN_TEXT_RE = /(?<![\p{L}\p{N}$€£.,])((?:19|20)\d{2})(?![\p{N}%]|[.,]\d)/gu;
const MAGNITUDE_AFTER_YEAR_RE = /^[ \u00A0]?(?:thousand|million|billion|trillion|bn|mn|tn|[kKmMbBtT](?![\p{L}\p{N}]))/iu;

function hasCue(text: string): boolean {
  return PROJECTION_CUE_RE.test(text) || MAY_CUE_RE.test(text);
}

/** True when `text` names a year after `referenceYear` (not a number like "2030 billion"). */
function hasLaterYear(text: string, referenceYear: number): boolean {
  for (const m of text.matchAll(YEAR_IN_TEXT_RE)) {
    const end = (m.index ?? 0) + m[0].length;
    if (MAGNITUDE_AFTER_YEAR_RE.test(text.slice(end, end + 12))) continue;
    if (Number(m[1]) > referenceYear) return true;
  }
  return false;
}

/**
 * Sentence-level test: any projection cue, or (with `referenceYear`) any
 * later year anywhere in the sentence. Acceptance does not use this; it
 * scopes cues to each amount with isProjectedAmount (ruling R2).
 */
export function hasProjectionCue(sentence: string, referenceYear?: number): boolean {
  return hasCue(sentence) || (referenceYear !== undefined && hasLaterYear(sentence, referenceYear));
}

/**
 * Ruling R2: the amount at [start, end) of `sentence` is projected when a
 * projection cue or a year after `referenceYear` appears BEFORE it in the
 * sentence, or a year after `referenceYear` appears after it and before the
 * next amount (or the sentence end). A cue never reaches back to amounts
 * before it, so "valued at X in 2024 and projected to reach Y by 2032, a
 * CAGR of Z" keeps X measured while Y and Z are projected.
 */
export function isProjectedAmount(
  sentence: string,
  amount: { start: number; end: number },
  referenceYear: number,
): boolean {
  const before = sentence.slice(0, amount.start);
  if (hasCue(before) || hasLaterYear(before, referenceYear)) return true;
  const next = scanAmounts(sentence).find((a) => a.start >= amount.end);
  return hasLaterYear(sentence.slice(amount.end, next ? next.start : sentence.length), referenceYear);
}

// ---------------------------------------------------------------------------
// Price expressions
// ---------------------------------------------------------------------------

const PERIOD_WORDS: Record<string, PricePeriod> = {
  mo: "month",
  mth: "month",
  month: "month",
  yr: "year",
  year: "year",
  annum: "year",
  wk: "week",
  week: "week",
  day: "day",
  "one-time": "one_time",
  onetime: "one_time",
  lifetime: "one_time",
};

const PERIOD_ADVERBS: Record<string, PricePeriod> = {
  monthly: "month",
  annually: "year",
  yearly: "year",
  weekly: "week",
  daily: "day",
};

const BASIS_WORDS: Record<string, PriceBasis> = {
  user: "per_user",
  seat: "per_user",
  member: "per_user",
  developer: "per_user",
  dev: "per_user",
  agent: "per_user",
  editor: "per_user",
  license: "per_user",
  licence: "per_user",
  person: "per_user",
  contributor: "per_user",
  workspace: "per_workspace",
  team: "per_workspace",
  account: "per_workspace",
  organization: "per_workspace",
  organisation: "per_workspace",
  org: "per_workspace",
  company: "per_workspace",
  store: "per_workspace",
  site: "per_workspace",
  project: "per_workspace",
  location: "per_workspace",
};

type Segment =
  | { kind: "period"; period: PricePeriod; end: number }
  | { kind: "basis"; basis: PriceBasis; end: number }
  | { kind: "qualifier"; end: number }
  | { kind: "invalid"; end: number };

function classifyUnit(token: string, end: number): Segment {
  const word = token.toLowerCase();
  const period = PERIOD_WORDS[word];
  if (period) return { kind: "period", period, end };
  const basis = BASIS_WORDS[word];
  if (basis) return { kind: "basis", basis, end };
  return { kind: "invalid", end };
}

const UNIT_TOKEN = String.raw`([\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*)`;
const SLASH_SEGMENT_RE = new RegExp(String.raw`\/[ \u00A0]*${UNIT_TOKEN}`, "uy");
const PER_SEGMENT_RE = new RegExp(String.raw`per[ \u00A0]+${UNIT_TOKEN}`, "iuy");
const ARTICLE_SEGMENT_RE = /an?[ \u00A0]+(\p{L}+)(?![\p{L}\p{N}])/iuy;
const ADVERB_SEGMENT_RE = /(monthly|annually|yearly|weekly|daily)(?![\p{L}\p{N}])/iuy;
const ONE_TIME_SEGMENT_RE = /(one[- ]?time|lifetime)(?![\p{L}\p{N}])/iuy;
const QUALIFIER_PHRASE =
  String.raw`(?:billed|paid)[ \u00A0]+(?:annually|yearly|monthly)|annual[ \u00A0]+billing|monthly[ \u00A0]+billing|(?:\+|plus)[ \u00A0]*usage|overages?|introductory|promo(?:tional)?|launch[ \u00A0]+pric(?:e|ing)|for[ \u00A0]+(?:the[ \u00A0]+)?first[ \u00A0]+(?:(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)[ \u00A0]+)?(?:months?|years?|weeks?)`;
const QUALIFIER_SEGMENT_RE = new RegExp(
  String.raw`[,(–—-]?[ \u00A0]*(?:(?:when|if|with|and)[ \u00A0]+)?(?:${QUALIFIER_PHRASE})(?![\p{L}\p{N}])\)?`,
  "iuy",
);

function stickyMatch(re: RegExp, text: string, index: number): RegExpExecArray | null {
  re.lastIndex = index;
  return re.exec(text);
}

function readSegment(text: string, index: number, crossed: Break): Segment | null {
  const qualifier = stickyMatch(QUALIFIER_SEGMENT_RE, text, index);
  if (qualifier) return { kind: "qualifier", end: index + qualifier[0].length };
  if (crossed === "sentence") return null;
  const slash = stickyMatch(SLASH_SEGMENT_RE, text, index);
  if (slash) return classifyUnit(slash[1] ?? "", index + slash[0].length);
  const per = stickyMatch(PER_SEGMENT_RE, text, index);
  if (per) return classifyUnit(per[1] ?? "", index + per[0].length);
  const oneTime = stickyMatch(ONE_TIME_SEGMENT_RE, text, index);
  if (oneTime) return { kind: "period", period: "one_time", end: index + oneTime[0].length };
  if (crossed === "newline") return null;
  const article = stickyMatch(ARTICLE_SEGMENT_RE, text, index);
  if (article) {
    const unit = classifyUnit(article[1] ?? "", index + article[0].length);
    return unit.kind === "invalid" ? null : unit;
  }
  const adverb = stickyMatch(ADVERB_SEGMENT_RE, text, index);
  if (adverb) {
    const period = PERIOD_ADVERBS[(adverb[1] ?? "").toLowerCase()];
    if (period) return { kind: "period", period, end: index + adverb[0].length };
  }
  return null;
}

type Break = "none" | "newline" | "sentence";

/**
 * Gap before a segment: spaces, then optionally one sentence-ending "." and
 * one line break. `crossed` names the strongest break in the gap.
 */
function readGap(text: string, index: number): { end: number; crossed: Break } {
  let i = index;
  while (HSPACE_RE.test(at(text, i))) i += 1;
  let crossed: Break = "none";
  if (at(text, i) === "." && SPACE_RE.test(at(text, i + 1))) {
    i += 1;
    crossed = "sentence";
    while (HSPACE_RE.test(at(text, i))) i += 1;
  }
  if (at(text, i) === "\r" && at(text, i + 1) === "\n") {
    i += 2;
    crossed = crossed === "none" ? "newline" : crossed;
  } else if (NEWLINE_RE.test(at(text, i))) {
    i += 1;
    crossed = crossed === "none" ? "newline" : crossed;
  }
  if (crossed !== "none") while (HSPACE_RE.test(at(text, i))) i += 1;
  return { end: i, crossed };
}

type Units = { period: PricePeriod | null; basis: PriceBasis; end: number };

function readUnits(text: string, amountEnd: number): Units | null {
  let period: PricePeriod | null = null;
  let basis: PriceBasis | null = null;
  let end = amountEnd;
  for (;;) {
    const gap = readGap(text, end);
    const segment = readSegment(text, gap.end, gap.crossed);
    if (!segment) break;
    const conflict =
      segment.kind === "invalid" ||
      (segment.kind === "period" && period !== null) ||
      (segment.kind === "basis" && basis !== null);
    if (conflict) {
      if (gap.crossed !== "none") break;
      return null;
    }
    if (segment.kind === "period") period = segment.period;
    if (segment.kind === "basis") basis = segment.basis;
    end = segment.end;
  }
  return { period, basis: basis ?? "flat", end };
}

const QUALIFIER_PATTERNS: ReadonlyArray<[PriceQualifier, RegExp]> = [
  [
    "billed_annually",
    /(?<!\p{L})(?:(?:billed|paid)[ \t\u00A0]+(?:annually|yearly)|annual[ \t\u00A0]+billing)(?!\p{L})/giu,
  ],
  [
    "billed_monthly",
    /(?<!\p{L})(?:(?:billed|paid)[ \t\u00A0]+monthly|monthly[ \t\u00A0]+billing)(?!\p{L})/giu,
  ],
  [
    "introductory",
    new RegExp(
      String.raw`(?<!\p{L})(?:introductory|promo(?:tional)?|launch[ \t\u00A0]+pric(?:e|ing)|for[ \t\u00A0]+(?:the[ \t\u00A0]+)?first[ \t\u00A0]+(?:(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)[ \t\u00A0]+)?(?:months?|years?|weeks?))(?!\p{L})`,
      "giu",
    ),
  ],
  ["plus_usage", /(?:\+|(?<!\p{L})plus)[ \t\u00A0]*usage(?!\p{L})|(?<!\p{L})overages?(?!\p{L})/giu],
];

const NEGATION_BEFORE_RE = /(?:^|[^\p{L}])(?:no|not|without|never|zero)\s+(?:\p{L}+\s+)?$/iu;

const STARTING_AT_BEFORE_RE =
  /(?:^|[^\p{L}])(?:start(?:ing|s)?[ \t\u00A0]+(?:at|from)|from|as[ \t\u00A0]+low[ \t\u00A0]+as)[ \t\u00A0]*(?:just[ \t\u00A0]+|only[ \t\u00A0]+)?(?:~|≈|about[ \t\u00A0]+|around[ \t\u00A0]+|approximately[ \t\u00A0]+|roughly[ \t\u00A0]+)?[:–-]?[ \t\u00A0]*$/iu;

const QUALIFIER_ORDER: readonly PriceQualifier[] = [
  "billed_annually",
  "billed_monthly",
  "introductory",
  "plus_usage",
  "starting_at",
];

function sortQualifiers(set: Iterable<PriceQualifier>): PriceQualifier[] {
  const present = new Set(set);
  return QUALIFIER_ORDER.filter((q) => present.has(q));
}

function clauseQualifiers(clause: string): Set<PriceQualifier> {
  const found = new Set<PriceQualifier>();
  for (const [qualifier, pattern] of QUALIFIER_PATTERNS) {
    const re = new RegExp(pattern.source, pattern.flags);
    for (const m of clause.matchAll(re)) {
      if (!NEGATION_BEFORE_RE.test(clause.slice(0, m.index ?? 0))) found.add(qualifier);
    }
  }
  return found;
}

function readPriceAt(text: string, found: FoundAmount): PriceExpression | null {
  const units = readUnits(text, found.end);
  if (!units || units.period === null) return null;
  const first = clauseAround(text, found.numberStart);
  const last = clauseAround(text, Math.max(found.numberStart, units.end - 1));
  const clauseStart = Math.min(first.start, last.start, found.start);
  const clauseEnd = Math.max(first.end, last.end, units.end);
  const clause = text.slice(clauseStart, clauseEnd);
  const qualifiers = clauseQualifiers(clause);
  if (STARTING_AT_BEFORE_RE.test(text.slice(clauseStart, found.start))) qualifiers.add("starting_at");
  return {
    terms: {
      amount: found.amount,
      period: units.period,
      basis: units.basis,
      qualifiers: sortQualifiers(qualifiers),
    },
    start: found.start,
    end: units.end,
    clause,
    clauseStart,
    clauseEnd,
  };
}

/** Price expressions whose first digit lies in [from, to), read with full-text context. */
export function priceExpressionsIn(text: string, from = 0, to = text.length): PriceExpression[] {
  const out: PriceExpression[] = [];
  for (const found of scanAmounts(text, from, to)) {
    if (found.amount.unit !== "currency") continue;
    const expression = readPriceAt(text, found);
    if (expression) out.push(expression);
  }
  return out;
}

/** Every price expression in `text`, with qualifiers read from its own clause. */
export function findPriceExpressions(
  text: string,
): Array<{ terms: PriceTerms; start: number; end: number; clause: string }> {
  return priceExpressionsIn(text);
}

const ISO_AFTER_NUMBER_RE =
  /^(?:[ \u00A0]?(?:thousand|million|billion|trillion|bn|mn|tn|MM|[kKmMbBtT]))?[ \u00A0]?(?:USD|EUR|GBP|CAD|AUD)(?![\p{L}\p{N}])/u;

/** Numbers written with a currency marker (prefix or suffix), parsed or not. */
function currencyNumberCount(text: string): number {
  let count = 0;
  for (const m of text.matchAll(new RegExp(NUMBER_RE.source, "g"))) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    if (prefixBefore(text, start) !== null || ISO_AFTER_NUMBER_RE.test(text.slice(end, end + 16))) {
      count += 1;
    }
  }
  return count;
}

/**
 * The single price expression in `text` (period, basis and qualifiers), or
 * null when it has none, several, a range, a bound, or other currency figures.
 */
export function parsePriceTerms(text: string): PriceTerms | null {
  if (currencyNumberCount(text) !== 1) return null;
  const expressions = priceExpressionsIn(text);
  return expressions.length === 1 && expressions[0] ? expressions[0].terms : null;
}

function sameQualifiers(a: readonly PriceQualifier[], b: readonly PriceQualifier[]): boolean {
  const x = sortQualifiers(a);
  const y = sortQualifiers(b);
  return x.length === y.length && x.every((q, i) => q === y[i]);
}

/**
 * Null when the candidate price equals the source price on amount, currency,
 * period, basis and qualifiers; otherwise the first difference in that order.
 * Any qualifier difference (dropped or added) is "qualifier_dropped".
 */
export function comparePriceTerms(candidate: PriceTerms, source: PriceTerms): RejectionReason | null {
  if (candidate.amount.unit !== "currency" || source.amount.unit !== "currency") return "unit_mismatch";
  if (candidate.amount.currency !== source.amount.currency) return "currency_mismatch";
  if (!amountsEqual(candidate.amount, source.amount)) return "amount_mismatch";
  if (candidate.period !== source.period) return "period_mismatch";
  if (candidate.basis !== source.basis) return "basis_mismatch";
  if (!sameQualifiers(candidate.qualifiers, source.qualifiers)) return "qualifier_dropped";
  return null;
}

// ---------------------------------------------------------------------------
// Ruling R9: comparisons and ambiguous billing around a price
// ---------------------------------------------------------------------------

/**
 * Words that make a sentence compare vendors (rulings R9 and R14): unlike,
 * than, instead (of), rather than, versus/vs, compare(d)/comparison,
 * alternative(s), competitor(s)/competing, switch(ed) from/to/away,
 * move(d)/migrate(d) to/from, replace(d) by/with. ("after" and "over" count
 * only before a brand-like name; accept.ts checks those.)
 */
const COMPARISON_CUE_RE =
  /(?<![\p{L}\p{N}])(?:unlike|than|instead|versus|vs\.?|compar(?:e|ed|es|ing|ison|isons)|alternatives?|competitors?|competing|switch(?:es|ed|ing)?[ \t\u00A0]+(?:from|to|away)|mov(?:e|es|ed|ing)[ \t\u00A0]+(?:to|from)|migrat(?:e|es|ed|ing)[ \t\u00A0]+(?:to|from)|replac(?:e|es|ed|ing)[ \t\u00A0]+(?:by|with))(?![\p{L}\p{N}])/iu;

/** A line that a sentence runs on from: it ends in , ; : or a dash. */
const SOFT_WRAP_END_RE = /[,;:\-–—][ \t\u00A0]*$/u;

/**
 * Ruling R14: where the text that binds a price begins. Its clause start;
 * or, when the clause starts its line and the line above runs on into it
 * (that line ends in , ; : or a dash, or this one starts in lowercase), the
 * start of that line's last clause.
 */
export function bindingWindowStart(text: string, expression: { start: number; clauseStart: number }): number {
  const own = lineAround(text, expression.start);
  if (text.slice(own.start, expression.clauseStart).trim() !== "") return expression.clauseStart;
  const above = lineAbove(text, own.start);
  if (!above) return expression.clauseStart;
  const aboveText = text.slice(above.start, above.end);
  const ownFirst = text.slice(expression.clauseStart).trimStart().charAt(0);
  const startsLower = ownFirst !== "" && ownFirst !== ownFirst.toUpperCase();
  if (!SOFT_WRAP_END_RE.test(aboveText) && !startsLower) return expression.clauseStart;
  const lastNonSpace = above.start + aboveText.trimEnd().length - 1;
  return Math.min(expression.clauseStart, clauseAround(text, Math.max(above.start, lastNonSpace)).start);
}

/**
 * The comparison cue in the sentence(s) a price expression's clause spans
 * (and the soft-wrapped line above it, bindingWindowStart), lowercased with
 * single spaces, or null. The whole sentence counts, not only the clause:
 * "versus" and "compared to" also split clauses, so the cue would otherwise
 * always sit in the neighbouring clause.
 */
export function comparisonCueFor(
  text: string,
  expression: { start: number; clauseStart: number; clauseEnd: number },
): string | null {
  const range = comparisonRange(text, expression);
  const m = COMPARISON_CUE_RE.exec(text.slice(range.start, range.end));
  return m ? m[0].toLowerCase().replace(/\s+/g, " ") : null;
}

/** Where comparison cues count for a price: its clause's sentence(s) and the soft-wrapped line above. */
export function comparisonRange(
  text: string,
  expression: { start: number; clauseStart: number; clauseEnd: number },
): { start: number; end: number } {
  const start = Math.min(sentenceAround(text, expression.clauseStart).start, bindingWindowStart(text, expression));
  const end = sentenceAround(text, Math.max(expression.clauseStart, expression.clauseEnd - 1)).end;
  return { start, end };
}

/**
 * The block of a price (ruling R9): its own line plus up to this many
 * non-blank lines directly above it. Billing phrases on lines that hold a
 * price (another plan's "$12/month, billed annually") count only here;
 * toggles and price-free billing lines count anywhere above (ruling R14).
 */
export const PRICE_BLOCK_LINES_ABOVE = 3;

/** Billing words a toggle line may hold (ruling R14). */
const TOGGLE_WORDS: ReadonlySet<string> = new Set([
  "monthly", "yearly", "annually", "annual", "billed", "billing", "bill", "pay", "paid", "month", "months", "year", "years",
]);
/** A savings note a toggle may carry: "(save 20%)", "save up to 15%", "-20%", "20% off", "2 months free". */
const TOGGLE_SAVINGS_RE =
  /\(?[ \t\u00A0]*(?:(?:save|get)[ \t\u00A0]+(?:up[ \t\u00A0]+to[ \t\u00A0]+)?\d{1,3}(?:\.\d+)?[ \t\u00A0]?%(?:[ \t\u00A0]+off)?|-?\d{1,3}(?:\.\d+)?[ \t\u00A0]?%(?:[ \t\u00A0]+off)?|(?:\d|one|two|three)[ \t\u00A0]+months?[ \t\u00A0]+free)[ \t\u00A0]*\)?/giu;
const ANNUAL_WORD_RE = /(?<![\p{L}])(?:annual|annually|yearly)(?![\p{L}])/iu;
const MONTHLY_WORD_RE = /(?<![\p{L}])monthly(?![\p{L}])/iu;

/**
 * Ruling R14: a standalone billing toggle line — only billing words such as
 * Monthly, Yearly, Annually, Billed monthly/yearly, Pay yearly (at most six),
 * optionally with a savings note — and which billings it names; else null.
 */
function billingToggle(line: string): { annual: boolean; monthly: boolean } | null {
  const rest = line.replace(TOGGLE_SAVINGS_RE, " ");
  if (/\p{N}/u.test(rest)) return null;
  const words = rest.toLowerCase().match(/\p{L}+/gu) ?? [];
  if (words.length === 0 || words.length > 6 || !words.every((w) => TOGGLE_WORDS.has(w))) return null;
  const annual = ANNUAL_WORD_RE.test(rest);
  const monthly = MONTHLY_WORD_RE.test(rest);
  return annual || monthly ? { annual, monthly } : null;
}

/** Phrases that state annual billing outside a toggle (ruling R14); a bare "annual" in a feature line is not one. */
const ANNUAL_BILLING_RE =
  /(?<![\p{L}])(?:(?:billed|paid|pay|charged|invoiced)[ \t\u00A0]+(?:annually|yearly|per[ \t\u00A0]+year|each[ \t\u00A0]+year|once[ \t\u00A0]+a[ \t\u00A0]+year)|(?:annual|yearly)[ \t\u00A0]+(?:billing|plans?|subscriptions?|contracts?|commitments?|payments?|pricing|terms?))(?![\p{L}])/giu;
/** Phrases that state monthly billing outside a toggle. */
const MONTHLY_BILLING_RE =
  /(?<![\p{L}])(?:(?:billed|paid|pay|charged|invoiced)[ \t\u00A0]+monthly|monthly[ \t\u00A0]+(?:billing|plans?|subscriptions?|payments?|pricing|terms?)|month[- ]to[- ]month)(?![\p{L}])/giu;

/** [start, end) of the line holding `index` (line breaks excluded). */
export function lineAround(text: string, index: number): { start: number; end: number } {
  let start = Math.max(0, Math.min(index, text.length));
  while (start > 0 && !NEWLINE_RE.test(at(text, start - 1))) start -= 1;
  let end = Math.max(0, Math.min(index, text.length));
  while (end < text.length && !NEWLINE_RE.test(at(text, end))) end += 1;
  return { start, end };
}

/** The nearest non-blank line above the line starting at `lineStart`, or null. */
export function lineAbove(text: string, lineStart: number): { start: number; end: number } | null {
  let cursor = lineStart - 1;
  while (cursor >= 0) {
    while (cursor >= 0 && NEWLINE_RE.test(at(text, cursor))) cursor -= 1;
    if (cursor < 0) return null;
    const line = lineAround(text, cursor);
    if (text.slice(line.start, line.end).trim() !== "") return line;
    cursor = line.start - 1;
  }
  return null;
}

function hasBillingCue(re: RegExp, text: string): boolean {
  for (const m of text.matchAll(new RegExp(re.source, re.flags))) {
    if (!NEGATION_BEFORE_RE.test(text.slice(0, m.index ?? 0))) return true;
  }
  return false;
}

/** A currency amount on a line (it holds a price, so its billing words may be that price's qualifier). */
const LINE_PRICE_RE = /[$€£][ \u00A0]?\d|\d[ \u00A0]?(?:USD|EUR|GBP|CAD|AUD)(?![\p{L}])|(?:USD|EUR|GBP|CAD|AUD)[ \u00A0]?\d/u;

/**
 * Which billings a line names: a toggle's words, or annual/monthly billing
 * phrases (negated ones aside) — on a line that holds a price only when
 * `withPrices` (the price's own block).
 */
function billingCues(line: string, withPrices: boolean): { annual: boolean; monthly: boolean } {
  const toggle = billingToggle(line);
  if (toggle) return toggle;
  if (!withPrices && LINE_PRICE_RE.test(line)) return { annual: false, monthly: false };
  return { annual: hasBillingCue(ANNUAL_BILLING_RE, line), monthly: hasBillingCue(MONTHLY_BILLING_RE, line) };
}

const LINE_BREAK_G_RE = /\r\n|[\n\r\u2028\u2029]/gu;

/**
 * Each line's billing cues, read once per page (ruling R14), so a page with
 * many prices and candidates is scanned once: line starts, the nearest
 * non-blank line at or before each line, each line's cues as a block line
 * (prices allowed) and prefix ORs of the page-scoped cues (price lines
 * ignored) before each line.
 */
export type PageBillingCues = {
  readonly starts: readonly number[];
  readonly nonBlankAtOrBefore: Int32Array;
  readonly blockAnnual: Uint8Array;
  readonly blockMonthly: Uint8Array;
  readonly pageAnnualBefore: Uint8Array;
  readonly pageMonthlyBefore: Uint8Array;
};

export function pageBillingCues(text: string): PageBillingCues {
  const starts = [0];
  for (const m of text.matchAll(new RegExp(LINE_BREAK_G_RE.source, LINE_BREAK_G_RE.flags))) {
    starts.push((m.index ?? 0) + m[0].length);
  }
  const ends = starts.map((start, i) => {
    const next = starts[i + 1];
    if (next === undefined) return text.length;
    return text.slice(start, next).search(/\r\n|[\n\r\u2028\u2029]/u) + start;
  });
  const n = starts.length;
  const nonBlankAtOrBefore = new Int32Array(n);
  const blockAnnual = new Uint8Array(n);
  const blockMonthly = new Uint8Array(n);
  const pageAnnualBefore = new Uint8Array(n + 1);
  const pageMonthlyBefore = new Uint8Array(n + 1);
  let lastNonBlank = -1;
  for (let i = 0; i < n; i += 1) {
    const line = text.slice(starts[i] ?? 0, ends[i] ?? 0);
    if (line.trim() !== "") lastNonBlank = i;
    nonBlankAtOrBefore[i] = lastNonBlank;
    const block = billingCues(line, true);
    blockAnnual[i] = block.annual ? 1 : 0;
    blockMonthly[i] = block.monthly ? 1 : 0;
    const page = billingCues(line, false);
    pageAnnualBefore[i + 1] = (pageAnnualBefore[i] ?? 0) | (page.annual ? 1 : 0);
    pageMonthlyBefore[i + 1] = (pageMonthlyBefore[i] ?? 0) | (page.monthly ? 1 : 0);
  }
  return { starts, nonBlankAtOrBefore, blockAnnual, blockMonthly, pageAnnualBefore, pageMonthlyBefore };
}

/** Index of the line holding `index` (binary search on line starts). */
function lineIndexAt(starts: readonly number[], index: number): number {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if ((starts[mid] ?? 0) <= index) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/**
 * Rulings R9 and R14: why a price's billing is ambiguous, or null. Annual
 * billing shows when a billing toggle line or a price-free annual-billing
 * line ("All plans are billed annually.") stands anywhere above the price,
 * or an annual-billing phrase stands in its block (its line and
 * PRICE_BLOCK_LINES_ABOVE non-blank lines above, where another price's
 * "billed annually" counts too). When it shows and the price is per month
 * (or the page shows monthly billing too) and the price's clause states
 * neither billed annually nor billed monthly, a reader cannot tell which
 * billing the figure is. A per-year or one-time price states its own term;
 * feature lines that mention "annual" and negated cues ("no annual
 * contract") do not count. Acceptance reads the page (with its cues read
 * once, `cues`), re-validation the excerpt.
 */
export function ambiguousBilling(
  text: string,
  expression: PriceExpression,
  cues: PageBillingCues = pageBillingCues(text),
): string | null {
  const { qualifiers, period } = expression.terms;
  if (qualifiers.includes("billed_annually") || qualifiers.includes("billed_monthly")) return null;
  if (period === "year" || period === "one_time") return null;
  const own = lineIndexAt(cues.starts, expression.start);
  let first = own;
  for (let i = 0; i < PRICE_BLOCK_LINES_ABOVE && first > 0; i += 1) {
    const above = cues.nonBlankAtOrBefore[first - 1] ?? -1;
    if (above < 0) break;
    first = above;
  }
  let annual = (cues.pageAnnualBefore[first] ?? 0) === 1;
  let monthly = period === "month" || (cues.pageMonthlyBefore[first] ?? 0) === 1;
  for (let i = first; i <= own; i += 1) {
    annual ||= cues.blockAnnual[i] === 1;
    monthly ||= cues.blockMonthly[i] === 1;
  }
  if (!annual || !monthly) return null;
  return "ambiguous billing: the page shows annual billing (a billing toggle or an annual-billing line) above a per-month price whose clause states neither billing (rulings R9, R14)";
}

const QUALIFIER_LABEL: Record<Exclude<PriceQualifier, "starting_at">, string> = {
  billed_annually: "billed annually",
  billed_monthly: "billed monthly",
  introductory: "introductory",
  plus_usage: "plus usage",
};

/**
 * Canonical price text that parses back to the same terms:
 * "$24/user/month, billed annually", "from $99/month", "$299 one-time".
 */
export function formatPriceTerms(t: PriceTerms): string {
  const qualifiers = sortQualifiers(t.qualifiers);
  let text = `${qualifiers.includes("starting_at") ? "from " : ""}${formatAmount(t.amount)}`;
  if (t.basis === "per_user") text += "/user";
  if (t.basis === "per_workspace") text += "/workspace";
  text += t.period === "one_time" ? " one-time" : `/${t.period}`;
  const labels = qualifiers.flatMap((q) => (q === "starting_at" ? [] : [QUALIFIER_LABEL[q]]));
  return [text, ...labels].join(", ");
}
