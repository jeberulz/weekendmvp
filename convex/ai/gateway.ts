/**
 * WP71-S2. The AI gateway: every crew model call and media render, metered.
 *
 * `02` §5.1, in order, for every provider call:
 * 1. resolve the spec (ref, model, JSON Schema, request blocks);
 * 2. size the worst-case reservation from the spec's tier and lane bounds and
 *    the S1 rate cards (`pricing.ts`) — before anything is reserved;
 * 3. C-METER `reserve` (kill switch, budgets) — a refusal means no call;
 * 4. C-METER `markSent`, immediately before the request leaves;
 * 5. the adapter call (S1), with an `AbortSignal` timeout;
 * 6. validate the structured output against the spec's zod schema;
 * 7. C-METER `settle` with the true cost and `estimated`, or `fail` with the
 *    adapter's `billed` state (C-METER `chargeOnFail` sets the charge).
 *
 * Rules this file enforces:
 * - **One call per attempt, one re-ask per run (D23).** A schema failure gets
 *   exactly one re-ask, as a new attempt with its own reservation (a new
 *   `ai_usage` row, `reask: true`). A second schema failure fails the run. The
 *   gateway never sends tools — `TextRequest` has no tools field — and never
 *   continues a `tool_use` or `pause_turn` reply (see `classifyError`).
 * - **Every row is finalised exactly once.** Each attempt reaches one
 *   `settle` or one `fail` call site. When `settle` / `fail` itself throws,
 *   the gateway does not call the other one: the row may already be final, and
 *   the WP70 sweep finalises it otherwise (`sweepOutcome`).
 * - **A refusal fails the job** (`02` §5.8), charged its actual cost, with no
 *   re-ask and no `fallbacks` (C-PROMPT header).
 * - **The worst case is charged when the provider may have billed.** `fail`
 *   receives `billed` from the adapter; C-METER charges the reservation for
 *   `possible`, 0 for `none` and the known cost for `actual`.
 * - **An overrun is visible.** A true cost above that attempt's reservation is
 *   still settled at the true cost, and flagged as
 *   `overrun: { reservedMicroUsd, actualMicroUsd }` on the attempt record and
 *   through the optional `onOverrun` hook (the C-METER port has no overrun
 *   field; see the S2 contract questions).
 *
 * Shape: a pure, injectable core (`runTextGateway`, `runImageGateway`) that
 * takes a meter port, an adapter port and a clock, so it runs without Convex.
 * No Convex function is registered here yet: an `internalAction` needs the
 * real C-METER mutations (WP70) and the S3 registry, and a deployed action on
 * the in-memory stub would enforce no budget at all. The wrapper lands with
 * WP70; it will be `"use node"` and only bind these ports to `ctx.runMutation`.
 */

import { z } from "zod";

import {
  isMeterErrorData,
  MAX_RESERVATION_MICRO_USD,
  type BilledState,
  type FailArgs,
  type FinalizeResult,
  type MarkSentArgs,
  type MarkSentResult,
  type MeterErrorClass,
  type MeterErrorData,
  type MeterProvider,
  type ReserveArgs,
  type ReserveResult,
  type SettleArgs,
} from "../../lib/workspace/contracts/metering";
import {
  maxInputTokensForSpec,
  modelForSpec,
  promptRef as promptRefFor,
  type PromptModel,
  type PromptSpec,
} from "../../lib/workspace/contracts/prompts";
import { anthropicWorstCaseMicroUsd, OPENAI_IMAGE_MODEL, RECRAFT_MODEL, recraftCostMicroUsd } from "./pricing";
import { openAiImageReservationMicroUsd, type OpenAiImageRequest } from "./providers/openaiImages";
import { assertRecraftRequest, type RecraftImageRequest } from "./providers/recraft";
import { MAX_TIMEOUT_MS, utf8Bytes } from "./providers/transport";
import {
  isProviderError,
  type ImageResult,
  type ProviderErrorKind,
  type TextRequest,
  type TextResult,
  type TextSystemBlock,
} from "./providers/types";

