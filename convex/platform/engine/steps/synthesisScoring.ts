import { v } from "convex/values";
import { internalAction } from "../../../_generated/server";
import { runPipelineStep, type StepResult } from "./runner";
import { briefContext, requireBrief } from "./shared";

/**
 * WP26-S3, pipeline step 5 — synthesis and scoring (plan §4.5).
 *
 * The one step that reasons over everything the research steps gathered. It is
 * given only what those steps stored, so a score can never rest on a fact no
 * cited step produced.
 */
export const run = internalAction({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args): Promise<StepResult> =>
    await runPipelineStep(ctx, {
      taskId: args.taskId,
      position: 5,
      title: "Synthesis and scoring",
      documentKind: "research",
      call: async (callArgs) => {
        const brief = requireBrief(callArgs);
        const research = callArgs.priorDocuments
          .map((doc) => `## ${doc.title}\n${doc.body}`)
          .join("\n\n");
        const result = await callArgs.providers.synthesis.complete({
          instructions:
            "Score this idea using only the supplied research. Reply with " +
            "JSON only. Every claim must trace to a supplied citation; if the " +
            "research does not support a section, say so rather than " +
            "inventing a figure.",
          input: `${briefContext(brief)}\n\n${research}`,
          maxOutputTokens: 4_000,
        });
        return { value: { text: result.value.text }, cost: result.cost };
      },
    }),
});
