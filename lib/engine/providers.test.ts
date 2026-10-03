/**
 * Provider adapter tests (Mode A2 phase 4).
 *
 * Fixture-only: no live keys, no network. Cases required by the plan:
 * missing key in live mode; keyword failure does not guess volume;
 * fixture mode estimates cost from pricing with no network.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { EXTRACTION_INSTRUCTIONS, runResearch, type BriefInput } from "./pipeline.ts";
import { createProviders } from "./providers.ts";
import { createSynthesisProvider, type Fetcher } from "./providers/openai.ts";
import { createSearchProvider } from "./providers/perplexity.ts";
import { createKeywordDataProvider } from "./providers/keywordData.ts";
import {
  ProviderCallError,
  ProviderConfigError,
  requireSecret,
  type ProviderCost,
  type SynthesisRequest,
} from "./providers/types.ts";
import {
  estimateKeywordUsd,
  estimateSearchUsd,
  estimateSynthesisUsd,
  REFERENCE_RUN_USD,
  REPORT_COST_CAP_USD,
  SYNTHESIS_LONG_CONTEXT_THRESHOLD_TOKENS,
  SYNTHESIS_MODEL,
} from "./providers/pricing.ts";
import {
  createFixtureProviders,
  fixtureKeywordFetch,
  fixtureSearchFetch,
  fixtureSynthesisFetch,
  KEYWORD_FIXTURE,
  unreachableFetch,
} from "./providers/fixtures.ts";

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
      maxOutputTokens: 2_000,
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
      provider.search({ query: "q", searchContextSize: "low", maxOutputTokens: 2_000 }),
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

describe("synthesis adapter: billed replies it cannot use (P3-9)", () => {
  const REQUEST: SynthesisRequest = {
    instructions: "Summarise the brief. é",
    input: "x".repeat(3_000),
    maxOutputTokens: 500,
  };
  const requestBytes = Buffer.byteLength(REQUEST.instructions) + Buffer.byteLength(REQUEST.input);

  const replying =
    (body: BodyInit | null, status = 200): Fetcher =>
    async () =>
      new Response(body, { status });

  async function failureOf(fetchImpl: Fetcher): Promise<ProviderCallError> {
    const error = await createSynthesisProvider({ fetchImpl, apiKey: "test-key" })
      .complete(REQUEST)
      .then(
        () => null,
        (e: unknown) => e,
      );
    if (!(error instanceof ProviderCallError)) throw new Error(`expected a ProviderCallError, got ${String(error)}`);
    return error;
  }

  /** Unknown usage is billed at the most this request could cost, never at zero. */
  function expectRequestCeiling(cost: ProviderCost | undefined): void {
    expect(cost).toMatchObject({ role: "synthesis", provider: "openai", billedAs: SYNTHESIS_MODEL, estimated: true });
    const inputTokens = cost?.units.inputTokens ?? 0;
    // A token is never shorter than one UTF-8 byte.
    expect(inputTokens).toBeGreaterThanOrEqual(requestBytes);
    expect(cost?.units).toEqual({ inputTokens, cachedInputTokens: 0, outputTokens: REQUEST.maxOutputTokens });
    expect(cost?.usd).toBe(
      estimateSynthesisUsd({ inputTokens, cachedInputTokens: 0, outputTokens: REQUEST.maxOutputTokens }),
    );
    expect(cost?.usd).toBeGreaterThan(0);
  }

  it("settles malformed JSON from a 200 at the request's upper bound, never at zero", async () => {
    const error = await failureOf(replying('{"output_text": "Collectors lose mo'));
    expect(error).toMatchObject({ message: "unparseable response", retryable: true });
    expectRequestCeiling(error.cost);
  });

  it("settles a 200 whose body breaks off mid-read", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"output_text": "par'));
        controller.error(new Error("connection reset"));
      },
    });
    const error = await failureOf(replying(body));
    expect(error.retryable).toBe(true);
    expectRequestCeiling(error.cost);
  });

  it("settles JSON that is not an object at the upper bound", async () => {
    for (const body of ["null", "[]", '"text"', "42"]) {
      const error = await failureOf(replying(body));
      expect(error.message, body).toBe("model returned no text");
      expectRequestCeiling(error.cost);
    }
  });

  it("charges the reported usage when a billed reply has no usable text, without a TypeError", async () => {
    const usage = { input_tokens: 1_200, output_tokens: 30, input_tokens_details: { cached_tokens: 200 } };
    for (const payload of [
      { output: [{ content: [{ type: "refusal", refusal: "I can't help with that." }] }], usage },
      { output: "not a list", usage },
      { output: [null, { content: "not a list" }, { content: [{ text: 42 }] }], usage },
      { output_text: "", usage },
    ]) {
      const error = await failureOf(replying(JSON.stringify(payload)));
      expect(error.message, JSON.stringify(payload)).toBe("model returned no text");
      expect(error.cost, JSON.stringify(payload)).toEqual({
        role: "synthesis",
        provider: "openai",
        billedAs: SYNTHESIS_MODEL,
        usd: estimateSynthesisUsd({ inputTokens: 1_200, cachedInputTokens: 200, outputTokens: 30 }),
        estimated: true,
        units: { inputTokens: 1_200, cachedInputTokens: 200, outputTokens: 30 },
      });
    }
  });

  it("never records missing or malformed usage as zero on a reply it can use", async () => {
    for (const usage of [undefined, {}, { input_tokens: "1200", output_tokens: -1 }, { input_tokens: 1.5, output_tokens: null }]) {
      const result = await createSynthesisProvider({
        fetchImpl: replying(JSON.stringify({ output_text: "Collectors lose money.", usage })),
        apiKey: "test-key",
      }).complete(REQUEST);
      expect(result.value.text).toBe("Collectors lose money.");
      expectRequestCeiling(result.cost);
    }
    // Only the missing count falls back; impossible cached counts count as none.
    const partial = await createSynthesisProvider({
      fetchImpl: replying(
        JSON.stringify({
          output_text: "ok",
          usage: { input_tokens: 800, input_tokens_details: { cached_tokens: 9_000 } },
        }),
      ),
      apiKey: "test-key",
    }).complete(REQUEST);
    expect(partial.cost.units).toEqual({
      inputTokens: 800,
      cachedInputTokens: 0,
      outputTokens: REQUEST.maxOutputTokens,
    });
  });
});

