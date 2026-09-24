/**
 * Pipeline tests (Mode A2 phase 5). Fixture providers only.
 */

import { describe, expect, it } from "vitest";

import { CostCapExceededError } from "./cost.ts";
import { createProviders } from "./providers.ts";
import { createKeywordDataProvider } from "./providers/keywordData.ts";
import { createSynthesisProvider } from "./providers/openai.ts";
import { createSearchProvider } from "./providers/perplexity.ts";
import {
  fixtureKeywordFetch,
  fixtureSearchFetch,
  SEARCH_MARKET_FIXTURE,
  SYNTHESIS_BRIEF_FIXTURE,
  SYNTHESIS_SCORE_FIXTURE,
} from "./providers/fixtures.ts";
import type { Fetcher } from "./providers/openai.ts";
import {
  PipelineError,
  runResearch,
  type BriefInput,
} from "./pipeline.ts";
import {
  MIN_COMPETITORS,
  MIN_MARKET_STATS,
  parseResearchRecord,
} from "./research-record.ts";

const RFP_BRIEF: BriefInput = {
  title: "AI RFP Response Assistant",
  audience: "SMB SaaS sales and solutions engineers",
  revenueModel: "Seat-based SaaS with usage caps",
  seedKeywords: [
    "rfp response software",
    "security questionnaire automation",
    "proposal management software",
  ],
  slug: "ai-rfp-response-assistant",
  oneLiner: "Grounded RFP drafts with citations for SMB sales teams.",
};