// ---------------------------------------------------------------------------
// Ports
// ---------------------------------------------------------------------------

/**
 * The four C-METER calls, with the contract's exact signatures. Codex's
 * `convex/ai/metering.ts` (WP70) binds to it through `ctx.runMutation`; until
 * then `meterStub.ts` implements it in memory. Refusals arrive as a thrown
 * `ConvexError` whose `data` is `MeterErrorData`.
 */
export type MeterPort = {
  reserve(args: ReserveArgs): Promise<ReserveResult>;
  markSent(args: MarkSentArgs): Promise<MarkSentResult>;
  settle(args: SettleArgs): Promise<FinalizeResult>;
  fail(args: FailArgs): Promise<FinalizeResult>;
};

/** The Claude adapter's one method (`createAnthropicAdapter` satisfies it). */
export type TextAdapterPort = {
  complete(request: TextRequest): Promise<TextResult>;
};

/** An image adapter's one method (`createOpenAiImagesAdapter`, `createRecraftAdapter`). */
export type ImageAdapterPort<TRequest> = {
  generate(request: TRequest): Promise<ImageResult>;
};

/** Milliseconds since the epoch; only used for `latencyMs`. */
export type GatewayClock = { readonly now: () => number };

/** A settled or failed cost above its attempt's reservation. */
export type OverrunSignal = {
  readonly usageId: string;
  readonly attemptKey: string;
  readonly promptRef: string;
  readonly provider: MeterProvider;
  readonly model: string;
  readonly reservedMicroUsd: number;
  readonly actualMicroUsd: number;
};

/**
 * Called once per overrun, after the row is final. Observability only: a
 * throwing or rejecting hook is ignored and cannot change what was billed.
 */
export type OverrunHook = (signal: OverrunSignal) => void | Promise<void>;

type BaseDeps = {
  readonly meter: MeterPort;
  readonly clock: GatewayClock;
  readonly onOverrun?: OverrunHook;
};

export type TextGatewayDeps = BaseDeps & { readonly adapter: TextAdapterPort };
export type ImageGatewayDeps = BaseDeps;

// ---------------------------------------------------------------------------
// Inputs and results
// ---------------------------------------------------------------------------

/** Who the call is for, and how its attempts are keyed. */
export type GatewayCaller = {
  readonly ownerId?: string;
  readonly projectId?: string;
  readonly taskId?: string;
  /** The task's credit debit, when the founder pays credits (C-METER verifies it). */
  readonly creditDebitId?: string;
  /** The C-METER attempt key for attempt `n` (`jobAttemptKey`, `chatAttemptKey`, ...). */
  readonly attemptKey: (attempt: number) => string;
  /** The first attempt number of this run (default 1). The re-ask uses the next one. */
  readonly attempt?: number;
};

/** The request deadline when the caller sets none: 3 minutes. */
export const DEFAULT_GATEWAY_TIMEOUT_MS = 3 * 60 * 1_000;

/**
 * Headroom added to the input estimate for message framing, the same
 * allowance as the Claude adapter's missing-usage fallback.
 */
export const GATEWAY_FRAMING_TOKENS = 200;

/** Re-asks allowed per run (D23): one. */
export const MAX_REASKS = 1;

export type TextGatewayInput<TInput, TOutput> = {
  readonly spec: Readonly<PromptSpec<TInput, TOutput>>;
  readonly inputs: TInput;
  readonly caller: GatewayCaller;
  /**
   * The business context block (`02` §5.4). Required when the spec's cache
   * layout is `per_business`, refused when it is `none`.
   */
  readonly businessContext?: string;
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
};

/** One `ai_usage` row this run created and finalised. */
export type GatewayAttempt = {
  readonly attempt: number;
  readonly attemptKey: string;
  readonly usageId: string;
  readonly reask: boolean;
  readonly reservedMicroUsd: number;
  readonly status: "settled" | "failed";
  /** What C-METER charged the row (`FinalizeResult.costMicroUsd`). */
  readonly chargedMicroUsd: number;
  readonly latencyMs: number;
  readonly billed?: BilledState;
  readonly errorClass?: MeterErrorClass;
  readonly stopReason?: string;
  readonly overrun?: { readonly reservedMicroUsd: number; readonly actualMicroUsd: number };
};

