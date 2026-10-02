/**
 * Fixed vocabulary and factual-line formats of a compiled idea page (WP54,
 * evidence contract §9, rulings R10 and R11). The compiler (compile.ts)
 * renders these lines and the final artifact audit (artifact-audit.ts) reads
 * them back, so both sides live here: a displayed figure is compared with the
 * record exactly, never matched as loose prose. The same goes for the market
 * signal row, the page's evidence set (usedEvidenceIds: what ## Sources
 * lists and what a link may target), the proposal labels and the manifest
 * `highlights` block. Record fields are named by the contract's lists
 * (WRITER_TEXT_FIELDS, WRITER_FIELD_TOKEN_KINDS, NUMERIC_PROPOSAL_FIELDS),
 * resolved with recordTextsAt.
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

import { formatAmount, formatPriceTerms } from "./evidence/amount.ts";
import { sourceHostLabel } from "./evidence/citation.ts";
import {
  WRITER_FIELD_TOKEN_KINDS,
  WRITER_TEXT_FIELDS,
  type MarketStatEvidence,
  type ResearchRecordV2,
} from "./evidence/contract.ts";
import { escapeMdxText } from "./evidence/quote.ts";
import { evidenceRefs, renderEvidenceInline } from "./evidence/tokens.ts";
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
/** The one section where fenced code (the build prompts) belongs. */
export const PROMPTS_TITLE: (typeof SECTION_TITLES)[number] = "AI Prompts to Build This";

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

/** The build prompts, in order; each is a bold "N. Title" line above its ```text fence. */
export const PROMPT_TITLES = ["Project Setup", "Core Feature", "Landing Page", "Branding Package"] as const;

/** Visible text of the heading of build prompt `index` (0-based): "1. Project Setup". */
export function promptHeadingText(index: number): string {
  return `${index + 1}. ${PROMPT_TITLES[index] ?? ""}`;
}

/**
 * Lead-ins that label every proposal and planning assumption on the page
 * (contract §9). A label of eight or more words carries the product name, so
 * it never repeats word for word on another engine page (the cross-idea
 * duplicate-sentence check).
 */
export function proposalLabels(productName: string): {
  howItWorks: string;
  dontBuildYet: string;
  pricing: string;
  unitEconomics: string;
  yearOne: string;
  channels: string;
  stack: string;
} {
  return {
    howItWorks: `The workflow below is ${productName}'s proposed first version: a plan to build, not a tested product.`,
    dontBuildYet: `What not to build yet (scope advice for ${productName}'s first version, not research):`,
    pricing: `Proposed ${productName} pricing to test with early buyers (an assumption, not observed market data):`,
    unitEconomics: "Planning estimates to verify, not measured results:",
    yearOne: `${productName}'s funnel, seat count and close rate below are planning assumptions, not measured results; the totals are plain arithmetic on them.`,
    channels: "Channels to test (proposals, not measured results):",
    stack: `A suggested stack for ${productName} (a recommendation, not research):`,
  };
}

/** The product name the page uses: editorial.productName, else the brief title without "for …". */
export function pageProductName(record: ResearchRecordV2): string {
  const named = record.editorial?.productName?.trim();
  if (named) return named;
  return record.brief.title.replace(/\s+for\s+.+$/i, "").trim() || record.brief.title;
}

/** The compiler's one prose tidy-up: a stray ".." becomes "." (an ellipsis "..." is kept). */
export function tidyProse(text: string): string {
  return text.replace(/(?<!\.)\.\.(?!\.)/g, ".");
}

const LINK_UNSAFE_RE = /[()\s<>{}\\]/g;

/**
 * Link destination as the compiler writes it: ( ) whitespace < > { } and the
 * backslash percent-encoded, nothing else changed. A raw backslash would
 * escape the character after it in Markdown, so a URL ending in one would
 * swallow the link's closing parenthesis. Apply it to both sides before
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

/**
 * A market signal row, written by the compiler and read back by the audit:
 * `- <renderEvidenceInline(stat)> ([source title](url)).` The rendering
 * already names the stat's subject, metric and period (ruling R7), so the
 * row has no label of its own: nothing on it can be relabelled, and a
 * changed subject or metric is a changed rendering.
 */