describe("runResearch (fixture)", () => {
  it("happy path produces a parseable ResearchRecord", async () => {
    const providers = createProviders({ mode: "fixture" });
    const record = await runResearch({
      brief: RFP_BRIEF,
      providers,
      ranAt: "2026-09-24T00:00:00.000Z",
    });
    // Round-trip through the fail-closed parser.
    const again = parseResearchRecord(record);
    expect(again.brief.slug).toBe("ai-rfp-response-assistant");
    expect(again.market.stats.length).toBeGreaterThanOrEqual(MIN_MARKET_STATS);
    expect(again.competitors.length).toBeGreaterThanOrEqual(MIN_COMPETITORS);
    expect(again.keywords.every((k) => k.source === "provider")).toBe(true);
    expect(again.provenance.costUsd).toBeGreaterThan(0);
    expect(again.provenance.providerCalls.length).toBeGreaterThan(0);
  });

  it("requires min stats and priced competitors", async () => {
    const providers = createProviders({ mode: "fixture" });
    const record = await runResearch({ brief: RFP_BRIEF, providers });
    expect(record.market.stats.length).toBeGreaterThanOrEqual(MIN_MARKET_STATS);
    for (const c of record.competitors) {
      expect(c.pricing.trim().length).toBeGreaterThan(0);
      expect(c.url).toMatch(/^https?:\/\//);
    }
    expect(record.competitors.length).toBeGreaterThanOrEqual(MIN_COMPETITORS);
  });

  it("keyword failure does not emit guessed CPC", async () => {
    const providers = createProviders({ mode: "fixture" });
    // Replace keyword adapter with one that always fails closed.
    providers.keywordData = createKeywordDataProvider({
      fetchImpl: fixtureKeywordFetch({
        payload: {
          status_code: 20000,
          tasks: [{ status_code: 20000, result: [] }],
        },
      }),
      login: "fixture-mode",
      password: "fixture-mode",
    });

    await expect(
      runResearch({ brief: RFP_BRIEF, providers }),
    ).rejects.toThrow(PipelineError);

    try {
      await runResearch({ brief: RFP_BRIEF, providers });
    } catch (error) {
      expect(error).toBeInstanceOf(PipelineError);
      expect((error as PipelineError).stepId).toBe("keywords_demand");
      // Ensure we never produced a record with invented metrics.
      expect(String(error)).not.toMatch(/guess|invent|estimate/i);
    }
  });

  it("cost cap aborts before another provider call", async () => {
    const providers = createProviders({ mode: "fixture" });
    await expect(
      runResearch({
        brief: RFP_BRIEF,
        providers,
        assertCap: () => {
          throw new CostCapExceededError(3_900_000, 200_000);
        },
      }),
    ).rejects.toThrow(CostCapExceededError);
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

/** Fixture providers whose scoring synthesis returns `score` instead. */
function providersWithScore(score: Record<string, unknown>) {
  const providers = createProviders({ mode: "fixture" });
  const base = JSON.parse(SYNTHESIS_SCORE_FIXTURE.output_text) as Record<
    string,
    unknown
  >;
  const fetchImpl = (async (_input, init) => {
    const body = JSON.parse(String(init?.body ?? "{}"));
    if (/normalize/i.test(body.instructions ?? "")) {
      return jsonResponse(SYNTHESIS_BRIEF_FIXTURE);
    }
    return jsonResponse({
      output_text: JSON.stringify({ ...base, ...score }),
      usage: SYNTHESIS_SCORE_FIXTURE.usage,
    });
  }) as Fetcher;
  providers.synthesis = createSynthesisProvider({
    fetchImpl,
    apiKey: "fixture-mode",
  });
  return providers;
}

async function expectStepFailure(
  promise: Promise<unknown>,
  stepId: string,
  message: RegExp,
) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(PipelineError);
  expect((error as PipelineError).stepId).toBe(stepId);
  expect((error as PipelineError).message).toMatch(message);
}

describe("runResearch provenance (no invented rows)", () => {
  it("fails instead of back-filling stats and competitors from search results", async () => {
    await expectStepFailure(
      runResearch({
        brief: RFP_BRIEF,
        providers: providersWithScore({ stats: [], competitors: [] }),
      }),
      "provenance_parse",
      /market stats.*got 0.*priced competitors.*got 0/,
    );
  });

  it("drops rows whose URL no search step returned", async () => {
    await expectStepFailure(
      runResearch({
        brief: RFP_BRIEF,
        providers: providersWithScore({
          stats: [
            {
              claim: "Made-up market size",
              value: "$9T",
              citationUrl: "https://invented.example/report",
              citationTitle: "Invented",
            },
          ],
        }),
      }),
      "provenance_parse",
      /market stats citing a search result \(got 0\)/,
    );
  });

  it("fails instead of using canned channels or how-it-works steps", async () => {
    await expectStepFailure(
      runResearch({
        brief: RFP_BRIEF,
        providers: providersWithScore({
          goToMarket: { positioning: "p", channels: ["one"], pricingNotes: "n" },
          howItWorks: [],
          whyNow: "",
        }),
      }),
      "provenance_parse",
      /channels \(got 1\).*howItWorks steps \(got 0\).*no whyNow/,
    );
  });

  it("keeps model rows that cite a returned search URL", async () => {
    const record = await runResearch({
      brief: RFP_BRIEF,
      providers: createProviders({ mode: "fixture" }),
    });
    expect(record.howItWorks?.length).toBeGreaterThanOrEqual(2);
    expect(record.goToMarket.channels).not.toEqual(record.howItWorks);
  });

  it("rejects a slug that could escape content/ideas", async () => {
    await expectStepFailure(
      runResearch({
        brief: { ...RFP_BRIEF, slug: "../../etc/evil" },
        providers: createProviders({ mode: "fixture" }),
      }),
      "brief_normalization",
      /must match/,
    );
  });
});

describe("runResearch cost accounting", () => {
  it("reserves before the retry and counts the billed failed attempt", async () => {
    const providers = createProviders({ mode: "fixture" });
    let marketCalls = 0;
    const fallback = fixtureSearchFetch();
    const fetchImpl = (async (input, init) => {
      const body = JSON.parse(String(init?.body ?? "{}"));
      const query: string = body.messages?.[0]?.content ?? "";
      if (/market statistics/i.test(query) && marketCalls++ === 0) {
        // Billed 200 with no usable citations.
        return jsonResponse({
          ...SEARCH_MARKET_FIXTURE,
          search_results: [],
          citations: [],
        });
      }
      return fallback(input, init);
    }) as Fetcher;
    providers.search = createSearchProvider({ fetchImpl, apiKey: "fixture-mode" });

    const reservations: number[] = [];
    const record = await runResearch({
      brief: RFP_BRIEF,
      providers,
      assertCap: ({ spentMicroUsd }) => {
        reservations.push(spentMicroUsd);
      },
    });

    // brief, market ×2, competitors, community, keywords, synthesis
    expect(reservations).toHaveLength(7);
    const failed = record.provenance.providerCalls.filter((c) =>
      c.operation.endsWith(":failed"),
    );
    expect(failed).toHaveLength(1);
    expect(failed[0]!.costUsd).toBeGreaterThan(0);
    // The failed attempt's cost is in the spend seen by the retry reservation.
    expect(reservations[2]).toBeGreaterThan(reservations[1]!);
    const total = record.provenance.providerCalls.reduce(
      (sum, c) => sum + c.costUsd,
      0,
    );
    expect(record.provenance.costUsd).toBeCloseTo(total, 5);
  });

  it("sends the step's output-token cap to the search provider", async () => {
    const providers = createProviders({ mode: "fixture" });
    const seen: number[] = [];
    const fallback = fixtureSearchFetch();
    const fetchImpl = (async (input, init) => {
      seen.push(JSON.parse(String(init?.body ?? "{}")).max_tokens);
      return fallback(input, init);
    }) as Fetcher;
    providers.search = createSearchProvider({ fetchImpl, apiKey: "fixture-mode" });
    await runResearch({ brief: RFP_BRIEF, providers });
    expect(seen).toEqual([2_000, 2_000, 2_000]);
  });

  it("refuses an input larger than the step budget before calling", async () => {
    const providers = createProviders({ mode: "fixture" });
    await expectStepFailure(
      runResearch({
        brief: { ...RFP_BRIEF, audience: "x".repeat(5_000) },
        providers,
      }),
      "brief_normalization",
      /exceeds the .*-token budget/,
    );
  });
});

describe("runResearch scores", () => {
  it("drops a partial score set so the Convex seed never sees one", async () => {
    const record = await runResearch({
      brief: RFP_BRIEF,
      providers: providersWithScore({
        scores: { opportunity: 8, pain: 9, execution: 7 },
      }),
    });
    expect(record.scores).toBeUndefined();
  });

  it("keeps a complete score set with a real timing score", async () => {
    const record = await runResearch({
      brief: RFP_BRIEF,
      providers: createProviders({ mode: "fixture" }),
    });
    expect(record.scores?.timing).toBe(8);
  });
});
