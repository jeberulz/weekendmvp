/**
 * WP41-S2 tests. Fixture transports only: no key, no network, no spend.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createBudget, MAX_CAP_USD, readCapUsd, toMicroUsd } from "./budget.ts";
import { BudgetExceededError, EvalCallError, EvalConfigError } from "./errors.ts";
import { createEvalLlm, parseJsonReply } from "./llm.ts";
import {
  createFixtureFetch,
  FIXTURE_MODELS,
  unreachableFetch,
  type FixtureChatBody,
} from "./providers/fixtures.ts";
import {
  createOpenRouterClient,
  estimateInputTokens,
  fetchModelCatalog,
  ratesFor,
  worstCaseUsd,
  type Fetcher,
} from "./providers/openrouter.ts";

const MODEL = FIXTURE_MODELS[0];
const REQUEST = {
  label: "test",
  model: MODEL,
  system: "You grade startup idea pages.",
  user: "Grade this page.",
  maxOutputTokens: 200,
};

let savedKey: string | undefined;
let savedCap: string | undefined;

beforeEach(() => {
  savedKey = process.env.OPENROUTER_API_KEY;
  savedCap = process.env.EVALS_MAX_USD;
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.EVALS_MAX_USD;
});

afterEach(() => {
  for (const [key, value] of [
    ["OPENROUTER_API_KEY", savedKey],
    ["EVALS_MAX_USD", savedCap],
  ] as const) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

/** Records every request so tests can assert what was (not) sent. */
function spyFetch(inner: Fetcher) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return inner(input, init);
  }) as Fetcher;
  return { fetchImpl, calls, chats: () => calls.filter((c) => c.url.endsWith("/chat/completions")) };
}

function errorResponse(status: number, message = "nope"): Response {
  return new Response(JSON.stringify({ error: { code: status, message } }), { status });
}

describe("readCapUsd", () => {
  it("defaults to the ruled $10", () => {
    expect(readCapUsd({})).toBe(MAX_CAP_USD);
    expect(readCapUsd({ EVALS_MAX_USD: "  " })).toBe(10);
  });

  it("accepts a lower cap", () => {
    expect(readCapUsd({ EVALS_MAX_USD: "2.5" })).toBe(2.5);
  });

  it.each(["0", "-1", "abc", "10.01", "Infinity"])("rejects %s", (value) => {
    expect(() => readCapUsd({ EVALS_MAX_USD: value })).toThrow(EvalConfigError);
  });
});

describe("createBudget", () => {
  it("refuses a reservation that would cross the cap", () => {
    const budget = createBudget(1);
    budget.reserve(0.6);
    expect(() => budget.reserve(0.5)).toThrow(BudgetExceededError);
  });

  it("counts open reservations so parallel calls cannot jointly overspend", () => {
    const budget = createBudget(1);
    const a = budget.reserve(0.4);
    budget.reserve(0.4);
    expect(() => budget.reserve(0.3)).toThrow(BudgetExceededError);
    budget.settle(a, 0.1);
    expect(() => budget.reserve(0.3)).not.toThrow();
  });

  it("settles to actual cost and releases unbilled calls", () => {
    const budget = createBudget(1);
    const a = budget.reserve(0.5);
    const b = budget.reserve(0.3);
    budget.settle(a, 0.12);
    budget.release(b);
    expect(budget.spentUsd()).toBe(0.12);
    expect(budget.reservedUsd()).toBe(0);
    expect(budget.remainingUsd()).toBe(0.88);
    expect(() => budget.settle(a, 0.1)).toThrow(/not open/);
  });

  it("rounds costs up to the next micro-dollar", () => {
    expect(toMicroUsd(0.0000001)).toBe(1);
    expect(toMicroUsd(0.1 + 0.2)).toBe(300_000);
  });
});

describe("OpenRouter model catalog", () => {
  it("parses per-token prices and skips variable-priced routers", async () => {
    const fetchImpl = (async () =>
      new Response(
        JSON.stringify({
          data: [
            { id: "a/model", name: "A", context_length: 1000, pricing: { prompt: "0.000001", completion: "0.000002" } },
            { id: "openrouter/auto", pricing: { prompt: "-1", completion: "-1" } },
            { id: "b/model" },
          ],
        }),
      )) as Fetcher;
    const catalog = await fetchModelCatalog(fetchImpl);
    expect([...catalog.keys()]).toEqual(["a/model"]);
    expect(ratesFor(catalog, "a/model")).toMatchObject({ promptUsd: 0.000001, completionUsd: 0.000002, requestUsd: 0 });
    expect(() => ratesFor(catalog, "openrouter/auto")).toThrow(EvalConfigError);
  });

  it("prices the worst case from every allowed output token", async () => {
    const catalog = await fetchModelCatalog(createFixtureFetch());
    const rates = ratesFor(catalog, MODEL);
    // 1,000 in at $0.50/M + 2,000 out at $1.50/M
    expect(worstCaseUsd(rates, { inputTokens: 1000, maxOutputTokens: 2000 })).toBeCloseTo(0.0035, 10);
  });

  it("over-estimates input tokens rather than under-estimating", () => {
    expect(estimateInputTokens(["x".repeat(400)])).toBeGreaterThan(400 / 4);
  });
});

