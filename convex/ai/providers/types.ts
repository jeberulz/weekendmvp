/**
 * WP71-S1. Shared types for the AI crew's provider adapters.
 *
 * Modelled on `lib/engine/providers/types.ts`: one request/result shape per
 * kind of call, a `ProviderCost` on every result, and a typed error that fails
 * closed. Two rules hold across every adapter:
 *
 * 1. **Fail closed.** A missing key, a refused or malformed reply, or a
 *    transport failure raises `ProviderError`. No adapter returns a degraded
 *    or invented result.
 * 2. **Every outcome says whether the provider may have billed.** A result
 *    carries its cost; an error carries `billed` (C-METER `BilledState`) and,
 *    when the reply was billed, its cost and usage. The gateway passes these
 *    straight to C-METER `settle` / `fail`.
 *
 * Plain helpers and types: these modules are imported by the `"use node"`
 * gateway action (S2). They register no Convex function and read no env.
 */

import type {
  BilledState,
  MeterErrorClass,
  MeterProvider,
} from "../../../lib/workspace/contracts/metering";
import type { PromptEffort, PromptModel, PromptThinking } from "../../../lib/workspace/contracts/prompts";

// ---------------------------------------------------------------------------
// Cost
// ---------------------------------------------------------------------------

/**
 * What one provider call cost, in integer micro-USD (rounded up).
 *
 * - `billedAs`: the exact model or endpoint billed, for audit.
 * - `estimated`: true when the figure is not from complete reported usage —
 *   a flat per-image price, or the conservative fallback for missing usage.
 *   Maps to C-METER `SettleArgs.estimated`.
 * - `units`: the breakdown (tokens, images) for the cost audit trail.
 * - `rateCard`: the `effectiveFrom` date of the rates used.
 *
 * A cost on a successful result is what the provider billed (`actual`). A
 * cost on a `ProviderError` is the billed reply that the adapter rejected.
 */
export type ProviderCost = {
  readonly provider: MeterProvider;
  readonly billedAs: string;
  readonly microUsd: number;
  readonly estimated: boolean;
  readonly units: Readonly<Record<string, number>>;
  readonly rateCard: string;
};

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export const PROVIDER_ERROR_KINDS = [
  /** Bad mode, missing key, or a request the adapter refuses to send. Nothing went out. */
  "config",
  /** Our deadline fired after the request left. */
  "timeout",
  /** The caller's own signal aborted the request after it left. */
  "aborted",
  /** HTTP 429. */
  "rate_limit",
  /** HTTP 401 / 403. */
  "auth",
  /** Any other 4xx: our request was wrong. */
  "bad_request",
  /** The model or the image provider declined on policy grounds. */
  "refusal",
  /** A billed reply we could not use: unparseable, truncated, or no output. */
  "invalid_output",
  /** HTTP 5xx (including 529 overloaded). */
  "server",
  /** No reply: the connection failed. */
  "network",
] as const;
export type ProviderErrorKind = (typeof PROVIDER_ERROR_KINDS)[number];

/** How each kind maps onto C-METER's `MeterErrorClass` (the WP26 executor classes). */
export const PROVIDER_ERROR_CLASS = {
  config: "permanent",
  timeout: "timeout",
  aborted: "indeterminate",
  rate_limit: "retryable",
  auth: "permanent",
  bad_request: "permanent",
  refusal: "refusal",
  invalid_output: "schema_invalid",
  server: "retryable",
  network: "indeterminate",
} as const satisfies Record<ProviderErrorKind, MeterErrorClass>;

export function meterErrorClassFor(kind: ProviderErrorKind): MeterErrorClass {
  return PROVIDER_ERROR_CLASS[kind];
}

/**
 * Default billed state per kind:
 * - `none`: the request never ran (config, auth, bad request, rate limit).
 * - `possible`: the request left and we cannot know whether it ran
 *   (timeout, abort, network, 5xx). C-METER charges the worst case.
 * - `actual`: a 2xx reply we rejected (invalid output, a model refusal); the
 *   error carries its cost.
 * An image provider's policy refusal is an HTTP 400 and is raised `none`.
 */
export const DEFAULT_BILLED: Record<ProviderErrorKind, BilledState> = {
  config: "none",
  timeout: "possible",
  aborted: "possible",
  rate_limit: "none",
  auth: "none",
  bad_request: "none",
  refusal: "actual",
  invalid_output: "actual",
  // Conservative C-METER rule: a 5xx may have run, so the meter charges the
  // reservation. Whether this locks Free owners out too early is an open
  // owner question; keep `possible` until it is ruled.
  server: "possible",
  network: "possible",
};

const RETRYABLE_KINDS: readonly ProviderErrorKind[] = ["timeout", "rate_limit", "server", "network", "invalid_output"];

/** Refusal details from Claude's `stop_details`. */
export type ProviderRefusal = {
  readonly category: string | null;
  readonly explanation: string | null;
};