export function marketSignalRow(item: MarketStatEvidence): string {
  return `- ${escapeMdxText(renderEvidenceInline(item))} (${mdLink(item.sourceTitle, item.sourceUrl)}).`;
}

// ---------------------------------------------------------------------------
// The record's evidence on the page
// ---------------------------------------------------------------------------

/** One record text at a concrete path ("competitors[2].notes"). */
export type RecordText = { path: string; text: string };

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * The strings of a record at a contract field path such as
 * "competitors[].notes" or "goToMarket.channels[]" (`[]` walks every array
 * element). The contract's field lists (WRITER_TEXT_FIELDS,
 * NUMERIC_PROPOSAL_FIELDS) are resolved with this, so neither the compiler
 * nor the auditor keeps its own list of record fields. Values that are not
 * strings are skipped.
 */
export function recordTextsAt(record: ResearchRecordV2, field: string): RecordText[] {
  let level: Array<{ path: string; value: unknown }> = [{ path: "", value: record }];
  for (const part of field.split(".")) {
    const many = part.endsWith("[]");
    const key = many ? part.slice(0, -2) : part;
    const next: Array<{ path: string; value: unknown }> = [];
    for (const { path, value } of level) {
      if (!isPlainRecord(value)) continue;
      const child = value[key];
      const at = path === "" ? key : `${path}.${key}`;
      if (!many) {
        if (child !== undefined) next.push({ path: at, value: child });
      } else if (Array.isArray(child)) {
        child.forEach((element: unknown, i: number) => next.push({ path: `${at}[${i}]`, value: element }));
      }
    }
    level = next;
  }
  return level.flatMap(({ path, value }) => (typeof value === "string" ? [{ path, text: value }] : []));
}

/**
 * The evidence ids a compiled page uses: the selected quotes, stats and
 * prices plus every token in a writer text field that may cite evidence
 * (WRITER_FIELD_TOKEN_KINDS, ruling R7; the record parser refuses a token in
 * any other field). ## Sources lists exactly their sources, and every link
 * on the page must target one of them.
 */
