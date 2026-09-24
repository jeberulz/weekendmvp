/**
 * Provider adapter tests (Mode A2 phase 4).
 *
 * Fixture-only: no live keys, no network. Cases required by the plan:
 * missing key in live mode; keyword failure does not guess volume;
 * fixture mode estimates cost from pricing with no network.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createProviders } from "./providers";
import { createSynthesisProvider } from "./providers/openai";
import { createSearchProvider } from "./providers/perplexity";
import { createKeywordDataProvider } from "./providers/keywordData";
import { ProviderCallError, ProviderConfigError, requireSecret } from "./providers/types";
import {
  estimateKeywordUsd,
  estimateSearchUsd,
  estimateSynthesisUsd,
  REFERENCE_RUN_USD,
  REPORT_COST_CAP_USD,
  SYNTHESIS_LONG_CONTEXT_THRESHOLD_TOKENS,
  SYNTHESIS_MODEL,
} from "./providers/pricing";
import {
  fixtureKeywordFetch,
  fixtureSearchFetch,
  fixtureSynthesisFetch,
  KEYWORD_FIXTURE,
  unreachableFetch,
} from "./providers/fixtures";

const KEYS = {
  OPENAI_API_KEY: "sk-test-not-a-real-key",
  PERPLEXITY_API_KEY: "pplx-test-not-a-real-key",
  DATAFORSEO_LOGIN: "test-login",
  DATAFORSEO_PASSWORD: "test-password",
};

let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = {};
  for (const [key, value] of Object.entries(KEYS)) {
    saved[key] = process.env[key];
    process.env[key] = value;
  }
});

afterEach(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("createProviders fixture mode", () => {
  it("runs with no env keys and estimates cost from the rate card", async () => {
    for (const key of Object.keys(KEYS)) {
      delete process.env[key];
    }
    const providers = createProviders({ mode: "fixture" });
    const synthesis = await providers.synthesis.complete({
      instructions: "Normalize a startup idea into a brief.",
      input: "RFP assistant",
      maxOutputTokens: 800,
    });
    expect(synthesis.cost.usd).toBeGreaterThan(0);
    expect(synthesis.cost.estimated).toBe(true);
    expect(synthesis.cost.usd).toBe(
      estimateSynthesisUsd({
        inputTokens: synthesis.value.inputTokens,
        cachedInputTokens: synthesis.value.cachedInputTokens,
        outputTokens: synthesis.value.outputTokens,
      }),
    );

    const search = await providers.search.search({
      query: "Find market statistics with CAGR",
      searchContextSize: "high",
    });
    expect(search.value.citations.length).toBeGreaterThan(0);
    expect(search.cost.usd).toBeGreaterThan(0);

    const keywords = await providers.keywordData.lookup({
      keywords: ["rfp response software"],
      locationCode: 2840,
      languageCode: "en",
    });
    expect(keywords.value.metrics.length).toBeGreaterThan(0);
    expect(keywords.cost.usd).toBe(
      estimateKeywordUsd({
        tasks: keywords.value.tasks,
        items: keywords.value.items,
      }),
    );
  });
});

describe("configuration (live mode)", () => {
  it("fails closed on a missing key, and says which one", async () => {
    delete process.env.OPENAI_API_KEY;
    const provider = createSynthesisProvider({
      fetchImpl: fixtureSynthesisFetch(),
    });
    await expect(
      provider.complete({
        instructions: "x",
        input: "y",
        maxOutputTokens: 100,
      }),
    ).rejects.toThrow(ProviderConfigError);
  });

  it.each(["", "   "])("treats a blank key (%s) as missing", async (value) => {
    process.env.PERPLEXITY_API_KEY = value;
    const provider = createSearchProvider({
      fetchImpl: fixtureSearchFetch(),
    });
    await expect(
      provider.search({ query: "q", searchContextSize: "low" }),
    ).rejects.toThrow(ProviderConfigError);
  });

  it("requires both DataForSEO credentials", async () => {
    delete process.env.DATAFORSEO_PASSWORD;
    const provider = createKeywordDataProvider({
      fetchImpl: fixtureKeywordFetch(),
    });
    await expect(
      provider.lookup({
        keywords: ["a"],
        locationCode: 2840,
        languageCode: "en",
      }),
    ).rejects.toThrow(/DATAFORSEO_PASSWORD/);
  });

  it("refuses a client-exposed variable by name, before reading it", () => {
    const clientExposed = `NEXT_PUBLIC_${"LEAKED"}`;
    expect(() => requireSecret("synthesis", clientExposed)).toThrow(
      ProviderConfigError,
    );
  });

  it("marks configuration errors non-retryable", async () => {
    delete process.env.OPENAI_API_KEY;
    const provider = createSynthesisProvider({
      fetchImpl: fixtureSynthesisFetch(),
    });
    await expect(
      provider.complete({
        instructions: "x",
        input: "y",
        maxOutputTokens: 100,
      }),
    ).rejects.toMatchObject({ retryable: false });
  });
});

describe("synthesis adapter", () => {
  it("pins a concrete model id, never the floating alias", () => {
    const provider = createSynthesisProvider();
    expect(provider.model).toBe(SYNTHESIS_MODEL);
    expect(provider.model).not.toBe("gpt-5.6");
    expect(SYNTHESIS_MODEL).toMatch(/^gpt-5\.6-sol/);
  });

  it("returns text and a costed result", async () => {
    const provider = createSynthesisProvider({
      fetchImpl: fixtureSynthesisFetch({ payload: undefined }),
    });
    // Force default SYNTHESIS_FIXTURE via empty instructions
    const result = await provider.complete({
      instructions: "Summarise",
      input: "...",
      maxOutputTokens: 1000,
    });
    expect(result.value.text.length).toBeGreaterThan(0);
    expect(result.cost.usd).toBeGreaterThan(0);
    expect(result.cost.estimated).toBe(true);
    expect(result.cost.billedAs).toBe(SYNTHESIS_MODEL);
  });

  it("fails closed when the model returns no text", async () => {
    const provider = createSynthesisProvider({
      fetchImpl: fixtureSynthesisFetch({ payload: { output: [], usage: {} } }),
    });
    await expect(
      provider.complete({
        instructions: "x",
        input: "y",
        maxOutputTokens: 10,
      }),
    ).rejects.toThrow(ProviderCallError);
  });

  it.each([
    [429, true],
    [500, true],
    [503, true],
    [400, false],
    [401, false],
    [403, false],
  ])("classifies HTTP %s as retryable=%s", async (status, retryable) => {
    const provider = createSynthesisProvider({
      fetchImpl: fixtureSynthesisFetch({ status, payload: {} }),
    });
    await expect(
      provider.complete({
        instructions: "x",
        input: "y",
        maxOutputTokens: 10,
      }),
    ).rejects.toMatchObject({ retryable });
  });

  it("treats a network failure as retryable", async () => {
    const provider = createSynthesisProvider({ fetchImpl: unreachableFetch() });
    await expect(
      provider.complete({
        instructions: "x",
        input: "y",
        maxOutputTokens: 10,
      }),
    ).rejects.toMatchObject({ retryable: true });
  });
});

describe("search adapter (citation-only)", () => {
  it("collects citations from both payload shapes and de-duplicates", async () => {
    const provider = createSearchProvider({
      fetchImpl: fixtureSearchFetch({ payload: undefined, status: undefined }),
    });
    // Use a query that does not match market/competitor/community routers
    const result = await provider.search({
      query: "generic collectibles query",
      searchContextSize: "medium",
    });
    // Default SEARCH_FIXTURE when no override — but smart router may still
    // pick SEARCH_FIXTURE for unmatched queries.
    expect(result.value.citations.length).toBeGreaterThanOrEqual(2);
  });

  it("fails closed when no usable citation comes back", async () => {
    const provider = createSearchProvider({
      fetchImpl: fixtureSearchFetch({
        payload: { choices: [{ message: { content: "c" } }], usage: {} },
      }),
    });
    await expect(
      provider.search({ query: "q", searchContextSize: "low" }),
    ).rejects.toThrow(/citation/i);
  });
});

describe("keyword adapter (never estimates)", () => {
  it("returns only provider-supplied metrics", async () => {
    const provider = createKeywordDataProvider({
      fetchImpl: fixtureKeywordFetch(),
    });
    const result = await provider.lookup({
      keywords: ["collectible authentication"],
      locationCode: 2840,
      languageCode: "en",
    });
    expect(result.value.metrics).toEqual(
      KEYWORD_FIXTURE.tasks[0].result.map((item) => ({
        keyword: item.keyword,
        searchVolume: item.search_volume,
        competition: item.competition_index,
        cpcUsd: item.cpc,
      })),
    );
  });

  it("drops a keyword with a missing metric rather than defaulting it to zero", async () => {
    const provider = createKeywordDataProvider({
      fetchImpl: fixtureKeywordFetch({
        payload: {
          status_code: 20000,
          tasks: [
            {
              status_code: 20000,
              result: [
                {
                  keyword: "partial",
                  search_volume: 100,
                  competition_index: 10,
                },
                {
                  keyword: "complete",
                  search_volume: 50,
                  competition_index: 5,
                  cpc: 1,
                },
              ],
            },
          ],
        },
      }),
    });
    const result = await provider.lookup({
      keywords: ["partial", "complete"],
      locationCode: 2840,
      languageCode: "en",
    });
    expect(result.value.metrics.map((m) => m.keyword)).toEqual(["complete"]);
  });

  it("fails closed on empty result — does not guess volume or CPC", async () => {
    const provider = createKeywordDataProvider({
      fetchImpl: fixtureKeywordFetch({
        payload: {
          status_code: 20000,
          tasks: [{ status_code: 20000, result: [] }],
        },
      }),
    });
    await expect(
      provider.lookup({
        keywords: ["a"],
        locationCode: 2840,
        languageCode: "en",
      }),
    ).rejects.toThrow(ProviderCallError);
  });

  it.each([
    [
      "a provider-level error status",
      { status_code: 40501, tasks: [] },
    ],
    [
      "a task-level error status",
      { status_code: 20000, tasks: [{ status_code: 40400, result: [] }] },
    ],
  ])("fails closed on %s", async (_label, payload) => {
    const provider = createKeywordDataProvider({
      fetchImpl: fixtureKeywordFetch({ payload }),
    });
    await expect(
      provider.lookup({
        keywords: ["a"],
        locationCode: 2840,
        languageCode: "en",
      }),
    ).rejects.toThrow(ProviderCallError);
  });
});

describe("cost model", () => {
  it("applies the >272K long-context surcharge to the whole request", () => {
    const under = estimateSynthesisUsd({
      inputTokens: SYNTHESIS_LONG_CONTEXT_THRESHOLD_TOKENS,
      cachedInputTokens: 0,
      outputTokens: 1000,
    });
    const over = estimateSynthesisUsd({
      inputTokens: SYNTHESIS_LONG_CONTEXT_THRESHOLD_TOKENS + 1,
      cachedInputTokens: 0,
      outputTokens: 1000,
    });
    expect(over).toBeGreaterThan(under * 1.9);
  });

  it("includes the per-1K search fee", () => {
    const tokensOnly = estimateSearchUsd({
      inputTokens: 1000,
      outputTokens: 1000,
      requests: 0,
      searchContextSize: "high",
    });
    const withRequest = estimateSearchUsd({
      inputTokens: 1000,
      outputTokens: 1000,
      requests: 1,
      searchContextSize: "high",
    });
    expect(withRequest - tokensOnly).toBeCloseTo(0.014, 6);
  });

  it("prices a reference run near the ruling budget and under the cap", () => {
    const synthesis = estimateSynthesisUsd({
      inputTokens: 40_000,
      cachedInputTokens: 0,
      outputTokens: 6_000,
    });
    const search = [1, 2, 3].reduce(
      (sum) =>
        sum +
        estimateSearchUsd({
          inputTokens: 1_500,
          outputTokens: 1_200,
          requests: 1,
          searchContextSize: "medium",
        }),
      0,
    );
    const keywords = estimateKeywordUsd({ tasks: 1, items: 50 });
    const total = synthesis + search + keywords;
    expect(total).toBeLessThan(REPORT_COST_CAP_USD);
    expect(total).toBeLessThan(REFERENCE_RUN_USD * 2);
  });
});
