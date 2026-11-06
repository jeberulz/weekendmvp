import { v, type Infer, type ObjectType } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction, type ActionCtx } from "../_generated/server";
// Types only: erased at build, so this default-runtime file never loads the Node action module.
import type { GatewayRunResult, RunPromptArgs } from "../ai/gatewayActions";
import { WREN_CARD_PROPOSALS_MAX, wrenReplyOutput, type WrenReplyOutput } from "../ai/prompts/wrenShared";
import type { WrenFailureCause } from "../../lib/workspace/wren";
import { WREN_CARD_FIELD_MAX_CHARS } from "../../lib/workspace/contracts/wrenTools";
import {
  WREN_MEMORY_FACT_MAX_CHARS,
  WREN_MEMORY_PROPOSALS_MAX,
  WREN_MEMORY_RAW_PASS_FACTOR,
  WREN_MEMORY_SUMMARY_MAX_CHARS,
  wrenMemoryOverlongMarker,
} from "../../lib/workspace/contracts/wrenMemory";
import { dropLoneSurrogates } from "../../lib/workspace/plainText";
import { WREN_PROMPT_REFS, type finishOutcomeValidator } from "./chat";

/**
 * WP77-S3. One Wren turn: load it, call the metered gateway, end the row.
 *
 * Every model call goes through `internal.ai.gatewayActions.runPrompt` with the
 * chat attempt key `chat:{projectId}:{wrenMessageId}:{attempt}` and a
 * `wren_reply` stream into the same row, so the reply appears as it is
 * written. The prompt is `WREN_PROMPT_REFS[route]` (the router takes the model
 * from that spec's tier). No tool loop (D23): the reply is text plus, from
 * S4, an optional `cards` array of proposals in the same structured output.
 * One gateway call per turn (plus its one re-ask), so every card a turn
 * proposes was metered with it. `finishWrenTurn` decides what the proposals
 * become (cards only, D13). From S5 the same reply may carry notes for
 * Wren's memory (`remember`, `memorySummary`): no extra model call.
 *
 * Endings:
 * - settled: the output is re-parsed with the Wren schema; `done` with it;
 * - `duplicate_attempt`: another run already holds this key (a repeated
 *   schedule or a race). Nothing was sent; this run leaves the row to the run
 *   that owns the key, so there are never two replies or two charges;
 * - any other failure: `failed` with an honest line (`causeFor`), the
 *   attempt's `usageId` kept for audit;
 * - a throw from the gateway action: `failed`;
 * - a throw from the `done` finish (a write the server refused): the run tries
 *   once more with `failed`, so the row never stays `streaming` until the
 *   stale rule. Every string the action sends is well-formed Unicode (lone
 *   surrogates dropped) and never cut, so a valid reply does not throw.
 *
 * `runWrenTurnWith` is the body with the gateway call injectable, so tests can
 * drive the real gateway and meter with a scripted fixture adapter.
 */

type FailedRun = Extract<GatewayRunResult, { ok: false }>;

type FinishOutcome = Infer<typeof finishOutcomeValidator>;
type CardProposal = NonNullable<Extract<FinishOutcome, { status: "done" }>["cards"]>[number];

/**
 * A card field for the server: well-formed, never cut. Past the server's
 * limit it becomes a fixed over-long stand-in, still refused there, so the
 * mutation argument stays small and no cut can split a surrogate pair.
 */
function boundedField(value: string | null | undefined): string | undefined {
  if (value === null || value === undefined) return undefined;
  return value.length > WREN_CARD_FIELD_MAX_CHARS ? "x".repeat(WREN_CARD_FIELD_MAX_CHARS + 1) : dropLoneSurrogates(value);
}

/**
 * The model's cards as proposals for `finishWrenTurn`: null fields read as
 * absent, a missing tool as `""` (refused as `unknown_tool`), every value
 * bounded. At most `WREN_CARD_PROPOSALS_MAX` (the schema's bound); the server
 * considers only the first `WREN_CARDS_PER_TURN` and refuses the rest.
 */
