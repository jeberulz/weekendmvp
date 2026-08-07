import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createSynthesisProvider } from "./openai";
import { createSearchProvider, MAX_SNIPPET_CHARS } from "./perplexity";
import { createKeywordDataProvider } from "./keywordData";
import { ProviderCallError, ProviderConfigError, requireSecret } from "./types";
import {
  estimateKeywordUsd,
  estimateSearchUsd,
  estimateSynthesisUsd,
  REFERENCE_RUN_USD,
  REPORT_COST_CAP_USD,
  SYNTHESIS_LONG_CONTEXT_THRESHOLD_TOKENS,
  SYNTHESIS_MODEL,
} from "./pricing";
import {
  fixtureKeywordFetch,
  fixtureSearchFetch,
  fixtureSynthesisFetch,
  KEYWORD_FIXTURE,
  unreachableFetch,
} from "./fixtures";

/**
 * WP26-S2. Fixture-only: no test here needs a live key or makes a network
 * call. The adapters under test are the real ones — only the transport is
 * substituted — so parsing, fail-closed behaviour, and cost estimation all
 * execute as they would in production.
 */

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

describe("configuration", () => {
  it("fails closed on a missing key, and says which one", async () => {
    delete process.env.OPENAI_API_KEY;
    const provider = createSynthesisProvider({ fetchImpl: fixtureSynthesisFetch() });
    await expect(
      provider.complete({ instructions: "x", input: "y", maxOutputTokens: 100 }),
    ).rejects.toThrow(ProviderConfigError);
  });

  it.each(["", "   "])("treats a blank key (%s) as missing", async (value) => {
    process.env.PERPLEXITY_API_KEY = value;
    const provider = createSearchProvider({ fetchImpl: fixtureSearchFetch() });
    await expect(
      provider.search({ query: "q", searchContextSize: "low" }),
    ).rejects.toThrow(ProviderConfigError);
  });

  it("requires both DataForSEO credentials", async () => {
    delete process.env.DATAFORSEO_PASSWORD;
    const provider = createKeywordDataProvider({ fetchImpl: fixtureKeywordFetch() });
    await expect(
      provider.lookup({ keywords: ["a"], locationCode: 2840, languageCode: "en" }),
    ).rejects.toThrow(/DATAFORSEO_PASSWORD/);
  });

  it("refuses a client-exposed variable by name, before reading it", () => {
    // Deliberately never assigned: the prefix check must reject the *name*
    // without consulting the environment at all. A credential that reached a
    // client bundle is compromised, so a set value must not make it
    // acceptable.
    //
    // The name is also assembled rather than written literally, because
    // WP20's environment-coverage gate statically scans for `process.env.X`
    // references and would otherwise require this fake key in `.env.example`.
    const clientExposed = `NEXT_PUBLIC_${"LEAKED"}`;
    expect(() => requireSecret("synthesis", clientExposed)).toThrow(
      ProviderConfigError,
    );
  });

  it("marks configuration errors non-retryable", async () => {
    delete process.env.OPENAI_API_KEY;
    const provider = createSynthesisProvider({ fetchImpl: fixtureSynthesisFetch() });
    // S3 must not spend a retry, and S4 must not reserve budget, on a config
    // error — it will fail identically every time.
    await expect(
      provider.complete({ instructions: "x", input: "y", maxOutputTokens: 100 }),
    ).rejects.toMatchObject({ retryable: false });
  });
});

describe("synthesis adapter", () => {
  it("pins a concrete model id, never the floating alias", () => {
    const provider = createSynthesisProvider();
    expect(provider.model).toBe(SYNTHESIS_MODEL);
    expect(provider.model).not.toBe("gpt-5.6");
    // Guards the drift the story cares about: an alias silently re-pointing.
    expect(SYNTHESIS_MODEL).toMatch(/^gpt-5\.6-sol/);
  });

  it("returns text and a costed result", async () => {
    const provider = createSynthesisProvider({ fetchImpl: fixtureSynthesisFetch() });
    const result = await provider.complete({
      instructions: "Summarise",
      input: "...",
      maxOutputTokens: 1000,
    });
    expect(result.value.text).toContain("Collectors lose thousands");
    expect(result.cost.usd).toBeGreaterThan(0);
    expect(result.cost.estimated).toBe(true);
    expect(result.cost.billedAs).toBe(SYNTHESIS_MODEL);
  });

  it("fails closed when the model returns no text", async () => {
    const provider = createSynthesisProvider({
      fetchImpl: fixtureSynthesisFetch({ payload: { output: [], usage: {} } }),
    });
    // An empty synthesis would become silently missing report sections.
    await expect(
      provider.complete({ instructions: "x", input: "y", maxOutputTokens: 10 }),
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
      provider.complete({ instructions: "x", input: "y", maxOutputTokens: 10 }),
    ).rejects.toMatchObject({ retryable });
  });

  it("treats a network failure as retryable", async () => {
    const provider = createSynthesisProvider({ fetchImpl: unreachableFetch() });
    await expect(
      provider.complete({ instructions: "x", input: "y", maxOutputTokens: 10 }),
    ).rejects.toMatchObject({ retryable: true });
  });
});

