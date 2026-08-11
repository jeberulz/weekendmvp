import type { Id } from "../../../_generated/dataModel";
import type { ActionCtx } from "../../../_generated/server";
import { internal } from "../../../_generated/api";
import {
  executePaidStep,
  realWithTimeout,
  StepTimeoutError,
  type StepOutcome,
} from "../executor";
import { stepAt, stepIdempotencyKey } from "../pipeline";
import { replaySafetyFor } from "../reconcile";
import { createProviders, readProviderMode } from "../providers/registry";
import type { EngineProviders } from "../providers/types";

/**
 * WP26-S3. The shell every pipeline step runs inside.
 *
 * Each of the seven step modules supplies only what makes it different — how it
 * builds its provider request and what it stores. Retry, cancellation, the
 * timeout, the crash-window reconciliation, and the cost seam live here, once,
 * so a new step cannot accidentally ship without them.
 */

export type StepDocumentKind = "research" | "validation_report" | "brief";

export type StepCallArgs = {
  readonly providers: EngineProviders;
  /** Outputs of the steps that already ran, for request construction. */
  readonly priorDocuments: ReadonlyArray<{ title: string; body: string }>;
  /** The step's stable, server-derived key, submitted to providers that use it. */
  readonly idempotencyKey: string;
};

export type StepSpec = {
  readonly taskId: Id<"tasks">;
  readonly position: number;
  readonly title: string;
  readonly documentKind: StepDocumentKind;
  /**
   * Performs the paid provider call and returns the JSON body to persist.
   * Runs under the executor, so it may be invoked at most twice and must not
   * do its own retrying.
   */
  readonly call: (args: StepCallArgs) => Promise<unknown>;
};

export type StepResult =
  | { readonly status: "succeeded" }
  | { readonly status: "failed"; readonly errorCode: string }
  | { readonly status: "cancelled" };

export async function runPipelineStep(
  ctx: ActionCtx,
  spec: StepSpec,
): Promise<StepResult> {
  const step = stepAt(spec.position);
  const position = BigInt(spec.position);

  const state = await ctx.runQuery(internal.platform.engine.tasks.runState, {
    taskId: spec.taskId,
  });
  // Belt and braces: the executor also checks, but a cancelled run should not
  // even transition its next step to `running`.
  if (state.cancelled) return { status: "cancelled" };

  await ctx.runMutation(internal.platform.engine.tasks.markStepRunning, {
    taskId: spec.taskId,
    position,
  });

  const providers = createProviders(readProviderMode());
  const priorDocuments = await ctx.runQuery(
    internal.platform.engine.tasks.readStepDocuments,
    { taskId: spec.taskId },
  );

  const idempotencyKey = stepIdempotencyKey(state.idempotencyKey, spec.position);

  // A step that pays no provider has nothing to reconcile and no charge to
  // duplicate, so it must not open an attempt record — doing so would make a
  // free step look, on resume, like money that might have been spent.
  if (step.role === null) {
    const outcome = await runUnpaidStep(ctx, spec, {
      providers,
      priorDocuments,
      idempotencyKey,
      timeoutMs: step.timeoutMs,
    });
    return outcome;
  }
  const role = step.role;

  const outcome: StepOutcome<unknown> = await executePaidStep<unknown>({
    replaySafety: replaySafetyFor(role),
    idempotencyKey,
    timeoutMs: step.timeoutMs,
    readAttempt: () =>
      ctx.runQuery(internal.platform.engine.tasks.readAttempt, {
        taskId: spec.taskId,
        position,
      }),
    beginAttempt: async (attempt) => {
      await ctx.runMutation(internal.platform.engine.tasks.beginAttempt, {
        taskId: spec.taskId,
        position,
        attempt,
      });
    },
    settleAttempt: async (attempt, result, errorCode) => {
      await ctx.runMutation(internal.platform.engine.tasks.settleAttempt, {
        taskId: spec.taskId,
        position,
        attempt,
        outcome: result,
        errorCode,
      });
    },
    // WP26-S4 replaces this with the pre-call worst-case reservation against
    // the $4.00 cap. The call site is deliberately here, inside the executor's
    // per-attempt loop, so S4 gets the retry check for free.
    reserve: async () => {},
    isCancelled: async () => {
      const current = await ctx.runQuery(
        internal.platform.engine.tasks.runState,
        { taskId: spec.taskId },
      );
      return current.cancelled;
    },
    call: async ({ idempotencyKey }) =>
      await spec.call({ providers, priorDocuments, idempotencyKey }),
    withTimeout: realWithTimeout,
  });

  if (outcome.status === "cancelled") return { status: "cancelled" };

  if (outcome.status === "failed") {
    await ctx.runMutation(internal.platform.engine.tasks.completeStep, {
      taskId: spec.taskId,
      position,
      outcome: "failed",
    });
    return { status: "failed", errorCode: outcome.errorCode };
  }

  await ctx.runMutation(internal.platform.engine.tasks.storeStepDocument, {
    taskId: spec.taskId,
    kind: spec.documentKind,
    title: spec.title,
    body: JSON.stringify(outcome.value),
  });
  await ctx.runMutation(internal.platform.engine.tasks.completeStep, {
    taskId: spec.taskId,
    position,
    outcome: "succeeded",
  });
  return { status: "succeeded" };
}

/**
 * Runs a step that spends nothing: one attempt, still under the step timeout so
 * it cannot hang the run, but with no attempt ledger and no cost reservation.
 */
async function runUnpaidStep(
  ctx: ActionCtx,
  spec: StepSpec,
  args: StepCallArgs & { readonly timeoutMs: number },
): Promise<StepResult> {
  const position = BigInt(spec.position);
  try {
    const value = await realWithTimeout(
      () =>
        spec.call({
          providers: args.providers,
          priorDocuments: args.priorDocuments,
          idempotencyKey: args.idempotencyKey,
        }),
      args.timeoutMs,
    );
    await ctx.runMutation(internal.platform.engine.tasks.storeStepDocument, {
      taskId: spec.taskId,
      kind: spec.documentKind,
      title: spec.title,
      body: JSON.stringify(value),
    });
    await ctx.runMutation(internal.platform.engine.tasks.completeStep, {
      taskId: spec.taskId,
      position,
      outcome: "succeeded",
    });
    return { status: "succeeded" };
  } catch (error) {
    await ctx.runMutation(internal.platform.engine.tasks.completeStep, {
      taskId: spec.taskId,
      position,
      outcome: "failed",
    });
    return {
      status: "failed",
      errorCode: error instanceof StepTimeoutError ? "STEP_TIMEOUT" : "STEP_FAILED",
    };
  }
}

