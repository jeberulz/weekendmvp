/**
 * Fixed vocabulary and factual-line formats of a compiled idea page (WP46,
 * evidence contract §9). The compiler (compile.ts) renders these lines and
 * the final artifact audit (artifact-audit.ts) reads them back, so both
 * sides live here: a displayed figure is compared with the record exactly,
 * never matched as loose prose.
 *
 * Year-One Math lines (all figures from finance.ts, money in exact cents):
 *   base      **45 × $100/mo = $54,000 ARR** — Crew accounts paying by month 12 (5 seats × $20/developer/month)
 *   downside  **22 × $100/mo = $26,400 ARR** — downside if the close rate halves (half of 45 accounts, rounded down)
 *   funnel    **1,200** — Marketplace visitors
 * The reader accepts presentation variations of these lines only: ×, x or
 * * for the product; "/mo" or "/month", "/yr" or "/year"; dollars with or
 * without thousands separators and with or without ".00"; an em dash, en
 * dash or hyphen before the description; optional spaces; bold markers;
 * a trailing period. The seat note is optional when seats is 1.
 */

import { escapeMdxText } from "./evidence/quote.ts";
import { formatUsdCents } from "./finance.ts";
import type { KeywordRow } from "./research-record.ts";

/** The seven body sections, in order. Keep in sync with scripts/lib/idea-sections.mjs (a test checks). */
export const SECTION_TITLES = [
  "The Problem",
  "The Solution",
  "Market Research",
  "Competitive Landscape",
  "Business Model",
  "Recommended Tech Stack",
  "AI Prompts to Build This",
] as const;

export const SOURCES_TITLE = "Sources";
export const HOW_IT_WORKS_LABEL = "**How it works:**";

/** Visible text of the bold labels that introduce factual blocks. */
export const LABEL = {
  marketSignals: "Market signals",
  searchDemand: "Search demand",
  yourOpportunity: "Your Opportunity",
  unitEconomics: "Unit Economics",
  yearOneMath: "Year-One Math",
  channels: "Channels",
} as const;

/** Separates a competitor row's editorial notes from its evidence-bound prices. */
export const PUBLISHED_PRICING = "Published pricing:";
/** Suffix of the Search demand label. */
export const SEARCH_DEMAND_NOTE = "(DataForSEO, US monthly)";

const LINK_UNSAFE_RE = /[()\s<>{}]/g;

/**
 * Link destination as the compiler writes it: ( ) whitespace < > { }
 * percent-encoded, nothing else changed. Apply it to both sides before
 * comparing a page URL with an evidence URL.
 */
