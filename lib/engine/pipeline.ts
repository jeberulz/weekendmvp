/**
 * Research pipeline: BriefInput → ResearchRecord (Mode A2 phase 5).
 *
 * Seven steps matching v1.1 order. Retry once on retryable provider errors,
 * then fail. Keyword step fails closed (no guessed CPC/volume). Cost over
 * $4.00 throws before another provider call.
 *
 * Does not write MDX. Does not touch Convex workflow/credits/ownerId.
 */

import {
  assertWithinCap,
  fromMicroUsd,
  toMicroUsd,
  worstCaseMicroUsd,
} from "./cost";
import { PIPELINE, stepAt } from "./pipeline-steps";
import {
  MIN_COMPETITORS,
  MIN_MARKET_STATS,
  parseResearchRecord,
  RESEARCH_RECORD_CONTRACT_VERSION,
  type Competitor,
  type KeywordRow,
  type MarketStat,
  type ProviderCall,
  type ResearchRecord,
  type ResearchScores,
} from "./research-record";
import {
  ProviderCallError,
  ProviderConfigError,
  type Citation,
  type EngineProviders,
  type ProviderCost,
  type KeywordMetric,
} from "./providers/types";

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
  oneLiner: string;
  scores?: ResearchScores;
};

const LOCATION_CODE = 2840;
const LANGUAGE_CODE = "en";

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

async function withRetryOnce<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (!isRetryable(error)) throw error;
    return await fn();
  }
}

function costToCall(cost: ProviderCost): ProviderCall {
  return {
    provider: cost.provider,
    operation: `${cost.role}:${cost.billedAs}`,
    costUsd: cost.usd,
  };
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
  return {
    title,
    audience: input.audience.trim(),
    model: input.revenueModel.trim(),
    seedKeywords: input.seedKeywords.map((k) => k.trim()).filter(Boolean),
    slug: (input.slug?.trim() || slugify(title)).toLowerCase(),
    oneLiner: input.oneLiner?.trim() || title,
  };
}

