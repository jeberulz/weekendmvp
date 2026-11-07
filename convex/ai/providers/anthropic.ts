/**
 * WP71-S1. Claude adapter over the official SDK (`@anthropic-ai/sdk`).
 *
 * The only file outside `providers/fixtures.ts` that touches the SDK, and
 * the only one that imports its runtime (D11, `02` §5.5).
 *
 * Request shape (Claude 5.5, checked against the installed SDK 1.5.0 types
 * and the `claude-api` skill on 2026-11-05):
 * - `output_config.effort` is always sent (Haiku and Opus 5.5 default to
 *   `medium`, Sonnet 5.5 to `high`; an unset effort is a hidden cost line).
 * - `thinking` is always sent, exactly as the spec sets it
 *   (`adaptive` / `between_tools` / `disabled`; C-PROMPT validates which
 *   model accepts which). Never `budget_tokens`.
 * - Structured output is `output_config.format: { type: "json_schema", schema }`
 *   with the caller's JSON Schema.
 * - System blocks carry `cache_control: { type: "ephemeral", ttl: "5m" }`
 *   where the caller asks for a breakpoint (at most four).
 * - No `fallbacks`, no beta header: a refusal stops the request and fails
 *   the job (C-PROMPT header, `02` §5.8). No sampling parameters, no prefill.
 * - The SDK's own retries are off (`maxRetries: 0`): a retry would bill a
 *   second call against one reservation. The gateway owns retries.
 *
 * Outcomes:
 * - A usable reply returns a `TextResult` (text, parsed JSON when a schema
 *   was sent, stop reason, usage and cost).
 * - `stop_reason: "refusal"` throws `ProviderError` kind `refusal`, billed
 *   `actual`, with the cost, usage and `stop_details` category.
 * - A billed reply we cannot use throws kind `invalid_output`, billed
 *   `actual`, with its cost: empty, not JSON (when a schema was sent), or
 *   stopped by anything but `end_turn` / `stop_sequence`. That covers
 *   `max_tokens` (truncated) in text mode too, and `tool_use`, `pause_turn`
 *   and `model_context_window_exceeded`: we never send tools (D23). The
 *   gateway re-asks once with a new reservation (`02` §5.1).
 * - Fixture results carry `billedAs` ending in ` (fixture)`.
 * - HTTP and transport failures throw the kinds in `transport.ts`.
 *
 * Streaming (WP77-S3): when the caller passes `onTextDelta`, the request goes
 * through `messages.stream` with the same params and options, each text delta
 * is handed to the hook, and the final message is read by `readMessage`
 * unchanged, so cost, usage, stop reason, refusal and JSON checks are the
 * same as a `create` reply. An error while streaming is mapped by the same
 * `errorForThrown`; a failure after the request left (an SSE `error` event,
 * a dropped connection) has no HTTP status, so it is `network`, billed
 * `possible`, and C-METER charges the worst case.
 *
 * Batch (WP90-S3): `createAnthropicBatchAdapter` submits Message Batches,
 * reads their status and their results. Each request's `params` is
 * `buildMessageParams` (the same body as a realtime call) and each succeeded
 * result is read by `readMessage(..., { batch: true })`, so cost, refusal and
 * JSON checks match the realtime path and the price is the batch rate.
 * Errored, canceled and expired results are not billed by the Batch API, so
 * they come back as `ProviderError` billed `none`. Fixture mode is stateless:
 * the batch id is a hash of the custom ids, the status is always `ended`, and
 * results are built from the requests the caller passes back.
 */

import Anthropic, { type Middleware } from "@anthropic-ai/sdk";

