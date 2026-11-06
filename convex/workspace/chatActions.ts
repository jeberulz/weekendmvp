import { v, type Infer, type ObjectType } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction, type ActionCtx } from "../_generated/server";
// Types only: erased at build, so this default-runtime file never loads the Node action module.
import type { GatewayRunResult, RunPromptArgs } from "../ai/gatewayActions";
import { wrenReplyOutput } from "../ai/prompts/wrenShared";
import type { WrenFailureCause } from "../../lib/workspace/wren";
import { WREN_PROMPT_REFS, type finishOutcomeValidator } from "./chat";

/**
 * WP77-S3. One Wren turn: load it, call the metered gateway, end the row.
 *
 * Every model call goes through `internal.ai.gatewayActions.runPrompt` with the
 * chat attempt key `chat:{projectId}:{wrenMessageId}:{attempt}` and a
 * `wren_reply` stream into the same row, so the reply appears as it is
 * written. The prompt is `WREN_PROMPT_REFS[route]` (the router takes the model
 * from that spec's tier). No tools: the reply is text and nothing else
 * happens (D13, D23).
 *
 * Endings:
 * - settled: the output is re-parsed with the Wren schema; `done` with it;
 * - `duplicate_attempt`: another run already holds this key (a repeated
 *   schedule or a race). Nothing was sent; this run leaves the row to the run
 *   that owns the key, so there are never two replies or two charges;
 * - any other failure: `failed` with an honest line (`causeFor`), the
 *   attempt's `usageId` kept for audit;
 * - a throw from the gateway action: `failed`.
 *
 * `runWrenTurnWith` is the body with the gateway call injectable, so tests can
 * drive the real gateway and meter with a scripted fixture adapter.
 */

type FailedRun = Extract<GatewayRunResult, { ok: false }>;
type FinishOutcome = Infer<typeof finishOutcomeValidator>;

export const runWrenTurnArgs = {
  ownerId: v.id("users"),
  projectId: v.id("projects"),
  founderMessageId: v.id("chat_messages"),
  wrenMessageId: v.id("chat_messages"),
  route: v.union(v.literal("fast"), v.literal("plan")),
  attempt: v.number(),
};

type RunWrenTurnArgs = ObjectType<typeof runWrenTurnArgs>;

/** The honest line for a failed run. Never claims Wren did anything. */
export function causeFor(failure: FailedRun["failure"]): WrenFailureCause {
  switch (failure.kind) {
    case "meter_refused":
      return failure.error.code === "BUDGET_EXHAUSTED" ? "budget" : "paused";
    case "refusal":
      return "refusal";
    case "schema_invalid":
      return "invalid";
    default:
      return "failed";
  }
}

function lastUsageId(result: GatewayRunResult): { usageId?: string } {
  const last = result.attempts.at(-1);
  return last === undefined ? {} : { usageId: last.usageId };
}

/** The run's last gateway attempt (a re-ask counts), so the finish guard compares like with like. */
function lastAttempt(result: GatewayRunResult, first: number): number {
  return result.attempts.reduce((highest, attempt) => Math.max(highest, attempt.attempt), first);
}

type TurnCtx = Pick<ActionCtx, "runQuery" | "runMutation">;

export async function runWrenTurnWith(
  ctx: TurnCtx,
  args: RunWrenTurnArgs,
  runPrompt: (prompt: RunPromptArgs) => Promise<GatewayRunResult>,
): Promise<null> {
  const finish = async (outcome: FinishOutcome, attempt: number = args.attempt) => {
    await ctx.runMutation(internal.workspace.chat.finishWrenTurn, {
      ownerId: args.ownerId, projectId: args.projectId, messageId: args.wrenMessageId, attempt, outcome,
    });
  };
  const turn = await ctx.runQuery(internal.workspace.chat.loadWrenTurn, {
    ownerId: args.ownerId,
    projectId: args.projectId,
    founderMessageId: args.founderMessageId,
    wrenMessageId: args.wrenMessageId,
  });
  if (turn.status !== "ready") return null;

  let result: GatewayRunResult;
  try {
    result = await runPrompt({
      promptRef: WREN_PROMPT_REFS[args.route],
      inputs: { message: turn.message, history: turn.history },
      businessContext: turn.businessContext,
      ownerId: args.ownerId,
      projectId: args.projectId,
      attemptKey: { kind: "chat", chatMessageId: args.wrenMessageId },
      attempt: args.attempt,
      stream: { kind: "wren_reply", messageId: args.wrenMessageId },
    });
  } catch {
    await finish({ status: "failed", cause: "failed" });
    return null;
  }

  if (result.ok) {
    let parsed: ReturnType<typeof wrenReplyOutput.safeParse>;
    try {
      parsed = wrenReplyOutput.safeParse(JSON.parse(result.outputJson));
    } catch {
      parsed = wrenReplyOutput.safeParse(null);
    }
    await finish(parsed.success
      ? { status: "done", body: parsed.data.reply, ...lastUsageId(result) }
      : { status: "failed", cause: "invalid", ...lastUsageId(result) }, lastAttempt(result, args.attempt));
    return null;
  }
  if (result.failure.kind === "duplicate_attempt") return null;
  await finish({ status: "failed", cause: causeFor(result.failure), ...lastUsageId(result) }, lastAttempt(result, args.attempt));
  return null;
}

export const runWrenTurn = internalAction({
  args: runWrenTurnArgs,
  returns: v.null(),
  handler: async (ctx, args): Promise<null> =>
    await runWrenTurnWith(ctx, args, async (prompt) => await ctx.runAction(internal.ai.gatewayActions.runPrompt, prompt)),
});