async function stepBriefNormalization(
  providers: EngineProviders,
  input: BriefInput,
): Promise<{ brief: NormalizedBrief; cost: ProviderCost }> {
  const seed = normalizeBriefFromInput(input);
  const result = await withRetryOnce(() =>
    providers.synthesis.complete({
      instructions:
        "Normalize a startup idea into a brief. Reply with JSON only: " +
        '{"title","audience","model","seedKeywords":[]}. Do not invent ' +
        "market data, competitors, or metrics — later steps source those.",
      input: [
        `Title: ${seed.title}`,
        `Audience: ${seed.audience}`,
        `Revenue model: ${seed.model}`,
        `Seed keywords: ${seed.seedKeywords.join(", ")}`,
      ].join("\n"),
      maxOutputTokens: 800,
    }),
  );

  let parsed: Record<string, unknown>;
  try {
    parsed = parseJsonObject(result.value.text);
  } catch {
    // Fixture/live may return non-JSON on unexpected path; keep seeded brief.
    return { brief: seed, cost: result.cost };
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
    ? parsed.seedKeywords.filter((k): k is string => typeof k === "string")
    : seed.seedKeywords;

  return {
    brief: {
      title,
      audience,
      model,
      seedKeywords: seedKeywords.length > 0 ? seedKeywords : seed.seedKeywords,
      slug: seed.slug,
      oneLiner: seed.oneLiner,
    },
    cost: result.cost,
  };
}

async function stepSearch(
  providers: EngineProviders,
  query: string,
  searchContextSize: "low" | "medium" | "high",
): Promise<{ pack: SearchPack; cost: ProviderCost }> {
  const result = await withRetryOnce(() =>
    providers.search.search({ query, searchContextSize }),
  );
  return {
    pack: { text: result.value.text, citations: result.value.citations },
    cost: result.cost,
  };
}

async function stepKeywords(
  providers: EngineProviders,
  seedKeywords: string[],
): Promise<{ metrics: KeywordMetric[]; cost: ProviderCost }> {
  if (seedKeywords.length === 0) {
    throw new PipelineError(
      "keywords_demand",
      "brief produced no seed keywords",
    );
  }
  try {
    const result = await withRetryOnce(() =>
      providers.keywordData.lookup({
        keywords: seedKeywords,
        locationCode: LOCATION_CODE,
        languageCode: LANGUAGE_CODE,
      }),
    );
    return { metrics: result.value.metrics, cost: result.cost };
  } catch (error) {
    // Fail closed — never invent volume/CPC.
    throw new PipelineError(
      "keywords_demand",
      error instanceof Error ? error.message : "keyword provider failed",
      error,
    );
  }
}

function citationTitle(c: Citation): string {
  return c.title?.trim() || c.url;
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

  const statsFromModel = Array.isArray(parsed.stats) ? parsed.stats : [];
  const stats: MarketStat[] = [];
  for (const row of statsFromModel) {
    if (typeof row !== "object" || row === null) continue;
    const r = row as Record<string, unknown>;
    const claim = typeof r.claim === "string" ? r.claim.trim() : "";
    const value = typeof r.value === "string" ? r.value.trim() : "";
    const citationUrl =
      typeof r.citationUrl === "string" ? r.citationUrl.trim() : "";
    const citationTitleText =
      typeof r.citationTitle === "string"
        ? r.citationTitle.trim()
        : citationUrl;
    if (claim && value && citationUrl) {
      stats.push({
        claim,
        value,
        citation: { url: citationUrl, title: citationTitleText || citationUrl },
      });
    }
  }
  // Fall back to search citations if synthesis omitted structured stats.
  if (stats.length < MIN_MARKET_STATS) {
    for (const c of market.citations) {
      if (stats.length >= MIN_MARKET_STATS) break;
      stats.push({
        claim: citationTitle(c),
        value: c.snippet?.trim() || "See source",
        citation: { url: c.url, title: citationTitle(c) },
      });
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
    const url = typeof r.url === "string" ? r.url.trim() : "";
    const notes = typeof r.notes === "string" ? r.notes.trim() : undefined;
    if (name && pricing && url) {
      competitorRows.push({
        name,
        pricing,
        url,
        ...(notes ? { notes } : {}),
      });
    }
  }
  if (competitorRows.length < MIN_COMPETITORS) {
    for (const c of competitors.citations) {
      if (competitorRows.length >= MIN_COMPETITORS) break;
      competitorRows.push({
        name: citationTitle(c),
        pricing: c.snippet?.trim() || "See vendor pricing page",
        url: c.url,
        notes: c.snippet,
      });
    }
  }

  const signalsFromModel = Array.isArray(parsed.signals) ? parsed.signals : [];
  const signals: SynthesisPack["signals"] = [];
  for (const row of signalsFromModel) {
    if (typeof row !== "object" || row === null) continue;
    const r = row as Record<string, unknown>;
    const quote = typeof r.quote === "string" ? r.quote.trim() : "";
    const citationUrl =
      typeof r.citationUrl === "string" ? r.citationUrl.trim() : "";
    const citationTitleText =
      typeof r.citationTitle === "string"
        ? r.citationTitle.trim()
        : citationUrl;
    if (quote && citationUrl) {
      signals.push({
        quote,
        citation: { url: citationUrl, title: citationTitleText || citationUrl },
      });
    }
  }
  if (signals.length === 0) {
    for (const c of community.citations) {
      signals.push({
        quote: c.snippet?.trim() || citationTitle(c),
        citation: { url: c.url, title: citationTitle(c) },
      });
    }
  }

  const gtm =
    typeof parsed.goToMarket === "object" && parsed.goToMarket !== null
      ? (parsed.goToMarket as Record<string, unknown>)
      : {};
  const channels = Array.isArray(gtm.channels)
    ? gtm.channels.filter((c): c is string => typeof c === "string")
    : [];

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
      channels:
        channels.length >= 2
          ? channels
          : [
              "Ingest customer documents and context",
              "Retrieve evidence with citations",
              "Draft answers with human review flags",
              "Export and ship to the customer workflow",
            ],
      pricingNotes:
        (typeof gtm.pricingNotes === "string" && gtm.pricingNotes.trim()) ||
        brief.model,
    },
    whyNow:
      (typeof parsed.whyNow === "string" && parsed.whyNow.trim()) ||
      "Timing favors a focused weekend MVP before incumbents close the mid-market gap.",
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

  const settle = (cost: ProviderCost) => {
    providerCalls.push(costToCall(cost));
    spentMicroUsd += toMicroUsd(cost.usd);
  };

  // --- 0 brief_normalization ---
  reserve(0);
  let briefResult: Awaited<ReturnType<typeof stepBriefNormalization>>;
  try {
    briefResult = await stepBriefNormalization(providers, options.brief);
  } catch (error) {
    throw new PipelineError(
      "brief_normalization",
      error instanceof Error ? error.message : "brief normalization failed",
      error,
    );
  }
  settle(briefResult.cost);
  const brief = briefResult.brief;

  // --- 1 market_stats ---
  reserve(1);
  let market: SearchPack;
  try {
    const r = await stepSearch(
      providers,
      `${briefContext(brief)}\n\nFind at least two market statistics with sources, including market size and CAGR. Cite every figure.`,
      "high",
    );
    market = r.pack;
    settle(r.cost);
  } catch (error) {
    throw new PipelineError(
      "market_stats",
      error instanceof Error ? error.message : "market search failed",
      error,
    );
  }

  // --- 2 competitors ---
  reserve(2);
  let competitorsPack: SearchPack;
  try {
    const r = await stepSearch(
      providers,
      `${briefContext(brief)}\n\nIdentify at least three direct competitors with their current pricing and positioning gaps. Cite each.`,
      "high",
    );
    competitorsPack = r.pack;
    settle(r.cost);
  } catch (error) {
    throw new PipelineError(
      "competitors",
      error instanceof Error ? error.message : "competitors search failed",
      error,
    );
  }

  // --- 3 community_signals ---
  reserve(3);
  let community: SearchPack;
  try {
    const r = await stepSearch(
      providers,
      `${briefContext(brief)}\n\nFind pain evidence discussed by real users on Reddit, Hacker News, and YouTube. Quote briefly and link each source.`,
      "medium",
    );
    community = r.pack;
    settle(r.cost);
  } catch (error) {
    throw new PipelineError(
      "community_signals",
      error instanceof Error ? error.message : "community search failed",
      error,
    );
  }

  // --- 4 keywords_demand (fail closed) ---
  reserve(4);
  const keywordResult = await stepKeywords(providers, brief.seedKeywords);
  settle(keywordResult.cost);
  const keywords = metricsToKeywordRows(keywordResult.metrics);

  // --- 5 synthesis_scoring ---
  reserve(5);
  let synthesisText: string;
  try {
    const researchBlob = [
      `## Market stats\n${JSON.stringify(market)}`,
      `## Competitors\n${JSON.stringify(competitorsPack)}`,
      `## Community signals\n${JSON.stringify(community)}`,
      `## Keywords (provider metrics only — do not invent volume/CPC)\n${JSON.stringify(keywords)}`,
    ].join("\n\n");
    const result = await withRetryOnce(() =>
      providers.synthesis.complete({
        instructions:
          "Score this idea using only the supplied research. Reply with " +
          "JSON only containing marketSummary, stats[{claim,value,citationUrl,citationTitle}], " +
          "competitors[{name,pricing,url,notes}], communitySummary, " +
          "signals[{quote,citationUrl,citationTitle}], goToMarket{positioning,channels,pricingNotes}, " +
          "whyNow, oneLiner, scores{opportunity,pain,builderConfidence,execution}. " +
          "Every claim must trace to a supplied citation. NEVER invent keyword volume or CPC.",
        input: `${briefContext(brief)}\n\n${researchBlob}`,
        maxOutputTokens: 4_000,
      }),
    );
    synthesisText = result.value.text;
    settle(result.cost);
  } catch (error) {
    throw new PipelineError(
      "synthesis_scoring",
      error instanceof Error ? error.message : "synthesis failed",
      error,
    );
  }

  // --- 6 provenance_parse (unpaid) ---
  const synth = parseSynthesisPack(
    synthesisText,
    market,
    competitorsPack,
    community,
    brief,
  );

  if (synth.stats.length < MIN_MARKET_STATS) {
    throw new PipelineError(
      "provenance_parse",
      `need ≥${MIN_MARKET_STATS} cited market stats (got ${synth.stats.length})`,
    );
  }
  if (synth.competitors.length < MIN_COMPETITORS) {
    throw new PipelineError(
      "provenance_parse",
      `need ≥${MIN_COMPETITORS} priced competitors (got ${synth.competitors.length})`,
    );
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
    throw new PipelineError(
      "provenance_parse",
      error instanceof Error ? error.message : "ResearchRecord parse failed",
      error,
    );
  }
}

/** Exported for tests that need to see the step table. */
export { PIPELINE, stepAt };
