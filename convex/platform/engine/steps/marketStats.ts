import { v } from "convex/values";
import { internalAction } from "../../../_generated/server";
import { runPipelineStep, type StepResult } from "./runner";
import { briefContext, requireBrief } from "./shared";

/**
 * WP26-S3, pipeline step 1 — Market stats (plan §4.5).
 *
 * The adapter already fails closed when a search returns no usable citation, which is what keeps an uncited market figure out of the report.
 */
export const run = internalAction({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args): Promise<StepResult> =>
    await runPipelineStep(ctx, {
      taskId: args.taskId,
      position: 1,
      title: "Market stats",
      documentKind: "research",
      call: async (callArgs) => {
        const brief = requireBrief(callArgs);
        const result = await callArgs.providers.search.search({
          query: `${briefContext(brief)}\n\nFind at least two market statistics with sources, including market size and CAGR. Cite every figure.`,
          searchContextSize: "high",
        });
        return {
          text: result.value.text,
          citations: result.value.citations,
        };
      },
    }),
});
