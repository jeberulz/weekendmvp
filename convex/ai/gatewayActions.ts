"use node";

/**
 * WP71-S2 follow-up. The gateway as a Convex function: `02` §5.1 bound to the
 * real C-METER (Codex's WP70 `convex/ai/metering.ts`).
 *
 * `runPrompt` is an `internalAction` (never public). It:
 * 1. takes a `promptRef` (`id@version`) and the run's inputs, never a spec or
 *    a model. The spec comes from the registry (`getSpec`), and the gateway
 *    re-validates and routes it (`routeSpec`) before anything is reserved;
 * 2. builds the attempt key from a C-METER form (`jobAttemptKey`,
 *    `chatAttemptKey`, or `eval:{runId}:{caseId}:{attempt}`), never a raw key;
 * 3. binds `MeterPort` to `internal.ai.metering.{reserve,markSent,settle,fail}`
 *    through `ctx.runMutation` (`meterPortFor`), so every gate and budget is
 *    the meter's: the kill switch, workspace switch, cohort, task and debit
 *    checks run inside `reserve` and again inside `markSent`. If either
 *    refuses, no adapter is called (the gateway core guarantees it);
 * 4. builds the Claude adapter from `AI_PROVIDER_MODE` and `ANTHROPIC_API_KEY`
 *    only (`gatewayEnv`), read from `process.env` here and nowhere else.
 *    Fixture mode is the default (`providers/mode.ts`): anything but exactly
 *    `"live"` runs the deterministic fixture transport, which cannot reach the
 *    network. The adapter resolves its mode at call time, which is after
 *    `reserve` and `markSent` have both passed;
 * 5. returns a plain summary (`gatewayRunResult`): the structured output as a
 *    JSON string (callers re-parse it with the spec's schema), the failure,
 *    and every `ai_usage` attempt as the meter reported it.
 *
 * `"use node"`: the Anthropic SDK's credential chain imports Node built-ins
 * (`node:fs`, `node:os`). This file exports only the action and plain helpers;
 * nothing in the default runtime may import it.
 *
 * `runPromptWithMeter` is the action's body with its adapter, clock and env
 * injectable, so the integration tests can drive the real meter mutations
 * with a scripted fixture adapter. The registered action always uses the
 * defaults.
 */

import { v, type Infer, type ObjectType } from "convex/values";

import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalAction, type ActionCtx } from "../_generated/server";
import {
  chatAttemptKey,
  jobAttemptKey,
  type FailArgs,
  type FinalizeResult,
  type MarkSentResult,
  type ReserveArgs,
  type ReserveResult,
  type SettleArgs,
} from "../../lib/workspace/contracts/metering";
import type { PromptSpec } from "../../lib/workspace/contracts/prompts";
import {
  runTextGateway,
  type GatewayAttempt,
  type GatewayClock,
  type GatewayFailure,
  type GatewayOutcome,
  type MeterPort,
  type TextAdapterPort,
  type TextRunValue,
} from "./gateway";
import { createAnthropicAdapter } from "./providers/anthropic";
import { AI_PROVIDER_MODE_ENV, PROVIDER_KEY_ENV, type ProviderEnv } from "./providers/mode";
import { getSpec, type RegisteredSpec } from "./registry";

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

/** A prompt input value: plain text, numbers, flags and lists of text. */
const promptInputValue = v.union(v.string(), v.number(), v.boolean(), v.null(), v.array(v.string()));

/** The C-METER attempt-key forms this action may build (`metering.ts` "Attempt keys"). */
export const attemptKeyFormValidator = v.union(
  /** Crew and Studio jobs: `{jobKey}:{attempt}`; `jobKey` starts `crew:`. */
  v.object({ kind: v.literal("job"), jobKey: v.string() }),
  /** Wren chat: `chat:{projectId}:{chatMessageId}:{attempt}` (the run's `projectId`). */
  v.object({ kind: v.literal("chat"), chatMessageId: v.string() }),
  /** Ownerless eval runs (CI graders): `eval:{runId}:{caseId}:{attempt}`. */
  v.object({ kind: v.literal("eval"), runId: v.string(), caseId: v.string() }),
);

