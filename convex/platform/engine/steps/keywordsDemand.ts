import { v } from "convex/values";
import { internalAction } from "../../../_generated/server";
import { runPipelineStep, type StepResult } from "./runner";
import { requireBrief } from "./shared";

/**
 * WP26-S3, pipeline step 4 — keywords and demand (plan §4.5).
 *
 * The only step whose numbers must come from a data provider rather than a
 * model. The adapter refuses to estimate, so an empty or failing lookup fails
 * the step closed here instead of reaching the report as "no demand".
 */

/** US English — the corpus the report's demand figures are quoted against. */
const LOCATION_CODE = 2840;
const LANGUAGE_CODE = "en";

export const run = internalAction({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args): Promise<StepResult> =>
    await runPipelineStep(ctx, {
      taskId: args.taskId,
      position: 4,
      title: "Keywords and demand",
      documentKind: "research",
      call: async (callArgs) => {
        const brief = requireBrief(callArgs);
        if (brief.seedKeywords.length === 0) {
          // Sending an empty keyword set would spend a task fee to learn
          // nothing; the brief step is what should have produced these.
          throw new Error("brief produced no seed keywords");
        }
        const result = await callArgs.providers.keywordData.lookup({
          keywords: [...brief.seedKeywords],
          locationCode: LOCATION_CODE,
          languageCode: LANGUAGE_CODE,
        });
        return { value: { metrics: result.value.metrics }, cost: result.cost };
      },
    }),
});
