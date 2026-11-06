/**
 * WP71-S1. Deterministic fixture transports for the AI crew's providers.
 *
 * Fixture mode is the default (`mode.ts`). Each fixture replaces only the
 * transport, so the adapter under test is the real adapter: request building,
 * reply parsing, fail-closed checks and cost maths run exactly as in live
 * mode. Nothing here touches the network, reads env or needs a key, so the
 * gateway (S2) and the evals (S6) can run end to end offline.
 *
 * Determinism: the same request always yields the same reply, id and usage.
 * - Claude: with `output_config.format`, the reply is the smallest instance
 *   of the schema (`sampleFromJsonSchema`); otherwise a fixed sentence.
 *   Usage is one token per four UTF-8 bytes, rounded up: the system prefix up
 *   to the last cache breakpoint is a cache write, the rest is input.
 * - Images: a 1×1 transparent PNG, as `b64_json`.
 * Callers (S2 gateway tests, S6 eval cases) replace any reply through the
 * `*FixtureResponder` options, e.g. to return a spec-valid artifact or a refusal.
 */

import type Anthropic from "@anthropic-ai/sdk";

import type { AnthropicMessagesClient, AnthropicRequestOptions } from "./anthropic";
import { isRecord, OPENAI_IMAGES_ENDPOINT, RECRAFT_ENDPOINT } from "./transport";
import type { Fetcher, TextStopReason } from "./types";

// ---------------------------------------------------------------------------
// Claude
// ---------------------------------------------------------------------------

export type AnthropicFixtureUsage = {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheReadTokens?: number;
  readonly cacheWriteTokens?: number;
  readonly thinkingTokens?: number;
};

/** What a fixture reply may set. Anything unset takes the deterministic default. */
export type AnthropicFixtureReply = {
  /** The reply text. Ignored when `json` is set. */
  readonly text?: string;
  /** A structured reply; serialised as the text. */
  readonly json?: unknown;
  readonly stopReason?: TextStopReason;
  readonly usage?: AnthropicFixtureUsage;
  /** Sets `stop_reason: "refusal"` and `stop_details`. */
  readonly refusal?: {
    readonly category: Anthropic.RefusalStopDetails["category"];
    readonly explanation?: string;
  };
};

export type AnthropicFixtureResponder = (
  params: Anthropic.MessageCreateParamsNonStreaming,
) => AnthropicFixtureReply | undefined | Promise<AnthropicFixtureReply | undefined>;

export const FIXTURE_TEXT_REPLY = "Fixture reply: no model was called.";

const utf8 = new TextEncoder();

function tokensFor(text: string): number {
  return Math.ceil(utf8.encode(text).byteLength / 4);
}

/** FNV-1a over the request body: a stable, short message id. */
function stableId(params: Anthropic.MessageCreateParamsNonStreaming): string {
  let hash = 0x811c9dc5;
  for (const byte of utf8.encode(JSON.stringify(params))) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `msg_fixture_${hash.toString(16).padStart(8, "0")}`;
}

function systemTexts(params: Anthropic.MessageCreateParamsNonStreaming): { cached: string; uncached: string } {
  const system = params.system;
  if (system === undefined) return { cached: "", uncached: "" };
  if (typeof system === "string") return { cached: "", uncached: system };
  let lastBreakpoint = -1;
  system.forEach((block, index) => {
    if (block.cache_control) lastBreakpoint = index;
  });
  const cached = system.slice(0, lastBreakpoint + 1).map((block) => block.text).join("");
  const uncached = system.slice(lastBreakpoint + 1).map((block) => block.text).join("");
  return { cached, uncached };
}

function userText(params: Anthropic.MessageCreateParamsNonStreaming): string {
  return params.messages
    .map((message) =>
      typeof message.content === "string"
        ? message.content
        : message.content.map((block) => (block.type === "text" ? block.text : "")).join(""),
    )
    .join("");
}