describe("search adapter (citation-only)", () => {
  it("collects citations from both payload shapes and de-duplicates", async () => {
    const provider = createSearchProvider({ fetchImpl: fixtureSearchFetch() });
    const result = await provider.search({ query: "q", searchContextSize: "medium" });
    expect(result.value.citations.map((c) => c.url)).toEqual([
      "https://example.com/collectibles-fraud-report-2026",
      "https://example.org/authentication-turnaround",
      "https://example.net/market-size",
    ]);
  });

  it("caps stored snippets rather than republishing page content", async () => {
    const long = "x".repeat(MAX_SNIPPET_CHARS + 500);
    const provider = createSearchProvider({
      fetchImpl: fixtureSearchFetch({
        payload: {
          choices: [{ message: { content: "c" } }],
          search_results: [{ url: "https://example.com/a", snippet: long }],
          usage: {},
        },
      }),
    });
    const result = await provider.search({ query: "q", searchContextSize: "low" });
    const snippet = result.value.citations[0].snippet ?? "";
    expect(snippet.length).toBeLessThanOrEqual(MAX_SNIPPET_CHARS + 1);
  });

  it.each(["javascript:alert(1)", "data:text/html,<script>", "not-a-url"])(
    "drops the non-http citation %s",
    async (url) => {
      const provider = createSearchProvider({
        fetchImpl: fixtureSearchFetch({
          payload: {
            choices: [{ message: { content: "c" } }],
            search_results: [{ url }, { url: "https://example.com/ok" }],
            usage: {},
          },
        }),
      });
      const result = await provider.search({ query: "q", searchContextSize: "low" });
      // A citation is republished to readers; a scheme-bearing URL must never
      // reach the renderer.
      expect(result.value.citations.map((c) => c.url)).toEqual([
        "https://example.com/ok",
      ]);
    },
  );

  it("fails closed when no usable citation comes back", async () => {
    const provider = createSearchProvider({
      fetchImpl: fixtureSearchFetch({
        payload: { choices: [{ message: { content: "c" } }], usage: {} },
      }),
    });
    // The report contract fails closed on uncited scored sections; failing
    // here lets S3 retry instead of failing deep in the compiler.
    await expect(
      provider.search({ query: "q", searchContextSize: "low" }),
    ).rejects.toThrow(/citation/i);
  });

  it("prices the per-request search fee separately from tokens", async () => {
    const provider = createSearchProvider({ fetchImpl: fixtureSearchFetch() });
    const low = await provider.search({ query: "q", searchContextSize: "low" });
    const high = await provider.search({ query: "q", searchContextSize: "high" });
    // Same tokens, different context tier: the fee must move the total, or the
    // "easy to omit" fee has been omitted.
    expect(high.cost.usd).toBeGreaterThan(low.cost.usd);
  });
});

describe("keyword adapter (never estimates)", () => {
  it("returns only provider-supplied metrics", async () => {
    const provider = createKeywordDataProvider({ fetchImpl: fixtureKeywordFetch() });
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
                { keyword: "partial", search_volume: 100, competition_index: 10 },
                { keyword: "complete", search_volume: 50, competition_index: 5, cpc: 1 },
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
    // Coercing a missing cpc to 0 would assert as measured fact that the
    // keyword has no commercial value.
    expect(result.value.metrics.map((m) => m.keyword)).toEqual(["complete"]);
  });

  it.each([
    ["an empty result set", { status_code: 20000, tasks: [{ status_code: 20000, result: [] }] }],
    ["a provider-level error status", { status_code: 40501, tasks: [] }],
    ["a task-level error status", { status_code: 20000, tasks: [{ status_code: 40400, result: [] }] }],
    ["a null result", { status_code: 20000, tasks: [{ status_code: 20000, result: null }] }],
  ])("fails closed on %s", async (_label, payload) => {
    const provider = createKeywordDataProvider({
      fetchImpl: fixtureKeywordFetch({ payload }),
    });
    // Empty is a failure, not a finding: `[]` downstream reads as "no demand".
    await expect(
      provider.lookup({ keywords: ["a"], locationCode: 2840, languageCode: "en" }),
    ).rejects.toThrow(ProviderCallError);
  });

  it("returns HTTP 200 with a body error, which must still fail", async () => {
    const provider = createKeywordDataProvider({
      fetchImpl: fixtureKeywordFetch({
        payload: { status_code: 40200, status_message: "quota" },
        status: 200,
      }),
    });
    // `response.ok` alone would wave this through.
    await expect(
      provider.lookup({ keywords: ["a"], locationCode: 2840, languageCode: "en" }),
    ).rejects.toThrow(ProviderCallError);
  });

  it("exposes no way to mark a value as inferred", () => {
    const provider = createKeywordDataProvider({ fetchImpl: fixtureKeywordFetch() });
    // Structural, not a runtime check: `KeywordMetric` has no confidence or
    // source field, so a model guess has nowhere to live.
    expect(Object.keys(provider)).not.toContain("estimate");
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
    // One token over roughly doubles the bill — it is not a marginal rate.
    expect(over).toBeGreaterThan(under * 1.9);
  });

  it("charges cached input at the cheaper rate", () => {
    const cold = estimateSynthesisUsd({
      inputTokens: 100_000,
      cachedInputTokens: 0,
      outputTokens: 0,
    });
    const warm = estimateSynthesisUsd({
      inputTokens: 100_000,
      cachedInputTokens: 100_000,
      outputTokens: 0,
    });
    expect(warm).toBeLessThan(cold);
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

  it("prices a reference run near the ruling's budget and well under the cap", () => {
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
    // Sanity-check the model against the ruling's ~$0.52 reference rather than
    // only against the cap, which is 8x the expected cost and would hide a
    // serious regression.
    expect(total).toBeLessThan(REFERENCE_RUN_USD * 2);
  });
});