import type { PromptModel, PromptThinking } from "../../../lib/workspace/contracts/prompts";
import { ANTHROPIC_RATE_CARDS, anthropicCostMicroUsd, anthropicRateCard } from "../pricing";
import { createFixtureAnthropicClient, type AnthropicFixtureResponder } from "./fixtures";
import { resolveProviderAccess, type ProviderEnv } from "./mode";
import {
  isRecord,
  kindForHttpStatus,
  noReplyError,
  startDeadline,
  tokenCount,
  utf8Bytes,
} from "./transport";
import {
  FIXTURE_BILLED_AS_SUFFIX,
  ProviderError,
  type ProviderCost,
  type TextCallHooks,
  type TextRequest,
  type TextResult,
  type TextStopReason,
  type TextUsage,
} from "./types";

// ---------------------------------------------------------------------------
// Client seam
// ---------------------------------------------------------------------------

export type AnthropicRequestOptions = {
  readonly signal?: AbortSignal;
  readonly timeout?: number;
  readonly maxRetries?: number;
};

/**
 * WP77-S3. The part of the SDK's `MessageStream` the adapter uses: text
 * deltas for display, then the final message, which is read exactly like a
 * `create` reply.
 */
export type AnthropicTextStream = {
  on(event: "text", listener: (textDelta: string) => void): unknown;
  finalMessage(): Promise<Anthropic.Message>;
};

/** The part of the SDK client the adapter uses. A real `Anthropic` instance satisfies it. */
export type AnthropicMessagesClient = {
  readonly messages: {
    create(
      params: Anthropic.MessageCreateParamsNonStreaming,
      options?: AnthropicRequestOptions,
    ): Promise<Anthropic.Message>;
    /**
     * WP77-S3: `messages.stream`, used only when the caller asks for text
     * deltas. Optional so a test client with `create` alone still works; the
     * adapter then makes the same call unstreamed.
     */
    stream?(
      params: Anthropic.MessageCreateParamsNonStreaming,
      options?: AnthropicRequestOptions,
    ): AnthropicTextStream;
  };
};

/** Builds the live client from the key. Injected in tests. */
export type AnthropicClientFactory = (apiKey: string) => AnthropicMessagesClient;

/** The only host live Claude traffic may reach. Explicit, so a stray `ANTHROPIC_BASE_URL` cannot redirect it. */
export const ANTHROPIC_BASE_URL = "https://api.anthropic.com";

/**
 * The request headers the live client may send: the SDK's own (`accept`,
 * `content-type`, `user-agent`, `anthropic-version`, the `x-stainless-*`
 * platform headers) and the key (`x-api-key`, or `authorization` as SDK 1.5.0
 * sends it). Everything else is dropped by `stripUnlistedHeaders`. The adapter
 * never sends a beta header, so `anthropic-beta` is not listed either.
 */
const LIVE_HEADER_ALLOWLIST: ReadonlySet<string> = new Set([
  "accept",
  "content-type",
  "user-agent",
  "anthropic-version",
  "x-api-key",
  "authorization",
]);
const LIVE_HEADER_PREFIX = "x-stainless-";

/**
 * Drops every request header outside `LIVE_HEADER_ALLOWLIST` (and the
 * `x-stainless-` prefix). The SDK constructor always merges
 * `ANTHROPIC_CUSTOM_HEADERS` from the environment into its default headers,
 * and no constructor option turns that off, so the filter runs per request,
 * after the SDK has built the headers.
 */
export const stripUnlistedHeaders: Middleware = async (request, next) => {
  const headers = new Headers(request.headers);
  for (const name of [...headers.keys()]) {
    if (!LIVE_HEADER_ALLOWLIST.has(name) && !name.startsWith(LIVE_HEADER_PREFIX)) headers.delete(name);
  }
  return next({ ...request, headers });
};

const silentLogger = {
  error: () => undefined,
  warn: () => undefined,
  info: () => undefined,
  debug: () => undefined,
};

