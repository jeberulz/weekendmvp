import { v } from "convex/values";

import { internal } from "../_generated/api";
import { internalAction, type ActionCtx } from "../_generated/server";
// Types only: `gatewayActions.ts` is a `"use node"` module, called through `ctx.runAction`.
import type { GatewayRunResult, RunPromptArgs } from "../ai/gatewayActions";
import { getEntry } from "../ai/registry";
import { parseModelOutput } from "../../lib/workspace/contracts/artifacts";
import { maxInputTokensForSpec } from "../../lib/workspace/contracts/prompts";
import type { CheckResult } from "../../lib/workspace/crew/checks";
import { gateCrewArtifact, isQualityGatedKind } from "../../lib/workspace/crew/quality";
import { UNKNOWN_OUTCOME_ATTEMPT_STRIDE } from "../../lib/workspace/crew/retry";
import { CREW_STEP_ARTIFACTS, founderNoteBlock, previousDraftBlock } from "../../lib/workspace/crew/tasks";
import {
  finishCrewStepResult,
  runCrewStepArgs,
  settleCrewRunResult,
  type CrewGatewayFailureArg,
  type FinishCrewStepResult,
  type RunCrewStepArgs,
  type SettleCrewRunResult,
  type StartCrewRunResult,
} from "./jobs";

/**
 * WP75-S2a — one crew step: start an execution of the task, run its prompt
 * through the metered gateway, then finish or settle it.
 *
 * - The gateway is called with the C-JOBS key form `{kind: "job", jobKey}` and
 *   `attempt` = the run's first attempt number, so `{jobKey}:{attempt}` is
 *   never reused across retries, re-asks or later holders of a released key.
 *   Everything else the call carries that matters for money or trust is read
 *   on the server by `startCrewRun`: the task's debit and, for a revision, the
 *   revised draft and the founder's note from the card.
 * - The revised draft and the note go into the prompt as escaped data blocks.
 *   A draft over half the spec's input bound (UTF-8 bytes, the gateway's
 *   unit) fails the step before any provider call (`config`, permanent).
 * - Retries are separate executions, never a loop in this action: one gateway
 *   run (first try plus one re-ask) can take most of an action's 10 minutes.
 *   `settleCrewRun` schedules the retry with backoff in its own transaction,
 *   or, with `retryMode: "return"`, hands the delay back to the caller (S2b's
 *   workpool, whose own retries stay off).
 * - A gateway call that throws, or a finish / settle mutation that throws, has
 *   an unknown outcome: it may have used both its attempt numbers and may have
 *   billed. The run settles as a timed-out provider failure (class
 *   `indeterminate`). If even that settle throws, the run stays `running` and
 *   `recoverStaleCrewRuns` (or the next start, after the lease) closes it.
 * - S3a: a quality-gated kind (blueprint, brand kit) is checked after the
 *   call. `finishCrewStep` is the authority and fails a hard issue closed;
 *   the pre-check here exists only to call S4b's repair seam
 *   (`CrewRunnerDeps.repairArtifact`, default `noArtifactRepair`).
 * - S3a: a generator that could not build the step's inputs passes
 *   `preflight`; the step then opens a run and settles it with that failure,
 *   before any provider call, so the normal guards and the calm note apply.
 */

export type CrewRunPrompt = (args: RunPromptArgs) => Promise<GatewayRunResult>;

export type CrewRunnerCtx = Pick<ActionCtx, "runMutation" | "runAction">;

type Started = Extract<StartCrewRunResult, { kind: "run" }>;

/** What S4b's repair seam is given: the step, the call that produced the draft, and the gate's findings. */
export type CrewRepairInput = {
  readonly args: RunCrewStepArgs;
  readonly start: Started;
  readonly result: Extract<GatewayRunResult, { ok: true }>;
  readonly issues: CheckResult;
  /** The first attempt number the repair's gateway run must use (`result.nextAttempt`), same job key. */
  readonly attempt: number;
};

/**
 * WP75-S4b SEAM: the one repair call for a draft with hard quality issues.
 * Returns the repaired call's result (its own attempt numbers, same job key),
 * or null for no repair. Not built: Owner Q6 (store flagged or fail) and Q7
 * (repair tier) are open. With no repair, `finishCrewStep` fails the step
 * closed on the hard issues.
 *
 * Attempt contract: the repair makes at most ONE gateway run, starting at
 * `input.attempt`. A returned result carries its own `nextAttempt`; a repair
 * that throws is settled at `input.attempt + UNKNOWN_OUTCOME_ATTEMPT_STRIDE`,
 * which covers one run (first try + one re-ask) and nothing more.
 * TODO(S4b): if the repair ever needs more than one gateway run, return the
 * highest attempt it used (or report it before each call) and settle after it.
 */
