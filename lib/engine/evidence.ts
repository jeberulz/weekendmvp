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
]);

const GEO: Array<[RegExp, string]> = [
  [/\bunited states\b|\bu\.s\.a?\b|\bus\b/i, "us"],
  [/\beurope\b|\beu\b/i, "eu"],
  [/\bunited kingdom\b|\buk\b/i, "uk"],
  [/\bindia\b/i, "in"],
];

type MoneyMention = { value: number; period: "month" | "year" | null };

function moneyMentions(text: string): MoneyMention[] {
  const out: MoneyMention[] = [];
  const re =
    /\$\s*(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)(?:\s*(billion|million|thousand|bn|b|m|k)\b)?/gi;
  for (const match of text.matchAll(re)) {
    const index = match.index ?? 0;
    const amount = Number(match[1]!.replace(/,/g, ""));
    const scaleWord = match[2]?.toLowerCase() ?? "";
    const scale = scaleWord ? (MONEY_SCALE[scaleWord] ?? 1) : 1;
    const window = text.slice(index, index + match[0].length + 24).toLowerCase();
    const period = /per year|\/yr|\/year|annual/.test(window)
      ? "year"
      : /per month|\/mo|\/month|monthly/.test(window)
        ? "month"
        : null;
    if (Number.isFinite(amount)) out.push({ value: amount * scale, period });
  }
  return out;
}

function sameMoney(claimed: MoneyMention, evidence: MoneyMention): boolean {
  const diff = Math.abs(claimed.value - evidence.value);
  return diff <= Math.max(0.01, claimed.value * 1e-9);
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

function geos(text: string): Set<string> {
  const found = new Set<string>();
  for (const [re, id] of GEO) {
    if (re.test(text)) found.add(id);
  }
  return found;
}

function qualitativeSupported(figure: string, haystack: string): boolean {
  const words = figure.toLowerCase().match(/[a-z][a-z0-9-]{3,}/g) ?? [];
  const wanted = [...new Set(words.filter((word) => !QUAL_STOP.has(word)))];
  if (wanted.length === 0) return false;
  const hay = haystack.toLowerCase();
  return wanted.every((word) => hay.includes(word));
}

export function figureSupported(figure: string, haystack: string): boolean {
  const claimed = moneyMentions(figure);
  if (claimed.length > 0) {
    const evidence = moneyMentions(haystack);
    const moneyOk = claimed.every((item) =>
      evidence.some(
        (found) =>
          sameMoney(item, found) &&
          (item.period === null || item.period === found.period),
      ),
    );
    if (!moneyOk) return false;
  }
  const claimedPercents = percentValues(figure);
  if (claimedPercents.length > 0) {
    const foundPercents = percentValues(haystack);
    if (!claimedPercents.every((value) => foundPercents.includes(value))) return false;
  }
  const claimedGeo = geos(figure);
  if (claimedGeo.size > 0) {
    const foundGeo = geos(haystack);
    if (![...claimedGeo].every((place) => foundGeo.has(place))) return false;
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

function sourceId(url: string): string {
  return contentHash(canonicalSourceKey(url) ?? url).slice(0, 16);
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
  const sources: EvidenceSource[] = urls.map((url) => {
    const page = pages.get(url);
    const text = page && "text" in page ? page.text : "";
    const excerpt = text ? boundExcerpt(text) : "";
    return {
      id: sourceId(url),
      canonicalUrl: canonicalSourceKey(url) ?? url,
      family: sourceFamily(url),
      retrievedAt: input.retrievedAt,
      excerpt,
      contentHash: contentHash(excerpt),
      outcome: text ? "read" : "missing",
    };
  });
  const claims: RecordedClaim[] = [];
  const supported = (figure: string, url: string): boolean | null => {
    const page = pages.get(url);
    if (!page || !("text" in page)) return null;
    return figureSupported(figure, page.text);
  };
  const stats = input.stats.filter((stat) => {
    const verdict = supported(stat.value, stat.citation.url);
    const page = pages.get(stat.citation.url);
    const text = page && "text" in page ? page.text : "";
    claims.push({
      text: `${stat.claim}: ${stat.value}`,
      evidenceIds: [sourceId(stat.citation.url)],
      stance: "observed",
      verdict: verdict ? "verified" : "unresolved",
      excerpt: text ? boundExcerpt(text).slice(0, 400) : "",
      reason: verdict
        ? "typed claim matched the fetched page"
        : verdict === null
          ? "cited page could not be read"
          : "fetched page does not support the typed claim",
    });
    return verdict === true;
  });
  const competitors = input.competitors.filter((row) => {
    const verdict = supported(row.pricing, row.url);
    const page = pages.get(row.url);
    const text = page && "text" in page ? page.text : "";
    claims.push({
      text: `${row.name} pricing: ${row.pricing}`,
      evidenceIds: [sourceId(row.url)],
      stance: "observed",
      verdict: verdict ? "verified" : "unresolved",
      excerpt: text ? boundExcerpt(text).slice(0, 400) : "",
      reason: verdict
        ? "typed price matched the fetched page"
        : verdict === null
          ? "cited page could not be read"
          : "fetched page does not support the typed price",
    });
    return verdict === true;
  });
  return { stats, competitors, sources, claims };
}