export function linkUrl(url: string): string {
  return url.replace(
    LINK_UNSAFE_RE,
    (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`,
  );
}

/** Markdown link: text escaped once with escapeMdxText, destination in linkUrl form. */
export function mdLink(text: string, url: string): string {
  return `[${escapeMdxText(text)}](${linkUrl(url)})`;
}

/** "(via reviews.example.com)": the visible label of a secondary-source price. */
export function viaLabel(host: string): string {
  return `(via ${host})`;
}

/** A trailing "(via host)" label and the text before it. */
export function splitViaLabel(text: string): { text: string; via: string | null } {
  const m = /\s*\(via\s+([^()\s]+)\)\s*$/i.exec(text);
  if (!m) return { text: text.trim(), via: null };
  return { text: text.slice(0, m.index).trim(), via: (m[1] ?? "").toLowerCase() };
}

/** Visible text of a Search demand row; the compiler bolds the term. */
export function keywordRowText(row: KeywordRow): string {
  return `${row.term} — ${row.volume}/mo, competition ${row.competition}, CPC $${row.cpc.toFixed(2)}`;
}

/** MDX of a Search demand row. */
export function keywordRowMdx(row: KeywordRow): string {
  return `- **${escapeMdxText(row.term)}** — ${row.volume}/mo, competition ${row.competition}, CPC $${row.cpc.toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// Year-One Math lines
// ---------------------------------------------------------------------------

function groupThousands(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** "mo" or "yr", as the equation shows the price period. */
export function periodAbbrev(period: "month" | "year"): "mo" | "yr" {
  return period === "month" ? "mo" : "yr";
}

/** "45 × $100/mo = $54,000 ARR": the bold equation of a base or downside line. */
export function arrEquation(
  accounts: number,
  perAccountCents: number,
  period: "month" | "year",
  arrCents: number,
): string {
  return `${groupThousands(accounts)} × ${formatUsdCents(perAccountCents)}/${periodAbbrev(period)} = ${formatUsdCents(arrCents)} ARR`;
}

/** The figures a Year-One equation line shows. */
export type YearOneEquation = {
  accounts: number;
  perAccountCents: number;
  period: "month" | "year";
  arrCents: number;
};

/** MDX of the base line; `seatPrice` is the tier's price text, shown when seats > 1. */
export function yearOneBaseLine(
  equation: YearOneEquation,
  tierName: string,
  seats: { count: number; priceText: string } | null,
): string {
  const note = seats && seats.count > 1 ? ` (${seats.count} seats × ${escapeMdxText(seats.priceText)})` : "";
  return `- **${arrEquation(equation.accounts, equation.perAccountCents, equation.period, equation.arrCents)}** — ${escapeMdxText(tierName)} accounts paying by month 12${note}`;
}

/** MDX of the downside line: floor(base / 2) accounts, which may be zero. */
export function yearOneDownsideLine(downside: YearOneEquation, baseAccounts: number): string {
  const noun = baseAccounts === 1 ? "account" : "accounts";
  const rounding = baseAccounts % 2 === 1 ? ", rounded down" : "";
  return `- **${arrEquation(downside.accounts, downside.perAccountCents, downside.period, downside.arrCents)}** — downside if the close rate halves (half of ${groupThousands(baseAccounts)} ${noun}${rounding})`;
}

/** MDX of one funnel stage line. */
export function yearOneFunnelLine(count: number, stage: string): string {
  return `- **${groupThousands(count)}** — ${escapeMdxText(stage)}`;
}

const COUNT = String.raw`(\d{1,3}(?:,\d{3})+|\d+)`;
const USD = String.raw`(\$[  ]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{2})?)`;
const TIMES = String.raw`\s*[×xX*]\s*`;
const PER = String.raw`\s*\/\s*(mo|month|yr|year)`;
const DASH = String.raw`\s*[—–-]{1,2}\s*`;
const EQUATION = String.raw`${COUNT}${TIMES}${USD}${PER}\s*=\s*${USD}\s*ARR`;

const BASE_LINE_RE = new RegExp(
  String.raw`^${EQUATION}${DASH}(.+?)\s+accounts?\s+paying\s+by\s+month\s+12(?:\s*\(\s*${COUNT}\s+seats?${TIMES}([^()]+?)\s*\))?\s*\.?$`,
  "i",
);
const DOWNSIDE_LINE_RE = new RegExp(
  String.raw`^${EQUATION}${DASH}downside\s+if\s+the\s+close\s+rate\s+halves(?:\s*\(\s*half\s+of\s+${COUNT}\s+accounts?(?:\s*,\s*rounded\s+down)?\s*\))?\s*\.?$`,
  "i",
);
const FUNNEL_LINE_RE = new RegExp(String.raw`^${COUNT}${DASH}(\S.*)$`);

/** A displayed count ("1,200" or "1200") as a safe integer, or null. */
export function parseDisplayedCount(text: string): number | null {
  if (!/^(?:\d{1,3}(?:,\d{3})+|\d+)$/.test(text)) return null;
  const n = Number(text.replace(/,/g, ""));
  return Number.isSafeInteger(n) ? n : null;
}

/** Exact cents of a displayed USD amount ("$54,000", "$2,998.80", "$54000.00"), or null. */
export function parseDisplayedUsd(text: string): number | null {
  const m = /^\$[  ]?((?:\d{1,3}(?:,\d{3})+|\d+))(?:\.(\d{2}))?$/.exec(text.trim());
  if (!m) return null;
  const dollars = Number((m[1] ?? "").replace(/,/g, ""));
  const cents = dollars * 100 + Number(m[2] ?? "0");
  return Number.isSafeInteger(dollars) && Number.isSafeInteger(cents) ? cents : null;
}

function readPeriod(text: string): "month" | "year" {
  return /^mo/i.test(text) ? "month" : "year";
}

/** A Year-One Math line read back from its visible text (whitespace already collapsed). */
export type DisplayedYearOneLine =
  | (YearOneEquation & {
      kind: "base";
      tier: string;
      seats: { count: number; priceText: string } | null;
    })
  | (YearOneEquation & { kind: "downside"; halfOf: number | null })
  | { kind: "funnel"; count: number; stage: string };

function readEquation(m: RegExpExecArray): YearOneEquation | null {
  const accounts = parseDisplayedCount(m[1] ?? "");
  const perAccountCents = parseDisplayedUsd(m[2] ?? "");
  const arrCents = parseDisplayedUsd(m[4] ?? "");
  if (accounts === null || perAccountCents === null || arrCents === null) return null;
  return { accounts, perAccountCents, period: readPeriod(m[3] ?? ""), arrCents };
}

/**
 * Read a Year-One Math line (base, downside or funnel stage), or null when
 * the text is none of them. Only the variations listed at the top of this
 * file are accepted; anything else is "not a Year-One line".
 */
export function parseYearOneLine(text: string): DisplayedYearOneLine | null {
  const line = text.replace(/\s+/g, " ").trim();
  const base = BASE_LINE_RE.exec(line);
  if (base) {
    const equation = readEquation(base);
    if (!equation) return null;
    const seatCount = base[6] === undefined ? null : parseDisplayedCount(base[6]);
    if (base[6] !== undefined && seatCount === null) return null;
    return {
      kind: "base",
      ...equation,
      tier: (base[5] ?? "").trim(),
      seats: seatCount === null ? null : { count: seatCount, priceText: (base[7] ?? "").trim() },
    };
  }
  const downside = DOWNSIDE_LINE_RE.exec(line);
  if (downside) {
    const equation = readEquation(downside);
    if (!equation) return null;
    const halfOf = downside[5] === undefined ? null : parseDisplayedCount(downside[5]);
    return { kind: "downside", ...equation, halfOf };
  }
  const funnel = FUNNEL_LINE_RE.exec(line);
  if (funnel) {
    const count = parseDisplayedCount(funnel[1] ?? "");
    if (count !== null) return { kind: "funnel", count, stage: (funnel[2] ?? "").trim() };
  }
  return null;
}
