// @vitest-environment node
/**
 * WP71-S1. Provider adapters: fixture mode, live-mode guards, request shape,
 * cost maths and error mapping. No test makes a network call: live mode is
 * only ever exercised with a fake SDK client or a fake fetch.
 */
import Anthropic from "@anthropic-ai/sdk";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  anthropicCostMicroUsd,
  anthropicWorstCaseMicroUsd,
  ANTHROPIC_RATE_CARDS,
  ceilMicroUsd,
  openAiImageCostMicroUsd,
  openAiImageSettleMicroUsd,
  OPENAI_IMAGE_TOKEN_RATES,
  recraftCostMicroUsd,
  RECRAFT_FLASH_MODEL,
  RECRAFT_SIZES,
  specWorstCaseMicroUsd,
  type RecraftModel,
  type RecraftSize,
} from "@/convex/ai/pricing";
import {
  ANTHROPIC_BASE_URL,
  createAnthropicAdapter,
  defaultAnthropicClientFactory,
  type AnthropicMessagesClient,
  type AnthropicRequestOptions,
} from "@/convex/ai/providers/anthropic";
import { FIXTURE_PNG_BASE64, sampleFromJsonSchema } from "@/convex/ai/providers/fixtures";
import { providerMode, resolveProviderAccess } from "@/convex/ai/providers/mode";
import { MAX_TIMEOUT_MS } from "@/convex/ai/providers/transport";
import { createOpenAiImagesAdapter, openAiImageReservationMicroUsd } from "@/convex/ai/providers/openaiImages";
import { createRecraftAdapter } from "@/convex/ai/providers/recraft";
import { ProviderError, type Fetcher, type TextRequest } from "@/convex/ai/providers/types";
import { TIER_MAX_INPUT_TOKENS, TIER_MAX_TOKENS, TIER_MODELS } from "@/lib/workspace/contracts/prompts";

const FIXTURE_ENV = {};
const LIVE_ENV = {
  AI_PROVIDER_MODE: "live",
  ANTHROPIC_API_KEY: "test-anthropic-key",
  OPENAI_API_KEY: "test-openai-key",
  RECRAFT_API_KEY: "test-recraft-key",
};

const SCHEMA = {
  type: "object",
  properties: { headline: { type: "string" }, bullets: { type: "array", items: { type: "string" } } },
  required: ["headline", "bullets"],
  additionalProperties: false,
};

function textRequest(overrides: Partial<TextRequest> = {}): TextRequest {
  return {
    model: TIER_MODELS.draft,
    effort: "low",
    thinking: { type: "between_tools" },
    maxTokens: 2_000,
    system: [
      { text: "You are the Weekend MVP crew.", cacheBreakpoint: true },
      { text: "Business: HydroTrail, a hydration app.", cacheBreakpoint: true },
    ],
    user: "Write the landing headline.",
    outputSchema: SCHEMA,
    timeoutMs: 5_000,
    ...overrides,
  };
}

type Captured = { params?: Anthropic.MessageCreateParamsNonStreaming; options?: AnthropicRequestOptions };

function message(overrides: Partial<Anthropic.Message> = {}): Anthropic.Message {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: TIER_MODELS.draft,
    container: null,
    diagnostics: null,
    content: [{ type: "text", text: JSON.stringify({ headline: "Drink up", bullets: [] }), citations: null }],
    stop_reason: "end_turn",
    stop_sequence: null,
    stop_details: null,
    usage: {
      input_tokens: 1_000,
      output_tokens: 500,
      cache_read_input_tokens: 2_000,
      cache_creation_input_tokens: 3_000,
      cache_creation: { ephemeral_5m_input_tokens: 3_000, ephemeral_1h_input_tokens: 0 },
      output_tokens_details: { thinking_tokens: 0 },
      inference_geo: null,
      server_tool_use: null,
      service_tier: "standard",
      speed: null,
    },
    ...overrides,
  };
}

function fakeClient(
  reply: (params: Anthropic.MessageCreateParamsNonStreaming, options?: AnthropicRequestOptions) => Promise<Anthropic.Message>,
  captured: Captured = {},
): AnthropicMessagesClient {
  return {
    messages: {
      create(params, options) {
        captured.params = params;
        captured.options = options;
        return reply(params, options);
      },
    },
  };
}

function liveAnthropic(client: AnthropicMessagesClient) {
  return createAnthropicAdapter({ env: LIVE_ENV, clientFactory: () => client });
}

async function caught(promise: Promise<unknown>): Promise<ProviderError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ProviderError) return error;
    throw error;
  }
  throw new Error("expected a ProviderError");
}

