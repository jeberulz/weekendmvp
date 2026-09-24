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
  signals: Array<{ quote: string; citation: { url: string; title: string } }>;
  goToMarket: {
    positioning: string;
    channels: string[];
    pricingNotes: string;
  };
  whyNow: string;
  howItWorks: string[];
  oneLiner: string;
  scores?: ResearchScores;
};

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
  const audience =
    typeof parsed.audience === "string" && parsed.audience.trim()
      ? parsed.audience.trim()
      : seed.audience;
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

function nonEmptyStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((v): v is string => typeof v === "string")
        .map((v) => v.trim())
        .filter(Boolean)
    : [];
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

  const statsFromModel = Array.isArray(parsed.stats) ? parsed.stats : [];
  const stats: MarketStat[] = [];
  for (const row of statsFromModel) {
    if (typeof row !== "object" || row === null) continue;
    const r = row as Record<string, unknown>;
    const claim = typeof r.claim === "string" ? r.claim.trim() : "";
    const value = typeof r.value === "string" ? r.value.trim() : "";
    const citation = resolveCitation(index, r.citationUrl, r.citationTitle);
    if (claim && value && citation) {
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
    const citation = resolveCitation(index, r.url, name);
    if (name && pricing && citation) {
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
      "builderConfidence",
      "execution",
    ] as const) {
      if (typeof s[key] === "number" && Number.isFinite(s[key])) {
        scores[key] = s[key];
      }
    }
    if (Object.keys(scores).length === 0) scores = undefined;
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
  };
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
  "Score this idea using only the supplied research. Reply with " +
  "JSON only containing marketSummary, stats[{claim,value,citationUrl,citationTitle}], " +
  "competitors[{name,pricing,url,notes}], communitySummary, " +
  "signals[{quote,citationUrl,citationTitle}], goToMarket{positioning,channels,pricingNotes}, " +
  "whyNow, howItWorks, oneLiner, scores{opportunity,pain,builderConfidence,execution}. " +
  "goToMarket.channels are customer-acquisition channels. howItWorks is 3-5 short " +
  "steps describing how a user moves through the product. Every citationUrl and " +
  "competitor url must be copied exactly from a supplied citation; rows with any " +
  "other URL are discarded. Quotes must come from the supplied community research. " +
  "NEVER invent keyword volume or CPC.";

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
      `${briefContext(brief)}\n\nFind at least two market statistics with sources, including market size and CAGR. Cite every figure.`,
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
      `${briefContext(brief)}\n\nIdentify at least three direct competitors with their current pricing and positioning gaps. Cite each.`,
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
      `${briefContext(brief)}\n\nFind pain evidence discussed by real users on Reddit, Hacker News, and YouTube. Quote briefly and link each source.`,
    );
  } catch (error) {
    throw stepError("community_signals", "community search failed", error);
  }

  // --- 4 keywords_demand (fail closed) ---
  const keywords = metricsToKeywordRows(
    await stepKeywords(providers, run, brief.seedKeywords),
  );

  // --- 5 synthesis_scoring ---
  let synthesisText: string;
  try {
    const researchBlob = [
      `## Market stats\n${JSON.stringify(market)}`,
      `## Competitors\n${JSON.stringify(competitorsPack)}`,
      `## Community signals\n${JSON.stringify(community)}`,
      `## Keywords (provider metrics only — do not invent volume/CPC)\n${JSON.stringify(keywords)}`,
    ].join("\n\n");
    const input = `${briefContext(brief)}\n\n${researchBlob}`;
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
      `need ≥${MIN_MARKET_STATS} market stats citing a search result (got ${synth.stats.length})`,
    );
  }
  if (synth.competitors.length < MIN_COMPETITORS) {
    shortfalls.push(
      `need ≥${MIN_COMPETITORS} priced competitors citing a search result (got ${synth.competitors.length})`,
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
      signals: synth.signals,
    },
    keywords,
    goToMarket: synth.goToMarket,
    whyNow: synth.whyNow,
    howItWorks: synth.howItWorks,
    ...(synth.scores ? { scores: synth.scores } : {}),
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