/**
 * The live client. Every option the SDK would otherwise default from
 * `process.env` is set here, so the key passed in is the only env value that
 * reaches it:
 * - `apiKey` given: the SDK reads no `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`,
 *   profile or federation variables;
 * - `baseURL` given: `ANTHROPIC_BASE_URL` is ignored;
 * - `webhookKey: null`: `ANTHROPIC_WEBHOOK_SIGNING_KEY` is not read;
 * - `logLevel: "off"` and a silent logger: `ANTHROPIC_LOG` is not read and
 *   nothing is written to `console`;
 * - `openTelemetry` given: the `ANTHROPIC_OPEN_TELEMETRY*` variables are not
 *   read, and no spans or trace headers are produced;
 * - `ANTHROPIC_CUSTOM_HEADERS` is still read by the constructor (SDK 1.5.0 has
 *   no option for it); `stripUnlistedHeaders` removes what it adds.
 */
function liveClient(apiKey: string): Anthropic {
  return new Anthropic({
    apiKey,
    baseURL: ANTHROPIC_BASE_URL,
    maxRetries: 0,
    webhookKey: null,
    logLevel: "off",
    logger: silentLogger,
    openTelemetry: { propagation: false, traces: false },
    middleware: [stripUnlistedHeaders],
  });
}

export const defaultAnthropicClientFactory: AnthropicClientFactory = liveClient;

/** The API's limit on `cache_control` breakpoints per request. */
export const MAX_CACHE_BREAKPOINTS = 4;

/**
 * Headroom for message framing when usage is missing, the same allowance as
 * the engine's OpenAI adapter.
 */
const FRAMING_TOKENS = 200;

// ---------------------------------------------------------------------------
// Request
// ---------------------------------------------------------------------------

function configError(message: string): ProviderError {
  return new ProviderError("anthropic", "config", message);
}

function thinkingParam(thinking: PromptThinking): Anthropic.ThinkingConfigParam {
  switch (thinking.type) {
    case "adaptive":
      return thinking.display === undefined
        ? { type: "adaptive" }
        : { type: "adaptive", display: thinking.display };
    case "between_tools":
      return { type: "between_tools" };
    case "disabled":
      return { type: "disabled" };
    default: {
      const unreachable: never = thinking;
      throw configError(`unknown thinking ${JSON.stringify(unreachable)}`);
    }
  }
}

/** Throws `config` for a request no caller should send. Nothing has gone out. */
export function assertTextRequest(request: TextRequest): void {
  if (!Object.hasOwn(ANTHROPIC_RATE_CARDS, request.model)) {
    throw configError(`model ${String(request.model)} has no rate card`);
  }
  if (!Number.isSafeInteger(request.maxTokens) || request.maxTokens < 1) {
    throw configError(`maxTokens must be a positive integer, got ${request.maxTokens}`);
  }
  if (request.system.length === 0 || request.system.some((block) => block.text.trim().length === 0)) {
    throw configError("every system block needs text");
  }
  const breakpoints = request.system.filter((block) => block.cacheBreakpoint === true).length;
  if (breakpoints > MAX_CACHE_BREAKPOINTS) {
    throw configError(`at most ${MAX_CACHE_BREAKPOINTS} cache breakpoints, got ${breakpoints}`);
  }
  if (request.user.trim().length === 0) throw configError("the task block is empty");
  if (request.outputSchema !== undefined && !isRecord(request.outputSchema)) {
    throw configError("outputSchema must be a JSON Schema object");
  }
}

/**
 * The Messages API body for a request. Also the `params` of a Message
 * Batches request (S5).
 */
export function buildMessageParams(request: TextRequest): Anthropic.MessageCreateParamsNonStreaming {
  assertTextRequest(request);
  const system: Anthropic.TextBlockParam[] = request.system.map((block) =>
    block.cacheBreakpoint === true
      ? { type: "text", text: block.text, cache_control: { type: "ephemeral", ttl: "5m" } }
      : { type: "text", text: block.text },
  );
  const outputConfig: Anthropic.OutputConfig =
    request.outputSchema === undefined
      ? { effort: request.effort }
      : { effort: request.effort, format: { type: "json_schema", schema: { ...request.outputSchema } } };
  return {
    model: request.model,
    max_tokens: request.maxTokens,
    system,
    messages: [{ role: "user", content: request.user }],
    thinking: thinkingParam(request.thinking),
    output_config: outputConfig,
  };
}