export type GatewayFailure =
  /** A request no caller should send. Nothing was reserved. */
  | { readonly kind: "config"; readonly message: string }
  /** C-METER refused the reservation (kill switch, budget). Nothing was sent. */
  | { readonly kind: "meter_refused"; readonly error: MeterErrorData }
  /**
   * The attempt key already had a row (a replayed run). Nothing was sent and
   * the existing row was left alone: the caller must use a new attempt number.
   */
  | { readonly kind: "duplicate_attempt"; readonly attemptKey: string; readonly usageId: string }
  | {
      readonly kind: "refusal";
      readonly provider: MeterProvider;
      readonly category: string | null;
      readonly explanation: string | null;
    }
  /** The output failed the schema on the first attempt and on the re-ask. */
  | { readonly kind: "schema_invalid"; readonly issues: readonly string[] }
  | {
      readonly kind: "provider";
      readonly provider: MeterProvider;
      readonly providerKind: ProviderErrorKind | "unknown";
      readonly errorClass: MeterErrorClass;
      readonly billed: BilledState;
      readonly retryable: boolean;
      readonly message: string;
    }
  /** Gateway code threw after the provider answered. The row was still finalised. */
  | { readonly kind: "internal"; readonly message: string };

export type GatewayOutcome<TValue> = (
  | { readonly ok: true; readonly value: TValue }
  | { readonly ok: false; readonly failure: GatewayFailure }
) & {
  readonly promptRef: string;
  readonly attempts: readonly GatewayAttempt[];
};

export type TextRunValue<TOutput> = {
  readonly output: TOutput;
  readonly messageId: string;
  readonly stopReason: string;
};

// ---------------------------------------------------------------------------
// One metered attempt
// ---------------------------------------------------------------------------

type SettleUsage = Omit<SettleArgs, "usageId" | "latencyMs">;

/** What an attempt resolves to, decided before the single finalise call. */
type Decision<TValue> =
  | { readonly kind: "settle"; readonly usage: SettleUsage; readonly value: TValue }
  | {
      readonly kind: "fail";
      readonly billed: BilledState;
      readonly costMicroUsd?: number;
      readonly errorClass: MeterErrorClass;
      readonly stopReason?: string;
      readonly failure: GatewayFailure;
      /** Whether D23's one re-ask applies (a schema failure of a finished reply). */
      readonly reaskable: boolean;
    };

type AttemptPlan<TResult, TValue> = {
  readonly attempt: number;
  readonly reserve: ReserveArgs;
  readonly call: () => Promise<TResult>;
  /** Reads a returned result. May throw; the attempt then fails at `knownCost`. */
  readonly read: (result: TResult) => Decision<TValue>;
  /** The billed cost of a returned result, read without validation. */
  readonly knownCost: (result: TResult) => number | undefined;
};

type AttemptOutcome<TValue> =
  | { readonly kind: "not_reserved"; readonly failure: GatewayFailure }
  | { readonly kind: "settled"; readonly record: GatewayAttempt; readonly value: TValue }
  | {
      readonly kind: "failed";
      readonly record: GatewayAttempt;
      readonly failure: GatewayFailure;
      readonly reaskable: boolean;
    };