/** The deterministic usage for a request and its reply text. */
export function fixtureUsageFor(
  params: Anthropic.MessageCreateParamsNonStreaming,
  replyText: string,
): AnthropicFixtureUsage {
  const { cached, uncached } = systemTexts(params);
  return {
    inputTokens: tokensFor(uncached + userText(params)),
    cacheWriteTokens: tokensFor(cached),
    cacheReadTokens: 0,
    outputTokens: Math.min(params.max_tokens, Math.max(1, tokensFor(replyText))),
  };
}

/**
 * The smallest value that satisfies the common JSON Schema keywords: an
 * object with its required properties, the first `enum` / `const`, empty or
 * `minItems`-long arrays, `minLength`-long strings, numbers at `minimum`.
 * Deterministic, not exhaustive: a spec with tighter rules (regex, refinements)
 * supplies its own fixture reply.
 */
export function sampleFromJsonSchema(schema: unknown, depth = 0): unknown {
  if (!isRecord(schema) || depth > 32) return null;
  if ("const" in schema) return schema.const;
  if (Array.isArray(schema.enum) && schema.enum.length > 0) return schema.enum[0];
  for (const key of ["anyOf", "oneOf", "allOf"] as const) {
    const options = schema[key];
    if (Array.isArray(options) && options.length > 0) return sampleFromJsonSchema(options[0], depth + 1);
  }
  const type = Array.isArray(schema.type) ? schema.type.find((t) => t !== "null") ?? schema.type[0] : schema.type;
  switch (type) {
    case "object": {
      const properties = isRecord(schema.properties) ? schema.properties : {};
      const required = Array.isArray(schema.required)
        ? schema.required.filter((key): key is string => typeof key === "string")
        : Object.keys(properties);
      const value: Record<string, unknown> = {};
      for (const key of required) value[key] = sampleFromJsonSchema(properties[key], depth + 1);
      return value;
    }
    case "array": {
      const count = typeof schema.minItems === "number" && schema.minItems > 0 ? Math.min(schema.minItems, 16) : 0;
      return Array.from({ length: count }, () => sampleFromJsonSchema(schema.items, depth + 1));
    }
    case "string": {
      const min = typeof schema.minLength === "number" ? Math.min(schema.minLength, 4_096) : 0;
      const base = "fixture";
      return base.length >= min ? base : base.padEnd(min, "x");
    }
    case "integer":
    case "number":
      return typeof schema.minimum === "number" ? Math.ceil(schema.minimum) : 0;
    case "boolean":
      return false;
    case "null":
      return null;
    default:
      return null;
  }
}

function buildMessage(
  params: Anthropic.MessageCreateParamsNonStreaming,
  reply: AnthropicFixtureReply,
): Anthropic.Message {
  const format = params.output_config?.format;
  const refusal = reply.refusal;
  const text =
    refusal !== undefined
      ? ""
      : reply.json !== undefined
        ? JSON.stringify(reply.json)
        : reply.text ?? (format ? JSON.stringify(sampleFromJsonSchema(format.schema)) : FIXTURE_TEXT_REPLY);
  const usage = reply.usage ?? fixtureUsageFor(params, text);
  const stopReason: TextStopReason = refusal !== undefined ? "refusal" : (reply.stopReason ?? "end_turn");
  const content: Anthropic.ContentBlock[] =
    text.length === 0 ? [] : [{ type: "text", text, citations: null }];
  return {
    id: stableId(params),
    type: "message",
    role: "assistant",
    model: params.model,
    container: null,
    diagnostics: null,
    content,
    stop_reason: stopReason,
    stop_sequence: null,
    stop_details:
      refusal === undefined
        ? null
        : { type: "refusal", category: refusal.category, explanation: refusal.explanation ?? null },
    usage: {
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
      cache_read_input_tokens: usage.cacheReadTokens ?? 0,
      cache_creation_input_tokens: usage.cacheWriteTokens ?? 0,
      cache_creation: { ephemeral_5m_input_tokens: usage.cacheWriteTokens ?? 0, ephemeral_1h_input_tokens: 0 },
      output_tokens_details:
        usage.thinkingTokens === undefined ? null : { thinking_tokens: usage.thinkingTokens },
      inference_geo: null,
      server_tool_use: null,
      service_tier: "standard",
      speed: null,
    },
  };
}

