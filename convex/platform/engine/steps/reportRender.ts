import { v } from "convex/values";
import { internalAction } from "../../../_generated/server";
import { runPipelineStep, type StepResult } from "./runner";

/**
 * WP26-S3, pipeline step 6 — report render (plan §4.5).
 *
 * The only unpaid step, so it opens no attempt record and reserves no budget.
 * It gathers what the pipeline produced into one document; turning that into a
 * validated `ValidationReport` — and enforcing the completeness gate — is
 * `S5`'s compiler, which is why this step deliberately does not mark the report
 * complete.
 */
export const run = internalAction({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args): Promise<StepResult> =>
    await runPipelineStep(ctx, {
      taskId: args.taskId,
      position: 6,
      title: "Raw report record",
      documentKind: "validation_report",
      call: async ({ priorDocuments }) => ({
        sections: priorDocuments.map((doc) => ({
          title: doc.title,
          body: doc.body,
        })),
      }),
    }),
});