export function usedEvidenceIds(record: ResearchRecordV2): Set<string> {
  const ids = new Set<string>([
    ...record.community.quoteIds,
    ...record.market.statIds,
    ...record.competitors.flatMap((c) => c.priceIds),
  ]);
  for (const field of WRITER_TEXT_FIELDS) {
    if (WRITER_FIELD_TOKEN_KINDS[field].length === 0) continue;
    for (const { text } of recordTextsAt(record, field)) {
      for (const id of evidenceRefs(text)) ids.add(id);
    }
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Manifest highlights (review P2-9)
// ---------------------------------------------------------------------------

/**
 * Limits of the homepage `highlights` block, as scripts/validate-idea-tags.mjs
 * (HIGHLIGHT_LIMITS) enforces them; a test checks the two agree.
 */
export const HIGHLIGHT_LIMITS = {
  problemQuote: 190,
  statValue: 12,
  statLabel: 90,
  statSource: 48,
  maxStats: 3,
  competitorName: 32,
  competitorPrice: 16,
  minCompetitors: 3,
  maxCompetitors: 5,
} as const;

/** The manifest `highlights` block lib/home/highlights.ts reads. */
export type IdeaHighlights = {
  problemQuote: string;
  stats: Array<{ value: string; label: string; source?: string }>;
  competitors?: Array<{ name: string; price: string }>;
};

function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

const METRIC_WORDS: Record<MarketStatEvidence["metric"], string | null> = {
  market_size: "market size",
  growth_rate: "growth rate",
  spend: "spend",
  user_count: "user count",
  adoption: "adoption",
  other: null,
};

/**
 * The label a stat gets in the homepage highlights, which show the amount
 * separately: subject, metric and period in words ("AI code review market
 * (market size) in 2025", "… (market size) projected for 2034"). Built from
 * the stat's typed fields; the subject is figure-free (ruling R9).
 */
export function highlightStatLabel(item: MarketStatEvidence): string {
  const subject = item.subject.charAt(0).toUpperCase() + item.subject.slice(1);
  const metric = METRIC_WORDS[item.metric];
  const { kind, year, toYear } = item.period;
  const period = kind === "projected" ? (toYear !== undefined ? `projected for ${toYear}` : "projected") : year !== undefined ? `in ${year}` : "";
  return collapse(`${subject}${metric ? ` (${metric})` : ""} ${period}`);
}

/**
 * The homepage highlights the record generates, or undefined when it cannot
 * fill the required parts. Everything comes from selected evidence, never
 * from the writer:
 *   - problemQuote: the first selected quote (community.quoteIds order) that
 *     fits, word for word (whitespace collapsed);
 *   - stats: up to three selected stats whose canonical amount (formatAmount)
 *     fits the value slot; the label is highlightStatLabel (subject, metric,
 *     period), the source its source title (or host) when it fits;
 *   - competitors: each competitor's first FIRST-PARTY price whose canonical
 *     terms (formatPriceTerms) fit the price slot, only when at least three
 *     competitors have one. A secondary price would lose its "(via host)"
 *     label on the homepage, so it is never used.
 * The auditor fails an engine page whose manifest row carries highlights
 * that differ from these.
 */
export function ideaHighlights(record: ResearchRecordV2): IdeaHighlights | undefined {
  const L = HIGHLIGHT_LIMITS;
  const byId = new Map(record.evidence.accepted.map((item) => [item.id, item]));
  let problemQuote: string | undefined;
  for (const id of record.community.quoteIds) {
    const item = byId.get(id);
    if (item?.kind !== "community_quote") continue;
    const text = collapse(item.excerpt);
    if (text.length > 0 && text.length <= L.problemQuote) {
      problemQuote = text;
      break;
    }
  }
  const stats: IdeaHighlights["stats"] = [];
  for (const id of record.market.statIds) {
    if (stats.length >= L.maxStats) break;
    const item = byId.get(id);
    if (item?.kind !== "market_stat") continue;
    const value = formatAmount(item.amount);
    const label = highlightStatLabel(item);
    if (value.length > L.statValue || label.length === 0 || label.length > L.statLabel) continue;
    const title = collapse(item.sourceTitle);
    const host = sourceHostLabel(item.sourceUrl);
    const source = title.length > 0 && title.length <= L.statSource ? title : host.length > 0 && host.length <= L.statSource ? host : undefined;
    stats.push(source === undefined ? { value, label } : { value, label, source });
  }
  if (problemQuote === undefined || stats.length === 0) return undefined;

  const competitors: Array<{ name: string; price: string }> = [];
  for (const competitor of record.competitors) {
    if (competitors.length >= L.maxCompetitors) break;
    const name = collapse(competitor.name);
    if (name.length === 0 || name.length > L.competitorName) continue;
    for (const id of competitor.priceIds) {
      const item = byId.get(id);
      if (item?.kind !== "competitor_price" || item.attribution !== "first_party") continue;
      const price = formatPriceTerms(item.price);
      if (price.length <= L.competitorPrice) {
        competitors.push({ name, price });
        break;
      }
    }
  }
  return competitors.length >= L.minCompetitors ? { problemQuote, stats, competitors } : { problemQuote, stats };
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
const USD = String.raw`(\$[ \u00A0]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{2})?)`;
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
  const m = /^\$[ \u00A0]?((?:\d{1,3}(?:,\d{3})+|\d+))(?:\.(\d{2}))?$/.exec(text.trim());
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