export const runPromptArgs = {
  promptRef: v.string(),
  inputs: v.record(v.string(), promptInputValue),
  /** The business context block, for a spec whose cache layout is `per_business`. */
  businessContext: v.optional(v.string()),
  ownerId: v.optional(v.id("users")),
  projectId: v.optional(v.id("projects")),
  taskId: v.optional(v.id("tasks")),
  /** The task's credit debit, for credit-funded work (the meter verifies it). */
  creditDebitId: v.optional(v.id("credit_ledger")),
  attemptKey: attemptKeyFormValidator,
  /** The first attempt number of this run (default 1); the re-ask uses the next. */
  attempt: v.optional(v.number()),
  timeoutMs: v.optional(v.number()),
};

export type RunPromptArgs = ObjectType<typeof runPromptArgs>;

const billedValidator = v.union(v.literal("none"), v.literal("possible"), v.literal("actual"));
const errorClassValidator = v.union(
  v.literal("retryable"), v.literal("indeterminate"), v.literal("permanent"),
  v.literal("refusal"), v.literal("schema_invalid"), v.literal("timeout"),
);
const providerValidator = v.union(
  v.literal("anthropic"), v.literal("openai_images"), v.literal("recraft"), v.literal("video"),
);
const gateCodeValidator = v.union(
  v.literal("AI_DISABLED"), v.literal("BUDGET_EXHAUSTED"), v.literal("WORKSPACE_DISABLED"),
  v.literal("RESOURCE_NOT_FOUND"), v.literal("UNAUTHENTICATED"),
);

const attemptValidator = v.object({
  attempt: v.number(),
  attemptKey: v.string(),
  usageId: v.string(),
  reask: v.boolean(),
  reservedMicroUsd: v.number(),
  status: v.union(v.literal("settled"), v.literal("failed")),
  alreadyFinal: v.boolean(),
  chargedMicroUsd: v.number(),
  lateAdjustmentMicroUsd: v.optional(v.number()),
  latencyMs: v.number(),
  billed: v.optional(billedValidator),
  errorClass: v.optional(errorClassValidator),
  stopReason: v.optional(v.string()),
  overrun: v.optional(v.object({ reservedMicroUsd: v.number(), actualMicroUsd: v.number() })),
});

const failureValidator = v.union(
  v.object({ kind: v.literal("config"), message: v.string() }),
  v.object({
    kind: v.literal("meter_refused"),
    error: v.object({ code: gateCodeValidator, scope: v.optional(v.string()), message: v.optional(v.string()) }),
  }),
  v.object({ kind: v.literal("duplicate_attempt"), attemptKey: v.string(), usageId: v.string() }),
  v.object({
    kind: v.literal("refusal"),
    provider: providerValidator,
    category: v.union(v.string(), v.null()),
    explanation: v.union(v.string(), v.null()),
  }),
  v.object({ kind: v.literal("schema_invalid"), issues: v.array(v.string()) }),
  v.object({
    kind: v.literal("provider"),
    provider: providerValidator,
    providerKind: v.string(),
    errorClass: errorClassValidator,
    billed: billedValidator,
    retryable: v.boolean(),
    message: v.string(),
  }),
  v.object({ kind: v.literal("internal"), message: v.string(), usageId: v.optional(v.string()) }),
);

export const gatewayRunResultValidator = v.union(
  v.object({
    ok: v.literal(true),
    promptRef: v.string(),
    /** The validated output as JSON. Re-parse it with the spec's `outputSchema`. */
    outputJson: v.string(),
    messageId: v.string(),
    stopReason: v.string(),
    attempts: v.array(attemptValidator),
  }),
  v.object({
    ok: v.literal(false),
    promptRef: v.string(),
    failure: failureValidator,
    attempts: v.array(attemptValidator),
  }),
);

export type GatewayRunResult = Infer<typeof gatewayRunResultValidator>;

// ---------------------------------------------------------------------------
// Env
// ---------------------------------------------------------------------------

/**
 * The only env the gateway reads: the provider mode switch and the Claude
 * key. Nothing else from `process.env` reaches the adapter.
 */