export type CrewArtifactRepair = (input: CrewRepairInput) => Promise<GatewayRunResult | null>;

/** The default repair seam: none (Owner Q6/Q7 open). */
export const noArtifactRepair: CrewArtifactRepair = async () => null;

export type CrewRunnerDeps = {
  /** Replaces the registered `runPrompt` action (tests: the real meter with a scripted adapter). */
  readonly runPrompt?: CrewRunPrompt;
  /** S3a: the generator could not build the inputs; settle the opened run with this failure, before any call. */
  readonly preflight?: CrewGatewayFailureArg;
  /** S4b seam (see `CrewArtifactRepair`). Defaults to `noArtifactRepair`. */
  readonly repairArtifact?: CrewArtifactRepair;
};

export type CrewStepSkipped = {
  readonly kind: "skipped";
  readonly reason: Extract<StartCrewRunResult, { kind: "skip" }>["reason"];
};

export type CrewStepOutcome = CrewStepSkipped | FinishCrewStepResult | SettleCrewRunResult;

export const crewStepOutcomeValidator = v.union(
  v.object({
    kind: v.literal("skipped"),
    reason: v.union(
      v.literal("missing"),
      v.literal("not_crew_step"),
      v.literal("terminal"),
      v.literal("blocked"),
      v.literal("in_flight"),
      v.literal("exhausted"),
      v.literal("unpaid"),
    ),
  }),
  ...finishCrewStepResult.members,
  ...settleCrewRunResult.members,
);

/**
 * The previous draft may use half the spec's input bound. The gateway
 * estimates input as one token per UTF-8 byte (`convex/ai/gateway.ts`), so
 * the bound is in bytes: half the lane's tokens.
 */
const PREVIOUS_DRAFT_SHARE = 0.5;

type Inputs = { ok: true; inputs: RunPromptArgs["inputs"] } | { ok: false; failure: CrewGatewayFailureArg };

/** The prompt inputs, plus the revised draft and the founder's quoted note for a revision task. */
function stepInputs(args: RunCrewStepArgs, start: Started): Inputs {
  const inputs: RunPromptArgs["inputs"] = { ...args.inputs };
  if (start.previousArtifactJson !== undefined) {
    let maxBytes: number;
    try {
      maxBytes = Math.floor(maxInputTokensForSpec(getEntry(args.promptRef).spec) * PREVIOUS_DRAFT_SHARE);
    } catch (error) {
      return { ok: false, failure: { kind: "config", message: error instanceof Error ? error.message : String(error) } };
    }
    const draft = previousDraftBlock(start.previousArtifactJson, maxBytes);
    if (!draft.ok) {
      return {
        ok: false,
        failure: {
          kind: "config",
          message: `the previous draft is too large for ${args.promptRef}: ${draft.bytes} UTF-8 bytes, at most ${draft.maxBytes}`,
        },
      };
    }
    inputs.previousArtifact = draft.block;
  }
  if (start.revisionNote !== undefined) inputs.revisionNote = founderNoteBlock(start.revisionNote);
  return { ok: true, inputs };
}

function unknownOutcome(error: unknown, what: string): CrewGatewayFailureArg {
  const detail = error instanceof Error ? error.message : "no detail";
  return {
    kind: "provider",
    provider: "anthropic",
    providerKind: "unknown",
    errorClass: "timeout",
    billed: "possible",
    retryable: true,
    message: `${what}: ${detail}`.slice(0, 500),
  };
}

/**
 * The runner's quality pre-check for S4b's seam: a gated kind whose draft
 * parses but has hard issues goes to `repair`; anything else is returned as
 * is (an unparsable draft fails in `finishCrewStep`, like before S3a).
 */
