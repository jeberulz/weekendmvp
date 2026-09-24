/**
 * Research pipeline: BriefInput → ResearchRecord (Mode A2 phase 5).
 *
 * Seven steps matching v1.1 order. Retry once on retryable provider errors,
 * then fail. Keyword step fails closed (no guessed CPC/volume). Cost over
 * $4.00 throws before another provider call — including the retry, and
 * counting billed failures.
 *
 * Every stat, competitor, and community signal must cite a URL the search
 * step actually returned. Nothing is back-filled from search results or
 * canned copy: a short synthesis fails the run instead of publishing
 * invented rows.
 *
 * Does not write MDX. Does not touch Convex workflow/credits/ownerId.
 */

import {
  assertWithinCap,
  CostCapExceededError,
  fromMicroUsd,
  toMicroUsd,
  worstCaseMicroUsd,
} from "./cost.ts";
import { PIPELINE, stepAt } from "./pipeline-steps.ts";
import {
  quoteAppearsIn,
  type SourceTextProvider,
} from "./providers/sourceText.ts";
import {
  type EditorialFields,
  parseDataModel,
  parseYearOne,
  MIN_COMPETITORS,
  MIN_HOW_IT_WORKS_STEPS,
  MIN_MARKET_STATS,
  parseResearchRecord,
  RESEARCH_RECORD_CONTRACT_VERSION,
  type Competitor,
  type KeywordRow,
  type MarketStat,
  type ProviderCall,
  type ResearchRecord,
  type ResearchScores,
} from "./research-record.ts";
import {
  ProviderCallError,
  ProviderConfigError,
  type Citation,
  type EngineProviders,
  type ProviderCost,
  type ProviderResult,
  type KeywordMetric,
} from "./providers/types.ts";

export type BriefInput = {
  title: string;
  audience: string;
  revenueModel: string;
  seedKeywords: string[];
  /** Optional slug; derived from title when omitted. */
  slug?: string;
  oneLiner?: string;
};

export type NormalizedBrief = {
  title: string;
  audience: string;
  model: string;
  seedKeywords: string[];
  slug: string;
  oneLiner: string;
};

type SearchPack = {
  text: string;
  citations: Citation[];
};

type SynthesisPack = {
  marketSummary: string;
  stats: MarketStat[];
  competitors: Competitor[];
  communitySummary: string;
  signals: Array<{
    quote: string;
    citation: { url: string; title: string };
    verified?: boolean;
  }>;
  goToMarket: {
    positioning: string;
    channels: string[];
    pricingNotes: string;
  };
  whyNow: string;
  howItWorks: string[];
  oneLiner: string;
  scores?: ResearchScores;
  editorial?: EditorialFields;
  /** Rows dropped because their numbers are not in the research text. */
  dropped: { stats: number; competitors: number };
};

/** Drop global SaaS/AI TAM rows — niche sizing only. */
const MEGA_TAM_STAT_RE =
  /global saas|worldwide saas|saas market.{0,40}\$\s?\d{2,4}|global ai (software|tools|market).{0,40}\$/i;

const LOCATION_CODE = 2840;
const LANGUAGE_CODE = "en";

/** Same shape the MDX auditor enforces (scripts/lib/idea-sections.mjs). */
export const SLUG_PATTERN = /^[a-z0-9-]+$/;

/** Minimum GTM channels the synthesis must supply; no canned fallback. */
export const MIN_CHANNELS = 2;

/**
 * Bounds on what one search step hands to synthesis. Together they keep the
 * synthesis input under its declared `maxInputTokens`, so the cap
 * reservation is a true worst case.
 */
const MAX_CITATIONS_PER_SEARCH = 8;

/** Scores the manifest publishes (convex/schema.ts requires all four). */
const PUBLISHED_SCORE_KEYS = [
  "opportunity",
  "pain",
  "timing",
  "builderConfidence",
] as const;
const MAX_SEARCH_TEXT_CHARS = 6_000;

/** Headroom for provider-side message framing tokens. */
const INPUT_FRAMING_TOKENS = 200;

/** Runs one billable provider call inside the cap (see runResearch). */
type Runner = <T>(
  position: number,
  fn: () => Promise<ProviderResult<T>>,
) => Promise<ProviderResult<T>>;

export class PipelineError extends Error {
  readonly stepId: string;
  readonly causeError?: unknown;

  constructor(stepId: string, message: string, cause?: unknown) {
    super(`[${stepId}] ${message}`);
    this.name = "PipelineError";
    this.stepId = stepId;
    this.causeError = cause;
  }
}

function slugify(title: string): string {
  const s = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return s.length > 0 ? s : "untitled-idea";
}

function briefContext(brief: NormalizedBrief): string {
  return [
    `Idea: ${brief.title}`,
    `Audience: ${brief.audience}`,
    `Business model: ${brief.model}`,
  ].join("\n");
}

function isRetryable(error: unknown): boolean {
  if (error instanceof ProviderConfigError) return false;
  if (error instanceof ProviderCallError) return error.retryable;
  return false;
}

/** Cap and pipeline errors pass through; anything else is tagged with the step. */
function stepError(stepId: string, fallback: string, error: unknown): Error {
  if (error instanceof CostCapExceededError) return error;
  if (error instanceof PipelineError) return error;
  return new PipelineError(
    stepId,
    error instanceof Error ? error.message : fallback,
    error,
  );
}