export function gatewayEnv(source: ProviderEnv): ProviderEnv {
  return {
    [AI_PROVIDER_MODE_ENV]: source[AI_PROVIDER_MODE_ENV],
    [PROVIDER_KEY_ENV.anthropic]: source[PROVIDER_KEY_ENV.anthropic],
  };
}

// ---------------------------------------------------------------------------
// Meter binding
// ---------------------------------------------------------------------------

type MeterCtx = Pick<ActionCtx, "runMutation">;

/** The ids this run was given, typed as Convex ids. */
type RunIds = {
  readonly ownerId?: Id<"users">;
  readonly projectId?: Id<"projects">;
  readonly taskId?: Id<"tasks">;
  readonly creditDebitId?: Id<"credit_ledger">;
};

function sameId(name: string, sent: string | undefined, given: string | undefined): void {
  if (sent !== given) throw new Error(`meter binding: ${name} does not match this run`);
}

/**
 * `MeterPort` over the real C-METER mutations. Each method copies exactly
 * the fields the mutation's validator declares (so a stray field can never
 * fail validation or slip through). `reserve` only passes the ids this run
 * was given, as typed Convex ids; `markSent`, `settle` and `fail` only touch
 * rows this run reserved. Refusals propagate as the mutation's `ConvexError`,
 * which the gateway classifies (`gatewayErrorDataOf`).
 */
export function meterPortFor(ctx: MeterCtx, ids: RunIds): MeterPort {
  const reserved = new Map<string, Id<"ai_usage">>();
  const ownRow = (usageId: string): Id<"ai_usage"> => {
    const id = reserved.get(usageId);
    if (id === undefined) throw new Error(`meter binding: ${usageId} was not reserved by this run`);
    return id;
  };

  return {
    async reserve(args: ReserveArgs): Promise<ReserveResult> {
      sameId("ownerId", args.ownerId, ids.ownerId);
      sameId("projectId", args.projectId, ids.projectId);
      sameId("taskId", args.taskId, ids.taskId);
      sameId("creditDebitId", args.creditDebitId, ids.creditDebitId);
      const result = await ctx.runMutation(internal.ai.metering.reserve, {
        ...(ids.ownerId === undefined ? {} : { ownerId: ids.ownerId }),
        ...(ids.projectId === undefined ? {} : { projectId: ids.projectId }),
        ...(ids.taskId === undefined ? {} : { taskId: ids.taskId }),
        ...(ids.creditDebitId === undefined ? {} : { creditDebitId: ids.creditDebitId }),
        attemptKey: args.attemptKey,
        promptRef: args.promptRef,
        provider: args.provider,
        model: args.model,
        tier: args.tier,
        feature: args.feature,
        reservedMicroUsd: args.reservedMicroUsd,
        ...(args.batch === true ? { batch: true as const } : {}),
        ...(args.escalation === true ? { escalation: true as const } : {}),
        ...(args.reask === true ? { reask: true as const } : {}),
      });
      // The meter returns the row's id; it is an `ai_usage` id by construction.
      reserved.set(result.usageId, result.usageId as Id<"ai_usage">);
      return { usageId: result.usageId, existing: result.existing };
    },

    async markSent(args): Promise<MarkSentResult> {
      const result = await ctx.runMutation(internal.ai.metering.markSent, { usageId: ownRow(args.usageId) });
      return {
        usageId: result.usageId,
        changed: result.changed,
        ...(result.sentAt === undefined ? {} : { sentAt: result.sentAt }),
      };
    },

    async settle(args: SettleArgs): Promise<FinalizeResult> {
      return await ctx.runMutation(internal.ai.metering.settle, {
        usageId: ownRow(args.usageId),
        inputTokens: args.inputTokens,
        cacheReadTokens: args.cacheReadTokens,
        cacheWriteTokens: args.cacheWriteTokens,
        outputTokens: args.outputTokens,
        ...(args.images === undefined ? {} : { images: args.images }),
        ...(args.videoSeconds === undefined ? {} : { videoSeconds: args.videoSeconds }),
        costMicroUsd: args.costMicroUsd,
        estimated: args.estimated,
        latencyMs: args.latencyMs,
        ...(args.stopReason === undefined ? {} : { stopReason: args.stopReason }),
      });
    },

    async fail(args: FailArgs): Promise<FinalizeResult> {
      return await ctx.runMutation(internal.ai.metering.fail, {
        usageId: ownRow(args.usageId),
        billed: args.billed,
        ...(args.costMicroUsd === undefined ? {} : { costMicroUsd: args.costMicroUsd }),
        errorClass: args.errorClass,
        latencyMs: args.latencyMs,
      });
    },
  };
}