// ---------------------------------------------------------------------------
// Usage and cost
// ---------------------------------------------------------------------------

type BilledUsage = { readonly usage: TextUsage; readonly estimated: boolean };

/**
 * The tokens a 2xx reply is charged for. Usage that is missing or malformed
 * is never recorded as zero:
 * - input: the request's UTF-8 bytes plus framing (a token is never shorter
 *   than a byte), booked as cache writes, the dearest input rate;
 * - output: `maxTokens`, which the API enforces and which includes thinking.
 * A `null` or absent cache count is the API saying "none" and counts as 0. A
 * cache count that is present but not a non-negative integer makes the input
 * side unknown, so the whole input takes the fallback.
 */
export function billedUsage(raw: unknown, request: TextRequest): BilledUsage {
  const reported = isRecord(raw) ? raw : {};
  const cacheCount = (value: unknown): number | null =>
    value === null || value === undefined ? 0 : tokenCount(value);
  const cacheRead = cacheCount(reported.cache_read_input_tokens);
  const cacheWrite = cacheCount(reported.cache_creation_input_tokens);
  const reportedInput = tokenCount(reported.input_tokens);
  const input = cacheRead === null || cacheWrite === null ? null : reportedInput;
  const output = tokenCount(reported.output_tokens);
  const details = isRecord(reported.output_tokens_details) ? reported.output_tokens_details : {};
  const thinking = tokenCount(details.thinking_tokens);

  const fallbackInput =
    request.system.reduce((sum, block) => sum + utf8Bytes(block.text), 0) +
    utf8Bytes(request.user) +
    (request.outputSchema === undefined ? 0 : utf8Bytes(JSON.stringify(request.outputSchema))) +
    FRAMING_TOKENS;

  const usage: TextUsage = {
    inputTokens: input ?? 0,
    cacheReadTokens: input === null ? 0 : (cacheRead ?? 0),
    cacheWriteTokens: input === null ? fallbackInput : (cacheWrite ?? 0),
    outputTokens: output ?? request.maxTokens,
    ...(thinking === null ? {} : { thinkingTokens: thinking }),
  };
  return { usage, estimated: input === null || output === null };
}

export type ReadOptions = {
  /** A Message Batches result: priced at the batch rate. */
  readonly batch?: boolean;
  /** A fixture reply: `billedAs` gets the ` (fixture)` suffix. */
  readonly fixture?: boolean;
};

export function textCost(model: PromptModel, billed: BilledUsage, options: ReadOptions = {}): ProviderCost {
  const { usage } = billed;
  return {
    provider: "anthropic",
    billedAs: `${model}${options.batch ? " (batch)" : ""}${options.fixture ? FIXTURE_BILLED_AS_SUFFIX : ""}`,
    microUsd: anthropicCostMicroUsd(model, usage, { batch: options.batch }),
    estimated: billed.estimated,
    units: {
      inputTokens: usage.inputTokens,
      cacheReadTokens: usage.cacheReadTokens,
      cacheWriteTokens: usage.cacheWriteTokens,
      outputTokens: usage.outputTokens,
    },
    rateCard: anthropicRateCard(model).effectiveFrom,
  };
}

// ---------------------------------------------------------------------------
// Reply
// ---------------------------------------------------------------------------

const STOP_REASONS: readonly TextStopReason[] = [
  "end_turn",
  "max_tokens",
  "stop_sequence",
  "tool_use",
  "pause_turn",
  "refusal",
  "model_context_window_exceeded",
];

/**
 * The only stops that mean a complete answer. `max_tokens` is truncated;
 * `tool_use` / `pause_turn` cannot be finished without a tool loop (D23);
 * `model_context_window_exceeded` is cut off.
 */
const USABLE_STOPS: readonly TextStopReason[] = ["end_turn", "stop_sequence"];