export function cardProposals(cards: WrenReplyOutput["cards"]): CardProposal[] | undefined {
  if (cards === null || cards === undefined) return undefined;
  return cards.slice(0, WREN_CARD_PROPOSALS_MAX).map((card) => {
    const kind = boundedField(card.kind);
    const subjectTable = boundedField(card.subjectTable);
    const subjectId = boundedField(card.subjectId);
    const topic = boundedField(card.topic);
    const route = boundedField(card.route);
    return {
      tool: boundedField(card.tool) ?? "",
      ...(kind === undefined ? {} : { kind }),
      ...(subjectTable === undefined ? {} : { subjectTable }),
      ...(subjectId === undefined ? {} : { subjectId }),
      ...(topic === undefined ? {} : { topic }),
      ...(route === undefined ? {} : { route }),
    };
  });
}

type MemoryProposal = NonNullable<Extract<FinishOutcome, { status: "done" }>["memory"]>;

/**
 * A note for the server, never cut: passed whole (lone surrogates dropped)
 * when it is at most `WREN_MEMORY_RAW_PASS_FACTOR` times the limit in UTF-16
 * units, since cleaning can shrink it (NFD accents, spacing). Past that, a
 * fixed stand-in the server refuses as `too_long`.
 */
export function boundedNote(value: string, max: number): string {
  return value.length > max * WREN_MEMORY_RAW_PASS_FACTOR ? wrenMemoryOverlongMarker(max) : dropLoneSurrogates(value);
}

/**
 * WP77-S5. The model's notes as a proposal for `finishWrenTurn`: null reads as
 * absent, at most `WREN_MEMORY_PROPOSALS_MAX` facts, every value bounded. The
 * server cleans, checks, dedupes and caps them (`applyWrenMemoryProposal`).
 * `baseVersion` is the memory version the turn loaded, so a summary written
 * over a founder's mid-turn edit is skipped.
 */
export function memoryProposal(
  reply: Pick<WrenReplyOutput, "remember" | "memorySummary">,
  baseVersion: string,
): MemoryProposal | undefined {
  const remember = (reply.remember ?? [])
    .slice(0, WREN_MEMORY_PROPOSALS_MAX)
    .map((fact) => boundedNote(fact, WREN_MEMORY_FACT_MAX_CHARS));
  const summary = reply.memorySummary === null || reply.memorySummary === undefined
    ? undefined
    : boundedNote(reply.memorySummary, WREN_MEMORY_SUMMARY_MAX_CHARS);
  if (remember.length === 0 && summary === undefined) return undefined;
  return {
    ...(remember.length === 0 ? {} : { remember }),
    ...(summary === undefined ? {} : { summary }),
    baseVersion,
  };
}

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
  const finishOnce = async (outcome: FinishOutcome, attempt: number) => {
    await ctx.runMutation(internal.workspace.chat.finishWrenTurn, {
      ownerId: args.ownerId, projectId: args.projectId, messageId: args.wrenMessageId, attempt, outcome,
    });
  };
  /**
   * A `done` the server refuses to write must still end the row. First retry
   * the same reply with no memory and no cards, so the paid reply survives a
   * bad note or card; only if that throws too, write `failed`.
   */
  const finish = async (outcome: FinishOutcome, attempt: number = args.attempt) => {
    if (outcome.status === "failed") {
      await finishOnce(outcome, attempt);
      return;
    }
    try {
      await finishOnce(outcome, attempt);
      return;
    } catch {
      // Fall through to the reply alone.
    }
    if (outcome.memory !== undefined || outcome.cards !== undefined) {
      try {
        await finishOnce({
          status: "done", body: outcome.body, ...(outcome.usageId === undefined ? {} : { usageId: outcome.usageId }),
        }, attempt);
        return;
      } catch {
        // Fall through to `failed`.
      }
    }
    await finishOnce({
      status: "failed", cause: "failed", ...(outcome.usageId === undefined ? {} : { usageId: outcome.usageId }),
    }, attempt);
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
    const cards = parsed.success ? cardProposals(parsed.data.cards) : undefined;
    const memory = parsed.success ? memoryProposal(parsed.data, turn.memoryVersion) : undefined;
    await finish(parsed.success
      ? {
        status: "done",
        body: dropLoneSurrogates(parsed.data.reply),
        // Proposals only; the server checks and caps them (`resolveWrenCards`).
        ...(cards === undefined ? {} : { cards }),
        // Notes only; the server cleans, checks and caps them (`applyWrenMemoryProposal`).
        ...(memory === undefined ? {} : { memory }),
        ...lastUsageId(result),
      }
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