// ---------------------------------------------------------------------------
// Attempt keys
// ---------------------------------------------------------------------------

const KEY_PART = /^[^:\s]{1,96}$/u;

/** The attempt-key builder for a run, from a C-METER form. Throws on a malformed form. */
export function attemptKeyBuilder(
  form: RunPromptArgs["attemptKey"],
  projectId: string | undefined,
): (attempt: number) => string {
  switch (form.kind) {
    case "job":
      jobAttemptKey(form.jobKey, 1);
      return (attempt) => jobAttemptKey(form.jobKey, attempt);
    case "chat": {
      if (projectId === undefined) throw new RangeError("a chat attempt key needs the run's projectId");
      chatAttemptKey(projectId, form.chatMessageId, 1);
      return (attempt) => chatAttemptKey(projectId, form.chatMessageId, attempt);
    }
    case "eval": {
      if (!KEY_PART.test(form.runId) || !KEY_PART.test(form.caseId)) {
        throw new RangeError("eval runId and caseId must be 1-96 characters without ':' or spaces");
      }
      return (attempt) => {
        if (!Number.isSafeInteger(attempt) || attempt < 1) throw new RangeError(`attempt must be a positive integer, got ${attempt}`);
        return `eval:${form.runId}:${form.caseId}:${attempt}`;
      };
    }
  }
}

// ---------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------

export type RunPromptDeps = {
  /** Replaces the env-built Claude adapter (tests: a scripted fixture adapter). */
  readonly adapter?: TextAdapterPort;
  readonly clock?: GatewayClock;
  /** Read for `AI_PROVIDER_MODE` and `ANTHROPIC_API_KEY` only. Defaults to `process.env`. */
  readonly env?: ProviderEnv;
};

/** Prompt inputs as the registry's specs see them: their input type is erased (`RegisteredSpec`). */
type PromptInputs = RunPromptArgs["inputs"];

function configResult(promptRef: string, message: string): GatewayRunResult {
  return { ok: false, promptRef, failure: { kind: "config", message }, attempts: [] };
}

function attemptRecord(attempt: GatewayAttempt): GatewayRunResult["attempts"][number] {
  return {
    attempt: attempt.attempt,
    attemptKey: attempt.attemptKey,
    usageId: attempt.usageId,
    reask: attempt.reask,
    reservedMicroUsd: attempt.reservedMicroUsd,
    status: attempt.status,
    alreadyFinal: attempt.alreadyFinal,
    chargedMicroUsd: attempt.chargedMicroUsd,
    ...(attempt.lateAdjustmentMicroUsd === undefined ? {} : { lateAdjustmentMicroUsd: attempt.lateAdjustmentMicroUsd }),
    latencyMs: attempt.latencyMs,
    ...(attempt.billed === undefined ? {} : { billed: attempt.billed }),
    ...(attempt.errorClass === undefined ? {} : { errorClass: attempt.errorClass }),
    ...(attempt.stopReason === undefined ? {} : { stopReason: attempt.stopReason }),
    ...(attempt.overrun === undefined
      ? {}
      : { overrun: { reservedMicroUsd: attempt.overrun.reservedMicroUsd, actualMicroUsd: attempt.overrun.actualMicroUsd } }),
  };
}