function meterErrorDataOf(error: unknown): MeterErrorData | null {
  if (isMeterErrorData(error)) return error;
  if (typeof error === "object" && error !== null && "data" in error) {
    const data: unknown = (error as { readonly data: unknown }).data;
    if (isMeterErrorData(data)) return data;
  }
  return null;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function runAttempt<TResult, TValue>(
  deps: BaseDeps,
  plan: AttemptPlan<TResult, TValue>,
): Promise<AttemptOutcome<TValue>> {
  const { meter, clock } = deps;
  const args = plan.reserve;

  // 3. Reserve. Nothing has been sent.
  let reserved: ReserveResult;
  try {
    reserved = await meter.reserve(args);
  } catch (error) {
    const data = meterErrorDataOf(error);
    if (data) return { kind: "not_reserved", failure: { kind: "meter_refused", error: data } };
    throw error;
  }
  if (reserved.existing) {
    return {
      kind: "not_reserved",
      failure: { kind: "duplicate_attempt", attemptKey: args.attemptKey, usageId: reserved.usageId },
    };
  }
  const usageId = reserved.usageId;

  // 4. markSent, then 5. the call. A markSent that throws means nothing left.
  let decision: Decision<TValue>;
  let latencyMs = 0;
  let markSentError: unknown;
  try {
    await meter.markSent({ usageId });
  } catch (error) {
    markSentError = error;
  }

  if (markSentError !== undefined) {
    decision = {
      kind: "fail",
      billed: "none",
      errorClass: "indeterminate",
      failure: {
        kind: "provider",
        provider: args.provider,
        providerKind: "unknown",
        errorClass: "indeterminate",
        billed: "none",
        retryable: true,
        message: `markSent failed before the request left: ${messageOf(markSentError)}`,
      },
      reaskable: false,
    };
  } else {
    const startedAt = clock.now();
    let returned: { readonly ok: true; readonly result: TResult } | { readonly ok: false; readonly error: unknown };
    try {
      returned = { ok: true, result: await plan.call() };
    } catch (error) {
      returned = { ok: false, error };
    }
    latencyMs = Math.max(0, Math.round(clock.now() - startedAt));

    // 6. Validate (inside `read`), or classify the error.
    try {
      decision = returned.ok ? plan.read(returned.result) : classifyError(returned.error, args.provider);
    } catch (error) {
      // Our own code threw after the provider answered: the reply was billed.
      const cost = returned.ok ? safeKnownCost(plan, returned.result) : undefined;
      decision = {
        kind: "fail",
        billed: cost === undefined ? "possible" : "actual",
        ...(cost === undefined ? {} : { costMicroUsd: cost }),
        errorClass: "indeterminate",
        failure: { kind: "internal", message: messageOf(error) },
        reaskable: false,
      };
    }
  }

  // 7. The single finalise call for this row. If it throws, nothing else is called.
  const finalized =
    decision.kind === "settle"
      ? await meter.settle({ usageId, ...decision.usage, latencyMs })
      : await meter.fail({
          usageId,
          billed: decision.billed,
          ...(decision.costMicroUsd === undefined ? {} : { costMicroUsd: decision.costMicroUsd }),
          errorClass: decision.errorClass,
          latencyMs,
        });

  const actual = decision.kind === "settle" ? decision.usage.costMicroUsd : decision.costMicroUsd;
  const overrun =
    actual !== undefined && actual > args.reservedMicroUsd
      ? { reservedMicroUsd: args.reservedMicroUsd, actualMicroUsd: actual }
      : undefined;

  const stopReason = decision.kind === "settle" ? decision.usage.stopReason : decision.stopReason;
  const record: GatewayAttempt = {
    attempt: plan.attempt,
    attemptKey: args.attemptKey,
    usageId,
    reask: args.reask === true,
    reservedMicroUsd: args.reservedMicroUsd,
    status: decision.kind === "settle" ? "settled" : "failed",
    chargedMicroUsd: finalized.costMicroUsd,
    latencyMs,
    ...(decision.kind === "fail" ? { billed: decision.billed, errorClass: decision.errorClass } : {}),
    ...(stopReason === undefined ? {} : { stopReason }),
    ...(overrun === undefined ? {} : { overrun }),
  };

  if (overrun && deps.onOverrun) {
    try {
      await deps.onOverrun({
        usageId,
        attemptKey: args.attemptKey,
        promptRef: args.promptRef,
        provider: args.provider,
        model: args.model,
        ...overrun,
      });
    } catch {
      // Observability only: the row is already final and correctly charged.
    }
  }

  if (decision.kind === "settle") return { kind: "settled", record, value: decision.value };
  return { kind: "failed", record, failure: decision.failure, reaskable: decision.reaskable };
}

function safeKnownCost<TResult, TValue>(plan: AttemptPlan<TResult, TValue>, result: TResult): number | undefined {
  try {
    const cost = plan.knownCost(result);
    return cost !== undefined && Number.isSafeInteger(cost) && cost >= 0 ? cost : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Maps a thrown adapter error to a fail decision.
 *
 * `tool_use` and `pause_turn` (S1 raises both as `invalid_output`): the run
 * fails at once, with no re-ask. D23 allows one structured call per run plus
 * one re-ask when a *finished* answer fails its schema. Neither stop is a
 * finished answer: each asks the caller to continue the turn (run a tool and
 * send its result, or resume a paused server tool), and continuing is exactly
 * the tool loop D23 rules out. We send no tools, so either stop means the
 * request reached a path we never configured; re-sending the same request
 * would most likely land there again and bill a second call for nothing. The
 * other `invalid_output` stops (`max_tokens`, `model_context_window_exceeded`,
 * an empty or non-JSON reply) are schema failures of an answer and get D23's
 * one re-ask.
 */
function classifyError<TValue>(error: unknown, provider: MeterProvider): Decision<TValue> {
  if (!isProviderError(error)) {
    // Not an adapter error: we cannot know whether the request ran.
    return {
      kind: "fail",
      billed: "possible",
      errorClass: "indeterminate",
      failure: {
        kind: "provider",
        provider,
        providerKind: "unknown",
        errorClass: "indeterminate",
        billed: "possible",
        retryable: false,
        message: messageOf(error),
      },
      reaskable: false,
    };
  }
  const cost = error.billed === "none" ? undefined : error.cost?.microUsd;
  const base = {
    kind: "fail" as const,
    billed: error.billed,
    ...(cost === undefined ? {} : { costMicroUsd: cost }),
    ...(error.stopReason === undefined ? {} : { stopReason: error.stopReason }),
  };
  if (error.kind === "refusal") {
    return {
      ...base,
      errorClass: "refusal",
      failure: {
        kind: "refusal",
        provider: error.provider,
        category: error.refusal?.category ?? null,
        explanation: error.refusal?.explanation ?? null,
      },
      reaskable: false,
    };
  }
  if (error.kind === "invalid_output") {
    const continuation = error.stopReason === "tool_use" || error.stopReason === "pause_turn";
    if (!continuation) {
      return {
        ...base,
        errorClass: "schema_invalid",
        failure: { kind: "schema_invalid", issues: [`unusable reply: ${error.message}`] },
        reaskable: true,
      };
    }
  }
  return {
    ...base,
    errorClass: error.errorClass,
    failure: {
      kind: "provider",
      provider: error.provider,
      providerKind: error.kind,
      errorClass: error.errorClass,
      billed: error.billed,
      retryable: error.retryable,
      message: error.message,
    },
    reaskable: false,
  };
}

// ---------------------------------------------------------------------------
// Text (Claude): spec → reserve → call → validate → settle, one re-ask
// ---------------------------------------------------------------------------

/**
 * The spec's zod schema as the JSON Schema sent in `output_config.format`.
 * `$schema` is dropped (a document marker, not a constraint). Throws for a
 * schema zod cannot represent (e.g. a transform).
 */
export function outputJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const json: Record<string, unknown> = { ...z.toJSONSchema(schema) };
  delete json.$schema;
  return json;
}

/** The system blocks for a spec (`02` §5.4): stable system, then the business block. */
export function systemBlocksFor(
  spec: Pick<PromptSpec<unknown, unknown>, "id" | "system" | "cacheLayout">,
  businessContext: string | undefined,
): TextSystemBlock[] {
  const blocks: TextSystemBlock[] = [{ text: spec.system, cacheBreakpoint: true }];
  if (spec.cacheLayout.business === "per_business") {
    if (businessContext === undefined || businessContext.trim().length === 0) {
      throw new Error(`${spec.id}: the cache layout needs a business context block`);
    }
    blocks.push({ text: businessContext, cacheBreakpoint: true });
  } else if (businessContext !== undefined) {
    throw new Error(`${spec.id}: the cache layout has no business block`);
  }
  return blocks;
}

/**
 * An upper bound on the request's input tokens: every UTF-8 byte of the
 * system blocks, the task block and the schema, plus framing. A token is
 * never shorter than a byte, so the true count cannot be higher.
 */
export function inputTokenUpperBound(request: Pick<TextRequest, "system" | "user" | "outputSchema">): number {
  return (
    request.system.reduce((sum, block) => sum + utf8Bytes(block.text), 0) +
    utf8Bytes(request.user) +
    (request.outputSchema === undefined ? 0 : utf8Bytes(JSON.stringify(request.outputSchema))) +
    GATEWAY_FRAMING_TOKENS
  );
}

/**
 * The re-ask's task block: the original block, then a fixed note naming the
 * schema paths that failed. The previous reply's text is never echoed back
 * (it is model output, so it is data, not instructions).
 */
export function reaskUserBlock(user: string, issues: readonly string[]): string {
  const listed = issues.slice(0, 8).map((issue) => `- ${issue.slice(0, 200)}`).join("\n");
  return [
    user,
    "",
    "<reask>",
    "Your previous reply could not be used because it did not match the required output schema:",
    listed,
    "Reply again with only JSON that matches the schema exactly.",
    "</reask>",
  ].join("\n");
}

function zodIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.map((part) => String(part)).join(".");
    return `${path.length === 0 ? "(root)" : path}: ${issue.code}`;
  });
}

