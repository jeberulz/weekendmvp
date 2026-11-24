import { isRetryClass } from "../../lib/workspace/crew/retry";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

const meterFailure: Record<NonNullable<Doc<"ai_usage">["errorClass"]>, string> = {
  schema_invalid: "The model’s reply did not match the expected draft format.",
  refusal: "The model declined the request.",
  timeout: "The model request timed out.",
  indeterminate: "The model request ended without a confirmed result.",
  retryable: "The provider reported a temporary error.",
  permanent: "The provider could not complete the request.",
};

/** A historical observation. This read does not evaluate whether another attempt could run now. */
export async function lastCrewFailure(ctx: Pick<QueryCtx, "db">, task: Doc<"tasks">) {
  if (task.status !== "failed") return null;
  const run = await ctx.db.query("workflow_runs").withIndex("by_taskId_and_createdAt", (q) => q.eq("taskId", task._id)).order("desc").first();
  if (!run || run.type !== task.type || run.ownerId !== task.ownerId || run.projectId !== task.projectId || run.status !== "failed") return null;
  // On close, attempt is the next unused gateway ordinal (including a schema re-ask).
  const usage = task.jobKey && run.attempt > 0n
    ? await ctx.db.query("ai_usage").withIndex("by_attemptKey", (q) => q.eq("attemptKey", `${task.jobKey}:${run.attempt - 1n}`)).first()
    : null;
  if (usage?.status === "failed" && usage.taskId === task._id && usage.ownerId === task.ownerId && usage.projectId === task.projectId &&
      usage.errorClass !== undefined && usage.createdAt >= run.createdAt && usage.createdAt <= run.updatedAt) {
    const detail = task.crewFailureReason?.startsWith("The model returned an invalid seven-post draft")
      ? task.crewFailureReason
      : [meterFailure[usage.errorClass], task.crewFailureReason].filter(Boolean).join(" ");
    return { failureClass: usage.errorClass, detail };
  }
  // A job can fail before a call or after a valid reply, for example at an artifact quality gate.
  return {
    failureClass: isRetryClass(run.errorCode) ? run.errorCode : "unknown",
    detail: task.crewFailureReason ?? "The last run ended before a draft could be saved.",
  };
}
