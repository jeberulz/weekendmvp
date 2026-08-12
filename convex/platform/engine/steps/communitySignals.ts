import { v } from "convex/values";
import { internalAction } from "../../../_generated/server";
import { runPipelineStep, type StepResult } from "./runner";
import { briefContext, requireBrief } from "./shared";

/**
 * WP26-S3, pipeline step 3 — Community signals (plan §4.5).
 *
 * Citation-only per the ruling: the adapter caps snippets, so this step stores links and short quotes, never reproduced third-party pages.
 */
export const run = internalAction({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args): Promise<StepResult> =>
    await runPipelineStep(ctx, {
      taskId: args.taskId,
      position: 3,
      title: "Community signals",
      documentKind: "research",
      call: async (callArgs) => {
        const brief = requireBrief(callArgs);
        const result = await callArgs.providers.search.search({
          query: `${briefContext(brief)}\n\nFind pain evidence discussed by real users on Reddit, Hacker News, and YouTube. Quote briefly and link each source.`,
          searchContextSize: "medium",
        });
        return {
          value: { text: result.value.text, citations: result.value.citations },
          cost: result.cost,
        };
      },
    }),
});