function configFailure(promptRef: string, message: string): GatewayOutcome<never> {
  return { ok: false, failure: { kind: "config", message }, promptRef, attempts: [] };
}

type ResolvedText = {
  readonly ref: string;
  readonly model: PromptModel;
  readonly maxInputTokens: number;
  readonly request: TextRequest;
};

function resolveText<TInput, TOutput>(input: TextGatewayInput<TInput, TOutput>): ResolvedText {
  const { spec } = input;
  const ref = promptRefFor(spec);
  if (spec.mode !== "realtime") {
    throw new Error(`${ref}: batch specs run through the Message Batches path (S5), not the realtime gateway`);
  }
  const timeoutMs = input.timeoutMs ?? DEFAULT_GATEWAY_TIMEOUT_MS;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > MAX_TIMEOUT_MS) {
    throw new Error(`timeoutMs must be 1..${MAX_TIMEOUT_MS}, got ${timeoutMs}`);
  }
  const user = spec.buildUser(input.inputs);
  if (typeof user !== "string" || user.trim().length === 0) throw new Error(`${ref}: buildUser returned an empty task block`);
  const request: TextRequest = {
    model: modelForSpec(spec),
    effort: spec.effort,
    thinking: spec.thinking,
    maxTokens: spec.maxTokens,
    system: systemBlocksFor(spec, input.businessContext),
    user,
    outputSchema: outputJsonSchema(spec.outputSchema),
    timeoutMs,
    ...(input.signal === undefined ? {} : { signal: input.signal }),
  };
  return { ref, model: request.model, maxInputTokens: maxInputTokensForSpec(spec), request };
}

