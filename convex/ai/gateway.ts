/**
 * WP71-S2. The AI gateway: every crew model call and media render, metered.
 *
 * `02` §5.1, in order, for every provider call:
 * 1. resolve the spec (ref, model, JSON Schema, request blocks);
 * 2. size the worst-case reservation from the spec's tier and lane bounds and
 *    the S1 rate cards (`pricing.ts`) — before anything is reserved;
 * 3. C-METER `reserve` (kill switch, budgets) — a refusal means no call;
 * 4. C-METER `markSent`, immediately before the request leaves. If it changes
 *    nothing (the row is already final, e.g. swept), nothing is sent;
 * 5. the adapter call (S1), with an `AbortSignal` timeout;
 * 6. validate the structured output against the spec's zod schema;
 * 7. C-METER `settle` with the true cost and `estimated`, or `fail` with the
 *    adapter's `billed` state (C-METER `chargeOnFail` sets the charge).
 *
 * Rules this file enforces:
 * - **One call per attempt, one re-ask per run (D23).** A schema failure of a
 *   finished reply gets exactly one re-ask, as a new attempt with its own
 *   reservation (a new `ai_usage` row, `reask: true`). A second schema failure
 *   fails the run. Truncated replies (`max_tokens`,
 *   `model_context_window_exceeded`) are not re-asked: the same request would
 *   truncate again. The gateway never sends tools — `TextRequest` has no tools
 *   field — and never continues a `tool_use` or `pause_turn` reply (see
 *   `classifyError`).
 * - **The re-ask never carries model-chosen text.** Its note lists each failed
 *   path and zod issue code only. A path segment is printed only when it is an
 *   array index or a property the output schema itself declares (and matches
 *   `SAFE_PATH_SEGMENT`); any other segment — a `z.record` key, an unknown
 *   key, anything the model invented — is printed as `[key]`. Zod issue
 *   messages are never used (they can quote values).
 * - **Every row is finalised at most once per kind.** Each attempt reaches one
 *   `settle` or one `fail` call site. If that call throws it is retried once
 *   (both are idempotent by `usageId`); the gateway never switches to the
 *   other call. If the retry also throws, the run ends `internal` with the
 *   row's id and the WP70 sweep finalises it (`sweepOutcome`).
 * - **The meter's answer is the record.** `GatewayAttempt.status` and the
 *   charge come from the `FinalizeResult` (including `alreadyFinal` and a late
 *   settle's `lateAdjustmentMicroUsd`), not from the gateway's own decision.
 * - **A refusal fails the job** (`02` §5.8), charged its actual cost, with no
 *   re-ask and no `fallbacks` (C-PROMPT header).
 * - **The worst case is charged when the provider may have billed.** `fail`
 *   receives `billed` from the adapter; C-METER charges the reservation for
 *   `possible`, 0 for `none` and the known cost for `actual`.
 * - **Text costs are cross-checked.** The gateway reprices the reported usage
 *   with the S1 rate card and charges the larger of that and the adapter's
 *   figure, so an adapter that under-reports cannot under-charge.
 * - **An overrun is visible.** A true cost above that attempt's reservation is
 *   still settled at the true cost, and flagged as
 *   `overrun: { reservedMicroUsd, actualMicroUsd }` on the attempt record and
 *   through the optional `onOverrun` hook (the C-METER port has no overrun
 *   field; see the S2 contract questions).
 * - **The run fits one Convex action.** A text run has an overall deadline of
 *   `GATEWAY_RUN_BUDGET_MS` from its start. The re-ask's timeout is bounded by
 *   the time left, and the re-ask is skipped when the caller's signal is
 *   aborted or less than `MIN_REASK_WINDOW_MS` is left.
 * - **Escalations count once.** `escalation: true` is sent only on attempt 1
 *   (orchestrator ruling, 2026-11-05): neither a job retry (`caller.attempt > 1`)
 *   nor the re-ask counts again; C-JOBS already bounds job retries.
 * - **Meter and gateway failures come back as results.** A throw from
 *   `reserve`, `settle` or `fail` ends the run `internal` with the attempts so
 *   far, never an escaped error that loses them.
 * - **A reused attempt key is a duplicate, not an internal error.** The
 *   meter's "attemptKey reused for a different call" (`METER_ATTEMPT_KEY_REUSED`)
 *   ends the run `duplicate_attempt` with no `usageId`, `reason:
 *   "key_reused_for_different_call"` and the meter's message, and nothing is
 *   sent. A text run returns `nextAttempt` so a retry never lands
 *   on its own re-ask row.
 * - **A gate refusal is a meter refusal.** The real meter throws C-OPS /
 *   C-AUTHZ gate codes (`AI_DISABLED`, `WORKSPACE_DISABLED`,
 *   `RESOURCE_NOT_FOUND`) from `reserve` and `markSent`, often as bare
 *   `{ code }` with no `message`. Both `MeterErrorData` and
 *   `WorkspaceGateErrorData` (`isGatewayErrorData`) end the run
 *   `meter_refused`. From `reserve`, nothing was created; from `markSent`, the
 *   row is failed `billed: "none"` (charged 0) and nothing is sent.
 * - **Streaming is display only (WP77-S3).** `onTextDelta` makes the adapter
 *   stream and tags each delta with its attempt; the settle, the schema check
 *   and the re-ask use the final message exactly as an unstreamed call does.
 * - **The router decides the call.** `resolveText` takes the model, effort,
 *   thinking, max tokens, mode and input ceiling from `routeSpec`, which
 *   re-validates the spec; a spec the router rejects is a `config` failure.
 *
 * Shape: a pure, injectable core (`runTextGateway`, `runImageGateway`) that
 * takes a meter port, an adapter port and a clock, so it runs without Convex.
 * The Convex binding is `convex/ai/gatewayActions.ts` (WP71-S2 follow-up): a
 * `"use node"` `internalAction` that resolves a `promptRef` through the
 * registry and binds `MeterPort` to `internal.ai.metering.*` through
 * `ctx.runMutation`. This file registers no Convex function. The in-memory
 * meter used by the unit tests lives in `tests/platform/support/`.
 */

