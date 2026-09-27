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
  "estimate",
  "pricing",
  "price",
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
  return wanted.every((word) => new RegExp(`\\b${word}\\b`, "i").test(hay));
}

/**
 * True when one relevant passage supports the complete typed claim.
 * Magnitude, currency, period, year, geography and subject must agree.
 */
function statementMatches(figure: string, haystack: string): boolean {
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
    if (!subjects.every((word) => new RegExp(`\\b${word}\\b`, "i").test(hay))) return false;
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

// These checks are a conservative lexical corroboration gate, not semantic
// entailment. Anything ambiguous stays unresolved for independent verification.
const UNSAFE_ASSERTION = /\b(?:not|no|never|neither|without|false|incorrect|denied|denies|deny|disputed|dispute|unconfirmed|unverified|alleged|allegedly|claim(?:s|ed)?|may|might|could|would|should|if|unless|hypothetical|suppose|assuming|projected|forecast|expected|prediction|predicts|falsely|rumou?r(?:ed)?|trial)\b|n[’']t\b|\?/i;

function statements(text: string): string[] {
  // Do not split decimal points or thousands separators. Conjoined clauses
  // cannot lend one another their subject, date, or amount.
  return text.split(/(?<=[.!?])\s+|[;\n]+|\s+(?:and|but|while|whereas|or)\s+|,(?!\d{3}\b)/i)
    .map((part) => part.trim()).filter(Boolean);
}

function matchingStatements(figure: string, page: string): string[] | null {
  const wanted = statements(figure);
  if (wanted.length === 0) return null;
  // Reject unsafe context before clause splitting: a comma must never erase
  // "it is not true that" or an uncertainty qualifier from the assertion.
  const candidates = page.split(/(?<=[.!?])\s+|\n+/)
    .filter((sentence) => !UNSAFE_ASSERTION.test(sentence))
    .flatMap(statements);
  const matches: string[] = [];
  for (const claim of wanted) {
    const found = candidates.find((statement) => {
      if (UNSAFE_ASSERTION.test(statement) || UNSAFE_ASSERTION.test(claim)) return false;
      if (!statementMatches(claim, statement)) return false;
      if (/^free$/i.test(claim.trim()) && !/^(?:(?:the|this) product is )?free[.!]?$/i.test(statement.trim())) return false;
      // A subject-bearing statement with extra values is ambiguous: the right
      // number may belong to another subject or time period in the same clause.
      if (subjectWords(claim).length > 0) {
        const amounts = moneyMentions(claim);
        if (amounts.length > 0 && moneyMentions(statement).some((value) => !amounts.some((amount) => sameMoney(amount, value)))) return false;
        const claimSubjects = amounts.length > 0 ? subjectWords(claim) : [];
        const sourceSubjects = subjectWords(statement);
        if (claimSubjects.length > 0 && !sourceSubjects.some((_, index) =>
          claimSubjects.every((word, offset) => sourceSubjects[index + offset] === word)
        )) return false;
      }
      return true;
    });
    if (!found) return null;
    matches.push(found);
  }
  return matches;
}

/** Lexical corroboration within statements; never combines unrelated facts. */
export function figureSupported(figure: string, haystack: string): boolean {
  return matchingStatements(figure, haystack) !== null;
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

/** Retain the statement that actually matched; never select the first number. */
export function supportingPassage(
  figure: string,
  page: string,
  radius = PASSAGE_RADIUS,
): string | null {
  const matches = matchingStatements(figure, page);
  if (!matches) return null;
  const passage = matches.join("; ");
  const limit = Math.min(MAX_EXCERPT_CHARS, Math.max(1, radius * 2));
  let retained = passage.replace(/\s+/g, " ").trim();
  if (retained.length > limit) {
    // Long navigation can precede the assertion without punctuation. Trim at
    // a complete subject token, never through a word or the assertion itself.
    const subject = subjectWords(figure)[0];
    const start = subject ? retained.search(new RegExp(`\\b${subject}\\b`, "i")) : -1;
    if (start < 0) return null;
    retained = retained.slice(start);
  }
  if (retained.length > limit) return null;
  return figureSupported(figure, retained) ? retained : null;
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
        ? "claim lexically corroborated within a source statement; semantic review still required"
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
        ? "price lexically corroborated within a source statement; semantic review still required"
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