/** The worst case for one text attempt. Throws when the input bound is over the lane ceiling. */
export function textReservationMicroUsd(resolved: Pick<ResolvedText, "model" | "maxInputTokens" | "request">): number {
  const reserved = anthropicWorstCaseMicroUsd({
    model: resolved.model,
    inputTokens: inputTokenUpperBound(resolved.request),
    maxTokens: resolved.request.maxTokens,
    maxInputTokens: resolved.maxInputTokens,
  });
  if (reserved > MAX_RESERVATION_MICRO_USD) {
    throw new RangeError(`reservation ${reserved} is over the meter's limit of ${MAX_RESERVATION_MICRO_USD}`);
  }
  return reserved;
}

/**
 * Runs one prompt spec: at most two provider calls (the first attempt and
 * D23's one re-ask), each with its own reservation and `ai_usage` row.
 */
export async function runTextGateway<TInput, TOutput>(
  deps: TextGatewayDeps,
  input: TextGatewayInput<TInput, TOutput>,
): Promise<GatewayOutcome<TextRunValue<TOutput>>> {
  // 1. Resolve the spec. Nothing is reserved if this fails.
  let resolved: ResolvedText;
  try {
    resolved = resolveText(input);
  } catch (error) {
    return configFailure(safeRef(input.spec), messageOf(error));
  }
  const { ref, model } = resolved;
  const { spec, caller } = input;
  const firstAttempt = caller.attempt ?? 1;
  const attempts: GatewayAttempt[] = [];

  let request = resolved.request;
  let lastIssues: readonly string[] = [];
  for (let reasks = 0; reasks <= MAX_REASKS; reasks++) {
    const attempt = firstAttempt + reasks;
    const reask = reasks > 0;

    // 2. The worst case for this attempt, before anything is reserved.
    let reserve: ReserveArgs;
    try {
      reserve = {
        ...(caller.ownerId === undefined ? {} : { ownerId: caller.ownerId }),
        ...(caller.projectId === undefined ? {} : { projectId: caller.projectId }),
        ...(caller.taskId === undefined ? {} : { taskId: caller.taskId }),
        ...(caller.creditDebitId === undefined ? {} : { creditDebitId: caller.creditDebitId }),
        attemptKey: caller.attemptKey(attempt),
        promptRef: ref,
        provider: "anthropic",
        model,
        tier: spec.tier,
        feature: "ai",
        reservedMicroUsd: textReservationMicroUsd({ ...resolved, request }),
        // The escalation counts once: the re-ask belongs to the same escalation.
        ...(spec.purpose === "escalation" && !reask ? { escalation: true as const } : {}),
        ...(reask ? { reask: true as const } : {}),
      };
    } catch (error) {
      return { ok: false, failure: { kind: "config", message: messageOf(error) }, promptRef: ref, attempts };
    }

    const sent = request;
    const outcome = await runAttempt<TextResult, TextRunValue<TOutput>>(deps, {
      attempt,
      reserve,
      call: () => deps.adapter.complete(sent),
      knownCost: (result) => result.cost.microUsd,
      read: (result) => {
        const usage: SettleUsage = {
          inputTokens: result.usage.inputTokens,
          cacheReadTokens: result.usage.cacheReadTokens,
          cacheWriteTokens: result.usage.cacheWriteTokens,
          outputTokens: result.usage.outputTokens,
          costMicroUsd: result.cost.microUsd,
          estimated: result.cost.estimated,
          stopReason: result.stopReason,
        };
        const parsed = spec.outputSchema.safeParse(result.json);
        if (parsed.success) {
          return {
            kind: "settle",
            usage,
            value: { output: parsed.data, messageId: result.messageId, stopReason: result.stopReason },
          };
        }
        return {
          kind: "fail",
          billed: "actual",
          costMicroUsd: result.cost.microUsd,
          errorClass: "schema_invalid",
          stopReason: result.stopReason,
          failure: { kind: "schema_invalid", issues: zodIssues(parsed.error) },
          reaskable: true,
        };
      },
    });

    if (outcome.kind === "not_reserved") {
      return { ok: false, failure: outcome.failure, promptRef: ref, attempts };
    }
    attempts.push(outcome.record);
    if (outcome.kind === "settled") return { ok: true, value: outcome.value, promptRef: ref, attempts };
    if (!outcome.reaskable || reasks >= MAX_REASKS) {
      return { ok: false, failure: outcome.failure, promptRef: ref, attempts };
    }
    lastIssues = outcome.failure.kind === "schema_invalid" ? outcome.failure.issues : [];
    request = { ...resolved.request, user: reaskUserBlock(resolved.request.user, lastIssues) };
  }
  // Unreachable: the loop returns on every path of its last iteration.
  return { ok: false, failure: { kind: "schema_invalid", issues: lastIssues }, promptRef: ref, attempts };
}

