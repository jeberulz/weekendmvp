import { v } from "convex/values";

import { internal } from "../_generated/api";
import { internalAction, type ActionCtx } from "../_generated/server";
// Types only: `gatewayActions.ts` is a `"use node"` module, called through `ctx.runAction`.
import type { GatewayRunResult, RunPromptArgs } from "../ai/gatewayActions";
import { getEntry } from "../ai/registry";
import { maxInputTokensForSpec } from "../../lib/workspace/contracts/prompts";
import { UNKNOWN_OUTCOME_ATTEMPT_STRIDE } from "../../lib/workspace/crew/retry";
import { founderNoteBlock, previousDraftBlock } from "../../lib/workspace/crew/tasks";
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
 *   A draft too long for half the spec's input bound fails the step before any
 *   provider call (`config`, permanent).
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
 */

export type CrewRunPrompt = (args: RunPromptArgs) => Promise<GatewayRunResult>;

export type CrewRunnerCtx = Pick<ActionCtx, "runMutation" | "runAction">;

export type CrewRunnerDeps = {
  /** Replaces the registered `runPrompt` action (tests: the real meter with a scripted adapter). */
  readonly runPrompt?: CrewRunPrompt;
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
    ),
  }),
  ...finishCrewStepResult.members,
  ...settleCrewRunResult.members,
);

/** Bytes per token in the gateway's input estimate; the previous draft may use half the spec's input bound. */
const BYTES_PER_TOKEN = 4;
const PREVIOUS_DRAFT_SHARE = 0.5;

type Started = Extract<StartCrewRunResult, { kind: "run" }>;

type Inputs = { ok: true; inputs: RunPromptArgs["inputs"] } | { ok: false; failure: CrewGatewayFailureArg };

/** The prompt inputs, plus the revised draft and the founder's quoted note for a revision task. */
function stepInputs(args: RunCrewStepArgs, start: Started): Inputs {
  const inputs: RunPromptArgs["inputs"] = { ...args.inputs };
  if (start.previousArtifactJson !== undefined) {
    let maxLength: number;
    try {
      maxLength = Math.floor(maxInputTokensForSpec(getEntry(args.promptRef).spec) * BYTES_PER_TOKEN * PREVIOUS_DRAFT_SHARE);
    } catch (error) {
      return { ok: false, failure: { kind: "config", message: error instanceof Error ? error.message : String(error) } };
    }
    const draft = previousDraftBlock(start.previousArtifactJson, maxLength);
    if (!draft.ok) {
      return {
        ok: false,
        failure: {
          kind: "config",
          message: `the previous draft is too large for ${args.promptRef}: ${draft.length} characters, at most ${draft.maxLength}`,
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

/** The step's body. `runCrewStep` is this with the registered gateway action. */
export async function runCrewStepWith(
  ctx: CrewRunnerCtx,
  args: RunCrewStepArgs,
  deps: CrewRunnerDeps = {},
): Promise<CrewStepOutcome> {
  const start = await ctx.runMutation(internal.crew.jobs.startCrewRun, {
    taskId: args.taskId,
    ...(args.resume === true ? { resume: true } : {}),
  });
  if (start.kind === "skip") return { kind: "skipped", reason: start.reason };
  const retry = args.retryMode === "return" ? {} : { retry: args };
  const settle = async (failure: CrewGatewayFailureArg, nextAttempt: number) =>
    await ctx.runMutation(internal.crew.jobs.settleCrewRun, { runId: start.runId, failure, nextAttempt, ...retry });

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

  try {
    if (result.ok) {
      return await ctx.runMutation(internal.crew.jobs.finishCrewStep, {
        runId: start.runId,
        promptRef: result.promptRef,
        outputJson: result.outputJson,
        nextAttempt: result.nextAttempt,
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