export type ProviderErrorOptions = {
  readonly billed?: BilledState;
  readonly status?: number;
  readonly cost?: ProviderCost;
  readonly usage?: TextUsage;
  readonly stopReason?: string;
  readonly refusal?: ProviderRefusal;
  readonly cause?: unknown;
};

export class ProviderError extends Error {
  readonly provider: MeterProvider;
  readonly kind: ProviderErrorKind;
  readonly billed: BilledState;
  /** Whether another attempt could succeed. The gateway owns retries and their reservations. */
  readonly retryable: boolean;
  readonly status?: number;
  readonly cost?: ProviderCost;
  readonly usage?: TextUsage;
  readonly stopReason?: string;
  readonly refusal?: ProviderRefusal;

  constructor(provider: MeterProvider, kind: ProviderErrorKind, message: string, options: ProviderErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "ProviderError";
    this.provider = provider;
    this.kind = kind;
    this.billed = options.billed ?? DEFAULT_BILLED[kind];
    this.retryable = RETRYABLE_KINDS.includes(kind);
    this.status = options.status;
    this.cost = options.cost;
    this.usage = options.usage;
    this.stopReason = options.stopReason;
    this.refusal = options.refusal;
  }

  get errorClass(): MeterErrorClass {
    return meterErrorClassFor(this.kind);
  }
}

export function isProviderError(value: unknown): value is ProviderError {
  return value instanceof ProviderError;
}

// ---------------------------------------------------------------------------
// Text (Anthropic)
// ---------------------------------------------------------------------------

/**
 * One system block. `cacheBreakpoint` puts a 5-minute `cache_control` on it
 * (`02` §5.4: after the stable system block and after the business block).
 * At most four breakpoints per request (an API limit).
 */
export type TextSystemBlock = {
  readonly text: string;
  readonly cacheBreakpoint?: boolean;
};

export type TextRequest = {
  readonly model: PromptModel;
  /** Always explicit: an unset effort is a hidden cost line. */
  readonly effort: PromptEffort;
  /** Always explicit, from the spec. */
  readonly thinking: PromptThinking;
  /** Includes thinking. The reservation is sized from it. */
  readonly maxTokens: number;
  /** In order: system (stable) → business context → anything else stable. */
  readonly system: readonly TextSystemBlock[];
  /** The task block for this call. */
  readonly user: string;
  /**
   * JSON Schema for structured output (`output_config.format`). When set, the
   * reply must parse as JSON; the gateway re-validates it with the spec's zod schema.
   */
  readonly outputSchema?: Readonly<Record<string, unknown>>;
  /** Hard deadline for the call, in milliseconds. */
  readonly timeoutMs: number;
  /** Optional caller signal (e.g. the action being cancelled). */
  readonly signal?: AbortSignal;
};

/** Token usage, named as C-METER `SettleArgs` names it. */
export type TextUsage = {
  readonly inputTokens: number;
  readonly cacheReadTokens: number;
  readonly cacheWriteTokens: number;
  /** Includes thinking. */
  readonly outputTokens: number;
  /** The thinking part of `outputTokens`, when reported. Observability only. */
  readonly thinkingTokens?: number;
};

export type TextStopReason =
  | "end_turn"
  | "max_tokens"
  | "stop_sequence"
  | "tool_use"
  | "pause_turn"
  | "refusal"
  | "model_context_window_exceeded";

export type TextResult = {
  readonly provider: "anthropic";
  readonly model: PromptModel;
  /** The provider's message id, for audit. */
  readonly messageId: string;
  readonly stopReason: TextStopReason;
  /** The text blocks, joined. Thinking blocks are never included. */
  readonly text: string;
  /** Present when the request had `outputSchema`: `JSON.parse(text)`, not yet schema-checked. */
  readonly json?: unknown;
  readonly usage: TextUsage;
  readonly cost: ProviderCost;
};

// ---------------------------------------------------------------------------
// Images (OpenAI Images, Recraft)
// ---------------------------------------------------------------------------

export type ImageRequestBase = {
  readonly prompt: string;
  readonly timeoutMs: number;
  readonly signal?: AbortSignal;
};

export type GeneratedImage =
  | { readonly kind: "bytes"; readonly bytes: Uint8Array; readonly mimeType: string }
  | { readonly kind: "url"; readonly url: string };

export type ImageResult = {
  readonly provider: Extract<MeterProvider, "openai_images" | "recraft">;
  readonly model: string;
  readonly size: string;
  readonly image: GeneratedImage;
  readonly cost: ProviderCost;
};

/** Appended to `billedAs` on fixture results, so dev `ai_usage` rows never read as live spend. */
export const FIXTURE_BILLED_AS_SUFFIX = " (fixture)";

/** `fetch`, injected so tests and fixture mode never touch the network. */
export type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;