import { z } from "zod";

import {
  isGatewayErrorData,
  MAX_RESERVATION_MICRO_USD,
  type BilledState,
  type FailArgs,
  type FinalizeResult,
  type GatewayErrorData,
  type MarkSentArgs,
  type MarkSentResult,
  type MeterErrorClass,
  type MeterProvider,
  type ReserveArgs,
  type ReserveResult,
  type SettleArgs,
} from "../../lib/workspace/contracts/metering";
import {
  promptRef as promptRefFor,
  type PromptModel,
  type PromptSpec,
} from "../../lib/workspace/contracts/prompts";
import {
  anthropicCostMicroUsd,
  anthropicWorstCaseMicroUsd,
  OPENAI_IMAGE_MODEL,
  recraftCostMicroUsd,
} from "./pricing";
import { openAiImageReservationMicroUsd, type OpenAiImageRequest } from "./providers/openaiImages";
import { assertRecraftRequest, recraftModelFor, type RecraftImageRequest } from "./providers/recraft";
import { MAX_TIMEOUT_MS, utf8Bytes } from "./providers/transport";
import { wireOutputSchema } from "./providers/wireSchema";
import {
  isProviderError,
  type ImageResult,
  type ProviderErrorKind,
  type TextCallHooks,
  type TextRequest,
  type TextResult,
  type TextSystemBlock,
  type TextUsage,
} from "./providers/types";
import { routeSpec } from "./router";

// ---------------------------------------------------------------------------
// Ports
// ---------------------------------------------------------------------------

/**
 * The four C-METER calls, with the contract's exact signatures.
 * `convex/ai/gatewayActions.ts` binds them to Codex's `convex/ai/metering.ts`
 * (WP70) through `ctx.runMutation`; the unit tests use the in-memory stub
 * (`tests/platform/support/meterStub.ts`). Refusals arrive as a thrown
 * `ConvexError` whose `data` is `MeterErrorData` or a gate error
 * (`WorkspaceGateErrorData`, often `{ code }` alone).
 */
export type MeterPort = {
  reserve(args: ReserveArgs): Promise<ReserveResult>;
  markSent(args: MarkSentArgs): Promise<MarkSentResult>;
  settle(args: SettleArgs): Promise<FinalizeResult>;
  fail(args: FailArgs): Promise<FinalizeResult>;
};

/**
 * The Claude adapter's one method (`createAnthropicAdapter` satisfies it).
 * `hooks` is passed only when the caller asked for text deltas (WP77-S3).
 */
export type TextAdapterPort = {
  complete(request: TextRequest, hooks?: TextCallHooks): Promise<TextResult>;
};

/** An image adapter's one method (`createOpenAiImagesAdapter`, `createRecraftAdapter`). */
export type ImageAdapterPort<TRequest> = {
  generate(request: TRequest): Promise<ImageResult>;
};