/** A failure as plain data, with only the fields the return validator declares. */
function failureRecord(failure: GatewayFailure): Extract<GatewayRunResult, { ok: false }>["failure"] {
  switch (failure.kind) {
    case "meter_refused": {
      const { code } = failure.error;
      const scope: unknown = "scope" in failure.error ? failure.error.scope : undefined;
      const message: unknown = failure.error.message;
      return {
        kind: "meter_refused",
        error: {
          code,
          ...(typeof scope === "string" ? { scope } : {}),
          ...(typeof message === "string" ? { message } : {}),
        },
      };
    }
    case "config":
      return { kind: "config", message: failure.message };
    case "duplicate_attempt":
      return { kind: "duplicate_attempt", attemptKey: failure.attemptKey, usageId: failure.usageId };
    case "refusal":
      return {
        kind: "refusal",
        provider: failure.provider,
        category: failure.category,
        explanation: failure.explanation,
      };
    case "schema_invalid":
      return { kind: "schema_invalid", issues: [...failure.issues] };
    case "provider":
      return {
        kind: "provider",
        provider: failure.provider,
        providerKind: failure.providerKind,
        errorClass: failure.errorClass,
        billed: failure.billed,
        retryable: failure.retryable,
        message: failure.message,
      };
    case "internal":
      return { kind: "internal", message: failure.message, ...(failure.usageId === undefined ? {} : { usageId: failure.usageId }) };
  }
}

/** The gateway's outcome as the action's plain return value. */
export function gatewayRunResult(outcome: GatewayOutcome<TextRunValue<unknown>>): GatewayRunResult {
  const attempts = outcome.attempts.map(attemptRecord);
  if (!outcome.ok) return { ok: false, promptRef: outcome.promptRef, failure: failureRecord(outcome.failure), attempts };
  return {
    ok: true,
    promptRef: outcome.promptRef,
    outputJson: JSON.stringify(outcome.value.output),
    messageId: outcome.value.messageId,
    stopReason: outcome.value.stopReason,
    attempts,
  };
}

/**
 * The action's body. Resolves `promptRef` through the registry (never a spec
 * or model from the caller), binds the real meter, and runs the gateway.
 */
export async function runPromptWithMeter(
  ctx: MeterCtx,
  args: RunPromptArgs,
  deps: RunPromptDeps = {},
): Promise<GatewayRunResult> {
  let spec: RegisteredSpec;
  let attemptKey: (attempt: number) => string;
  try {
    spec = getSpec(args.promptRef);
    attemptKey = attemptKeyBuilder(args.attemptKey, args.projectId);
  } catch (error) {
    return configResult(args.promptRef, error instanceof Error ? error.message : String(error));
  }

  const ids: RunIds = {
    ...(args.ownerId === undefined ? {} : { ownerId: args.ownerId }),
    ...(args.projectId === undefined ? {} : { projectId: args.projectId }),
    ...(args.taskId === undefined ? {} : { taskId: args.taskId }),
    ...(args.creditDebitId === undefined ? {} : { creditDebitId: args.creditDebitId }),
  };
  const adapter = deps.adapter ?? createAnthropicAdapter({ env: gatewayEnv(deps.env ?? process.env) });
  // The registry erases each spec's input type; `buildUser` receives the
  // validated record and a spec that cannot use it fails as `config`.
  const typed = spec as Readonly<PromptSpec<PromptInputs, unknown>>;

  const outcome = await runTextGateway(
    { meter: meterPortFor(ctx, ids), adapter, clock: deps.clock ?? { now: () => Date.now() } },
    {
      spec: typed,
      inputs: args.inputs,
      caller: {
        ...ids,
        attemptKey,
        ...(args.attempt === undefined ? {} : { attempt: args.attempt }),
      },
      ...(args.businessContext === undefined ? {} : { businessContext: args.businessContext }),
      ...(args.timeoutMs === undefined ? {} : { timeoutMs: args.timeoutMs }),
    },
  );
  return gatewayRunResult(outcome);
}

/** Runs one registered prompt through the metered gateway. Internal only. */
export const runPrompt = internalAction({
  args: runPromptArgs,
  returns: gatewayRunResultValidator,
  handler: async (ctx, args): Promise<GatewayRunResult> => await runPromptWithMeter(ctx, args),
});