async function withRepair(
  args: RunCrewStepArgs,
  start: Started,
  result: Extract<GatewayRunResult, { ok: true }>,
  repair: CrewArtifactRepair,
): Promise<GatewayRunResult> {
  const { kind } = CREW_STEP_ARTIFACTS[start.jobType];
  if (!isQualityGatedKind(kind)) return result;
  let raw: unknown;
  try {
    raw = JSON.parse(result.outputJson);
  } catch {
    return result;
  }
  const parsed = parseModelOutput(kind, raw, null);
  if (!parsed.success) return result;
  const { result: issues } = gateCrewArtifact(kind, parsed.data, start.quality);
  if (issues.hard.length === 0) return result;
  return (await repair({ args, start, result, issues, attempt: result.nextAttempt })) ?? result;
}

/** The step's body. `runCrewStep` is this with the registered gateway action. */
export async function runCrewStepWith(
  ctx: CrewRunnerCtx,
  args: RunCrewStepArgs,
  deps: CrewRunnerDeps = {},
): Promise<CrewStepOutcome> {
  const start = await ctx.runMutation(internal.crew.jobs.startCrewRun, {
    taskId: args.taskId,
    ...(args.resume === true ? { resume: true } : {}),
    ...(args.seedId === undefined ? {} : { seedId: args.seedId }),
  });
  if (start.kind === "skip") return { kind: "skipped", reason: start.reason };
  const retry = args.retryMode === "return" ? {} : { retry: args };
  const settle = async (failure: CrewGatewayFailureArg, nextAttempt: number) =>
    await ctx.runMutation(internal.crew.jobs.settleCrewRun, { runId: start.runId, failure, nextAttempt, ...retry });

  if (deps.preflight !== undefined) return await settle(deps.preflight, start.attempt);
  const prepared = stepInputs(args, start);
  if (!prepared.ok) return await settle(prepared.failure, start.attempt);

  const runPrompt: CrewRunPrompt = deps.runPrompt ??
    (async (promptArgs) => await ctx.runAction(internal.ai.gatewayActions.runPrompt, promptArgs));
  let result: GatewayRunResult;
  try {
    result = await runPrompt({
      promptRef: args.promptRef,
      inputs: prepared.inputs,
      ...(args.businessContext === undefined ? {} : { businessContext: args.businessContext }),
      ownerId: start.ownerId,
      projectId: start.projectId,
      taskId: args.taskId,
      ...(start.creditDebitId === undefined ? {} : { creditDebitId: start.creditDebitId }),
      attemptKey: { kind: "job", jobKey: start.jobKey },
      attempt: start.attempt,
      ...(args.timeoutMs === undefined ? {} : { timeoutMs: args.timeoutMs }),
    });
  } catch (error) {
    return await settle(unknownOutcome(error, "the gateway call did not return"), start.attempt + UNKNOWN_OUTCOME_ATTEMPT_STRIDE);
  }

  if (result.ok) {
    try {
      result = await withRepair(args, start, result, deps.repairArtifact ?? noArtifactRepair);
    } catch (error) {
      // A repair that throws has an unknown outcome, like a gateway call that does not return. It started at
      // `result.nextAttempt` and makes at most one gateway run (the seam's contract), so one stride covers it.
      return await settle(unknownOutcome(error, "the repair call did not return"), result.nextAttempt + UNKNOWN_OUTCOME_ATTEMPT_STRIDE);
    }
  }

  try {
    if (result.ok) {
      return await ctx.runMutation(internal.crew.jobs.finishCrewStep, {
        runId: start.runId,
        promptRef: result.promptRef,
        outputJson: result.outputJson,
        nextAttempt: result.nextAttempt,
        ...(args.seedId === undefined ? {} : { seedId: args.seedId }),
        ...(args.briefDocumentId === undefined ? {} : { briefDocumentId: args.briefDocumentId }),
        ...(args.brandKitDocumentId === undefined ? {} : { brandKitDocumentId: args.brandKitDocumentId }),
      });
    }
    return await settle(result.failure, result.nextAttempt);
  } catch (error) {
    // The mutation rolled back, so the run is still open. Settle it as
    // indeterminate; if that throws too, recovery closes it after the lease.
    return await settle(unknownOutcome(error, "finishing the step failed"), result.nextAttempt);
  }
}

/**
 * Runs one crew step. Internal: S1's launch, S2b's DAG and WP77's change
 * rounds call it after their own authorisation and task insert.
 */
export const runCrewStep = internalAction({
  args: runCrewStepArgs,
  returns: crewStepOutcomeValidator,
  handler: async (ctx, args): Promise<CrewStepOutcome> => await runCrewStepWith(ctx, args),
});
