import { v } from "convex/values";
import { internalAction } from "../../../_generated/server";
import { runPipelineStep, type StepResult } from "./runner";
import { briefContext, requireBrief } from "./shared";

/**
 * WP26-S3, pipeline step 2 — Competitors (plan §4.5).
 *
 * Competitor pricing goes stale fastest of anything in the report, so this step is the one most dependent on live search rather than model recall.
 */
export const run = internalAction({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args): Promise<StepResult> =>
    await runPipelineStep(ctx, {
      taskId: args.taskId,
      position: 2,
      title: "Competitors",
      documentKind: "research",
      call: async (callArgs) => {
        const brief = requireBrief(callArgs);
        const result = await callArgs.providers.search.search({
          query: `${briefContext(brief)}\n\nIdentify at least three direct competitors with their current pricing and positioning gaps. Cite each.`,
          searchContextSize: "high",
        });
        return {
          value: { text: result.value.text, citations: result.value.citations },
          cost: result.cost,
        };
      },
    }),
});