/** Rejects when the signal aborts; never resolves otherwise. */
function untilAborted(signal: AbortSignal | undefined): Promise<never> {
  return new Promise((_, reject) => {
    signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------

describe("provider mode", () => {
  it("is live only for exactly AI_PROVIDER_MODE=live", () => {
    expect(providerMode({ AI_PROVIDER_MODE: "live" })).toBe("live");
    for (const value of [undefined, "", "LIVE", " live", "fixture", "true", "1"]) {
      expect(providerMode({ AI_PROVIDER_MODE: value })).toBe("fixture");
    }
    expect(providerMode({})).toBe("fixture");
  });

  it("needs no key in fixture mode and a key in live mode", () => {
    expect(resolveProviderAccess("anthropic", {})).toEqual({ mode: "fixture" });
    expect(resolveProviderAccess("recraft", { AI_PROVIDER_MODE: "live", RECRAFT_API_KEY: "  k  " })).toEqual({
      mode: "live",
      apiKey: "k",
    });
    for (const provider of ["anthropic", "openai_images", "recraft"] as const) {
      let error: unknown;
      try {
        resolveProviderAccess(provider, { AI_PROVIDER_MODE: "live", ANTHROPIC_API_KEY: " " });
      } catch (thrown) {
        error = thrown;
      }
      expect(error).toBeInstanceOf(ProviderError);
      expect((error as ProviderError).kind).toBe("config");
      expect((error as ProviderError).billed).toBe("none");
    }
  });
});

describe("fixture mode makes no network call", () => {
  it("never calls fetch or the SDK client factory, and returns deterministic replies", async () => {
    const globalFetch = vi.fn();
    vi.stubGlobal("fetch", globalFetch);
    const clientFactory = vi.fn();
    const fetchImpl = vi.fn<Fetcher>();

    const anthropic = createAnthropicAdapter({ env: FIXTURE_ENV, clientFactory });
    const first = await anthropic.complete(textRequest());
    const second = await anthropic.complete(textRequest());
    expect(first).toEqual(second);
    expect(first.json).toEqual({ headline: "fixture", bullets: [] });
    expect(first.cost.estimated).toBe(false);
    expect(first.cost.billedAs).toBe("claude-sonnet-5-5 (fixture)");
    expect(first.usage.cacheWriteTokens).toBeGreaterThan(0);

    const text = await anthropic.complete(textRequest({ outputSchema: undefined }));
    expect(text.json).toBeUndefined();
    expect(text.text).toContain("Fixture reply");

    const openai = createOpenAiImagesAdapter({ env: FIXTURE_ENV, fetchImpl });
    const hero = await openai.generate({ prompt: "A hero", size: "1536x1024", quality: "medium", timeoutMs: 1_000 });
    const recraft = createRecraftAdapter({ env: FIXTURE_ENV, fetchImpl });
    const logo = await recraft.generate({ prompt: "A logo mark", size: "1024x1024", timeoutMs: 1_000 });

    expect(hero.cost.billedAs).toMatch(/ \(fixture\)$/);
    expect(logo.cost.billedAs).toMatch(/ \(fixture\)$/);
    for (const image of [hero.image, logo.image]) {
      expect(image.kind).toBe("bytes");
      if (image.kind === "bytes") expect(Array.from(image.bytes.slice(1, 4))).toEqual([0x50, 0x4e, 0x47]); // "PNG"
    }
    expect(globalFetch).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(clientFactory).not.toHaveBeenCalled();
  });

  it("lets a caller replace the fixture reply, including a refusal", async () => {
    const anthropic = createAnthropicAdapter({
      env: FIXTURE_ENV,
      fixtureResponder: () => ({ refusal: { category: "general_harms", explanation: "no" } }),
    });
    const error = await caught(anthropic.complete(textRequest()));
    expect(error.kind).toBe("refusal");
    expect(error.refusal).toEqual({ category: "general_harms", explanation: "no" });
  });

  it("samples the smallest schema instance deterministically", () => {
    expect(
      sampleFromJsonSchema({
        type: "object",
        properties: {
          tone: { enum: ["warm", "bold"] },
          count: { type: "integer", minimum: 3 },
          tags: { type: "array", minItems: 2, items: { type: "string", minLength: 10 } },
          note: { type: ["string", "null"] },
        },
        required: ["tone", "count", "tags", "note"],
      }),
    ).toEqual({ tone: "warm", count: 3, tags: ["fixturexxx", "fixturexxx"], note: "fixture" });
  });
});

describe("live mode without a key", () => {
  it("throws config before any client or fetch exists", async () => {
    const clientFactory = vi.fn();
    const fetchImpl = vi.fn<Fetcher>();
    const env = { AI_PROVIDER_MODE: "live" };

    const errors = await Promise.all([
      caught(createAnthropicAdapter({ env, clientFactory }).complete(textRequest())),
      caught(
        createOpenAiImagesAdapter({ env, fetchImpl }).generate({
          prompt: "x",
          size: "1024x1024",
          quality: "medium",
          timeoutMs: 1_000,
        }),
      ),
      caught(createRecraftAdapter({ env, fetchImpl }).generate({ prompt: "x", size: "1024x1024", timeoutMs: 1_000 })),
    ]);
    for (const error of errors) {
      expect(error.kind).toBe("config");
      expect(error.billed).toBe("none");
      expect(error.errorClass).toBe("permanent");
    }
    expect(clientFactory).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("Anthropic request shape", () => {
  it("sends effort, thinking, max_tokens, the JSON Schema format and cache breakpoints", async () => {
    const captured: Captured = {};
    const factory = vi.fn(() => fakeClient(async () => message(), captured));
    const adapter = createAnthropicAdapter({ env: LIVE_ENV, clientFactory: factory });
    await adapter.complete(
      textRequest({
        system: [
          { text: "Crew charter.", cacheBreakpoint: true },
          { text: "Business context.", cacheBreakpoint: true },
          { text: "Not cached." },
        ],
      }),
    );

    expect(factory).toHaveBeenCalledWith("test-anthropic-key");
    const params = captured.params;
    expect(params).toBeDefined();
    expect(params?.model).toBe("claude-sonnet-5-5");
    expect(params?.max_tokens).toBe(2_000);
    expect(params?.thinking).toEqual({ type: "between_tools" });
    expect(params?.output_config).toEqual({ effort: "low", format: { type: "json_schema", schema: SCHEMA } });
    expect(params?.system).toEqual([
      { type: "text", text: "Crew charter.", cache_control: { type: "ephemeral", ttl: "5m" } },
      { type: "text", text: "Business context.", cache_control: { type: "ephemeral", ttl: "5m" } },
      { type: "text", text: "Not cached." },
    ]);
    expect(params?.messages).toEqual([{ role: "user", content: "Write the landing headline." }]);
    const keys = Object.keys(params ?? {});
    for (const forbidden of ["fallbacks", "temperature", "top_p", "top_k", "betas", "stream"]) {
      expect(keys).not.toContain(forbidden);
    }
    expect(captured.options?.maxRetries).toBe(0);
    expect(captured.options?.signal).toBeInstanceOf(AbortSignal);
    expect(captured.options?.timeout).toBe(5_000);
  });

  it("maps each thinking setting and omits format in text mode", async () => {
    const captured: Captured = {};
    const adapter = liveAnthropic(fakeClient(async () => message({ content: [{ type: "text", text: "hi", citations: null }] }), captured));

    await adapter.complete(
      textRequest({ model: TIER_MODELS.fast, effort: "medium", thinking: { type: "disabled" }, outputSchema: undefined }),
    );
    expect(captured.params?.thinking).toEqual({ type: "disabled" });
    expect(captured.params?.output_config).toEqual({ effort: "medium" });

    await adapter.complete(
      textRequest({
        model: TIER_MODELS.deep,
        effort: "medium",
        thinking: { type: "adaptive", display: "summarized" },
        outputSchema: undefined,
      }),
    );
    expect(captured.params?.thinking).toEqual({ type: "adaptive", display: "summarized" });
  });

  it("refuses more than four cache breakpoints before sending", async () => {
    const create = vi.fn();
    const adapter = liveAnthropic({ messages: { create } });
    const system = Array.from({ length: 5 }, (_, i) => ({ text: `block ${i}`, cacheBreakpoint: true }));
    const error = await caught(adapter.complete(textRequest({ system })));
    expect(error.kind).toBe("config");
    expect(create).not.toHaveBeenCalled();
  });
});

describe("Anthropic reply handling", () => {
  it("returns text, parsed JSON, usage and cost", async () => {
    const result = await liveAnthropic(fakeClient(async () => message())).complete(textRequest());
    expect(result.stopReason).toBe("end_turn");
    expect(result.json).toEqual({ headline: "Drink up", bullets: [] });
    expect(result.usage).toEqual({
      inputTokens: 1_000,
      cacheReadTokens: 2_000,
      cacheWriteTokens: 3_000,
      outputTokens: 500,
      thinkingTokens: 0,
    });
    // Sonnet 5.5: 1000×$2 + 2000×$0.20 + 3000×$2.50 + 500×$10 per MTok.
    expect(result.cost).toMatchObject({ provider: "anthropic", billedAs: "claude-sonnet-5-5", microUsd: 14_900, estimated: false });
  });

  it("surfaces a refusal with its category and cost", async () => {
    const reply = message({
      content: [],
      stop_reason: "refusal",
      stop_details: { type: "refusal", category: "cyber", explanation: "declined" },
    });
    const error = await caught(liveAnthropic(fakeClient(async () => reply)).complete(textRequest()));
    expect(error.kind).toBe("refusal");
    expect(error.errorClass).toBe("refusal");
    expect(error.billed).toBe("actual");
    expect(error.stopReason).toBe("refusal");
    expect(error.refusal).toEqual({ category: "cyber", explanation: "declined" });
    expect(error.cost?.microUsd).toBe(14_900);
    expect(error.retryable).toBe(false);
  });

  it("raises invalid_output with the cost for unparseable or truncated structured replies", async () => {
    const notJson = message({ content: [{ type: "text", text: "{not json", citations: null }] });
    const truncated = message({ stop_reason: "max_tokens" });
    for (const reply of [notJson, truncated]) {
      const error = await caught(liveAnthropic(fakeClient(async () => reply)).complete(textRequest()));
      expect(error.kind).toBe("invalid_output");
      expect(error.errorClass).toBe("schema_invalid");
      expect(error.billed).toBe("actual");
      expect(error.cost?.microUsd).toBe(14_900);
      expect(error.usage?.outputTokens).toBe(500);
    }
  });

  it("uses the conservative fallback when usage is missing", async () => {
    const { usage: _usage, ...rest } = message();
    void _usage;
    const noUsage = rest as unknown as Anthropic.Message;
    const request = textRequest({ model: TIER_MODELS.draft });
    const result = await liveAnthropic(fakeClient(async () => noUsage)).complete(request);

    const bytes =
      new TextEncoder().encode("You are the Weekend MVP crew.").byteLength +
      new TextEncoder().encode("Business: HydroTrail, a hydration app.").byteLength +
      new TextEncoder().encode("Write the landing headline.").byteLength +
      new TextEncoder().encode(JSON.stringify(SCHEMA)).byteLength +
      200;
    expect(result.cost.estimated).toBe(true);
    expect(result.usage).toEqual({ inputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: bytes, outputTokens: 2_000 });
    // Every input byte at the cache-write rate, plus max_tokens of output.
    expect(result.cost.microUsd).toBe(ceilMicroUsd(bytes * 2.5 + 2_000 * 10));
  });

  it("aborts on the deadline and reports a possibly billed timeout", async () => {
    const captured: Captured = {};
    const client = fakeClient((_params, options) => untilAborted(options?.signal), captured);
    const started = Date.now();
    const error = await caught(liveAnthropic(client).complete(textRequest({ timeoutMs: 30 })));
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(captured.options?.signal?.aborted).toBe(true);
    expect(error.kind).toBe("timeout");
    expect(error.errorClass).toBe("timeout");
    expect(error.billed).toBe("possible");
  });

  it("maps HTTP 429, 5xx, 401 and 400 to their error classes", async () => {
    const cases = [
      { status: 429, kind: "rate_limit", errorClass: "retryable", billed: "none", retryable: true },
      { status: 500, kind: "server", errorClass: "retryable", billed: "possible", retryable: true },
      { status: 529, kind: "server", errorClass: "retryable", billed: "possible", retryable: true },
      { status: 401, kind: "auth", errorClass: "permanent", billed: "none", retryable: false },
      { status: 400, kind: "bad_request", errorClass: "permanent", billed: "none", retryable: false },
    ] as const;
    for (const expected of cases) {
      const apiError = Anthropic.APIError.generate(
        expected.status,
        { type: "error", error: { type: "api_error", message: "test" } },
        "test",
        new Headers(),
      );
      const error = await caught(liveAnthropic(fakeClient(async () => Promise.reject(apiError))).complete(textRequest()));
      expect(error).toMatchObject({
        kind: expected.kind,
        billed: expected.billed,
        status: expected.status,
        retryable: expected.retryable,
      });
      expect(error.errorClass).toBe(expected.errorClass);
    }
  });

  it("maps a connection failure to network, billed possible", async () => {
    const failure = new Anthropic.APIConnectionError({ message: "socket hang up" });
    const error = await caught(liveAnthropic(fakeClient(async () => Promise.reject(failure))).complete(textRequest()));
    expect(error.kind).toBe("network");
    expect(error.errorClass).toBe("indeterminate");
    expect(error.billed).toBe("possible");
  });
});

describe("rate cards and micro-USD maths", () => {
  it("covers every tier model with dated rates", () => {
    for (const model of Object.values(TIER_MODELS)) {
      expect(ANTHROPIC_RATE_CARDS[model].effectiveFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("prices usage per model and rounds up to whole micro-USD", () => {
    // Haiku: 3 input tokens × $0.10/MTok = 0.3 µ$ → 1.
    expect(anthropicCostMicroUsd("claude-haiku-5-5", { inputTokens: 3, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: 0 })).toBe(1);
    expect(anthropicCostMicroUsd("claude-haiku-5-5", { inputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: 0 })).toBe(0);
    // Float noise is not rounded up: 1000 × 0.1 is exactly 100.
    expect(anthropicCostMicroUsd("claude-haiku-5-5", { inputTokens: 1_000, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: 0 })).toBe(100);
    // Opus 5.5: cache reads are $0.20 (0.05× input), writes $5.
    expect(
      anthropicCostMicroUsd("claude-opus-5-5", { inputTokens: 1_000, cacheReadTokens: 10_000, cacheWriteTokens: 1_000, outputTokens: 1_000 }),
    ).toBe(4_000 + 2_000 + 5_000 + 20_000);
  });

  it("switches Haiku to the long-context card above 100K prompt tokens", () => {
    const usage = { inputTokens: 100_001, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: 0 };
    expect(anthropicCostMicroUsd("claude-haiku-5-5", usage)).toBe(50_001); // 100,001 × $0.50 = 50,000.5 → 50,001
    expect(anthropicCostMicroUsd("claude-haiku-5-5", { ...usage, inputTokens: 100_000 })).toBe(10_000);
  });

  it("halves every rate on the batch API", () => {
    const usage = { inputTokens: 1_000, cacheReadTokens: 1_000, cacheWriteTokens: 1_000, outputTokens: 1_000 };
    const realtime = anthropicCostMicroUsd("claude-opus-5-5", usage);
    expect(anthropicCostMicroUsd("claude-opus-5-5", usage, { batch: true })).toBe(realtime / 2);
  });

  it("sizes the worst case from max input at the cache-write rate plus max_tokens", () => {
    // `02` / C-PROMPT: the worst deep escalation is about $0.55.
    expect(
      anthropicWorstCaseMicroUsd({
        model: "claude-opus-5-5",
        inputTokens: TIER_MAX_INPUT_TOKENS.deep_realtime,
        maxTokens: TIER_MAX_TOKENS.draft,
      }),
    ).toBe(60_000 * 5 + 12_288 * 20);
    expect(specWorstCaseMicroUsd({ tier: "draft", mode: "realtime", maxTokens: TIER_MAX_TOKENS.draft })).toBe(
      60_000 * 2.5 + 12_288 * 10,
    );
    expect(specWorstCaseMicroUsd({ tier: "deep", mode: "batch", maxTokens: TIER_MAX_TOKENS.deep })).toBe(
      (120_000 * 5 + 24_576 * 20) / 2,
    );
    expect(() =>
      anthropicWorstCaseMicroUsd({ model: "claude-haiku-5-5", inputTokens: 50_000, maxTokens: 10, maxInputTokens: 40_000 }),
    ).toThrow(RangeError);
  });

  it("matches the measured image costs", () => {
    expect(openAiImageCostMicroUsd({ quality: "medium", size: "1536x1024", promptBytes: 0 })).toBe(41_000);
    expect(openAiImageCostMicroUsd({ quality: "medium", size: "1024x1024", promptBytes: 0 })).toBe(53_000);
    expect(recraftCostMicroUsd({ size: "1024x1024" })).toBe(35_000);
    expect(recraftCostMicroUsd({ size: "1024x1024", count: 3 })).toBe(105_000);
  });
});

describe("image adapters", () => {
  function pngReply(): Response {
    return new Response(JSON.stringify({ data: [{ b64_json: FIXTURE_PNG_BASE64 }], usage: { input_tokens: 12, output_tokens: 0 } }), {
      status: 200,
    });
  }

  it("sends a priced gpt-image-2 request and reports the measured cost", async () => {
    const fetchImpl = vi.fn<Fetcher>(async () => pngReply());
    const adapter = createOpenAiImagesAdapter({ env: LIVE_ENV, fetchImpl });
    const result = await adapter.generate({ prompt: "An offer image", size: "1536x1024", quality: "medium", timeoutMs: 1_000 });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/images/generations");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer test-openai-key");
    expect(JSON.parse(String(init?.body))).toEqual({
      model: "gpt-image-2",
      prompt: "An offer image",
      size: "1536x1024",
      quality: "medium",
      n: 1,
      output_format: "png",
    });
    // Reported usage (12 text tokens) is under the table price, so the table price stands.
    expect(result.cost).toMatchObject({ provider: "openai_images", microUsd: 41_000, estimated: false });
    expect(result.cost.billedAs).toBe("gpt-image-2 medium 1536x1024");
    expect(result.cost.units).toEqual({ images: 1, input_tokens: 12, output_tokens: 0 });
  });

  it("rejects unpriced sizes and qualities before fetch", async () => {
    const fetchImpl = vi.fn<Fetcher>();
    const adapter = createOpenAiImagesAdapter({ env: LIVE_ENV, fetchImpl });
    const bad = [
      { size: "1024x1536", quality: "medium" },
      { size: "1024x1024", quality: "high" },
    ] as const;
    for (const { size, quality } of bad) {
      const error = await caught(
        adapter.generate({ prompt: "x", size: size as unknown as "1024x1024", quality: quality as unknown as "medium", timeoutMs: 1_000 }),
      );
      expect(error.kind).toBe("config");
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("only accepts Recraft sizes V4.1 supports and we price", async () => {
    expect(RECRAFT_SIZES).toEqual(["1024x1024"]);
    const fetchImpl = vi.fn<Fetcher>(async () => pngReply());
    const adapter = createRecraftAdapter({ env: LIVE_ENV, fetchImpl });
    for (const size of ["1536x1024", "1024x1536", "2048x2048"]) {
      const error = await caught(adapter.generate({ prompt: "x", size: size as RecraftSize, timeoutMs: 1_000 }));
      expect(error.kind).toBe("config");
    }
    expect(fetchImpl).not.toHaveBeenCalled();

    const result = await adapter.generate({ prompt: "A logo mark", size: "1024x1024", styleId: "style-uuid", timeoutMs: 1_000 });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://external.api.recraft.ai/v1/images/generations");
    expect(JSON.parse(String(init?.body))).toEqual({
      prompt: "A logo mark",
      model: "recraftv4_1",
      size: "1024x1024",
      n: 1,
      response_format: "b64_json",
      image_format: "png",
      style_id: "style-uuid",
    });
    expect(result.cost).toMatchObject({ provider: "recraft", microUsd: 35_000, estimated: true });
  });

  it("sends V4.1 Flash as recraftv4_1_flash at $0.007 and refuses a styleId or an unpriced model (WP67-S7)", async () => {
    expect(RECRAFT_FLASH_MODEL).toBe("recraftv4_1_flash");
    expect(recraftCostMicroUsd({ size: "1024x1024", model: RECRAFT_FLASH_MODEL })).toBe(7_000);
    expect(recraftCostMicroUsd({ size: "1024x1024", model: RECRAFT_FLASH_MODEL, count: 13 })).toBe(91_000);
    expect(recraftCostMicroUsd({ size: "1024x1024" })).toBe(35_000);
    expect(() => recraftCostMicroUsd({ size: "1024x1024", model: "gpt-image-2" as RecraftModel })).toThrow(RangeError);

    const fetchImpl = vi.fn<Fetcher>(async () => pngReply());
    const adapter = createRecraftAdapter({ env: LIVE_ENV, fetchImpl });
    const withStyle = await caught(
      adapter.generate({ prompt: "x", size: "1024x1024", model: RECRAFT_FLASH_MODEL, styleId: "style-uuid", timeoutMs: 1_000 }),
    );
    expect(withStyle).toMatchObject({ kind: "config", billed: "none" });
    const unpriced = await caught(
      adapter.generate({ prompt: "x", size: "1024x1024", model: "gpt-image-2" as RecraftModel, timeoutMs: 1_000 }),
    );
    expect(unpriced).toMatchObject({ kind: "config", billed: "none" });
    expect(fetchImpl).not.toHaveBeenCalled();

    const result = await adapter.generate({ prompt: "An avatar", size: "1024x1024", model: RECRAFT_FLASH_MODEL, timeoutMs: 1_000 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://external.api.recraft.ai/v1/images/generations");
    expect(JSON.parse(String(init?.body))).toEqual({
      prompt: "An avatar",
      model: "recraftv4_1_flash",
      size: "1024x1024",
      n: 1,
      response_format: "b64_json",
      image_format: "png",
    });
    expect(result.model).toBe("recraftv4_1_flash");
    expect(result.image.kind).toBe("bytes");
    expect(result.cost).toMatchObject({
      provider: "recraft",
      billedAs: "recraftv4_1_flash 1024x1024",
      microUsd: 7_000,
      estimated: true,
      rateCard: "2026-11-07",
    });
  });

  it("fails closed for Flash: no key means no call, and fixture mode never reads as live spend (WP67-S7)", async () => {
    const fetchImpl = vi.fn<Fetcher>(async () => pngReply());
    const noKey = await caught(
      createRecraftAdapter({ env: { AI_PROVIDER_MODE: "live" }, fetchImpl }).generate({
        prompt: "x",
        size: "1024x1024",
        model: RECRAFT_FLASH_MODEL,
        timeoutMs: 1_000,
      }),
    );
    expect(noKey).toMatchObject({ kind: "config", billed: "none" });
    expect(fetchImpl).not.toHaveBeenCalled();

    const fixture = await createRecraftAdapter({ env: FIXTURE_ENV, fetchImpl }).generate({
      prompt: "x",
      size: "1024x1024",
      model: RECRAFT_FLASH_MODEL,
      timeoutMs: 1_000,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(fixture.cost.billedAs).toBe("recraftv4_1_flash 1024x1024 (fixture)");
  });

  it("maps HTTP 429, 5xx and moderation blocks to their error classes", async () => {
    const cases = [
      { status: 429, body: {}, kind: "rate_limit", billed: "none" },
      { status: 503, body: {}, kind: "server", billed: "possible" },
      { status: 400, body: { error: { code: "moderation_blocked" } }, kind: "refusal", billed: "none" },
      { status: 400, body: { error: { code: "invalid_size" } }, kind: "bad_request", billed: "none" },
    ] as const;
    for (const expected of cases) {
      const fetchImpl: Fetcher = async () => new Response(JSON.stringify(expected.body), { status: expected.status });
      const error = await caught(
        createOpenAiImagesAdapter({ env: LIVE_ENV, fetchImpl }).generate({
          prompt: "x",
          size: "1024x1024",
          quality: "medium",
          timeoutMs: 1_000,
        }),
      );
      expect(error).toMatchObject({ kind: expected.kind, billed: expected.billed, status: expected.status });
    }
    const recraftError = await caught(
      createRecraftAdapter({ env: LIVE_ENV, fetchImpl: async () => new Response("{}", { status: 500 }) }).generate({
        prompt: "x",
        size: "1024x1024",
        timeoutMs: 1_000,
      }),
    );
    expect(recraftError).toMatchObject({ kind: "server", billed: "possible" });
  });

  it("aborts on the deadline", async () => {
    const fetchImpl: Fetcher = (_url, init) => untilAborted(init?.signal ?? undefined);
    for (const adapter of [
      createRecraftAdapter({ env: LIVE_ENV, fetchImpl }),
      createOpenAiImagesAdapter({ env: LIVE_ENV, fetchImpl }),
    ]) {
      const error = await caught(
        adapter.provider === "recraft"
          ? adapter.generate({ prompt: "x", size: "1024x1024", timeoutMs: 20 })
          : adapter.generate({ prompt: "x", size: "1024x1024", quality: "medium", timeoutMs: 20 }),
      );
      expect(error.kind).toBe("timeout");
      expect(error.billed).toBe("possible");
    }
  });

  it("charges a billed 2xx that holds no image", async () => {
    const fetchImpl: Fetcher = async () => new Response(JSON.stringify({ data: [] }), { status: 200 });
    const error = await caught(
      createOpenAiImagesAdapter({ env: LIVE_ENV, fetchImpl }).generate({
        prompt: "x",
        size: "1024x1024",
        quality: "medium",
        timeoutMs: 1_000,
      }),
    );
    expect(error.kind).toBe("invalid_output");
    expect(error.billed).toBe("actual");
    expect(error.cost?.microUsd).toBe(53_000);
  });
});

// ---------------------------------------------------------------------------
// Review fixes
// ---------------------------------------------------------------------------

describe("cancellation and client construction", () => {
  it("throws config, billed none, for a signal aborted before the send", async () => {
    const controller = new AbortController();
    controller.abort();
    const create = vi.fn();
    const fetchImpl = vi.fn<Fetcher>();
    const errors = [
      await caught(liveAnthropic({ messages: { create } }).complete(textRequest({ signal: controller.signal }))),
      await caught(
        createOpenAiImagesAdapter({ env: LIVE_ENV, fetchImpl }).generate({
          prompt: "x",
          size: "1024x1024",
          quality: "medium",
          timeoutMs: 1_000,
          signal: controller.signal,
        }),
      ),
      await caught(
        createRecraftAdapter({ env: LIVE_ENV, fetchImpl }).generate({
          prompt: "x",
          size: "1024x1024",
          timeoutMs: 1_000,
          signal: controller.signal,
        }),
      ),
    ];
    for (const error of errors) expect(error).toMatchObject({ kind: "config", billed: "none" });
    expect(create).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("reports a parent abort after the send as aborted, billed possible", async () => {
    const controller = new AbortController();
    const client = fakeClient((_params, options) => {
      setTimeout(() => controller.abort(), 5);
      return untilAborted(options?.signal);
    });
    const error = await caught(liveAnthropic(client).complete(textRequest({ signal: controller.signal })));
    expect(error).toMatchObject({ kind: "aborted", billed: "possible" });
    expect(error.errorClass).toBe("indeterminate");
  });

  it("turns a throwing client factory into config, billed none", async () => {
    const adapter = createAnthropicAdapter({
      env: LIVE_ENV,
      clientFactory: () => {
        throw new Error("bad options");
      },
    });
    const error = await caught(adapter.complete(textRequest()));
    expect(error).toMatchObject({ kind: "config", billed: "none" });
  });

  it("builds the default client with retries off and the pinned base URL", () => {
    const client = defaultAnthropicClientFactory("dummy-key-no-request");
    expect(client).toBeInstanceOf(Anthropic);
    const sdk = client as Anthropic;
    expect(sdk.maxRetries).toBe(0);
    expect(sdk.baseURL).toBe("https://api.anthropic.com");
    expect(ANTHROPIC_BASE_URL).toBe("https://api.anthropic.com");
  });

  it("caps deadlines under the Convex action limit", async () => {
    expect(MAX_TIMEOUT_MS).toBe(9 * 60 * 1_000);
    const create = vi.fn();
    const error = await caught(liveAnthropic({ messages: { create } }).complete(textRequest({ timeoutMs: MAX_TIMEOUT_MS + 1 })));
    expect(error.kind).toBe("config");
    expect(create).not.toHaveBeenCalled();
  });
});

describe("timeouts reported by the SDK or the server", () => {
  it("maps APIConnectionTimeoutError and HTTP 408 to timeout, billed possible", async () => {
    const sdkTimeout = new Anthropic.APIConnectionTimeoutError();
    const http408 = Anthropic.APIError.generate(408, { type: "error", error: { type: "timeout_error", message: "t" } }, "t", new Headers());
    for (const thrown of [sdkTimeout, http408]) {
      const error = await caught(liveAnthropic(fakeClient(async () => Promise.reject(thrown))).complete(textRequest()));
      expect(error).toMatchObject({ kind: "timeout", billed: "possible" });
      expect(error.errorClass).toBe("timeout");
    }
  });
});

describe("unusable Claude replies", () => {
  it("raises invalid_output with the cost for every incomplete stop, in both modes", async () => {
    const stops = ["max_tokens", "tool_use", "pause_turn", "model_context_window_exceeded"] as const;
    for (const stop of stops) {
      for (const outputSchema of [SCHEMA, undefined]) {
        const reply = message({ stop_reason: stop });
        const error = await caught(liveAnthropic(fakeClient(async () => reply)).complete(textRequest({ outputSchema })));
        expect(error).toMatchObject({ kind: "invalid_output", billed: "actual", stopReason: stop });
        expect(error.cost?.microUsd).toBe(14_900);
      }
    }
  });

  it("raises invalid_output for an empty reply", async () => {
    for (const content of [[], [{ type: "text" as const, text: "   ", citations: null }]]) {
      const error = await caught(
        liveAnthropic(fakeClient(async () => message({ content }))).complete(textRequest({ outputSchema: undefined })),
      );
      expect(error).toMatchObject({ kind: "invalid_output", billed: "actual" });
      expect(error.cost?.microUsd).toBe(14_900);
    }
  });

  it("falls back conservatively on partial or malformed usage", async () => {
    const base = message().usage;
    const request = textRequest({ outputSchema: undefined });
    const contentOk = { content: [{ type: "text" as const, text: "ok", citations: null }] };

    // Malformed cache count: the whole input side takes the fallback.
    const badCache = { ...base, cache_read_input_tokens: 1.5 } as unknown as Anthropic.Usage;
    const r1 = await liveAnthropic(fakeClient(async () => message({ ...contentOk, usage: badCache }))).complete(request);
    expect(r1.cost.estimated).toBe(true);
    expect(r1.usage.inputTokens).toBe(0);
    expect(r1.usage.cacheReadTokens).toBe(0);
    expect(r1.usage.cacheWriteTokens).toBeGreaterThan(200);
    expect(r1.usage.outputTokens).toBe(500);

    // Missing output count: max_tokens is charged.
    const noOutput = { ...base, output_tokens: undefined } as unknown as Anthropic.Usage;
    const r2 = await liveAnthropic(fakeClient(async () => message({ ...contentOk, usage: noOutput }))).complete(request);
    expect(r2.cost.estimated).toBe(true);
    expect(r2.usage.outputTokens).toBe(request.maxTokens);
    expect(r2.usage.inputTokens).toBe(1_000);

    // Negative input count is malformed.
    const negative = { ...base, input_tokens: -1 } as unknown as Anthropic.Usage;
    const r3 = await liveAnthropic(fakeClient(async () => message({ ...contentOk, usage: negative }))).complete(request);
    expect(r3.cost.estimated).toBe(true);
    expect(r3.usage.inputTokens).toBe(0);

    // Null cache counts are the API's "none": not estimated.
    const nullCache = { ...base, cache_read_input_tokens: null, cache_creation_input_tokens: null };
    const r4 = await liveAnthropic(fakeClient(async () => message({ ...contentOk, usage: nullCache }))).complete(request);
    expect(r4.cost.estimated).toBe(false);
    expect(r4.usage).toMatchObject({ inputTokens: 1_000, cacheReadTokens: 0, cacheWriteTokens: 0 });
  });
});

describe("Haiku long-context worst case", () => {
  it("uses the long-context card when the lane bound is over 100K, even for a small estimate", () => {
    const small = anthropicWorstCaseMicroUsd({ model: "claude-haiku-5-5", inputTokens: 1_000, maxTokens: 1_000 });
    expect(small).toBe(ceilMicroUsd(1_000 * 0.125 + 1_000 * 0.5));
    const bounded = anthropicWorstCaseMicroUsd({
      model: "claude-haiku-5-5",
      inputTokens: 1_000,
      maxTokens: 1_000,
      maxInputTokens: 120_000,
    });
    expect(bounded).toBe(ceilMicroUsd(1_000 * 0.625 + 1_000 * 2.5));
    expect(
      anthropicWorstCaseMicroUsd({ model: "claude-haiku-5-5", inputTokens: 100_001, maxTokens: 0 + 1 }),
    ).toBe(ceilMicroUsd(100_001 * 0.625 + 2.5));
    // Within the fast lane (40K) the standard card applies.
    expect(
      anthropicWorstCaseMicroUsd({ model: "claude-haiku-5-5", inputTokens: 1_000, maxTokens: 1_000, maxInputTokens: 40_000 }),
    ).toBe(small);
  });
});

describe("gpt-image-2 token billing", () => {
  it("reserves the table price plus the prompt bytes at the text-input rate", () => {
    const prompt = "A sunlit café — offer image";
    const bytes = new TextEncoder().encode(prompt).byteLength;
    expect(openAiImageReservationMicroUsd({ prompt, size: "1536x1024", quality: "medium", timeoutMs: 1_000 })).toBe(
      41_000 + bytes * OPENAI_IMAGE_TOKEN_RATES.textInput,
    );
    expect(OPENAI_IMAGE_TOKEN_RATES).toMatchObject({ textInput: 5, imageOutput: 30 });
  });

  it("settles at the larger of the table price and tokens × rates", async () => {
    expect(openAiImageSettleMicroUsd({ quality: "medium", size: "1024x1024", inputTokens: 100, outputTokens: 100 })).toBe(53_000);
    // 200 × $5 + 2,000 × $30 per MTok = 61,000 µ$, above the $0.053 table price.
    expect(openAiImageSettleMicroUsd({ quality: "medium", size: "1024x1024", inputTokens: 200, outputTokens: 2_000 })).toBe(61_000);

    const fetchImpl: Fetcher = async () =>
      new Response(JSON.stringify({ data: [{ b64_json: FIXTURE_PNG_BASE64 }], usage: { input_tokens: 200, output_tokens: 2_000 } }), {
        status: 200,
      });
    const result = await createOpenAiImagesAdapter({ env: LIVE_ENV, fetchImpl }).generate({
      prompt: "x",
      size: "1024x1024",
      quality: "medium",
      timeoutMs: 1_000,
    });
    expect(result.cost).toMatchObject({ microUsd: 61_000, estimated: false });

    const noUsage: Fetcher = async () => new Response(JSON.stringify({ data: [{ b64_json: FIXTURE_PNG_BASE64 }] }), { status: 200 });
    const estimated = await createOpenAiImagesAdapter({ env: LIVE_ENV, fetchImpl: noUsage }).generate({
      prompt: "x",
      size: "1024x1024",
      quality: "medium",
      timeoutMs: 1_000,
    });
    expect(estimated.cost).toMatchObject({ microUsd: 53_000, estimated: true });
  });
});

describe("billed 2xx image replies we cannot use", () => {
  const NOT_PNG = btoa("GIF89a not a png at all");

  it("raises invalid_output for an unparseable body, bad base64 or non-PNG bytes from OpenAI", async () => {
    const bodies = ["{not json", JSON.stringify({ data: [{ b64_json: "%%%not-base64%%%" }] }), JSON.stringify({ data: [{ b64_json: NOT_PNG }] })];
    for (const body of bodies) {
      const fetchImpl: Fetcher = async () => new Response(body, { status: 200 });
      const error = await caught(
        createOpenAiImagesAdapter({ env: LIVE_ENV, fetchImpl }).generate({
          prompt: "x",
          size: "1024x1024",
          quality: "medium",
          timeoutMs: 1_000,
        }),
      );
      expect(error).toMatchObject({ kind: "invalid_output", billed: "actual" });
      expect(error.cost?.microUsd).toBe(53_000);
    }
  });

  it("raises invalid_output for a non-PNG Recraft image", async () => {
    const fetchImpl: Fetcher = async () => new Response(JSON.stringify({ data: [{ b64_json: NOT_PNG }] }), { status: 200 });
    const error = await caught(
      createRecraftAdapter({ env: LIVE_ENV, fetchImpl }).generate({ prompt: "x", size: "1024x1024", timeoutMs: 1_000 }),
    );
    expect(error).toMatchObject({ kind: "invalid_output", billed: "actual" });
    expect(error.cost?.microUsd).toBe(35_000);
  });
});
