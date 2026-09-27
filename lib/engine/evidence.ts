import { createHash } from "node:crypto";

import { canonicalSourceKey } from "./quote-binding.mjs";
import type {
  Competitor,
  EvidenceSource,
  MarketStat,
  RecordedClaim,
} from "./research-record.ts";

export const PIPELINE_VERSION = "wp45-s2";
export const PROMPT_VERSION = "synthesis-v1";
export const MAX_EXCERPT_CHARS = 2_000;
export const PASSAGE_RADIUS = 240;

/** Implementation windows, not a research ruling. Reverse with the word freshness. */
export const FRESHNESS_DAYS = {
  price: 90,
  community: 365,
  marketStat: 540,
  keyword: 30,
} as const;

const MONEY_SCALE: Record<string, number> = {
  billion: 1e9,
  bn: 1e9,
  b: 1e9,
  million: 1e6,
  m: 1e6,
  thousand: 1e3,
  k: 1e3,
};

const QUAL_STOP = new Set([
  "this",
  "that",
  "with",
  "from",
  "through",
  "their",
  "about",
  "which",
  "where",
  "when",
  "into",
  "over",
  "under",
  "than",
  "then",
  "also",
  "only",
  "just",
  "more",
  "most",
  "some",
  "such",
  "other",
  "these",
  "those",
  "been",
  "have",
  "will",
  "would",
  "could",
  "should",
  "your",
  "they",
  "them",
  "were",
  "what",
  "much",
  "this",
  "spent",
  "spend",
  "market",
  "estimate",
  "pricing",
  "price",
  "users",
  "user",
  "directional",
  "estimated",
  "approximate",
  "approx",
  "roughly",
  "nearly",
  "circa",
  "overall",
  "approximately",
  "indicative",
  "software",
  "market",
  "size",
]);

const GEO: Array<[RegExp, string]> = [
  [/\bunited states\b|\bu\.s\.a?\b|\bus\b/i, "us"],
  [/\beurope\b|\beu\b|\beuropean\b/i, "eu"],
  [/\bunited kingdom\b|\buk\b/i, "uk"],
  [/\bindia\b/i, "in"],
];

type MoneyMention = {
  value: number;
  period: "month" | "year" | null;
  currency: "usd" | "gbp" | "eur" | "none";
  hasScale: boolean;
  index: number;
};

function moneyMentions(text: string): MoneyMention[] {
  const out: MoneyMention[] = [];
  const re =
    /([£$€])?\s*(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)(?:\s*(billion|million|thousand|bn|b|m|k)\b)?/gi;
  for (const match of text.matchAll(re)) {
    const index = match.index ?? 0;
    const symbol = match[1] ?? "";
    const amount = Number(match[2]!.replace(/,/g, ""));
    const scaleWord = match[3]?.toLowerCase() ?? "";
    const scale = scaleWord ? (MONEY_SCALE[scaleWord] ?? 1) : 1;
    const window = text.slice(index, index + match[0].length + 24).toLowerCase();
    const period = /per year|\/yr|\/year|annual/.test(window)
      ? "year"
      : /per month|\/mo|\/month|monthly/.test(window)
        ? "month"
        : null;
    const currency =
      symbol === "$"
        ? "usd"
        : symbol === "£"
          ? "gbp"
          : symbol === "€"
            ? "eur"
            : "none";
    if (Number.isFinite(amount)) {
      out.push({
        value: amount * scale,
        period,
        currency,
        hasScale: Boolean(scaleWord),
        index,
      });
    }
  }
  return out;
}

function sameMoney(claimed: MoneyMention, evidence: MoneyMention): boolean {
  const diff = Math.abs(claimed.value - evidence.value);
  if (diff > Math.max(0.01, claimed.value * 1e-9)) return false;
  if (claimed.period !== null && claimed.period !== evidence.period) return false;
  if (claimed.currency !== "none" && claimed.currency !== evidence.currency) {
    return false;
  }
  if (claimed.hasScale && !evidence.hasScale) return false;
  return true;
}

function percentValues(text: string): number[] {
  return [...text.matchAll(/(?<![\d.])(\d+(?:\.\d+)?)\s*%/g)].map((match) =>
    Number(match[1]),
  );
}

function figureTokens(text: string): string[] {
  return (text.replace(/(\d),(?=\d{3}\b)/g, "$1").match(/\d+(?:\.\d+)?/g) ?? []).filter(
    (n) => n !== "0",
  );
}

function years(text: string): number[] {
  return [...text.matchAll(/\b(?:19|20)\d{2}\b/g)].map((match) => Number(match[0]));
}