/** Milliseconds since the epoch: `latencyMs` and the run's overall deadline. */
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

/**
 * A text run's overall time budget, first call and re-ask together: 9
 * minutes, inside one Convex action's 10-minute limit.
 */
export const GATEWAY_RUN_BUDGET_MS = MAX_TIMEOUT_MS;

/** The least time a re-ask may be given; with less left, the run ends without one. */
export const MIN_REASK_WINDOW_MS = 30 * 1_000;

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
  /**
   * WP77-S3. Text deltas as they stream, tagged with the attempt number, so a
   * caller can show a reply while it is written and start over on the re-ask.
   * Display only: it never changes what is reserved, sent, validated or
   * charged, and a throwing sink is ignored (`streamHooksFor`).
   */
  readonly onTextDelta?: (event: TextDeltaEvent) => void;
};

/** One streamed text delta and the attempt it belongs to. */
export type TextDeltaEvent = { readonly attempt: number; readonly delta: string };

/**
 * The adapter hooks for one attempt, or undefined when the caller wants no
 * deltas (the adapter then makes its unstreamed call, unchanged). A sink that
 * throws is swallowed here, so it cannot fail a call that was already billed.
 */
export function streamHooksFor(
  sink: ((event: TextDeltaEvent) => void) | undefined,
  attempt: number,
): TextCallHooks | undefined {
  if (sink === undefined) return undefined;
  return {
    onTextDelta: (delta) => {
      try {
        sink({ attempt, delta });
      } catch {
        // Display only: the final message is the record.
      }
    },
  };
}

/** One `ai_usage` row this run created and finalised, as C-METER reported it. */
export type GatewayAttempt = {
  readonly attempt: number;
  readonly attemptKey: string;
  readonly usageId: string;
  readonly reask: boolean;
  readonly reservedMicroUsd: number;
  /** `FinalizeResult.status`: a swept row stays `failed` even after a late settle. */
  readonly status: "settled" | "failed";
  /** True when the row was already final (`FinalizeResult.alreadyFinal`). */
  readonly alreadyFinal: boolean;
  /**
   * What C-METER charged for the row: `FinalizeResult.costMicroUsd`, plus
   * `lateAdjustmentMicroUsd` when a late settle added to a swept row.
   */
  readonly chargedMicroUsd: number;
  readonly lateAdjustmentMicroUsd?: number;
  readonly latencyMs: number;
  readonly billed?: BilledState;
  readonly errorClass?: MeterErrorClass;
  readonly stopReason?: string;
  readonly overrun?: { readonly reservedMicroUsd: number; readonly actualMicroUsd: number };
};

export type GatewayFailure =
  /** A request no caller should send. Nothing was reserved. */
  | { readonly kind: "config"; readonly message: string }
  /**
   * C-METER refused (kill switch, workspace switch, cohort, budget, a task or
   * debit no longer valid). Nothing was sent. From `reserve` no row exists;
   * from `markSent` the row is in `attempts`, failed with `billed: "none"`.
   * `error` is the meter's data: `message` and `scope` may be absent.
   */
  | { readonly kind: "meter_refused"; readonly error: GatewayErrorData }
  /**
   * The attempt key already had a row. Nothing was sent and the existing row
   * was left alone: the caller must use a new attempt number (a text run's
   * `nextAttempt` from the run that made the row). `usageId` names the row
   * when the meter returned it (the same call replayed); it is absent when the
   * meter refused the key as "attemptKey reused for a different call" (e.g. a
   * job retry that landed on an earlier run's re-ask row, or two tasks sharing
   * one `jobKey`). Then `reason` is `"key_reused_for_different_call"` and
   * `message` is the meter's error text, so a key bug stays visible.
   */
  | {
      readonly kind: "duplicate_attempt";
      readonly attemptKey: string;
      readonly usageId?: string;
      readonly reason?: "key_reused_for_different_call";
      readonly message?: string;
    }
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
  /**
   * A meter call or gateway code threw. `usageId` names a row left
   * unfinalised for the WP70 sweep (it is not in `attempts`).
   */
  | { readonly kind: "internal"; readonly message: string; readonly usageId?: string };

export type GatewayOutcome<TValue> = (
  | { readonly ok: true; readonly value: TValue }
  | { readonly ok: false; readonly failure: GatewayFailure }
) & {
  readonly promptRef: string;
  readonly attempts: readonly GatewayAttempt[];
};

