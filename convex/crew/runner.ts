import { v } from "convex/values";

import { internal } from "../_generated/api";
import { internalAction, type ActionCtx } from "../_generated/server";
// Types only: `gatewayActions.ts` is a `"use node"` module, called through `ctx.runAction`.
import type { GatewayRunResult, RunPromptArgs } from "../ai/gatewayActions";
import { UNKNOWN_OUTCOME_ATTEMPT_STRIDE } from "../../lib/workspace/crew/retry";
import { founderNoteBlock } from "../../lib/workspace/crew/tasks";
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
 *   never reused across retries, re-asks or later change rounds that reuse a
 *   released key. The gateway's `nextAttempt` is stored back on the run.
 * - Retries are separate executions, never a loop in this action: one gateway
 *   run (first try plus one re-ask) can take most of an action's 10 minutes.
 *   `settleCrewRun` schedules the retry with backoff in its own transaction,
 *   or, with `retryMode: "return"`, hands the delay back to the caller (S2b's
 *   workpool, whose own retries stay off).
 * - A gateway call that throws instead of returning has an unknown outcome:
 *   it may have used both its attempt numbers and may have billed. It settles
 *   as a timed-out provider failure (class `indeterminate`), with the next
 *   attempt moved past both numbers.
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

/** The prompt inputs, plus the revised draft and the founder's quoted note for a revision task. */
function stepInputs(args: RunCrewStepArgs, previousArtifactJson: string | undefined): RunPromptArgs["inputs"] {
  return {
    ...args.inputs,
    ...(previousArtifactJson === undefined ? {} : { previousArtifact: previousArtifactJson }),
    ...(args.revisionNote === undefined ? {} : { revisionNote: founderNoteBlock(args.revisionNote) }),
  };
}

function unknownOutcome(error: unknown): CrewGatewayFailureArg {
  return {
    kind: "provider",
    provider: "anthropic",
    providerKind: "unknown",
    errorClass: "timeout",
    billed: "possible",
    retryable: true,
    message: error instanceof Error ? error.message.slice(0, 500) : "the gateway call did not return",
  };
}

/** The step's body. `runCrewStep` is this with the registered gateway action. */
export async function runCrewStepWith(
  ctx: CrewRunnerCtx,
  args: RunCrewStepArgs,
  deps: CrewRunnerDeps = {},
): Promise<CrewStepOutcome> {
  const start = await ctx.runMutation(internal.crew.jobs.startCrewRun, { taskId: args.taskId });
  if (start.kind === "skip") return { kind: "skipped", reason: start.reason };

  const runPrompt: CrewRunPrompt = deps.runPrompt ??
    (async (promptArgs) => await ctx.runAction(internal.ai.gatewayActions.runPrompt, promptArgs));
  let result: GatewayRunResult | null = null;
  let thrown: unknown = null;
  try {
    result = await runPrompt({
      promptRef: args.promptRef,
      inputs: stepInputs(args, start.previousArtifactJson),
      ...(args.businessContext === undefined ? {} : { businessContext: args.businessContext }),
      ownerId: start.ownerId,
      projectId: start.projectId,
      taskId: args.taskId,
      ...(args.creditDebitId === undefined ? {} : { creditDebitId: args.creditDebitId }),
      attemptKey: { kind: "job", jobKey: start.jobKey },
      attempt: start.attempt,
      ...(args.timeoutMs === undefined ? {} : { timeoutMs: args.timeoutMs }),
    });
  } catch (error) {
    thrown = error;
  }

  if (result?.ok === true) {
    return await ctx.runMutation(internal.crew.jobs.finishCrewStep, {
      runId: start.runId,
      promptRef: result.promptRef,
      outputJson: result.outputJson,
      nextAttempt: result.nextAttempt,
    });
  }
  const retry = args.retryMode === "return" ? {} : { retry: args };
  if (result === null) {
    return await ctx.runMutation(internal.crew.jobs.settleCrewRun, {
      runId: start.runId,
      failure: unknownOutcome(thrown),
      nextAttempt: start.attempt + UNKNOWN_OUTCOME_ATTEMPT_STRIDE,
      ...retry,
    });
  }
  return await ctx.runMutation(internal.crew.jobs.settleCrewRun, {
    runId: start.runId,
    failure: result.failure,
    nextAttempt: result.nextAttempt,
    ...retry,
  });
}

/**
 * Runs one crew step. Internal: S1's launch, S2b's DAG and WP77-S2's change
 * rounds call it after their own authorisation and task insert.
 */
export const runCrewStep = internalAction({
  args: runCrewStepArgs,
  returns: crewStepOutcomeValidator,
  handler: async (ctx, args): Promise<CrewStepOutcome> => await runCrewStepWith(ctx, args),
});