function safeRef(spec: Pick<PromptSpec<unknown, unknown>, "id" | "version">): string {
  try {
    return promptRefFor(spec);
  } catch {
    return `${String(spec.id)}@${String(spec.version)}`;
  }
}

// ---------------------------------------------------------------------------
// Images (gpt-image-2, Recraft): reserve → call → settle, no re-ask
// ---------------------------------------------------------------------------

export type ImageJob =
  | {
      readonly provider: "openai_images";
      readonly request: OpenAiImageRequest;
      readonly adapter: ImageAdapterPort<OpenAiImageRequest>;
    }
  | {
      readonly provider: "recraft";
      readonly request: RecraftImageRequest;
      readonly adapter: ImageAdapterPort<RecraftImageRequest>;
    };

export type ImageGatewayInput = {
  readonly job: ImageJob;
  /** The media prompt's ref, e.g. `brand-logo-mark@1` (C-METER: media calls use their own refs). */
  readonly promptRef: string;
  readonly caller: GatewayCaller;
};

/** The worst case for one image render. Throws a `config` error for an unpriced request. */
export function imageReservationMicroUsd(job: ImageJob): number {
  if (job.provider === "openai_images") return openAiImageReservationMicroUsd(job.request);
  assertRecraftRequest(job.request);
  return recraftCostMicroUsd({ size: job.request.size });
}