function abortError(signal: AbortSignal): Error {
  return signal.reason instanceof Error ? signal.reason : new Error("aborted");
}

/** WP77-S3: fixture text deltas are cut into pieces of this many characters. */
export const FIXTURE_STREAM_CHUNK_CHARS = 16;

/** A reply's text in fixed-size pieces, as a stream would deliver it. */
export function fixtureTextChunks(text: string, size = FIXTURE_STREAM_CHUNK_CHARS): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) chunks.push(text.slice(i, i + size));
  return chunks;
}

/**
 * A Messages client that answers from fixtures. Honours an already-aborted
 * signal. `stream` (WP77-S3) builds the same message as `create` and emits its
 * text in `FIXTURE_STREAM_CHUNK_CHARS` pieces before `finalMessage` resolves,
 * so the streaming path is exercised offline with the same reply.
 */
export function createFixtureAnthropicClient(responder?: AnthropicFixtureResponder): AnthropicMessagesClient {
  const reply = async (params: Anthropic.MessageCreateParamsNonStreaming, options?: AnthropicRequestOptions) => {
    if (options?.signal?.aborted) throw abortError(options.signal);
    return buildMessage(params, (await responder?.(params)) ?? {});
  };
  return {
    messages: {
      create: reply,
      stream(params, options?: AnthropicRequestOptions) {
        const listeners: ((textDelta: string) => void)[] = [];
        return {
          on(_event: "text", listener: (textDelta: string) => void) {
            listeners.push(listener);
            return undefined;
          },
          async finalMessage() {
            const message = await reply(params, options);
            for (const block of message.content) {
              if (block.type !== "text") continue;
              for (const chunk of fixtureTextChunks(block.text)) {
                for (const listener of listeners) listener(chunk);
              }
            }
            return message;
          },
        };
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

/** A 1×1 transparent PNG. */
export const FIXTURE_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

/** A fixture image reply: an HTTP status (default 200) and a JSON body. */
export type ImageFixtureReply = { readonly status?: number; readonly body: unknown };

/** Receives the parsed request body the adapter would have sent. */
export type ImageFixtureResponder = (
  body: Record<string, unknown>,
) => ImageFixtureReply | undefined | Promise<ImageFixtureReply | undefined>;

function imageFixtureFetch(
  endpoint: string,
  defaultBody: () => unknown,
  responder?: ImageFixtureResponder,
): Fetcher {
  return async (input, init) => {
    if (init?.signal?.aborted) throw abortError(init.signal);
    if (input !== endpoint) {
      return new Response(JSON.stringify({ error: { message: `no fixture for ${input}` } }), { status: 404 });
    }
    let body: Record<string, unknown> = {};
    try {
      const parsed: unknown = typeof init?.body === "string" ? JSON.parse(init.body) : {};
      body = isRecord(parsed) ? parsed : {};
    } catch {
      body = {};
    }
    const reply = (await responder?.(body)) ?? { body: defaultBody() };
    return new Response(JSON.stringify(reply.body), {
      status: reply.status ?? 200,
      headers: { "content-type": "application/json" },
    });
  };
}

/** `fetch` for the OpenAI Images endpoint, answering from fixtures. */
export function fixtureOpenAiImagesFetch(responder?: ImageFixtureResponder): Fetcher {
  return imageFixtureFetch(
    OPENAI_IMAGES_ENDPOINT,
    () => ({
      created: 0,
      data: [{ b64_json: FIXTURE_PNG_BASE64 }],
      usage: { input_tokens: 0, output_tokens: 0 },
    }),
    responder,
  );
}

/** `fetch` for the Recraft endpoint, answering from fixtures. */
export function fixtureRecraftFetch(responder?: ImageFixtureResponder): Fetcher {
  return imageFixtureFetch(
    RECRAFT_ENDPOINT,
    () => ({ created: 0, data: [{ b64_json: FIXTURE_PNG_BASE64 }] }),
    responder,
  );
}