function costToCall(cost: ProviderCost, failed = false): ProviderCall {
  return {
    provider: cost.provider,
    operation: `${cost.role}:${cost.billedAs}${failed ? ":failed" : ""}`,
    costUsd: cost.usd,
  };
}

/**
 * Upper bound on input tokens: a token is never shorter than one UTF-8 byte.
 * Throws before the call when the input could exceed the step budget.
 */
function assertInputFits(position: number, ...parts: string[]): void {
  const step = stepAt(position);
  if (step.budget.role !== "synthesis" && step.budget.role !== "search") return;
  const bytes = parts.reduce(
    (sum, part) => sum + new TextEncoder().encode(part).length,
    0,
  );
  const limit = step.budget.maxInputTokens - INPUT_FRAMING_TOKENS;
  if (bytes > limit) {
    throw new PipelineError(
      step.id,
      `input of ${bytes} bytes exceeds the ${limit}-token budget for this step`,
    );
  }
}

function normalizeUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return parsed.href;
  } catch {
    return null;
  }
}

function parseJsonObject(text: string): Record<string, unknown> {
  // Tolerate optional markdown fences from the model.
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  const raw = fenced ? fenced[1].trim() : trimmed;
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("expected JSON object");
  }
  return parsed as Record<string, unknown>;
}

function normalizeBriefFromInput(input: BriefInput): NormalizedBrief {
  const title = input.title.trim();
  if (!title) throw new PipelineError("brief_normalization", "title required");
  const slug = (input.slug?.trim() || slugify(title)).toLowerCase();
  if (!SLUG_PATTERN.test(slug)) {
    throw new PipelineError(
      "brief_normalization",
      `slug '${slug}' must match ${SLUG_PATTERN}`,
    );
  }
  return {
    title,
    audience: input.audience.trim(),
    model: input.revenueModel.trim(),
    seedKeywords: input.seedKeywords.map((k) => k.trim()).filter(Boolean),
    slug,
    oneLiner: input.oneLiner?.trim() || title,
  };
}

const BRIEF_INSTRUCTIONS =
  "Normalize a startup idea into a brief. Reply with JSON only: " +
  '{"title","audience","model","seedKeywords":[]}. Do not invent ' +
  "market data, competitors, or metrics — later steps source those.";

async function stepBriefNormalization(
  providers: EngineProviders,
  run: Runner,
  input: BriefInput,
): Promise<NormalizedBrief> {
  const seed = normalizeBriefFromInput(input);
  const briefInput = [
    `Title: ${seed.title}`,
    `Audience: ${seed.audience}`,
    `Revenue model: ${seed.model}`,
    `Seed keywords: ${seed.seedKeywords.join(", ")}`,
  ].join("\n");
  assertInputFits(0, BRIEF_INSTRUCTIONS, briefInput);
  const result = await run(0, () =>
    providers.synthesis.complete({
      instructions: BRIEF_INSTRUCTIONS,
      input: briefInput,
      maxOutputTokens: synthesisOutputCap(0),
    }),
  );

  let parsed: Record<string, unknown>;
  try {
    parsed = parseJsonObject(result.value.text);
  } catch {
    // Fixture/live may return non-JSON on unexpected path; keep seeded brief.
    return seed;
  }

  const title =
    typeof parsed.title === "string" && parsed.title.trim()
      ? parsed.title.trim()
      : seed.title;
  // Prefer brief seed casing — models often lowercase "SMB SaaS".
  const audience = seed.audience.trim() ||
    (typeof parsed.audience === "string" ? parsed.audience.trim() : "");
  const model =
    typeof parsed.model === "string" && parsed.model.trim()
      ? parsed.model.trim()
      : seed.model;
  const seedKeywords = Array.isArray(parsed.seedKeywords)
    ? parsed.seedKeywords
        .filter((k): k is string => typeof k === "string")
        .map((k) => k.trim())
        .filter(Boolean)
    : seed.seedKeywords;

  return {
    title,
    audience,
    model,
    seedKeywords: seedKeywords.length > 0 ? seedKeywords : seed.seedKeywords,
    slug: seed.slug,
    oneLiner: seed.oneLiner,
  };
}

function synthesisOutputCap(position: number): number {
  const budget = stepAt(position).budget;
  if (budget.role !== "synthesis") {
    throw new Error(`step ${position} is not a synthesis step`);
  }
  return budget.maxOutputTokens;
}

async function stepSearch(
  providers: EngineProviders,
  run: Runner,
  position: number,
  query: string,
): Promise<SearchPack> {
  const budget = stepAt(position).budget;
  if (budget.role !== "search") {
    throw new Error(`step ${position} is not a search step`);
  }
  assertInputFits(position, query);
  const result = await run(position, () =>
    providers.search.search({
      query,
      searchContextSize: budget.searchContextSize,
      maxOutputTokens: budget.maxOutputTokens,
    }),
  );
  return {
    text: result.value.text.slice(0, MAX_SEARCH_TEXT_CHARS),
    citations: result.value.citations.slice(0, MAX_CITATIONS_PER_SEARCH),
  };
}