/**
 * A text run's outcome. `nextAttempt` is one past the highest attempt number
 * this run reserved a row for or found occupied: it counts a row left
 * unfinalised for the sweep, a row the meter refused at `markSent`, and an
 * attempt key that already had a row (`duplicate_attempt`, on the first
 * attempt or the re-ask), so a retry with it never lands on that key again.
 * When the run reserved nothing and hit no duplicate (a `config` failure, a
 * `reserve` refusal) it is the run's first attempt number. A caller's retry
 * uses it, never `firstAttempt + attempts.length` (`attempts` leaves out an
 * unfinalised row).
 */
export type TextGatewayOutcome<TValue> = GatewayOutcome<TValue> & { readonly nextAttempt: number };

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
  /** Maps a thrown adapter error to a decision (defaults to `classifyError`). */
  readonly classify?: (error: unknown) => Decision<TValue>;
};

type AttemptOutcome<TValue> =
  /**
   * Nothing was sent. `reserved` is true when this attempt did create a row
   * (it was no longer ours to finalise by `markSent`), false when nothing was
   * reserved.
   */
  | { readonly kind: "not_sent"; readonly failure: GatewayFailure; readonly reserved: boolean }
  /** The finalise call threw twice: the row is left for the sweep. */
  | { readonly kind: "unfinalized"; readonly failure: GatewayFailure }
  | { readonly kind: "settled"; readonly record: GatewayAttempt; readonly value: TValue }
  | {
      readonly kind: "failed";
      readonly record: GatewayAttempt;
      readonly failure: GatewayFailure;
      readonly reaskable: boolean;
    };

/**
 * The meter's refusal data, from a thrown `ConvexError` (or the bare data).
 * Accepts meter codes and gate codes (`isGatewayErrorData`): the real meter
 * throws C-OPS `{ code: "AI_DISABLED" }` with no `message`, which
 * `isMeterErrorData` alone would reject.
 */
