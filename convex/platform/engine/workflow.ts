import { vResultValidator, WorkflowManager } from "@convex-dev/workflow";
import type { RunResult } from "@convex-dev/workpool";
import { v } from "convex/values";
import { components, internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { internalMutation } from "../../_generated/server";
import type { StepResult } from "./steps/runner";

/**
 * WP26-S3. The durable Validation Report workflow.
 *
 * **Runtime choice — Convex Workflow over Vercel Workflow DevKit.** The story
 * left this to implementation and asked for the rationale to be recorded; the
 * full comparison is in `docs/wp/wp26-progress.md`. The deciding factor is that
 * the durable journal and the credit ledger must not live in different systems.
 * Every piece of state a run touches — `tasks`, `task_steps`, `workflow_runs`,
 * `documents`, `credit_ledger` — is already in Convex, so a Convex-native
 * journal makes "this step completed" and "these credits moved" the same
 * transaction. A Vercel-side runtime would make each step a cross-service round
 * trip with its own crash window, which multiplies the reconciliation surface
 * this story exists to close rather than removing it.
 *
 * **Retries are ours, not the runtime's.** Every `runAction` passes
 * `retry: false`. The workpool's own retry would re-issue paid provider calls
 * outside the executor's attempt ledger and outside `S4`'s reservation check,
 * so the run could quietly buy calls nothing counted. The single allowed retry
 * happens inside `executePaidStep`.
 */

export const workflow = new WorkflowManager(components.workflow);

/** Passed to `onComplete` so it can settle the run it belongs to. */
const completionContext = v.object({ taskId: v.id("tasks") });

export const validationReport = workflow.define({
  args: { taskId: v.id("tasks"), rawIdea: v.string() },
  handler: async (step, args): Promise<string> => {
    await step.runMutation(internal.platform.engine.tasks.markRunning, {
      taskId: args.taskId,
    });

    const noRetry = { retry: false } as const;

    const brief: StepResult = await step.runAction(
      internal.platform.engine.steps.briefNormalization.run,
      { taskId: args.taskId, rawIdea: args.rawIdea },
      { ...noRetry, name: "brief_normalization" },
    );
    if (brief.status !== "succeeded") return brief.status;

    // Each step is awaited in turn rather than run in parallel: the cost cap is
    // a per-run total, and concurrent calls would commit spend that a
    // reservation check could no longer refuse.
    const sequence = [
      {
        name: "market_stats",
        fn: internal.platform.engine.steps.marketStats.run,
      },
      {
        name: "competitors",
        fn: internal.platform.engine.steps.competitors.run,
      },
      {
        name: "community_signals",
        fn: internal.platform.engine.steps.communitySignals.run,
      },
      {
        name: "keywords_demand",
        fn: internal.platform.engine.steps.keywordsDemand.run,
      },
      {
        name: "synthesis_scoring",
        fn: internal.platform.engine.steps.synthesisScoring.run,
      },
      { name: "report_render", fn: internal.platform.engine.steps.reportRender.run },
    ] as const;

    for (const entry of sequence) {
      const result: StepResult = await step.runAction(
        entry.fn,
        { taskId: args.taskId },
        { ...noRetry, name: entry.name },
      );
      if (result.status !== "succeeded") return result.status;
    }

    return "succeeded";
  },
});

/**
 * Settles the run exactly once.
 *
 * `completeRun` refuses to move a task that is already terminal, so a duplicate
 * or concurrent completion signal — a redelivered callback, or a cancellation
 * that landed first — leaves the original outcome intact rather than
 * overwriting it.
 */
export const onValidationReportComplete = internalMutation({
  args: {
    workflowId: v.string(),
    result: vResultValidator,
    context: completionContext,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const outcome = readOutcome(args.result);
    if (outcome === "cancelled") {
      // The task was already marked cancelled by `requestCancel`; re-asserting
      // it here would be a second write of a state that is already terminal.
      return null;
    }
    await ctx.runMutation(internal.platform.engine.tasks.completeRun, {
      taskId: args.context.taskId,
      outcome,
    });
    return null;
  },
});

/**
 * Maps the component's result envelope onto our terminal states.
 *
 * Anything other than an explicit success is a failure. Reading an unrecognised
 * envelope as success would mark a report complete that no step produced. The
 * handler also returns the string `"cancelled"` when a step observed the
 * cooperative cancel flag, which the component reports as a *successful* run of
 * a workflow that chose to stop — so that case is unwrapped here rather than
 * being recorded as a completed report.
 */
function readOutcome(result: RunResult): "succeeded" | "failed" | "cancelled" {
  if (result.kind !== "success") {
    return result.kind === "canceled" ? "cancelled" : "failed";
  }
  if (result.returnValue === "cancelled") return "cancelled";
  return result.returnValue === "succeeded" ? "succeeded" : "failed";
}

/**
 * Starts a run out of band.
 *
 * The caller returns as soon as the workflow is enqueued — no request thread
 * waits on provider calls, which is what keeps the pipeline off any Next.js
 * request's clock.
 */
export const startValidationReport = internalMutation({
  args: {
    ownerId: v.id("users"),
    projectId: v.id("projects"),
    idempotencyKey: v.string(),
    title: v.string(),
    rawIdea: v.string(),
  },
  returns: v.object({ taskId: v.id("tasks"), started: v.boolean() }),
  // Annotated explicitly: this handler references its own module through
  // `internal.*`, and without the annotation TypeScript resolves the module's
  // exported types to `any`, which silently degrades every caller of the
  // generated `api` object — not just this file.
  handler: async (
    ctx,
    args,
  ): Promise<{ taskId: Id<"tasks">; started: boolean }> => {
    const { taskId, created }: { taskId: Id<"tasks">; created: boolean } =
      await ctx.runMutation(internal.platform.engine.tasks.createRun, {
        ownerId: args.ownerId,
        projectId: args.projectId,
        idempotencyKey: args.idempotencyKey,
        title: args.title,
      });
    // A duplicate start must not enqueue a second workflow against the same
    // task — that would run the whole paid pipeline twice for one purchase.
    if (!created) return { taskId, started: false };

    await workflow.start(
      ctx,
      internal.platform.engine.workflow.validationReport,
      { taskId, rawIdea: args.rawIdea },
      {
        onComplete: internal.platform.engine.workflow.onValidationReportComplete,
        context: { taskId },
      },
    );
    return { taskId, started: true };
  },
});