function stopReasonOf(value: unknown): TextStopReason | null {
  return typeof value === "string" && (STOP_REASONS as readonly string[]).includes(value)
    ? (value as TextStopReason)
    : null;
}

function joinedText(content: unknown): string {
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const block of content) {
    if (isRecord(block) && block.type === "text" && typeof block.text === "string") parts.push(block.text);
  }
  return parts.join("");
}

/**
 * Reads a 2xx reply (a realtime response, or one succeeded batch result with
 * `batch: true`). Returns the result, or throws `refusal` / `invalid_output`
 * carrying the cost. Typed `unknown` so a malformed body is handled, not trusted.
 */
export function readMessage(message: unknown, request: TextRequest, options: ReadOptions = {}): TextResult {
  const body = isRecord(message) ? message : {};
  const billed = billedUsage(body.usage, request);
  const cost = textCost(request.model, billed, options);
  const stopReason = stopReasonOf(body.stop_reason);
  const billedError = (kind: "refusal" | "invalid_output", text: string, extra: object = {}) =>
    new ProviderError("anthropic", kind, text, {
      cost,
      usage: billed.usage,
      stopReason: stopReason ?? undefined,
      ...extra,
    });

  if (stopReason === "refusal") {
    const details = isRecord(body.stop_details) ? body.stop_details : {};
    throw billedError("refusal", "the model declined the request", {
      refusal: {
        category: typeof details.category === "string" ? details.category : null,
        explanation: typeof details.explanation === "string" ? details.explanation : null,
      },
    });
  }

  const structured = request.outputSchema !== undefined;
  if (stopReason === null || !USABLE_STOPS.includes(stopReason)) {
    throw billedError("invalid_output", `the reply stopped with ${String(body.stop_reason)}`);
  }

  const text = joinedText(body.content);
  if (text.trim().length === 0) throw billedError("invalid_output", "the reply had no text");

  const base = {
    provider: "anthropic" as const,
    model: request.model,
    messageId: typeof body.id === "string" ? body.id : "",
    stopReason,
    text,
    usage: billed.usage,
    cost,
  };
  if (!structured) return base;

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (cause) {
    throw billedError("invalid_output", "the structured reply is not valid JSON", { cause });
  }
  return { ...base, json };
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

function errorForThrown(error: unknown, deadline: ReturnType<typeof startDeadline>): ProviderError {
  if (error instanceof ProviderError) return error;
  if (deadline.timedOut() || deadline.parentAborted()) return noReplyError("anthropic", deadline, error);
  if (error instanceof Anthropic.APIConnectionTimeoutError) {
    return new ProviderError("anthropic", "timeout", "the SDK timed out waiting for a reply", { cause: error });
  }
  if (error instanceof Anthropic.APIError && typeof error.status === "number") {
    const kind = kindForHttpStatus(error.status);
    return new ProviderError("anthropic", kind, `Anthropic returned ${error.status}`, {
      status: error.status,
      cause: error,
    });
  }
  return noReplyError("anthropic", deadline, error);
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export type AnthropicAdapter = {
  readonly provider: "anthropic";
  complete(request: TextRequest, hooks?: TextCallHooks): Promise<TextResult>;
};

export type AnthropicAdapterOptions = {
  /** Read for `AI_PROVIDER_MODE` and `ANTHROPIC_API_KEY`. Never `process.env` implicitly. */
  readonly env: ProviderEnv;
  /** Live mode only. Defaults to the real SDK client with retries off. */
  readonly clientFactory?: AnthropicClientFactory;
  /** Fixture mode only: replaces the default deterministic replies. */
  readonly fixtureResponder?: AnthropicFixtureResponder;
};

export function createAnthropicAdapter(options: AnthropicAdapterOptions): AnthropicAdapter {
  return {
    provider: "anthropic",
    async complete(request: TextRequest, hooks?: TextCallHooks): Promise<TextResult> {
      // Build first: a bad request, mode or key fails before any client exists.
      const params = buildMessageParams(request);
      const access = resolveProviderAccess("anthropic", options.env);
      let client: AnthropicMessagesClient;
      try {
        client =
          access.mode === "live"
            ? (options.clientFactory ?? defaultAnthropicClientFactory)(access.apiKey)
            : createFixtureAnthropicClient(options.fixtureResponder);
      } catch (cause) {
        throw new ProviderError("anthropic", "config", "the Anthropic client could not be created", {
          billed: "none",
          cause,
        });
      }

      const deadline = startDeadline("anthropic", request.timeoutMs, request.signal);
      let message: Anthropic.Message;
      const requestOptions: AnthropicRequestOptions = {
        signal: deadline.signal,
        timeout: request.timeoutMs,
        maxRetries: 0,
      };
      const onTextDelta = hooks?.onTextDelta;
      try {
        if (onTextDelta !== undefined && client.messages.stream !== undefined) {
          const stream = client.messages.stream(params, requestOptions);
          stream.on("text", (textDelta) => onTextDelta(textDelta));
          message = await stream.finalMessage();
        } else {
          message = await client.messages.create(params, requestOptions);
        }
      } catch (error) {
        throw errorForThrown(error, deadline);
      } finally {
        deadline.clear();
      }
      return readMessage(message, request, { fixture: access.mode === "fixture" });
    },
  };
}

// ---------------------------------------------------------------------------
// Message Batches (WP90-S3)
// ---------------------------------------------------------------------------

export type AnthropicBatchProcessingStatus = "in_progress" | "canceling" | "ended";

/** The part of the SDK client the batch adapter uses. A real `Anthropic` instance satisfies it. */
export type AnthropicBatchesClient = {
  readonly messages: {
    readonly batches: {
      create(
        params: Anthropic.Messages.BatchCreateParams,
        options?: AnthropicRequestOptions,
      ): Promise<Anthropic.Messages.MessageBatch>;
      retrieve(
        messageBatchID: string,
        params?: undefined,
        options?: AnthropicRequestOptions,
      ): Promise<Anthropic.Messages.MessageBatch>;
      results(
        messageBatchID: string,
        params?: undefined,
        options?: AnthropicRequestOptions,
      ): Promise<AsyncIterable<Anthropic.Messages.MessageBatchIndividualResponse>>;
    };
  };
};

export type AnthropicBatchClientFactory = (apiKey: string) => AnthropicBatchesClient;

export const defaultAnthropicBatchClientFactory: AnthropicBatchClientFactory = liveClient;

/** A batch's custom id: the API allows 1-64 letters, digits, `_` and `-`. */
export const BATCH_CUSTOM_ID = /^[A-Za-z0-9_-]{1,64}$/u;

/** The Batch API's per-batch request limit. */
export const MAX_BATCH_REQUESTS = 100_000;

export type BatchRequestItem = {
  /** The request's `custom_id`. C-METER: the `usageId` of its reservation. */
  readonly customId: string;
  readonly request: TextRequest;
};

export type BatchRequestCounts = {
  readonly processing: number;
  readonly succeeded: number;
  readonly errored: number;
  readonly canceled: number;
  readonly expired: number;
};

export type BatchStatus = {
  readonly batchId: string;
  readonly processingStatus: AnthropicBatchProcessingStatus;
  /** Absent in fixture mode, which keeps no state. */
  readonly counts?: BatchRequestCounts;
};

/** One result: a read reply, or a `ProviderError` (refusal and invalid output carry their cost). */
export type BatchItemOutcome =
  | { readonly customId: string; readonly ok: true; readonly result: TextResult }
  | { readonly customId: string; readonly ok: false; readonly error: ProviderError };

export type BatchResults = {
  readonly outcomes: readonly BatchItemOutcome[];
  /** Result lines whose custom id the caller did not pass (never read, never charged here). */
  readonly unknownCustomIds: readonly string[];
};

/** Fixture mode only: makes a request come back unbilled instead of answered. */
export type BatchFixtureResultType = (customId: string) => "errored" | "canceled" | "expired" | undefined;

export type AnthropicBatchAdapterOptions = {
  readonly env: ProviderEnv;
  readonly clientFactory?: AnthropicBatchClientFactory;
  readonly fixtureResponder?: AnthropicFixtureResponder;
  readonly fixtureResultType?: BatchFixtureResultType;
};

export type BatchCallOptions = { readonly timeoutMs: number; readonly signal?: AbortSignal };

export type AnthropicBatchAdapter = {
  readonly provider: "anthropic";
  readonly mode: "live" | "fixture";
  submit(items: readonly BatchRequestItem[], options: BatchCallOptions): Promise<BatchStatus>;
  status(batchId: string, options: BatchCallOptions): Promise<BatchStatus>;
  /** Reads every result line. `items` maps each custom id to the request it was sent with. */
  results(batchId: string, items: ReadonlyMap<string, TextRequest>, options: BatchCallOptions): Promise<BatchResults>;
};

const FIXTURE_BATCH_PREFIX = "msgbatch_fixture_";

function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(text)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function countOf(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function batchStatusOf(batch: unknown): BatchStatus {
  const body = isRecord(batch) ? batch : {};
  const status = body.processing_status;
  if (typeof body.id !== "string" || (status !== "in_progress" && status !== "canceling" && status !== "ended")) {
    throw new ProviderError("anthropic", "invalid_output", "the batch reply has no id or status", { billed: "none" });
  }
  const counts = isRecord(body.request_counts) ? body.request_counts : {};
  return {
    batchId: body.id,
    processingStatus: status,
    counts: {
      processing: countOf(counts.processing),
      succeeded: countOf(counts.succeeded),
      errored: countOf(counts.errored),
      canceled: countOf(counts.canceled),
      expired: countOf(counts.expired),
    },
  };
}

function assertBatchItems(items: readonly BatchRequestItem[]): void {
  if (items.length === 0) throw configError("a batch needs at least one request");
  if (items.length > MAX_BATCH_REQUESTS) throw configError(`a batch takes at most ${MAX_BATCH_REQUESTS} requests`);
  const seen = new Set<string>();
  for (const item of items) {
    if (!BATCH_CUSTOM_ID.test(item.customId)) throw configError(`custom id ${JSON.stringify(item.customId)} is not 1-64 of [A-Za-z0-9_-]`);
    if (seen.has(item.customId)) throw configError(`custom id ${item.customId} appears twice`);
    seen.add(item.customId);
  }
}

/** An unbilled result: the Batch API charges only succeeded requests. */
function unbilledResult(customId: string, type: "errored" | "canceled" | "expired", status?: number): BatchItemOutcome {
  const kind = type === "errored" && status !== undefined ? kindForHttpStatus(status) : "server";
  return {
    customId,
    ok: false,
    error: new ProviderError("anthropic", kind, `the batch request was ${type}`, {
      billed: "none",
      ...(status === undefined ? {} : { status }),
    }),
  };
}

function readBatchLine(
  line: unknown,
  items: ReadonlyMap<string, TextRequest>,
  fixture: boolean,
): BatchItemOutcome | { readonly unknown: string } | null {
  const body = isRecord(line) ? line : {};
  const customId = typeof body.custom_id === "string" ? body.custom_id : null;
  if (customId === null) return null;
  const request = items.get(customId);
  if (request === undefined) return { unknown: customId };
  const result = isRecord(body.result) ? body.result : {};
  switch (result.type) {
    case "succeeded":
      try {
        return { customId, ok: true, result: readMessage(result.message, request, { batch: true, fixture }) };
      } catch (error) {
        if (error instanceof ProviderError) return { customId, ok: false, error };
        throw error;
      }
    case "errored": {
      const error = isRecord(result.error) ? result.error : {};
      const inner = isRecord(error.error) ? error.error : error;
      const status = inner.type === "invalid_request_error" ? 400 : inner.type === "overloaded_error" ? 529 : 500;
      return unbilledResult(customId, "errored", status);
    }
    case "canceled":
    case "expired":
      return unbilledResult(customId, result.type);
    default:
      return unbilledResult(customId, "errored", 500);
  }
}

export function createAnthropicBatchAdapter(options: AnthropicBatchAdapterOptions): AnthropicBatchAdapter {
  const access = resolveProviderAccess("anthropic", options.env);
  const fixture = access.mode === "fixture";
  let client: AnthropicBatchesClient | null = null;
  const liveBatches = () => {
    if (access.mode !== "live") throw configError("the live batch client is not available in fixture mode");
    try {
      client ??= (options.clientFactory ?? defaultAnthropicBatchClientFactory)(access.apiKey);
    } catch (cause) {
      throw new ProviderError("anthropic", "config", "the Anthropic client could not be created", { billed: "none", cause });
    }
    return client.messages.batches;
  };

  async function call<T>(callOptions: BatchCallOptions, run: (requestOptions: AnthropicRequestOptions) => Promise<T>): Promise<T> {
    const deadline = startDeadline("anthropic", callOptions.timeoutMs, callOptions.signal);
    try {
      return await run({ signal: deadline.signal, timeout: callOptions.timeoutMs, maxRetries: 0 });
    } catch (error) {
      throw errorForThrown(error, deadline);
    } finally {
      deadline.clear();
    }
  }

  return {
    provider: "anthropic",
    mode: access.mode,

    async submit(items, callOptions) {
      assertBatchItems(items);
      const requests = items.map((item) => ({ custom_id: item.customId, params: buildMessageParams(item.request) }));
      if (fixture) {
        if (callOptions.signal?.aborted) throw configError("the call was cancelled before it was sent");
        return { batchId: `${FIXTURE_BATCH_PREFIX}${fnv1a(requests.map((r) => r.custom_id).join(","))}`, processingStatus: "in_progress" };
      }
      const batches = liveBatches();
      return batchStatusOf(await call(callOptions, (requestOptions) => batches.create({ requests }, requestOptions)));
    },

    async status(batchId, callOptions) {
      if (fixture) {
        if (!batchId.startsWith(FIXTURE_BATCH_PREFIX)) throw configError(`${batchId} is not a fixture batch`);
        return { batchId, processingStatus: "ended" };
      }
      const batches = liveBatches();
      return batchStatusOf(await call(callOptions, (requestOptions) => batches.retrieve(batchId, undefined, requestOptions)));
    },

    async results(batchId, items, callOptions) {
      const outcomes: BatchItemOutcome[] = [];
      const unknownCustomIds: string[] = [];
      const take = (read: ReturnType<typeof readBatchLine>) => {
        if (read === null) return;
        if ("unknown" in read) unknownCustomIds.push(read.unknown);
        else outcomes.push(read);
      };
      if (fixture) {
        if (!batchId.startsWith(FIXTURE_BATCH_PREFIX)) throw configError(`${batchId} is not a fixture batch`);
        const fixtureClient = createFixtureAnthropicClient(options.fixtureResponder);
        for (const [customId, request] of items) {
          const type = options.fixtureResultType?.(customId);
          if (type !== undefined) {
            outcomes.push(unbilledResult(customId, type, type === "errored" ? 500 : undefined));
            continue;
          }
          const message = await fixtureClient.messages.create(buildMessageParams(request));
          take(readBatchLine({ custom_id: customId, result: { type: "succeeded", message } }, items, true));
        }
        return { outcomes, unknownCustomIds };
      }
      const batches = liveBatches();
      await call(callOptions, async (requestOptions) => {
        const stream = await batches.results(batchId, undefined, requestOptions);
        for await (const line of stream) take(readBatchLine(line, items, false));
      });
      return { outcomes, unknownCustomIds };
    },
  };
}
