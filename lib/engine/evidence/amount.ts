/**
 * Amounts and prices — the one grammar shared by evidence acceptance, record
 * re-validation, the compiler and the auditor (WP46, contract §5).
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
 *   A unit or qualifier segment may continue on the next line ("$24 /month"
 *   then "per seat, billed annually"); a conflicting segment on the next line
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
 * SENTENCES AND CLAUSES
 *   Sentences end at . ! ? … followed by whitespace (closing quotes/brackets
 *   allowed in between) and at every line break. A "." after a single letter
 *   (U.S., J.) or a listed abbreviation (e.g., i.e., etc., vs., approx., est.,
 *   inc., ltd., co., corp., no., mr., dr., month names) does not end one.
 *   Clauses also split at "|", tabs, ";" and before the contrast words while,
 *   whereas, but, versus, vs, compared to/with.
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
  "practitioner", "practitioners", "installer", "reviewer", "reviewers",
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

/** End of the sentence that contains `index` (exclusive, untrimmed). */
function sentenceEndFrom(text: string, index: number): number {
  for (let i = index; i < text.length; i += 1) {
    const ch = at(text, i);
    if (NEWLINE_RE.test(ch)) return i;
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
function sentenceStartFrom(text: string, index: number): number {
  for (let i = Math.min(index, text.length) - 1; i >= 0; i -= 1) {
    const ch = at(text, i);
    if (NEWLINE_RE.test(ch)) return i + 1;
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

/** The sentence containing `index` (see SENTENCES AND CLAUSES above). */
export function sentenceAround(text: string, index: number): TextRange {
  const i = Math.max(0, Math.min(index, text.length));
  return trimmedRange(text, sentenceStartFrom(text, i), sentenceEndFrom(text, i));
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
// Projection cues
// ---------------------------------------------------------------------------

const PROJECTION_CUE_RE = new RegExp(
  [
    String.raw`\bwill\b`,
    String.raw`\bwould\b`,
    String.raw`\bshall\b`,
    String.raw`\bgoing to\b`,
    String.raw`\bexpect(?:s|ed|ing|ation|ations)?\b`,
    String.raw`\bproject(?:ed|ing|ion|ions)\b`,
    String.raw`\bforecast(?:s|ed|ing|er|ers)?\b`,
    String.raw`\bpredict(?:s|ed|ing|ion|ions)?\b`,
    String.raw`\banticipat(?:e|es|ed|ing)\b`,
    String.raw`\bpoised\b`,
    String.raw`\bset to\b`,
    String.raw`\bslated\b`,
    String.raw`\bon track to\b`,
    String.raw`\boutlook\b`,
    String.raw`\bto (?:reach|hit|grow|surpass|exceed|touch|attain|climb|rise|increase|double|triple)\b`,
    String.raw`\b(?:by|through|until|till) (?:19|20)\d{2}\b`,
  ].join("|"),
  "i",
);

const YEAR_IN_TEXT_RE = /(?<![\p{L}\p{N}$€£.,])((?:19|20)\d{2})(?![\p{N}%]|[.,]\d)/gu;

/**
 * True when the sentence reads as a forecast: future tense, forecast words,
 * "by/through <year>", or (with `referenceYear`) any year after it.
 */
export function hasProjectionCue(sentence: string, referenceYear?: number): boolean {
  if (PROJECTION_CUE_RE.test(sentence)) return true;
  if (referenceYear === undefined) return false;
  for (const m of sentence.matchAll(YEAR_IN_TEXT_RE)) {
    if (Number(m[1]) > referenceYear) return true;
  }
  return false;
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

function readSegment(text: string, index: number, afterNewline: boolean): Segment | null {
  const qualifier = stickyMatch(QUALIFIER_SEGMENT_RE, text, index);
  if (qualifier) return { kind: "qualifier", end: index + qualifier[0].length };
  const slash = stickyMatch(SLASH_SEGMENT_RE, text, index);
  if (slash) return classifyUnit(slash[1] ?? "", index + slash[0].length);
  const per = stickyMatch(PER_SEGMENT_RE, text, index);
  if (per) return classifyUnit(per[1] ?? "", index + per[0].length);
  const oneTime = stickyMatch(ONE_TIME_SEGMENT_RE, text, index);
  if (oneTime) return { kind: "period", period: "one_time", end: index + oneTime[0].length };
  if (afterNewline) return null;
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

/** Whitespace before a segment: at most one line break. */
function readGap(text: string, index: number): { end: number; newline: boolean } {
  let i = index;
  while (HSPACE_RE.test(at(text, i))) i += 1;
  let newline = false;
  if (at(text, i) === "\r" && at(text, i + 1) === "\n") {
    i += 2;
    newline = true;
  } else if (NEWLINE_RE.test(at(text, i))) {
    i += 1;
    newline = true;
  }
  if (newline) while (HSPACE_RE.test(at(text, i))) i += 1;
  return { end: i, newline };
}

type Units = { period: PricePeriod | null; basis: PriceBasis; end: number };

function readUnits(text: string, amountEnd: number): Units | null {
  let period: PricePeriod | null = null;
  let basis: PriceBasis | null = null;
  let end = amountEnd;
  for (;;) {
    const gap = readGap(text, end);
    const segment = readSegment(text, gap.end, gap.newline);
    if (!segment) break;
    const conflict =
      segment.kind === "invalid" ||
      (segment.kind === "period" && period !== null) ||
      (segment.kind === "basis" && basis !== null);
    if (conflict) {
      if (gap.newline) break;
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