async function stepKeywords(
  providers: EngineProviders,
  run: Runner,
  seedKeywords: string[],
): Promise<KeywordMetric[]> {
  const budget = stepAt(4).budget;
  if (budget.role !== "keywordData") {
    throw new Error("step 4 is not the keyword step");
  }
  // Never send more keywords than the reservation assumed.
  const keywords = [...new Set(seedKeywords)].slice(0, budget.maxItems);
  if (keywords.length === 0) {
    throw new PipelineError(
      "keywords_demand",
      "brief produced no seed keywords",
    );
  }
  try {
    const result = await run(4, () =>
      providers.keywordData.lookup({
        keywords,
        locationCode: LOCATION_CODE,
        languageCode: LANGUAGE_CODE,
      }),
    );
    return result.value.metrics;
  } catch (error) {
    // Fail closed — never invent volume/CPC.
    throw stepError("keywords_demand", "keyword provider failed", error);
  }
}

/** Every URL a search step returned, keyed by normalized href. */
function citationIndex(packs: SearchPack[]): Map<string, Citation> {
  const index = new Map<string, Citation>();
  for (const pack of packs) {
    for (const c of pack.citations) {
      const href = normalizeUrl(c.url);
      if (href && !index.has(href)) index.set(href, { ...c, url: href });
    }
  }
  return index;
}

/**
 * Resolves a model-supplied URL to a citation the search steps returned.
 * Returns null for any URL the model did not get from search.
 */
function resolveCitation(
  index: Map<string, Citation>,
  url: unknown,
  title: unknown,
): { url: string; title: string } | null {
  if (typeof url !== "string") return null;
  const href = normalizeUrl(url.trim());
  if (!href) return null;
  const known = index.get(href);
  if (!known) return null;
  const modelTitle = typeof title === "string" ? title.trim() : "";
  return { url: href, title: modelTitle || known.title?.trim() || href };
}

/**
 * Competitor URLs: exact citation match first, then any indexed citation
 * whose hostname looks like the competitor's own site (so a /pricing page
 * the model slightly mistyped still binds to a real search result).
 */
