/**
 * Pipeline tests (PIPELINE_VERSION 2). Fixture providers only: no network,
 * no keys, no spend.
 */

import { describe, expect, it } from "vitest";

import {
  CAP_MICRO_USD,
  CostCapExceededError,
  worstCaseMicroUsd,
  worstCaseRunMicroUsd,
} from "./cost.ts";
import { EVIDENCE_MINIMUMS } from "./evidence/contract.ts";
import { PipelineError, runResearch, type BriefInput } from "./pipeline.ts";
import { PIPELINE, PIPELINE_STEP_IDS, PIPELINE_VERSION } from "./pipeline-steps.ts";
import { createProviders } from "./providers.ts";
import {
  createFixtureProviders,
  FIXTURE_BRIEF_SLUG,
  FIXTURE_EXTRACTION,
  FIXTURE_PAGES,
  FIXTURE_URLS,
  fixtureSearchFetch,
  SEARCH_MARKET_FIXTURE,
} from "./providers/fixtures.ts";
import type { Fetcher } from "./providers/openai.ts";
import { createSearchProvider } from "./providers/perplexity.ts";
import type { EngineProviders, SynthesisRequest } from "./providers/types.ts";
import { parseResearchRecordV2 } from "./research-record.ts";

const RFP_BRIEF: BriefInput = {
  title: "AI RFP Response Assistant",
  audience: "SMB SaaS sales and solutions engineers",
  revenueModel: "Seat-based SaaS with usage caps",
  seedKeywords: ["rfp response software", "security questionnaire automation", "proposal management software"],
  slug: "ai-rfp-response-assistant",
  oneLiner: "Grounded RFP drafts with citations for SMB sales teams.",
};

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

/** Record every synthesis request; returns the captured list. */
function captureSynthesis(providers: EngineProviders): SynthesisRequest[] {
  const seen: SynthesisRequest[] = [];
  const real = providers.synthesis;
  providers.synthesis = {
    ...real,
    complete: (request) => {
      seen.push(request);
      return real.complete(request);
    },
  };
  return seen;
}

async function failureOf(promise: Promise<unknown>): Promise<PipelineError> {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  if (!(error instanceof PipelineError)) throw new Error(`expected a PipelineError, got ${String(error)}`);
  return error;
}

describe("step table (PIPELINE_VERSION 2)", () => {
  it("accepts evidence before keyword and editorial spend", () => {
    expect(PIPELINE_VERSION).toBe(2);
    expect(PIPELINE_STEP_IDS).toEqual([
      "brief_normalization",
      "market_stats",
      "competitors",
      "community_signals",
      "evidence_extraction",
      "keywords_demand",
      "editorial_synthesis",
      "provenance_parse",
    ]);
    expect(PIPELINE.map((s) => s.id)).toEqual([...PIPELINE_STEP_IDS]);
    expect(PIPELINE.map((s) => s.position)).toEqual(PIPELINE.map((_, i) => i));
  });

  it("bounds the billable attempts of every paid step", () => {
    expect(Object.fromEntries(PIPELINE.map((s) => [s.id, s.maxAttempts]))).toEqual({
      brief_normalization: 2,
      market_stats: 2,
      competitors: 2,
      community_signals: 4,
      evidence_extraction: 2,
      keywords_demand: 2,
      editorial_synthesis: 2,
      provenance_parse: 0,
    });
  });

  it("keeps the worst case of every allowed billable attempt under the $4.00 cap ($3.262)", () => {
    const worst = worstCaseRunMicroUsd(PIPELINE);
    expect(worst).toBe(PIPELINE.reduce((sum, s) => sum + s.maxAttempts * worstCaseMicroUsd(s.budget), 0));
    expect(worst).toBeLessThanOrEqual(CAP_MICRO_USD);
    // Pinned so any budget or attempt change is a deliberate, reviewed edit.
    expect(worst).toBe(3_262_000);
  });
});