function generateImage(job: ImageJob): Promise<ImageResult> {
  switch (job.provider) {
    case "openai_images":
      return job.adapter.generate(job.request);
    case "recraft":
      return job.adapter.generate(job.request);
  }
}

function unitCount(units: Readonly<Record<string, number>>, key: string): number {
  const value = units[key];
  return value !== undefined && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

/** One render: one reservation, one call, one settle or fail. Media has no re-ask. */
export async function runImageGateway(
  deps: ImageGatewayDeps,
  input: ImageGatewayInput,
): Promise<GatewayOutcome<ImageResult>> {
  const { job, caller, promptRef } = input;
  if (typeof promptRef !== "string" || promptRef.trim().length === 0) {
    return configFailure(String(promptRef), "promptRef is required");
  }
  const attempt = caller.attempt ?? 1;
  let reserve: ReserveArgs;
  try {
    reserve = {
      ...(caller.ownerId === undefined ? {} : { ownerId: caller.ownerId }),
      ...(caller.projectId === undefined ? {} : { projectId: caller.projectId }),
      ...(caller.taskId === undefined ? {} : { taskId: caller.taskId }),
      ...(caller.creditDebitId === undefined ? {} : { creditDebitId: caller.creditDebitId }),
      attemptKey: caller.attemptKey(attempt),
      promptRef,
      provider: job.provider,
      model: job.provider === "openai_images" ? OPENAI_IMAGE_MODEL : RECRAFT_MODEL,
      tier: "image",
      feature: "ai",
      reservedMicroUsd: imageReservationMicroUsd(job),
    };
  } catch (error) {
    return configFailure(promptRef, messageOf(error));
  }

  const outcome = await runAttempt<ImageResult, ImageResult>(deps, {
    attempt,
    reserve,
    call: () => generateImage(job),
    knownCost: (result) => result.cost.microUsd,
    read: (result) => ({
      kind: "settle",
      usage: {
        inputTokens: unitCount(result.cost.units, "input_tokens"),
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        outputTokens: unitCount(result.cost.units, "output_tokens"),
        images: 1,
        costMicroUsd: result.cost.microUsd,
        estimated: result.cost.estimated,
      },
      value: result,
    }),
  });
  if (outcome.kind === "not_reserved") return { ok: false, failure: outcome.failure, promptRef, attempts: [] };
  if (outcome.kind === "settled") return { ok: true, value: outcome.value, promptRef, attempts: [outcome.record] };
  return { ok: false, failure: outcome.failure, promptRef, attempts: [outcome.record] };
}