function resolveCompetitorCitation(
  index: Map<string, Citation>,
  url: unknown,
  name: string,
): { url: string; title: string } | null {
  const roundup =
    /comparison|\/best-|\/top-|roundup|alternatives|vs-|\/blog-posts\//i;

  const usable = (href: string) => !roundup.test(href);

  const direct = resolveCitation(index, url, name);
  if (direct && usable(direct.url)) return direct;

  const needle = name
    .toLowerCase()
    .replace(/\.(ai|io|com|hq)$/i, "")
    .replace(/[^a-z0-9]/g, "");
  if (needle.length < 3) return null;

  for (const cite of index.values()) {
    if (!usable(cite.url)) continue;
    try {
      const host = new URL(cite.url).hostname.toLowerCase().replace(/^www\./, "");
      const hostKey = host.replace(/[^a-z0-9]/g, "");
      if (
        hostKey.includes(needle) ||
        needle.includes(hostKey.replace(/(ai|io|com|app|hq)$/, ""))
      ) {
        if (
          /(g2\.com|capterra|softwareadvice|selecthub|techradar|forbes|medium\.com|linkedin\.com)/i.test(
            host,
          )
        ) {
          continue;
        }
        return { url: cite.url, title: name };
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

function nonEmptyStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((v): v is string => typeof v === "string")
        .map((v) => v.trim())
        .filter(Boolean)
    : [];
}

/**
 * Numbers a figure depends on ("$1.8 billion", "20.2% CAGR", "$24/dev").
 * Thousands separators are dropped so "1,300" matches "1300".
 */
export function figureTokens(text: string): string[] {
  return (text.replace(/(\d),(?=\d{3}\b)/g, "$1").match(/\d+(?:\.\d+)?/g) ?? [])
    .filter((n) => n !== "0");
}

/**
 * True when every number in `figure` appears in the research text the model
 * was given. A stat or price whose numbers are nowhere in the search results
 * was invented by the model, so it never reaches a page.
 */
export function isGroundedFigure(figure: string, haystack: string): boolean {
  const tokens = figureTokens(figure);
  if (tokens.length === 0) return true;
  const hay = haystack.replace(/(\d),(?=\d{3}\b)/g, "$1");
  return tokens.every((t) =>
    new RegExp(`(?<![\\d.])${t.replace(".", "\\.")}(?![\\d]|\\.\\d)`).test(hay),
  );
}

/** Community quotes that must be found verbatim before a record is kept. */
export const MIN_VERIFIED_SIGNALS = 2;

/** Readable community pages needed before any keyword or synthesis spend. */
export const MIN_READABLE_SOURCES = 2;
/** Page text handed to synthesis so quotes are copied, not recalled. */
const SOURCE_EXCERPT_CHARS = 10_000;
const MAX_SOURCE_PAGES = 6;

type PageRead = { text: string | null; error?: string };

/**
 * Fetch each cited community page once. Runs right after the community
 * search, so a network that blocks the sources fails the run before
 * DataForSEO or the synthesis model is billed.
 */
export async function readCommunityPages(
  citations: Array<{ url: string }>,
  sourceText: SourceTextProvider,
): Promise<Map<string, PageRead>> {
  const urls = [...new Set(citations.map((c) => c.url))];
  const reads = await Promise.all(
    urls.map(async (url): Promise<[string, PageRead]> => {
      try {
        const text = await sourceText.fetchText(url);
        return [url, text.trim() ? { text } : { text: null, error: "empty page" }];
      } catch (error) {
        return [
          url,
          { text: null, error: error instanceof Error ? error.message : String(error) },
        ];
      }
    }),
  );
  return new Map(reads);
}

function utf8Bytes(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** Byte budget assertInputFits enforces for a step's whole input. */
function synthesisInputBudgetBytes(position: number): number {
  const budget = stepAt(position).budget;
  return budget.role === "synthesis"
    ? budget.maxInputTokens - INPUT_FRAMING_TOKENS
    : 0;
}

/** Cut text to at most `maxBytes` UTF-8 bytes without splitting a character. */
function sliceToBytes(text: string, maxBytes: number): string {
  if (utf8Bytes(text) <= maxBytes) return text;
  let out = "";
  let used = 0;
  for (const ch of text) {
    const n = utf8Bytes(ch);
    if (used + n > maxBytes) break;
    out += ch;
    used += n;
  }
  return out;
}

/** Below this, a page excerpt is too short to hold a quotable passage. */
const MIN_PAGE_EXCERPT_BYTES = 800;

/**
 * The "Community source pages" section, sized to the bytes left in the
 * synthesis budget. Headers, URLs and separators count; the remaining room
 * is split evenly across readable pages (each capped at
 * SOURCE_EXCERPT_CHARS), and pages that would get too little are dropped.
 */
export function buildSourcePagesSection(
  pages: Map<string, { text: string | null }>,
  availableBytes: number,
): string {
  const header =
    "## Community source pages (fetched text — copy every quote character-for-character from here, and cite that page's URL)\n";
  const separator = "\n\n";
  let readable = [...pages]
    .filter(([, p]) => p.text !== null)
    .slice(0, MAX_SOURCE_PAGES);
  // Leading "\n\n" joins the section to the rest of the input.
  const room = availableBytes - utf8Bytes(separator) - utf8Bytes(header);
  while (readable.length > 0) {
    const overhead = readable.reduce(
      (sum, [url]) => sum + utf8Bytes(`### ${url}\n`),
      utf8Bytes(separator) * (readable.length - 1),
    );
    const perPage = Math.floor((room - overhead) / readable.length);
    if (perPage >= MIN_PAGE_EXCERPT_BYTES) {
      const blocks = readable.map(
        ([url, p]) =>
          `### ${url}\n${sliceToBytes(p.text!.slice(0, SOURCE_EXCERPT_CHARS), perPage)}`,
      );
      return `${header}${blocks.join(separator)}`;
    }
    readable = readable.slice(0, -1);
  }
  return "";
}

/** Serve already-read pages from memory; fetch anything new. */
function cachedSourceText(
  pages: Map<string, PageRead>,
  sourceText: SourceTextProvider,
): SourceTextProvider {
  return {
    async fetchText(url: string): Promise<string> {
      const hit = pages.get(url);
      if (hit) {
        if (hit.text === null) throw new Error(hit.error ?? "unreadable");
        return hit.text;
      }
      return sourceText.fetchText(url);
    },
  };
}

/**
 * Fetch each cited page once and mark every quote verified or not. A page
 * that cannot be fetched leaves its quotes unverified — never assumed true.
 */
export async function verifySignals(
  signals: SynthesisPack["signals"],
  sourceText: SourceTextProvider,
): Promise<Array<SynthesisPack["signals"][number] & { verified: boolean }>> {
  const pages = new Map<string, Promise<string | null>>();
  const pageText = (url: string) => {
    let p = pages.get(url);
    if (!p) {
      p = sourceText.fetchText(url).catch(() => null);
      pages.set(url, p);
    }
    return p;
  };
  return Promise.all(
    signals.map(async (s) => {
      const text = await pageText(s.citation.url);
      return { ...s, verified: text !== null && quoteAppearsIn(s.quote, text) };
    }),
  );
}

/**
 * Evidence text per cited URL: the result's own snippet plus every sentence
 * of the search answer tagged with that result's `[n]` marker. A figure is
 * checked against the source it is attributed to, not against every search
 * result (or URLs and titles) at once. When an answer carries no markers at
 * all, attribution is impossible, so that one answer's text (never the
 * other searches) is added to each of its sources' snippets.
 */
export function citationEvidence(packs: SearchPack[]): Map<string, string> {
  const evidence = new Map<string, string[]>();
  const add = (href: string, text: string) =>
    evidence.set(href, [...(evidence.get(href) ?? []), text]);
  for (const pack of packs) {
    const clean = (t: string) => t.replace(/\[\d+\]/g, " ");
    const hrefs = pack.citations.map((c) => normalizeUrl(c.url) ?? c.url);
    pack.citations.forEach((c, i) => {
      if (c.snippet) add(hrefs[i]!, c.snippet);
      else if (!evidence.has(hrefs[i]!)) evidence.set(hrefs[i]!, []);
    });
    const tagged = /\[\d+\]/.test(pack.text);
    if (!tagged) {
      for (const href of hrefs) add(href, clean(pack.text));
      continue;
    }
    for (const sentence of pack.text.split(/(?<=[.!?])\s+|\n+/)) {
      for (const m of sentence.matchAll(/\[(\d+)\]/g)) {
        const href = hrefs[Number(m[1]) - 1];
        if (href) add(href, clean(sentence));
      }
    }
  }
  return new Map([...evidence].map(([href, parts]) => [href, parts.join("\n")]));
}

function parseSynthesisPack(
  text: string,
  market: SearchPack,
  competitors: SearchPack,
  community: SearchPack,
  brief: NormalizedBrief,
): SynthesisPack {
  let parsed: Record<string, unknown>;
  try {
    parsed = parseJsonObject(text);
  } catch {
    parsed = {};
  }

  const index = citationIndex([market, competitors, community]);
  const evidence = citationEvidence([market, competitors, community]);
  const groundedIn = (figure: string, url: string) =>
    isGroundedFigure(figure, evidence.get(url) ?? "");
  const dropped = { stats: 0, competitors: 0 };

  const statsFromModel = Array.isArray(parsed.stats) ? parsed.stats : [];
  const stats: MarketStat[] = [];
  for (const row of statsFromModel) {
    if (typeof row !== "object" || row === null) continue;
    const r = row as Record<string, unknown>;
    const claim = typeof r.claim === "string" ? r.claim.trim() : "";
    const value = typeof r.value === "string" ? r.value.trim() : "";
    const citation = resolveCitation(index, r.citationUrl, r.citationTitle);
    if (claim && value && citation) {
      if (MEGA_TAM_STAT_RE.test(`${claim} ${value}`)) continue;
      if (!groundedIn(`${claim} ${value}`, citation.url)) {
        dropped.stats += 1;
        continue;
      }
      stats.push({ claim, value, citation });
    }
  }

  const competitorsFromModel = Array.isArray(parsed.competitors)
    ? parsed.competitors
    : [];
  const competitorRows: Competitor[] = [];
  for (const row of competitorsFromModel) {
    if (typeof row !== "object" || row === null) continue;
    const r = row as Record<string, unknown>;
    const name = typeof r.name === "string" ? r.name.trim() : "";
    const pricing = typeof r.pricing === "string" ? r.pricing.trim() : "";
    const notes = typeof r.notes === "string" ? r.notes.trim() : undefined;
    const citation = resolveCompetitorCitation(index, r.url, name);
    if (name && pricing && citation && !groundedIn(pricing, citation.url)) {
      dropped.competitors += 1;
    } else if (name && pricing && citation) {
      competitorRows.push({
        name,
        pricing,
        url: citation.url,
        ...(notes ? { notes } : {}),
      });
    }
  }

  const signalsFromModel = Array.isArray(parsed.signals) ? parsed.signals : [];
  const signals: SynthesisPack["signals"] = [];
  for (const row of signalsFromModel) {
    if (typeof row !== "object" || row === null) continue;
    const r = row as Record<string, unknown>;
    const quote = typeof r.quote === "string" ? r.quote.trim() : "";
    const citation = resolveCitation(index, r.citationUrl, r.citationTitle);
    if (quote && citation) {
      signals.push({ quote, citation });
    }
  }

  const gtm =
    typeof parsed.goToMarket === "object" && parsed.goToMarket !== null
      ? (parsed.goToMarket as Record<string, unknown>)
      : {};

  let scores: ResearchScores | undefined;
  if (typeof parsed.scores === "object" && parsed.scores !== null) {
    const s = parsed.scores as Record<string, unknown>;
    scores = {};
    for (const key of [
      "opportunity",
      "pain",
      "timing",
      "builderConfidence",
      "execution",
    ] as const) {
      if (typeof s[key] === "number" && Number.isFinite(s[key])) {
        scores[key] = s[key];
      }
    }
    // The site's score contract needs all four published fields; a partial
    // set fails the Convex seed, so keep all or none.
    const complete = PUBLISHED_SCORE_KEYS.every(
      (key) => scores![key] !== undefined,
    );
    if (!complete) scores = undefined;
  }

  return {
    marketSummary:
      (typeof parsed.marketSummary === "string" && parsed.marketSummary.trim()) ||
      market.text.trim() ||
      "Market research gathered from cited sources.",
    stats,
    competitors: competitorRows,
    communitySummary:
      (typeof parsed.communitySummary === "string" &&
        parsed.communitySummary.trim()) ||
      community.text.trim() ||
      "Community signals gathered from cited sources.",
    signals,
    goToMarket: {
      positioning:
        (typeof gtm.positioning === "string" && gtm.positioning.trim()) ||
        brief.oneLiner,
      channels: nonEmptyStrings(gtm.channels),
      pricingNotes:
        (typeof gtm.pricingNotes === "string" && gtm.pricingNotes.trim()) ||
        brief.model,
    },
    whyNow: (typeof parsed.whyNow === "string" && parsed.whyNow.trim()) || "",
    howItWorks: nonEmptyStrings(parsed.howItWorks),
    oneLiner:
      (typeof parsed.oneLiner === "string" && parsed.oneLiner.trim()) ||
      brief.oneLiner,
    scores,
    editorial: parseEditorial(parsed),
    dropped,
  };
}

function parseEditorial(
  parsed: Record<string, unknown>,
): SynthesisPack["editorial"] {
  const raw =
    typeof parsed.editorial === "object" && parsed.editorial !== null
      ? (parsed.editorial as Record<string, unknown>)
      : parsed;
  const out: NonNullable<SynthesisPack["editorial"]> = {};
  for (const key of [
    "productName",
    "dontBuildYet",
    "problemNarrative",
    "solutionNarrative",
    "competitiveNarrative",
    "stackNotes",
    "audienceShort",
    "brandBrief",
  ] as const) {
    const v = raw[key];
    if (typeof v === "string" && v.trim()) out[key] = v.trim();
  }
  // Structured fields go through the record's own validators; a malformed
  // yearOne/dataModel is dropped here and the auditor then fails the page,
  // rather than the whole paid run failing on one bad sub-object.
  if (raw.yearOne !== undefined) {
    const yearOne = parseYearOne(raw.yearOne, []);
    if (yearOne) out.yearOne = yearOne;
  }
  if (raw.dataModel !== undefined) {
    const dataModel = parseDataModel(raw.dataModel, []);
    if (dataModel) out.dataModel = dataModel;
  }
  if (Array.isArray(raw.pricingTiers)) {
    const tiers: Array<{ name: string; price: string; includes: string }> = [];
    for (const row of raw.pricingTiers) {
      if (typeof row !== "object" || row === null) continue;
      const r = row as Record<string, unknown>;
      const name = typeof r.name === "string" ? r.name.trim() : "";
      const price = typeof r.price === "string" ? r.price.trim() : "";
      const includes = typeof r.includes === "string" ? r.includes.trim() : "";
      if (name && price && includes) tiers.push({ name, price, includes });
    }
    if (tiers.length > 0) out.pricingTiers = tiers;
  }
  if (Array.isArray(raw.unitEconomics)) {
    const rows: Array<{ label: string; value: string }> = [];
    for (const row of raw.unitEconomics) {
      if (typeof row !== "object" || row === null) continue;
      const r = row as Record<string, unknown>;
      const label = typeof r.label === "string" ? r.label.trim() : "";
      const value = typeof r.value === "string" ? r.value.trim() : "";
      if (label && value) rows.push({ label, value });
    }
    if (rows.length > 0) out.unitEconomics = rows;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function metricsToKeywordRows(metrics: KeywordMetric[]): KeywordRow[] {
  return metrics.map((m) => ({
    term: m.keyword,
    volume: m.searchVolume,
    competition: m.competition,
    cpc: m.cpcUsd,
    source: "provider" as const,
  }));
}

const SYNTHESIS_INSTRUCTIONS =
  "Score this idea using only the supplied research. Reply with JSON only. " +
  "Preserve audience casing from the brief (SMB SaaS, not smb saas). " +
  "Required keys: marketSummary (niche-focused, 180-280 words; NEVER quote global SaaS/AI TAM like $375B+), " +
  "stats[{claim,value,citationUrl,citationTitle}] (niche category stats only; drop mega TAM; copy every number exactly as the research writes it — values whose numbers are not in the research are discarded), " +
  "competitors[{name,pricing,url,notes}] (pricing copies the research's figures exactly — do not convert annual to monthly or round; url SHOULD be that company's own pricing or product page from the supplied citations — never invent a URL; prefer first-party over roundup blogs; notes ≥25 words each, unique per competitor), " +
  "communitySummary (≥100 words), signals[{quote,citationUrl,citationTitle}] (3-6 quotes, each copied character-for-character from the 'Community source pages' text with citationUrl set to that page — quotes not found on the page are discarded; never paraphrase), " +
  "goToMarket{positioning (≥40 words),channels,pricingNotes (≥60 words)}, whyNow, " +
  "howItWorks (3-5 strings each exactly 'Title — description' with a named Title, never 'Step 1'; each description ≥35 words), " +
  "oneLiner, scores{opportunity,pain,timing,builderConfidence,execution} (1-10; timing=market timing, execution=build feasibility), " +
  "editorial{productName (short brand name unique to THIS idea, not a reused brand from another idea, not 'an AI tool'), dontBuildYet (one sentence: what NOT to build yet), " +
  "problemNarrative (300-420 words, named buyers with proper casing, specific pain, no operator/meta notes), " +
  "solutionNarrative (220-320 words, named product + wedge), " +
  "competitiveNarrative (120-180 words, how THIS product differs from named competitors), " +
  "pricingTiers[{name,price,includes}] (2-4 tiers whose names fit THIS idea's buying motion — e.g. Audit / Pilot / Expansion, or Solo / Team — not a generic Starter/Team/Scale ladder; price strings start with a dollar figure or 'Free'; use the same names everywhere), " +
  "unitEconomics[{label,value}] (≥3 rows; value is the number first and ≤8 words, e.g. '$2.40 per developer per month'; label says what it measures in ≤12 words), stackNotes (≥60 words, product-specific), " +
  "audienceShort (2-5 word label for repeat mentions, e.g. 'small GitHub teams'; keep acronyms like SMB/SaaS uppercase), " +
  "brandBrief (50-90 words: visual direction and voice for THIS buyer, what the mark should signal, what to avoid; no generic 'modern and clean'), " +
  "yearOne{funnel[{stage,count}] (3-5 stages from named prospects to paying accounts, counts non-increasing, each stage names the channel), tier (one pricingTiers name), payingAccounts, monthlyRevenuePerAccount (USD number incl. seats), assumptions (1-2 sentences on why these rates are plausible)} — do NOT compute ARR; the compiler does it, " +
  "dataModel[{table,columns}] (3-6 snake_case tables specific to THIS product's workflow, e.g. pull_requests/findings for a code reviewer — exclude workspaces, members, usage_events, which always exist; columns as 'id, workspace_id fk, …' with types and check constraints where useful)}. " +
  "goToMarket.channels are customer-acquisition channels. Every citationUrl and competitor url must be copied exactly from a supplied citation; other URLs are discarded. " +
  "NEVER invent keyword volume or CPC. NEVER emit operator notes like 're-check before publish' or 'never model-invented'. " +
  "Do not reuse cross-idea padding phrases (no 'Success looks like a user finishing this step without opening a side doc', no 'passport stamp', no 'agency-scale SaaS year', no 'weekly questionnaire load').";

export type RunResearchOptions = {
  brief: BriefInput;
  providers: EngineProviders;
  /** Override for tests. */
  ranAt?: string;
  /**
   * Injected spend ceiling helper — tests can force a low remaining budget.
   * Defaults to real assertWithinCap.
   */
  assertCap?: typeof assertWithinCap;
};

/**
 * Run the seven-step research pipeline. Returns a parsed ResearchRecord.
 */
export async function runResearch(
  options: RunResearchOptions,
): Promise<ResearchRecord> {
  const { providers } = options;
  const checkCap = options.assertCap ?? assertWithinCap;
  const providerCalls: ProviderCall[] = [];
  let spentMicroUsd = 0;

  const reserve = (position: number) => {
    const step = stepAt(position);
    checkCap({
      spentMicroUsd,
      worstCaseMicroUsd: worstCaseMicroUsd(step.budget),
    });
  };

  const settle = (cost: ProviderCost, failed = false) => {
    providerCalls.push(costToCall(cost, failed));
    spentMicroUsd += toMicroUsd(cost.usd);
  };

  const settleFailure = (error: unknown) => {
    if (error instanceof ProviderCallError && error.cost) {
      settle(error.cost, true);
    }
  };

  // Reserve before every attempt (the retry is a second billable call) and
  // count billed failures, so the cap sees real spend.
  const run: Runner = async (position, fn) => {
    reserve(position);
    let result;
    try {
      result = await fn();
    } catch (error) {
      settleFailure(error);
      if (!isRetryable(error)) throw error;
      reserve(position);
      try {
        result = await fn();
      } catch (retryError) {
        settleFailure(retryError);
        throw retryError;
      }
    }
    settle(result.cost);
    return result;
  };

  // --- 0 brief_normalization ---
  let brief: NormalizedBrief;
  try {
    brief = await stepBriefNormalization(providers, run, options.brief);
  } catch (error) {
    throw stepError("brief_normalization", "brief normalization failed", error);
  }

  // --- 1 market_stats ---
  let market: SearchPack;
  try {
    market = await stepSearch(
      providers,
      run,
      1,
      `${briefContext(brief)}\n\nFind at least two NICHE market statistics with sources for this specific category (size, CAGR, or buyer spend in the segment). Do NOT cite global SaaS market, worldwide SaaS revenue, or generic AI software TAM ($100B+). Cite every figure.`,
    );
  } catch (error) {
    throw stepError("market_stats", "market search failed", error);
  }

  // --- 2 competitors ---
  let competitorsPack: SearchPack;
  try {
    competitorsPack = await stepSearch(
      providers,
      run,
      2,
      `${briefContext(brief)}\n\nIdentify at least three direct competitors with current plan prices. Prefer each vendor's own pricing or product page URL in your citations (company.com/pricing or product homepage). Avoid roundup/best-of blogs as the primary URL, but still return ≥3 named competitors with prices. Cite each.`,
    );
  } catch (error) {
    throw stepError("competitors", "competitors search failed", error);
  }

  // --- 3 community_signals ---
  let community: SearchPack;
  try {
    community = await stepSearch(
      providers,
      run,
      3,
      `${briefContext(brief)}\n\nFind pain evidence from real users on Reddit, Hacker News, and YouTube. Copy short VERBATIM quotes (do not rewrite) and link each source.`,
    );
  } catch (error) {
    throw stepError("community_signals", "community search failed", error);
  }

  // Read the cited community pages now (unpaid). If the sources are not
  // reachable from this network, stop before keywords and synthesis bill.
  let communityPages = new Map<string, PageRead>();
  if (providers.sourceText) {
    communityPages = await readCommunityPages(
      community.citations,
      providers.sourceText,
    );
    const readable = [...communityPages.values()].filter((p) => p.text !== null);
    if (readable.length < MIN_READABLE_SOURCES) {
      const reasons = [...communityPages]
        .filter(([, p]) => p.text === null)
        .map(([url, p]) => `${url} (${p.error})`)
        .join("; ");
      throw new PipelineError(
        "community_signals",
        `only ${readable.length}/${communityPages.size} cited community pages could be read; need ≥${MIN_READABLE_SOURCES} to verify quotes. Stopped before keyword and synthesis spend. Unreadable: ${reasons}`,
      );
    }
  }

  // --- 4 keywords_demand (fail closed) ---
  const keywords = metricsToKeywordRows(
    await stepKeywords(providers, run, brief.seedKeywords),
  );

  // --- 5 synthesis_scoring ---
  let synthesisText: string;
  try {
    const baseSections = [
      `## Market stats\n${JSON.stringify(market)}`,
      `## Competitors\n${JSON.stringify(competitorsPack)}`,
      `## Community signals\n${JSON.stringify(community)}`,
      `## Keywords (provider metrics only — do not invent volume/CPC)\n${JSON.stringify(keywords)}`,
    ];
    const baseInput = `${briefContext(brief)}\n\n${baseSections.join("\n\n")}`;
    const pagesSection = buildSourcePagesSection(
      communityPages,
      synthesisInputBudgetBytes(5) -
        utf8Bytes(SYNTHESIS_INSTRUCTIONS) -
        utf8Bytes(baseInput),
    );
    const input = pagesSection ? `${baseInput}\n\n${pagesSection}` : baseInput;
    assertInputFits(5, SYNTHESIS_INSTRUCTIONS, input);
    const result = await run(5, () =>
      providers.synthesis.complete({
        instructions: SYNTHESIS_INSTRUCTIONS,
        input,
        maxOutputTokens: synthesisOutputCap(5),
      }),
    );
    synthesisText = result.value.text;
  } catch (error) {
    throw stepError("synthesis_scoring", "synthesis failed", error);
  }

  // --- 6 provenance_parse (unpaid) ---
  const synth = parseSynthesisPack(
    synthesisText,
    market,
    competitorsPack,
    community,
    brief,
  );

  const shortfalls: string[] = [];
  if (synth.stats.length < MIN_MARKET_STATS) {
    shortfalls.push(
      `need ≥${MIN_MARKET_STATS} market stats citing a search result (got ${synth.stats.length}; ${synth.dropped.stats} dropped because their numbers are not in the search results)`,
    );
  }
  if (synth.competitors.length < MIN_COMPETITORS) {
    shortfalls.push(
      `need ≥${MIN_COMPETITORS} priced competitors citing a search result (got ${synth.competitors.length}; ${synth.dropped.competitors} dropped because their prices are not in the search results)`,
    );
  }
  if (synth.goToMarket.channels.length < MIN_CHANNELS) {
    shortfalls.push(
      `need ≥${MIN_CHANNELS} go-to-market channels (got ${synth.goToMarket.channels.length})`,
    );
  }
  if (synth.howItWorks.length < MIN_HOW_IT_WORKS_STEPS) {
    shortfalls.push(
      `need ≥${MIN_HOW_IT_WORKS_STEPS} howItWorks steps (got ${synth.howItWorks.length})`,
    );
  }
  if (!synth.whyNow) {
    shortfalls.push("synthesis returned no whyNow");
  }
  if (shortfalls.length > 0) {
    throw new PipelineError("provenance_parse", shortfalls.join("; "));
  }

  // --- quote verification (unpaid, part of provenance_parse) ---
  const signals = providers.sourceText
    ? await verifySignals(
        synth.signals,
        cachedSourceText(communityPages, providers.sourceText),
      )
    : synth.signals;
  if (providers.sourceText) {
    const verified = signals.filter((s) => s.verified).length;
    if (verified < MIN_VERIFIED_SIGNALS) {
      const missed = signals
        .filter((s) => !s.verified)
        .map((s) => `"${s.quote.slice(0, 60)}" (${s.citation.url})`)
        .join("; ");
      throw new PipelineError(
        "provenance_parse",
        `quote verification: ${verified}/${signals.length} community quotes found verbatim on their cited pages; need ≥${MIN_VERIFIED_SIGNALS}. Not found: ${missed}`,
      );
    }
  }

  const draft = {
    contractVersion: RESEARCH_RECORD_CONTRACT_VERSION,
    brief: {
      title: brief.title,
      slug: brief.slug,
      oneLiner: synth.oneLiner,
      targetCustomer: brief.audience,
    },
    market: {
      summary: synth.marketSummary,
      stats: synth.stats,
    },
    competitors: synth.competitors,
    community: {
      summary: synth.communitySummary,
      signals,
    },
    keywords,
    goToMarket: synth.goToMarket,
    whyNow: synth.whyNow,
    howItWorks: synth.howItWorks,
    ...(synth.scores ? { scores: synth.scores } : {}),
    ...(synth.editorial ? { editorial: synth.editorial } : {}),
    provenance: {
      providerCalls,
      costUsd: fromMicroUsd(spentMicroUsd),
      ranAt: options.ranAt ?? new Date().toISOString(),
    },
  };

  try {
    return parseResearchRecord(draft);
  } catch (error) {
    throw stepError("provenance_parse", "ResearchRecord parse failed", error);
  }
}

/** Exported for tests that need to see the step table. */
export { PIPELINE, stepAt };