describe("createOpenRouterClient", () => {
  it("fails closed on a missing key without a request", async () => {
    const spy = spyFetch(unreachableFetch());
    const client = createOpenRouterClient({ fetchImpl: spy.fetchImpl });
    await expect(client.chat(REQUEST)).rejects.toThrow(EvalConfigError);
    expect(spy.calls).toHaveLength(0);
  });

  it("sends a pinned model, temperature 0, JSON mode, and auth", async () => {
    const spy = spyFetch(createFixtureFetch());
    const client = createOpenRouterClient({ fetchImpl: spy.fetchImpl, apiKey: "k" });
    await client.chat({ ...REQUEST, json: true });
    const { init } = spy.chats()[0];
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({
      model: MODEL,
      max_tokens: 200,
      temperature: 0,
      response_format: { type: "json_object" },
      provider: { require_parameters: true },
    });
    expect(body.messages.map((m: { role: string }) => m.role)).toEqual(["system", "user"]);
    expect((init?.headers as Record<string, string>).authorization).toBe("Bearer k");
  });

  it.each([
    [401, false, /rejected the API key/],
    [402, false, /out of credits/],
    [400, false, /returned 400/],
    [429, true, /returned 429/],
    [503, true, /returned 503/],
  ])("maps status %i (retryable=%s)", async (status, retryable, message) => {
    const client = createOpenRouterClient({
      apiKey: "k",
      fetchImpl: createFixtureFetch({ reply: () => errorResponse(status) }),
    });
    const error = await client.chat(REQUEST).catch((e) => e);
    expect(error).toBeInstanceOf(EvalCallError);
    expect(error.retryable).toBe(retryable);
    expect(error.billing).toBe("none");
    expect(error.message).toMatch(message);
  });

  it("flags a reply cut off at maxOutputTokens", async () => {
    const client = createOpenRouterClient({
      apiKey: "k",
      fetchImpl: createFixtureFetch({ reply: () => ({ text: '{"score": 4', finishReason: "length" }) }),
    });
    const reply = await client.chat(REQUEST);
    expect(reply.truncated).toBe(true);
  });
});