function geos(text: string): Set<string> {
  const found = new Set<string>();
  for (const [re, id] of GEO) {
    if (re.test(text)) found.add(id);
  }
  return found;
}

function scaleWords(text: string): string[] {
  return [
    ...text
      .toLowerCase()
      .matchAll(/\b(billion|million|thousand|bn|b|m|k)\b/g),
  ].map((match) => match[1]!);
}

function subjectWords(text: string): string[] {
  const words = text.toLowerCase().match(/[a-z][a-z0-9-]{3,}/g) ?? [];
  return [...new Set(words.filter((word) => !QUAL_STOP.has(word)))];
}

function qualitativeSupported(figure: string, haystack: string): boolean {
  const wanted = subjectWords(figure);
  if (wanted.length === 0) return false;
  const hay = haystack.toLowerCase();
  return wanted.every((word) => hay.includes(word));
}

/**
 * True when one relevant passage supports the complete typed claim.
 * Magnitude, currency, period, year, geography and subject must agree.
 */
export function figureSupported(figure: string, haystack: string): boolean {
  const claimed = moneyMentions(figure);
  if (claimed.length > 0) {
    const evidence = moneyMentions(haystack);
    const moneyOk = claimed.every((item) => evidence.some((found) => sameMoney(item, found)));
    if (!moneyOk) return false;
  }
  const claimedScales = scaleWords(figure);
  if (claimedScales.length > 0) {
    const foundScales = new Set(scaleWords(haystack));
    if (!claimedScales.every((word) => foundScales.has(word))) return false;
  }
  const claimedPercents = percentValues(figure);
  if (claimedPercents.length > 0) {
    const foundPercents = percentValues(haystack);
    if (!claimedPercents.every((value) => foundPercents.includes(value))) return false;
  }
  const claimedYears = years(figure);
  if (claimedYears.length > 0) {
    const foundYears = new Set(years(haystack));
    if (!claimedYears.every((year) => foundYears.has(year))) return false;
  }
  const claimedGeo = geos(figure);
  if (claimedGeo.size > 0) {
    const foundGeo = geos(haystack);
    if (![...claimedGeo].every((place) => foundGeo.has(place))) return false;
  }
  const subjects = subjectWords(figure);
  if (subjects.length > 0) {
    const hay = haystack.toLowerCase();
    if (!subjects.every((word) => hay.includes(word))) return false;
  }
  const tokens = figureTokens(figure);
  if (tokens.length === 0) {
    if (claimed.length > 0 || claimedPercents.length > 0) return true;
    return qualitativeSupported(figure, haystack);
  }
  const hay = haystack.replace(/(\d),(?=\d{3}\b)/g, "$1");
  return tokens.every((token) =>
    new RegExp(`(?<![\\d.])${token.replace(".", "\\.")}(?![\\d]|\\.\\d)`).test(hay),
  );
}

export function boundExcerpt(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, MAX_EXCERPT_CHARS);
}

export function contentHash(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export function evidenceSourceId(url: string): string {
  return contentHash(canonicalSourceKey(url) ?? url).slice(0, 16);
}

export function sourceFamily(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
    if (host === "reddit.com" || host.endsWith(".reddit.com")) return "reddit";
    if (host.endsWith("ycombinator.com")) return "hackernews";
    if (host.endsWith("youtube.com") || host === "youtu.be") return "youtube";
    return "web";
  } catch {
    return "web";
  }
}

export function evidenceIsStale(
  retrievedAt: string,
  kind: keyof typeof FRESHNESS_DAYS,
  nowIso: string,
): boolean {
  const retrieved = Date.parse(retrievedAt);
  const now = Date.parse(nowIso);
  if (!Number.isFinite(retrieved) || !Number.isFinite(now)) return true;
  return (now - retrieved) / 86_400_000 > FRESHNESS_DAYS[kind];
}

function evidenceIndex(figure: string, page: string): number {
  const claimed = moneyMentions(figure);
  if (claimed.length > 0) {
    const evidence = moneyMentions(page);
    const hit = evidence.find((found) => sameMoney(claimed[0]!, found));
    if (hit) return hit.index;
  }
  for (const year of years(figure)) {
    const at = page.search(new RegExp(`\\b${year}\\b`));
    if (at >= 0) return at;
  }
  for (const word of subjectWords(figure)) {
    const at = page.toLowerCase().indexOf(word);
    if (at >= 0) return at;
  }
  const tokens = figureTokens(figure);
  for (const token of tokens) {
    const at = page.search(
      new RegExp(`(?<![\\d.])${token.replace(".", "\\.")}(?![\\d]|\\.\\d)`),
    );
    if (at >= 0) return at;
  }
  return -1;
}

