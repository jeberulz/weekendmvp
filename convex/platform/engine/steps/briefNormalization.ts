import { v } from "convex/values";
import { internalAction } from "../../../_generated/server";
import { runPipelineStep, type StepResult } from "./runner";
import { BRIEF_DOCUMENT_TITLE, type NormalizedBrief } from "./shared";

/**
 * WP26-S3, pipeline step 0 — brief normalization (plan §4.5).
 *
 * Turns the customer's raw idea text into the structured brief every later step
 * builds its request from.
 */
export const run = internalAction({
  args: { taskId: v.id("tasks"), rawIdea: v.string() },
  handler: async (ctx, args): Promise<StepResult> =>
    await runPipelineStep(ctx, {
      taskId: args.taskId,
      position: 0,
      title: BRIEF_DOCUMENT_TITLE,
      documentKind: "brief",
      call: async ({ providers }) => {
        const result = await providers.synthesis.complete({
          instructions:
            "Normalize a startup idea into a brief. Reply with JSON only: " +
            '{"title","audience","model","seedKeywords":[]}. Do not invent ' +
            "market data, competitors, or metrics — later steps source those.",
          input: args.rawIdea,
          maxOutputTokens: 800,
        });
        return parseBrief(result.value.text);
      },
    }),
});

/**
 * Fails closed on unparseable model output instead of falling back to the raw
 * idea text. A silently degraded brief would propagate into every downstream
 * query, producing a full report built on a title the customer never wrote.
 */
function parseBrief(text: string): NormalizedBrief {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("brief normalization returned non-JSON");
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("brief normalization returned a non-object");
  }
  const record = parsed as Record<string, unknown>;
  const title = typeof record.title === "string" ? record.title.trim() : "";
  if (title.length === 0) {
    throw new Error("brief normalization returned no title");
  }
  return {
    title,
    audience: typeof record.audience === "string" ? record.audience : "",
    model: typeof record.model === "string" ? record.model : "",
    seedKeywords: Array.isArray(record.seedKeywords)
      ? record.seedKeywords.filter((k): k is string => typeof k === "string")
      : [],
  };
}