describe("createEvalLlm", () => {
  it("fixture mode runs with no key and no network", async () => {
    const llm = createEvalLlm({ mode: "fixture", fetchImpl: unreachableFetch() });
    const result = await llm.call({ ...REQUEST, json: true });
    expect(result.json).toEqual({ ok: true });
    expect(result.costSource).toBe("provider");
    expect(result.costUsd).toBeGreaterThan(0);
    expect(llm.spentUsd()).toBeCloseTo(result.costUsd, 6);
    expect(llm.ledger()).toHaveLength(1);
  });

  it("refuses a call over the cap before sending it", async () => {
    // Each call reports $0.0003; the worst case reserved is ~$0.00032.
    const spy = spyFetch(createFixtureFetch({ reply: () => ({ text: "ok", costUsd: 0.0003 }) }));
    const llm = createEvalLlm({ mode: "live", apiKey: "k", fetchImpl: spy.fetchImpl, capUsd: 0.0005 });
    await llm.call(REQUEST);
    await expect(llm.call(REQUEST)).rejects.toThrow(BudgetExceededError);
    expect(spy.chats()).toHaveLength(1);
    expect(llm.spentUsd()).toBeLessThanOrEqual(0.0005);
  });

  it("stops parallel calls that jointly exceed the cap", async () => {
    const spy = spyFetch(createFixtureFetch());
    const llm = createEvalLlm({ mode: "live", apiKey: "k", fetchImpl: spy.fetchImpl, capUsd: 0.0007 });
    const results = await Promise.allSettled([llm.call(REQUEST), llm.call(REQUEST), llm.call(REQUEST)]);
    const refused = results.filter((r) => r.status === "rejected" && r.reason instanceof BudgetExceededError);
    expect(refused.length).toBeGreaterThan(0);
    expect(spy.chats().length).toBe(results.length - refused.length);
  });

  it("uses the reported cost, else a token estimate", async () => {
    const llm = createEvalLlm({
      mode: "fixture",
      fixture: { reply: () => ({ text: "fine", inputTokens: 1000, outputTokens: 100, costUsd: null }) },
    });
    const result = await llm.call(REQUEST);
    expect(result.costSource).toBe("estimate");
    expect(result.costUsd).toBeCloseTo(1000 * 0.0000005 + 100 * 0.0000015, 10);
  });

  it("charges nothing for an error status and releases the reservation", async () => {
    const llm = createEvalLlm({ mode: "fixture", capUsd: 1, fixture: { reply: () => errorResponse(503) } });
    const error = await llm.call(REQUEST).catch((e) => e);
    expect(error).toBeInstanceOf(EvalCallError);
    expect(error.costUsd).toBe(0);
    expect(llm.spentUsd()).toBe(0);
    expect(llm.remainingUsd()).toBe(1);
    expect(llm.ledger()[0]).toMatchObject({ ok: false, costSource: "none" });
  });

  it("charges the worst case when the outcome is unknown", async () => {
    let first = true;
    const flaky = createFixtureFetch();
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith("/chat/completions") && first) {
        first = false;
        throw new Error("socket hang up");
      }
      return flaky(input, init);
    }) as Fetcher;
    const llm = createEvalLlm({ mode: "live", apiKey: "k", fetchImpl });
    const error = await llm.call(REQUEST).catch((e) => e);
    expect(error.billing).toBe("unknown");
    expect(error.costUsd).toBeGreaterThan(0);
    expect(llm.ledger()[0].costSource).toBe("worst-case");
    expect(llm.spentUsd()).toBeCloseTo(error.costUsd, 6);
  });

  it("charges a billed empty reply", async () => {
    const llm = createEvalLlm({
      mode: "fixture",
      fixture: { reply: () => ({ text: "", inputTokens: 50, outputTokens: 0, costUsd: 0.00002 }) },
    });
    const error = await llm.call(REQUEST).catch((e) => e);
    expect(error.billing).toBe("billed");
    expect(error.costUsd).toBe(0.00002);
    expect(llm.spentUsd()).toBe(0.00002);
  });

  it("fails a JSON call whose reply is not JSON, after charging it", async () => {
    const llm = createEvalLlm({ mode: "fixture", fixture: { reply: () => ({ text: "Sure! The score is 4." }) } });
    const error = await llm.call({ ...REQUEST, json: true }).catch((e) => e);
    expect(error).toBeInstanceOf(EvalCallError);
    expect(error.message).toMatch(/valid JSON/);
    expect(error.costUsd).toBeGreaterThan(0);
    expect(llm.ledger()[0].ok).toBe(false);
  });

  it("fails closed on a model OpenRouter does not list", async () => {
    const spy = spyFetch(createFixtureFetch());
    const llm = createEvalLlm({ mode: "live", apiKey: "k", fetchImpl: spy.fetchImpl });
    await expect(llm.call({ ...REQUEST, model: "made-up/model" })).rejects.toThrow(EvalConfigError);
    expect(spy.chats()).toHaveLength(0);
  });

  it("reads the model catalog once per run", async () => {
    const spy = spyFetch(createFixtureFetch());
    const llm = createEvalLlm({ mode: "live", apiKey: "k", fetchImpl: spy.fetchImpl });
    await Promise.all(FIXTURE_MODELS.map((model) => llm.call({ ...REQUEST, model })));
    expect(spy.calls.filter((c) => c.url.endsWith("/models"))).toHaveLength(1);
  });

  it("passes the request body the fixture expects", async () => {
    const seen: FixtureChatBody[] = [];
    const llm = createEvalLlm({
      mode: "fixture",
      fixture: { reply: (body) => (seen.push(body), { text: "ok" }) },
    });
    await llm.call({ ...REQUEST, temperature: 0.2 });
    expect(seen[0].temperature).toBe(0.2);
  });
});

describe("parseJsonReply", () => {
  it("accepts bare, fenced, and wrapped JSON", () => {
    expect(parseJsonReply('{"a":1}')).toEqual({ a: 1 });
    expect(parseJsonReply('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseJsonReply('Here you go: {"a":1} done')).toEqual({ a: 1 });
    expect(() => parseJsonReply("no json here")).toThrow();
  });
});