describe("runResearch (fixture)", () => {
  it("produces a v2 record and a run report from accepted evidence", async () => {
    const { record, report } = await runResearch({
      brief: RFP_BRIEF,
      providers: createProviders({ mode: "fixture" }),
      mode: "fixture",
      ranAt: "2026-10-01T00:00:00.000Z",
    });
    // Round trip through the fail-closed v2 parser.
    const again = parseResearchRecordV2(JSON.parse(JSON.stringify(record)));
    expect(again).toEqual(record);
    expect(record.mode).toBe("fixture");
    expect(record.brief.slug).toBe(FIXTURE_BRIEF_SLUG);
    expect(record.market.statIds.length).toBeGreaterThanOrEqual(EVIDENCE_MINIMUMS.marketStats);
    expect(record.competitors.length).toBeGreaterThanOrEqual(EVIDENCE_MINIMUMS.pricedCompetitors);
    expect(record.community.quoteIds.length).toBeGreaterThanOrEqual(EVIDENCE_MINIMUMS.distinctQuotes);
    expect(record.keywords.every((k) => k.source === "provider")).toBe(true);
    expect(record.provenance.ranAt).toBe("2026-10-01T00:00:00.000Z");
    expect(record.provenance.costUsd).toBeGreaterThan(0);
    expect(record.provenance.models).toEqual({
      synthesis: "gpt-5.6-sol",
      search: "perplexity:sonar-pro",
      keywordData: "dataforseo",
    });
    expect(record.provenance.attempts).toEqual({
      brief_normalization: 1,
      market_stats: 1,
      competitors: 1,
      community_signals: 1,
      evidence_extraction: 1,
      keywords_demand: 1,
      editorial_synthesis: 1,
    });
    expect(record.provenance.providerCalls.map((c) => c.operation.split("/")[0])).toEqual([
      "brief_normalization",
      "market_stats",
      "competitors",
      "community_signals",
      "evidence_extraction",
      "keywords_demand",
      "editorial_synthesis",
    ]);

    expect(report.ok).toBe(true);
    expect(report.mode).toBe("fixture");
    expect(report.pipelineVersion).toBe(2);
    expect(report.recordContractVersion).toBe(2);
    expect(report.briefSlug).toBe(FIXTURE_BRIEF_SLUG);
    expect(report.briefSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(report.failedStep).toBeUndefined();
    expect(report.costUsd).toBe(record.provenance.costUsd);
    expect(report.evidence.accepted).toEqual({ community_quote: 3, market_stat: 3, competitor_price: 3 });
    expect(report.evidence.rejected.map((r) => r.reason).sort()).toEqual(["source_unreadable", "span_not_found"]);
    expect(report.sources.map((s) => s.status)).toEqual(record.evidence.sources.map((s) => s.status));
  });

  it("records one source per distinct URL with the roles of the searches that cited it", async () => {
    const { record } = await runResearch({ brief: RFP_BRIEF, providers: createProviders({ mode: "fixture" }), mode: "fixture" });
    const byUrl = new Map(record.evidence.sources.map((s) => [s.url, s]));
    expect(byUrl.get(FIXTURE_URLS.marketReport)?.roles).toEqual(["market"]);
    expect(byUrl.get("https://bidwell.example/pricing")?.roles).toEqual(["competitors"]);
    expect(byUrl.get(FIXTURE_URLS.hnThread)?.roles).toEqual(["community"]);
    const reddit = byUrl.get("https://www.reddit.com/r/sales/comments/abc123/rfp_weekends");
    expect(reddit?.status).toBe("unreadable");
    expect(reddit?.retrievedAt).toBeUndefined();
    expect(new Set(record.evidence.sources.map((s) => s.url)).size).toBe(record.evidence.sources.length);
  });

  it("fails closed when the keyword provider fails: no record, no editorial call", async () => {
    const providers = createFixtureProviders({
      keywordPayload: { status_code: 20000, tasks: [{ status_code: 20000, result: [] }] },
    });
    const requests = captureSynthesis(providers);
    const error = await failureOf(runResearch({ brief: RFP_BRIEF, providers, mode: "fixture" }));
    expect(error.stepId).toBe("keywords_demand");
    expect(error.report?.ok).toBe(false);
    expect(error.report?.failedStep).toBe("keywords_demand");
    expect(String(error)).not.toMatch(/guess|invent|estimate/i);
    expect(requests.filter((r) => /editorial research record/.test(r.instructions))).toHaveLength(0);
  });

  it("stops before any provider call when the cap refuses the first reservation", async () => {
    const providers = createProviders({ mode: "fixture" });
    const requests = captureSynthesis(providers);
    const error = await failureOf(
      runResearch({
        brief: RFP_BRIEF,
        providers,
        mode: "fixture",
        assertCap: () => {
          throw new CostCapExceededError(3_900_000, 200_000);
        },
      }),
    );
    expect(error.causeError).toBeInstanceOf(CostCapExceededError);
    expect(error.stepId).toBe("brief_normalization");
    expect(error.report?.providerCalls).toEqual([]);
    expect(error.report?.error).toMatch(/cost cap/);
    expect(requests).toHaveLength(0);
  });

  it("rejects a slug that could escape content/ideas before any paid call", async () => {
    const providers = createProviders({ mode: "fixture" });
    const requests = captureSynthesis(providers);
    const error = await failureOf(
      runResearch({ brief: { ...RFP_BRIEF, slug: "../../etc/evil" }, providers, mode: "fixture" }),
    );
    expect(error.stepId).toBe("brief_normalization");
    expect(error.message).toMatch(/must match/);
    expect(requests).toHaveLength(0);
  });

  it("refuses an input larger than the step budget before calling", async () => {
    const providers = createProviders({ mode: "fixture" });
    const requests = captureSynthesis(providers);
    const error = await failureOf(
      runResearch({ brief: { ...RFP_BRIEF, audience: "x".repeat(5_000) }, providers, mode: "fixture" }),
    );
    expect(error.stepId).toBe("brief_normalization");
    expect(error.message).toMatch(/exceeds the .*-token budget/);
    expect(requests).toHaveLength(0);
  });

  it("sends each search step's output-token cap", async () => {
    const providers = createProviders({ mode: "fixture" });
    const seen: number[] = [];
    const fallback = fixtureSearchFetch();
    const fetchImpl = (async (input, init) => {
      const body: unknown = JSON.parse(String(init?.body ?? "{}"));
      if (typeof body === "object" && body !== null && "max_tokens" in body && typeof body.max_tokens === "number") {
        seen.push(body.max_tokens);
      }
      return fallback(input, init);
    }) as Fetcher;
    providers.search = createSearchProvider({ fetchImpl, apiKey: "fixture-mode" });
    await runResearch({ brief: RFP_BRIEF, providers, mode: "fixture" });
    expect(seen).toEqual([2_000, 2_000, 2_000]);
  });

  it("reserves before the retry and counts the billed failed attempt", async () => {
    const providers = createProviders({ mode: "fixture" });
    let marketCalls = 0;
    const fallback = fixtureSearchFetch();
    const fetchImpl = (async (input, init) => {
      const query = String(init?.body ?? "");
      if (/market statistics/i.test(query) && marketCalls++ === 0) {
        // Billed 200 with no usable citations.
        return jsonResponse({ ...SEARCH_MARKET_FIXTURE, search_results: [], citations: [] });
      }
      return fallback(input, init);
    }) as Fetcher;
    providers.search = createSearchProvider({ fetchImpl, apiKey: "fixture-mode" });

    const reservations: number[] = [];
    const { record } = await runResearch({
      brief: RFP_BRIEF,
      providers,
      mode: "fixture",
      assertCap: ({ spentMicroUsd }) => {
        reservations.push(spentMicroUsd);
      },
    });

    // brief, market ×2, competitors, community, extraction, keywords, editorial
    expect(reservations).toHaveLength(8);
    expect(record.provenance.attempts.market_stats).toBe(2);
    const failed = record.provenance.providerCalls.filter((c) => c.operation.endsWith(":failed"));
    expect(failed.map((c) => c.operation)).toEqual(["market_stats/search:sonar-pro:failed"]);
    expect(failed[0]?.costUsd).toBeGreaterThan(0);
    // The failed attempt's cost is in the spend the retry reservation sees.
    expect(reservations[2]).toBeGreaterThan(reservations[1] ?? Infinity);
    const total = record.provenance.providerCalls.reduce((sum, c) => sum + c.costUsd, 0);
    expect(record.provenance.costUsd).toBeCloseTo(total, 5);
  });

  it("runs the non-Reddit supplement when fewer than two community pages can be read", async () => {
    const pages = { ...FIXTURE_PAGES };
    delete pages[FIXTURE_URLS.hnThread];
    delete pages[FIXTURE_URLS.forumThread];
    const extraction = {
      ...FIXTURE_EXTRACTION,
      quotes: [
        {
          sourceUrl: FIXTURE_URLS.supplementThread,
          text: "Every buyer uses a different portal, so we retype the same approved answers again and again.",
        },
        {
          sourceUrl: FIXTURE_URLS.supplementThread,
          text: "The answers exist, but finding the version legal signed off on takes longer than writing them.",
        },
      ],
    };
    const providers = createFixtureProviders({ pages, synthesis: { extraction: () => extraction } });
    const queries: string[] = [];
    const realSearch = providers.search;
    providers.search = {
      ...realSearch,
      search: (request) => {
        queries.push(request.query);
        return realSearch.search(request);
      },
    };
    const { record } = await runResearch({ brief: RFP_BRIEF, providers, mode: "fixture" });
    expect(queries.filter((q) => /Earlier community citations were mostly unreadable/.test(q))).toHaveLength(1);
    expect(queries.some((q) => /Do NOT cite Reddit/.test(q))).toBe(true);
    expect(record.provenance.attempts.community_signals).toBe(2);
    const supplement = record.evidence.sources.find((s) => s.url === FIXTURE_URLS.supplementThread);
    expect(supplement).toMatchObject({ status: "read", roles: ["community"] });
    const quoteSources = record.community.quoteIds.map(
      (id) => record.evidence.accepted.find((e) => e.id === id)?.sourceUrl,
    );
    expect(quoteSources).toEqual([FIXTURE_URLS.supplementThread, FIXTURE_URLS.supplementThread]);
  });
});