export function gatewayErrorDataOf(error: unknown): GatewayErrorData | null {
  let data: unknown = error;
  if (!isGatewayErrorData(data) && typeof error === "object" && error !== null && "data" in error) {
    data = (error as { readonly data: unknown }).data;
  }
  return isGatewayErrorData(data) ? data : null;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * The real meter's text when `reserve` finds the attempt key on a row made by
 * a different call (`sameAttempt` in `convex/ai/metering.ts`). It throws a
 * plain `Error`, not a `ConvexError`; through `ctx.runMutation` the message
 * can arrive wrapped (function name, request id, "Uncaught Error:"), so it is
 * matched as a substring, and only this exact phrase.
 */
export const METER_ATTEMPT_KEY_REUSED = "attemptKey reused for a different call";

function isAttemptKeyReused(error: unknown): boolean {
  return error instanceof Error && error.message.includes(METER_ATTEMPT_KEY_REUSED);
}

/** Calls a finalise mutation, retrying the same call once (C-METER makes it idempotent by `usageId`). */
async function finalizeOnce(
  call: () => Promise<FinalizeResult>,
): Promise<{ readonly ok: true; readonly result: FinalizeResult } | { readonly ok: false; readonly error: unknown }> {
  try {
    return { ok: true, result: await call() };
  } catch {
    try {
      return { ok: true, result: await call() };
    } catch (error) {
      return { ok: false, error };
    }
  }
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
    const data = gatewayErrorDataOf(error);
    if (data === null && isAttemptKeyReused(error)) {
      return {
        kind: "not_sent",
        reserved: false,
        failure: {
          kind: "duplicate_attempt",
          attemptKey: args.attemptKey,
          reason: "key_reused_for_different_call",
          message: messageOf(error),
        },
      };
    }
    return {
      kind: "not_sent",
      reserved: false,
      failure: data ? { kind: "meter_refused", error: data } : { kind: "internal", message: `reserve failed: ${messageOf(error)}` },
    };
  }
  if (reserved.existing) {
    return {
      kind: "not_sent",
      reserved: false,
      failure: { kind: "duplicate_attempt", attemptKey: args.attemptKey, usageId: reserved.usageId },
    };
  }
  const usageId = reserved.usageId;

  // 4. markSent, then 5. the call.
  let decision: Decision<TValue>;
  let latencyMs = 0;
  let sentFlag: MarkSentResult | undefined;
  let markSentFailed = false;
  let markSentError: unknown;
  try {
    sentFlag = await meter.markSent({ usageId });
  } catch (error) {
    markSentFailed = true;
    markSentError = error;
  }

  if (sentFlag !== undefined && !sentFlag.changed) {
    // We created this row a moment ago, so "changed nothing" means it is no
    // longer ours (already final, e.g. swept). Send nothing, finalise nothing.
    return {
      kind: "not_sent",
      reserved: true,
      failure: {
        kind: "provider",
        provider: args.provider,
        providerKind: "unknown",
        errorClass: "indeterminate",
        billed: "none",
        retryable: false,
        message: `markSent changed nothing on ${usageId}: the row is already final, so nothing was sent`,
      },
    };
  }

  const markSentRefusal = markSentFailed ? gatewayErrorDataOf(markSentError) : null;
  if (markSentRefusal !== null) {
    // The meter's gate refused the send (kill switch flipped, task cancelled,
    // debit refunded). Nothing left: fail the row unbilled and stop.
    decision = {
      kind: "fail",
      billed: "none",
      errorClass: "permanent",
      failure: { kind: "meter_refused", error: markSentRefusal },
      reaskable: false,
    };
  } else if (markSentFailed) {
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
      if (returned.ok) {
        decision = plan.read(returned.result);
      } else {
        decision = plan.classify ? plan.classify(returned.error) : classifyError(returned.error, args.provider);
      }
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

  // 7. The single finalise call for this row, retried once, never switched.
  const settled = decision;
  const finalized = await finalizeOnce(() =>
    settled.kind === "settle"
      ? meter.settle({ usageId, ...settled.usage, latencyMs })
      : meter.fail({
          usageId,
          billed: settled.billed,
          ...(settled.costMicroUsd === undefined ? {} : { costMicroUsd: settled.costMicroUsd }),
          errorClass: settled.errorClass,
          latencyMs,
        }),
  );
  if (!finalized.ok) {
    return {
      kind: "unfinalized",
      failure: {
        kind: "internal",
        message: `${decision.kind} failed twice on ${usageId}; the sweep will finalise it: ${messageOf(finalized.error)}`,
        usageId,
      },
    };
  }
  const result = finalized.result;

  const actual = decision.kind === "settle" ? decision.usage.costMicroUsd : decision.costMicroUsd;
  const overrun =
    actual !== undefined && actual > args.reservedMicroUsd
      ? { reservedMicroUsd: args.reservedMicroUsd, actualMicroUsd: actual }
      : undefined;

  const late = result.alreadyFinal ? result.lateAdjustmentMicroUsd : 0;
  const stopReason = decision.kind === "settle" ? decision.usage.stopReason : decision.stopReason;
  const record: GatewayAttempt = {
    attempt: plan.attempt,
    attemptKey: args.attemptKey,
    usageId,
    reask: args.reask === true,
    reservedMicroUsd: args.reservedMicroUsd,
    status: result.status,
    alreadyFinal: result.alreadyFinal,
    chargedMicroUsd: result.costMicroUsd + late,
    ...(late > 0 ? { lateAdjustmentMicroUsd: late } : {}),
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

  // The output is returned whenever it validated: even when the sweep beat
  // the settle, the reply was produced and the late settle charged it.
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

/** Stops that mean the reply was cut off; re-sending the same request would cut off again. */
const TRUNCATION_STOPS: readonly string[] = ["max_tokens", "model_context_window_exceeded"];

/** Stops that ask the caller to continue the turn, which only a tool loop can do (D23). */
const CONTINUATION_STOPS: readonly string[] = ["tool_use", "pause_turn"];

/**
 * Maps a thrown adapter error to a fail decision. `repriceUsage`, when given,
 * reprices the usage on a billed error (text calls) so the larger of the two
 * figures is charged.
 *
 * `tool_use` and `pause_turn` (S1 raises both as `invalid_output`): the run
 * fails at once, with no re-ask. D23 allows one structured call per run plus
 * one re-ask when a *finished* answer fails its schema. Neither stop is a
 * finished answer: each asks the caller to continue the turn (run a tool and
 * send its result, or resume a paused server tool), and continuing is exactly
 * the tool loop D23 rules out. We send no tools, so either stop means the
 * request reached a path we never configured; re-sending the same request
 * would most likely land there again and bill a second call for nothing.
 *
 * `max_tokens` and `model_context_window_exceeded` also fail at once, billed
 * `actual` at their cost: the re-ask is the same request with a longer task
 * block, so it would truncate again.
 *
 * The remaining `invalid_output` replies (finished, but empty or not JSON) are
 * schema failures and get D23's one re-ask. Their issue text is fixed; the
 * adapter's message is not used.
 */
function classifyError<TValue>(
  error: unknown,
  provider: MeterProvider,
  repriceUsage?: (usage: TextUsage) => number | undefined,
): Decision<TValue> {
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
  const reported = error.billed === "none" ? undefined : error.cost?.microUsd;
  const repriced = error.billed !== "none" && error.usage !== undefined ? repriceUsage?.(error.usage) : undefined;
  const cost = reported === undefined && repriced === undefined ? undefined : Math.max(reported ?? 0, repriced ?? 0);
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
    const stop = error.stopReason ?? "";
    if (!CONTINUATION_STOPS.includes(stop) && !TRUNCATION_STOPS.includes(stop)) {
      return {
        ...base,
        errorClass: "schema_invalid",
        failure: { kind: "schema_invalid", issues: ["(root): invalid_json"] },
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
 * system blocks, the task block and the schema as sent (`wireOutputSchema`),
 * plus framing. A token is
 * never shorter than a byte, so the true count cannot be higher.
 */
export function inputTokenUpperBound(request: Pick<TextRequest, "system" | "user" | "outputSchema">): number {
  return (
    request.system.reduce((sum, block) => sum + utf8Bytes(block.text), 0) +
    utf8Bytes(request.user) +
    (request.outputSchema === undefined ? 0 : utf8Bytes(JSON.stringify(wireOutputSchema(request.outputSchema)))) +
    GATEWAY_FRAMING_TOKENS
  );
}

/** A path segment safe to print: a plain identifier the schema itself could declare. */
export const SAFE_PATH_SEGMENT = /^[A-Za-z_][A-Za-z0-9_]{0,40}$/;

/** What an unsafe or undeclared path segment prints as. */
export const REDACTED_SEGMENT = "[key]";

const SAFE_ISSUE_CODE = /^[a-z_]{1,40}$/;

type JsonNode = Readonly<Record<string, unknown>>;

function asNode(value: unknown): JsonNode | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as JsonNode) : undefined;
}

/**
 * Work caps for `safeIssuePath`. Past either one the walk stops and every
 * later name segment prints as `[key]`, which is always safe. Real output
 * schemas sit far below both; the caps only bound a hostile or recursive
 * schema and a deep path.
 */
export const MAX_SAFE_PATH_DEPTH = 64;
export const MAX_SAFE_PATH_NODES = 256;

/**
 * Every schema node reachable from `start` through `anyOf` / `oneOf` /
 * `allOf` branches and local `$ref`s (`#` or `#/$defs/...`), each node once
 * (deduplicated by identity, so recursive `$defs` cannot loop or multiply).
 * Returns undefined when the set would pass `MAX_SAFE_PATH_NODES`.
 */
function expandNodes(start: readonly (JsonNode | undefined)[], root: JsonNode): JsonNode[] | undefined {
  const seen = new Set<JsonNode>();
  const stack = [...start];
  const defs = asNode(root.$defs);
  while (stack.length > 0) {
    const node = stack.pop();
    if (node === undefined || seen.has(node)) continue;
    if (seen.size >= MAX_SAFE_PATH_NODES) return undefined;
    seen.add(node);
    const ref = node.$ref;
    if (ref === "#") stack.push(root);
    else if (typeof ref === "string" && ref.startsWith("#/$defs/")) {
      stack.push(asNode(defs?.[ref.slice("#/$defs/".length)]));
    }
    for (const key of ["anyOf", "oneOf", "allOf"] as const) {
      const list = node[key];
      if (Array.isArray(list)) for (const item of list) stack.push(asNode(item));
    }
  }
  return [...seen];
}

/**
 * Renders a zod issue path without any model-chosen text. Walks the output's
 * JSON Schema alongside the path: an array index prints as itself; a
 * property name prints only when the schema declares it under `properties`
 * and it matches `SAFE_PATH_SEGMENT`; anything else (`z.record` keys, unknown
 * keys) prints as `[key]`. Each step works on a deduplicated node set, and
 * the walk stops (later names print as `[key]`) past `MAX_SAFE_PATH_DEPTH`
 * segments or `MAX_SAFE_PATH_NODES` nodes, so its cost stays linear.
 */
export function safeIssuePath(path: readonly PropertyKey[], schema: JsonNode): string {
  let nodes: JsonNode[] = expandNodes([schema], schema) ?? [];
  const parts: string[] = [];
  for (const segment of path) {
    if (parts.length >= MAX_SAFE_PATH_DEPTH) nodes = [];
    if (typeof segment === "number" && Number.isSafeInteger(segment) && segment >= 0) {
      parts.push(String(segment));
      nodes = expandNodes(nodes.map((node) => asNode(node.items)), schema) ?? [];
      continue;
    }
    const declared =
      typeof segment === "string" &&
      SAFE_PATH_SEGMENT.test(segment) &&
      nodes.some((node) => {
        const properties = asNode(node.properties);
        return properties !== undefined && Object.hasOwn(properties, segment);
      });
    if (declared) {
      parts.push(segment);
      nodes = expandNodes(nodes.map((node) => asNode(asNode(node.properties)?.[segment])), schema) ?? [];
    } else {
      parts.push(REDACTED_SEGMENT);
      nodes = expandNodes(nodes.map((node) => asNode(node.additionalProperties)), schema) ?? [];
    }
  }
  return parts.length === 0 ? "(root)" : parts.join(".");
}

/** One line per issue: a safe path and the zod issue code. Never the issue message. */
export function safeZodIssues(error: z.ZodError, schema: JsonNode): string[] {
  return error.issues.map((issue) => {
    const code = SAFE_ISSUE_CODE.test(issue.code) ? issue.code : "invalid";
    return `${safeIssuePath(issue.path, schema)}: ${code}`;
  });
}

/**
 * The re-ask's task block: the original block, then a fixed note listing the
 * failed paths and issue codes from `safeZodIssues`. Nothing in the note
 * comes from the model's reply.
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

function configFailure(promptRef: string, message: string): GatewayOutcome<never> {
  return { ok: false, failure: { kind: "config", message }, promptRef, attempts: [] };
}

type ResolvedText = {
  readonly ref: string;
  readonly model: PromptModel;
  readonly maxInputTokens: number;
  readonly request: TextRequest;
};

/**
 * The request for a spec. The call settings (model, effort, thinking, max
 * tokens, mode, input ceiling) come from `routeSpec`, which re-validates the
 * spec first, so a hand-built spec cannot carry settings C-PROMPT rejects.
 */
function resolveText<TInput, TOutput>(input: TextGatewayInput<TInput, TOutput>): ResolvedText {
  const { spec } = input;
  const ref = promptRefFor(spec);
  const route = routeSpec(spec);
  if (route.mode !== "realtime") {
    throw new Error(`${ref}: batch specs run through the Message Batches path (S5), not the realtime gateway`);
  }
  const timeoutMs = input.timeoutMs ?? DEFAULT_GATEWAY_TIMEOUT_MS;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > GATEWAY_RUN_BUDGET_MS) {
    throw new Error(`timeoutMs must be 1..${GATEWAY_RUN_BUDGET_MS}, got ${timeoutMs}`);
  }
  const user = spec.buildUser(input.inputs);
  if (typeof user !== "string" || user.trim().length === 0) throw new Error(`${ref}: buildUser returned an empty task block`);
  const request: TextRequest = {
    model: route.model,
    effort: route.effort,
    thinking: route.thinking,
    maxTokens: route.maxTokens,
    system: systemBlocksFor(spec, input.businessContext),
    user,
    outputSchema: outputJsonSchema(spec.outputSchema),
    timeoutMs,
    ...(input.signal === undefined ? {} : { signal: input.signal }),
  };
  return { ref, model: request.model, maxInputTokens: route.maxInputTokens, request };
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

/** The usage repriced on the realtime rate card, or undefined when it cannot be. */
function repriceTextUsage(model: PromptModel, usage: TextUsage): number | undefined {
  try {
    return anthropicCostMicroUsd(model, usage);
  } catch {
    return undefined;
  }
}

/**
 * The cost to charge a text reply: the larger of the adapter's figure and the
 * reported usage repriced with the S1 rate card at the model the gateway
 * requested (never the model the adapter echoes back). `estimated` stays the
 * adapter's flag: both figures come from the same usage, so the charge is an
 * estimate exactly when that usage was (missing usage took the fallback).
 */
export function crossCheckedTextCost(
  requestedModel: PromptModel,
  result: Pick<TextResult, "usage" | "cost">,
): number {
  return Math.max(result.cost.microUsd, repriceTextUsage(requestedModel, result.usage) ?? 0);
}

/**
 * Runs one prompt spec: at most two provider calls (the first attempt and
 * D23's one re-ask), each with its own reservation and `ai_usage` row, inside
 * one overall deadline (`GATEWAY_RUN_BUDGET_MS`).
 */
export async function runTextGateway<TInput, TOutput>(
  deps: TextGatewayDeps,
  input: TextGatewayInput<TInput, TOutput>,
): Promise<TextGatewayOutcome<TextRunValue<TOutput>>> {
  const runStartedAt = deps.clock.now();
  const deadlineAt = runStartedAt + GATEWAY_RUN_BUDGET_MS;
  const firstAttempt = input.caller.attempt ?? 1;

  // 1. Resolve the spec. Nothing is reserved if this fails.
  let resolved: ResolvedText;
  try {
    resolved = resolveText(input);
  } catch (error) {
    return { ...configFailure(safeRef(input.spec), messageOf(error)), nextAttempt: firstAttempt };
  }
  const { ref, model } = resolved;
  const { spec, caller } = input;
  const schemaNode = resolved.request.outputSchema ?? {};
  const attempts: GatewayAttempt[] = [];
  // The highest attempt number this run reserved a row for or found occupied.
  let lastReserved = firstAttempt - 1;
  const end = (failure: GatewayFailure): TextGatewayOutcome<TextRunValue<TOutput>> => ({
    ok: false,
    failure,
    promptRef: ref,
    attempts,
    nextAttempt: lastReserved + 1,
  });

  let request = resolved.request;
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
        // An escalation counts once per logical escalation: attempt 1 only.
        // Job retries (caller.attempt > 1) are bounded by C-JOBS; the re-ask
        // belongs to the same escalation.
        ...(spec.purpose === "escalation" && attempt === 1 ? { escalation: true as const } : {}),
        ...(reask ? { reask: true as const } : {}),
      };
    } catch (error) {
      return end({ kind: "config", message: messageOf(error) });
    }

    const sent = request;
    const hooks = streamHooksFor(input.onTextDelta, attempt);
    const outcome = await runAttempt<TextResult, TextRunValue<TOutput>>(deps, {
      attempt,
      reserve,
      call: () => (hooks === undefined ? deps.adapter.complete(sent) : deps.adapter.complete(sent, hooks)),
      knownCost: (result) => crossCheckedTextCost(model, result),
      classify: (error) => classifyError(error, "anthropic", (usage) => repriceTextUsage(model, usage)),
      read: (result) => {
        const costMicroUsd = crossCheckedTextCost(model, result);
        const usage: SettleUsage = {
          inputTokens: result.usage.inputTokens,
          cacheReadTokens: result.usage.cacheReadTokens,
          cacheWriteTokens: result.usage.cacheWriteTokens,
          outputTokens: result.usage.outputTokens,
          costMicroUsd,
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
          costMicroUsd,
          errorClass: "schema_invalid",
          stopReason: result.stopReason,
          failure: { kind: "schema_invalid", issues: safeZodIssues(parsed.error, schemaNode) },
          reaskable: true,
        };
      },
    });

    // A duplicate key is occupied: the next retry must start past it.
    if (outcome.kind !== "not_sent" || outcome.reserved || outcome.failure.kind === "duplicate_attempt") {
      lastReserved = attempt;
    }
    if (outcome.kind === "not_sent" || outcome.kind === "unfinalized") return end(outcome.failure);
    attempts.push(outcome.record);
    if (outcome.kind === "settled") {
      return { ok: true, value: outcome.value, promptRef: ref, attempts, nextAttempt: lastReserved + 1 };
    }
    if (!outcome.reaskable || reasks >= MAX_REASKS) return end(outcome.failure);

    // D23's one re-ask, only if the run can still afford it in time.
    const remainingMs = Math.floor(deadlineAt - deps.clock.now());
    if (input.signal?.aborted === true || remainingMs < MIN_REASK_WINDOW_MS) return end(outcome.failure);
    const issues = outcome.failure.kind === "schema_invalid" ? outcome.failure.issues : [];
    request = {
      ...resolved.request,
      user: reaskUserBlock(resolved.request.user, issues),
      timeoutMs: Math.min(resolved.request.timeoutMs, remainingMs),
    };
  }
  // Unreachable: the loop returns on every path of its last iteration.
  return end({ kind: "internal", message: "the attempt loop ended without a result" });
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
  return recraftCostMicroUsd({ size: job.request.size, model: recraftModelFor(job.request) });
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
      model: job.provider === "openai_images" ? OPENAI_IMAGE_MODEL : recraftModelFor(job.request),
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
  if (outcome.kind === "not_sent" || outcome.kind === "unfinalized") {
    return { ok: false, failure: outcome.failure, promptRef, attempts: [] };
  }
  if (outcome.kind === "settled") return { ok: true, value: outcome.value, promptRef, attempts: [outcome.record] };
  return { ok: false, failure: outcome.failure, promptRef, attempts: [outcome.record] };
}