/**
 * Bounded context around the matched claim. The saved passage itself must
 * support the figure, or verification stays unresolved.
 */
export function supportingPassage(
  figure: string,
  page: string,
  radius = PASSAGE_RADIUS,
): string | null {
  if (!figureSupported(figure, page)) return null;
  const at = evidenceIndex(figure, page);
  if (at < 0) return null;
  const start = Math.max(0, at - radius);
  const end = Math.min(page.length, at + radius);
  const passage = boundExcerpt(page.slice(start, end));
  if (!figureSupported(figure, passage)) return null;
  return passage;
}

export function mergeEvidenceSources(
  ...lists: EvidenceSource[][]
): EvidenceSource[] {
  const byId = new Map<string, EvidenceSource>();
  for (const list of lists) {
    for (const source of list) {
      const prior = byId.get(source.id);
      if (!prior) {
        byId.set(source.id, source);
        continue;
      }
      if (prior.outcome !== "read" && source.outcome === "read") {
        byId.set(source.id, source);
      } else if (
        prior.outcome === source.outcome &&
        source.excerpt.length > prior.excerpt.length
      ) {
        byId.set(source.id, source);
      }
    }
  }
  return [...byId.values()];
}

export function pageToEvidenceSource(
  url: string,
  text: string | null,
  retrievedAt: string,
  excerpt = "",
): EvidenceSource {
  const retained = excerpt || (text ? boundExcerpt(text) : "");
  return {
    id: evidenceSourceId(url),
    canonicalUrl: canonicalSourceKey(url) ?? url,
    family: sourceFamily(url),
    retrievedAt,
    excerpt: retained,
    contentHash: contentHash(retained),
    outcome: text ? "read" : "missing",
  };
}

export async function filterFiguresByPage(input: {
  stats: MarketStat[];
  competitors: Competitor[];
  fetchText: (url: string) => Promise<string>;
  retrievedAt: string;
}): Promise<{
  stats: MarketStat[];
  competitors: Competitor[];
  sources: EvidenceSource[];
  claims: RecordedClaim[];
}> {
  const urls = [
    ...new Set([
      ...input.stats.map((stat) => stat.citation.url),
      ...input.competitors.map((row) => row.url),
    ]),
  ];
  const pages = new Map<string, { text: string } | { missing: true }>();
  for (const url of urls) {
    try {
      const text = (await input.fetchText(url)).trim();
      pages.set(url, text ? { text } : { missing: true });
    } catch {
      pages.set(url, { missing: true });
    }
  }
  const sources: EvidenceSource[] = [];
  const claims: RecordedClaim[] = [];
  const pageText = (url: string): string | null => {
    const page = pages.get(url);
    return page && "text" in page ? page.text : null;
  };

  const stats = input.stats.filter((stat) => {
    const figure = `${stat.claim} ${stat.value}`.trim();
    const text = pageText(stat.citation.url);
    const passage = text ? supportingPassage(figure, text) : null;
    const verified = passage !== null;
    sources.push(
      pageToEvidenceSource(
        stat.citation.url,
        text,
        input.retrievedAt,
        passage ?? "",
      ),
    );
    claims.push({
      text: `${stat.claim}: ${stat.value}`,
      evidenceIds: [evidenceSourceId(stat.citation.url)],
      stance: "observed",
      verdict: verified ? "verified" : "unresolved",
      excerpt: passage ?? "",
      reason: verified
        ? "typed claim matched a supporting passage"
        : text === null
          ? "cited page could not be read"
          : "fetched page does not support the typed claim",
    });
    return verified;
  });
  const competitors = input.competitors.filter((row) => {
    const text = pageText(row.url);
    const passage = text ? supportingPassage(row.pricing, text) : null;
    const verified = passage !== null;
    sources.push(
      pageToEvidenceSource(row.url, text, input.retrievedAt, passage ?? ""),
    );
    claims.push({
      text: `${row.name} pricing: ${row.pricing}`,
      evidenceIds: [evidenceSourceId(row.url)],
      stance: "observed",
      verdict: verified ? "verified" : "unresolved",
      excerpt: passage ?? "",
      reason: verified
        ? "typed price matched a supporting passage"
        : text === null
          ? "cited page could not be read"
          : "fetched page does not support the typed price",
    });
    return verified;
  });
  return {
    stats,
    competitors,
    sources: mergeEvidenceSources(sources),
    claims,
  };
}