describe("a billed reply the adapter cannot use reaches the run's ledger", () => {
  it("records an unparseable extraction reply as a failed billed call, then retries", async () => {
    const brief: BriefInput = JSON.parse(
      readFileSync(
        path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../engine/briefs/rfp-assistant.json"),
        "utf8",
      ),
    );
    const fixture = fixtureSynthesisFetch();
    let cut = 0;
    const fetchImpl: Fetcher = async (input, init) => {
      const body: unknown = typeof init?.body === "string" ? JSON.parse(init.body) : null;
      const extraction =
        typeof body === "object" && body !== null && "instructions" in body && body.instructions === EXTRACTION_INSTRUCTIONS;
      if (extraction && cut === 0) {
        cut += 1;
        return new Response('{"output_text": "{\\"quotes\\": [', { status: 200 });
      }
      return fixture(input, init);
    };
    const providers = {
      ...createFixtureProviders(),
      synthesis: createSynthesisProvider({ fetchImpl, apiKey: "fixture-mode" }),
    };
    const { record } = await runResearch({ brief, providers, mode: "fixture" });
    const failed = record.provenance.providerCalls.filter((c) => c.operation.endsWith(":failed"));
    expect(failed.map((c) => c.operation)).toEqual([`evidence_extraction/synthesis:${SYNTHESIS_MODEL}:failed`]);
    expect(failed[0]?.costUsd).toBeGreaterThan(0);
    expect(record.provenance.attempts.evidence_extraction).toBe(2);
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
      maxOutputTokens: 2_000,
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
      provider.search({ query: "q", searchContextSize: "low", maxOutputTokens: 2_000 }),
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

  it("records the charge DataForSEO reports instead of the rate-card estimate", async () => {
    const provider = createKeywordDataProvider({
      fetchImpl: fixtureKeywordFetch({
        payload: { ...KEYWORD_FIXTURE, cost: 0.075 },
      }),
    });
    const result = await provider.lookup({
      keywords: ["collectible authentication"],
      locationCode: 2840,
      languageCode: "en",
    });
    expect(result.cost.usd).toBe(0.075);
    expect(result.cost.estimated).toBe(false);
  });

  it("falls back to the rate card when no charge is reported", async () => {
    const provider = createKeywordDataProvider({
      fetchImpl: fixtureKeywordFetch(),
    });
    const result = await provider.lookup({
      keywords: ["collectible authentication"],
      locationCode: 2840,
      languageCode: "en",
    });
    expect(result.cost.estimated).toBe(true);
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
