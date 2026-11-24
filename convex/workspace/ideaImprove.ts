import { ConvexError, v, type Infer } from "convex/values";

import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { action, internalMutation, mutation, query, type ActionCtx, type MutationCtx } from "../_generated/server";
// Types only: erased at build, so this default-runtime file never loads the Node action module.
import type { GatewayRunResult, RunPromptArgs } from "../ai/gatewayActions";
import { ideaImproveSpec } from "../ai/prompts/ideaImprove.v1";
import { assertFeatureEnabled } from "../ops/settings";
import { requireCurrentPlatformUser, requireCurrentPlatformUserForMutation } from "../platform/authz";
import { checkLimit } from "../platform/limits";
import { promptRef } from "../../lib/workspace/contracts/prompts";
import {
  ideaImproveOutputSchema,
  judgeIdeaImprovement,
  modeOf,
  parseIdeaImproveRequest,
  type IdeaImproveRequest,
  type IdeaImproveVerdict,
} from "../../lib/workspace/wizard/idea-improve";

/**
 * WP100. "Improve with AI" on wizard Step 1 (`docs/design/wizard-idea-ai-improve.md`).
 *
 * `improve` (public action) is the only entry:
 * 1. `begin` (internal mutation, the caller's auth): the `workspace` switch and
 *    cohort, the signed-in founder, C-LIMITS `ideaImprove` (which also checks
 *    the `ai` switch), then one `wizard_idea_improvements` row. A refusal
 *    returns `rate_limited` or `unavailable` and nothing is written or sent.
 * 2. `internal.ai.gatewayActions.runPrompt` with `wizard-idea-improve@1` and
 *    the `idea_improve` key (`idea-improve:{rowId}:{attempt}`) for that owner,
 *    so the meter reserves, gates (kill switch, budgets, the owner's daily cap
 *    and Free ceiling), settles and records `ai_usage`. No raw SDK call.
 * 3. The output is parsed again and judged in code (`judgeIdeaImprovement`).
 *    A suggestion that fails a check is never returned.
 * 4. `finish` records the verdict, the usage rows and the charge.
 *
 * It never throws to the client: every ending is a typed result. The field
 * works as before whatever this returns.
 *
 * `decide` records what the founder did with a suggestion (used, kept their
 * own, tried again, undid it). The session reads the accepted row when the
 * founder continues (WP100-S5).
 *
 * `improveWith` is the action's body with the gateway call injectable, so
 * tests drive the real gateway and meter with a scripted fixture adapter.
 */

const PROMPT_REF = promptRef(ideaImproveSpec);
/** A Step 1 suggestion is worth a short wait, not the gateway's 3 minutes. */
const IMPROVE_TIMEOUT_MS = 30_000;

const selectionValidator = v.object({ start: v.number(), end: v.number() });

export const improveArgs = {
  text: v.string(),
  selection: v.optional(selectionValidator),
  /** The accepted suggestion this round builds on, so the original text carries over. */
  parentId: v.optional(v.id("wizard_idea_improvements")),
};

export const improveResultValidator = v.union(
  v.object({
    status: v.literal("suggested"),
    improvementId: v.id("wizard_idea_improvements"),
    mode: v.union(v.literal("whole"), v.literal("selection")),
    text: v.string(),
    changeNote: v.string(),
  }),
  v.object({
    status: v.union(v.literal("already_clear"), v.literal("not_an_idea"), v.literal("rejected"), v.literal("failed")),
    improvementId: v.id("wizard_idea_improvements"),
  }),
  v.object({
    status: v.union(v.literal("too_short"), v.literal("invalid"), v.literal("rate_limited"), v.literal("unavailable")),
  }),
);

export type ImproveResult = Infer<typeof improveResultValidator>;

const beginResultValidator = v.union(
  v.object({ ok: v.literal(true), improvementId: v.id("wizard_idea_improvements"), ownerId: v.id("users") }),
  v.object({ ok: v.literal(false), status: v.union(v.literal("rate_limited"), v.literal("unavailable")) }),
);

type BeginResult = Infer<typeof beginResultValidator>;

function isRateLimited(error: unknown): boolean {
  return error instanceof ConvexError && typeof error.data === "object" && error.data !== null &&
    "kind" in error.data && error.data.kind === "RateLimited";
}

/**
 * Starts one improve call for the signed-in founder. Feature, cohort and
 * limit refusals come back as data, not throws: they are expected states the
 * UI shows calmly. Anything else (a bug) still throws.
 */
export const begin = internalMutation({
  args: {
    text: v.string(),
    selection: v.optional(selectionValidator),
    parentId: v.optional(v.id("wizard_idea_improvements")),
  },
  returns: beginResultValidator,
  handler: async (ctx, args): Promise<BeginResult> => {
    const parsed = parseIdeaImproveRequest(args.text, args.selection);
    if (!parsed.ok) throw new ConvexError({ code: "INVALID_ARGUMENT" });
    let ownerId: Id<"users">;
    try {
      await assertFeatureEnabled(ctx, "workspace");
      ownerId = (await requireCurrentPlatformUserForMutation(ctx))._id;
      await checkLimit(ctx, "ideaImprove", ownerId);
    } catch (error) {
      if (isRateLimited(error)) return { ok: false, status: "rate_limited" };
      if (error instanceof ConvexError) return { ok: false, status: "unavailable" };
      throw error;
    }
    const parent = args.parentId === undefined ? null : await ctx.db.get("wizard_idea_improvements", args.parentId);
    const ownedParent = parent !== null && parent.ownerId === ownerId && parent.status === "suggested" ? parent : null;
    const { request } = parsed;
    const improvementId = await ctx.db.insert("wizard_idea_improvements", {
      ownerId,
      mode: modeOf(request),
      inputText: request.text,
      ...(request.selection === null ? {} : { selection: { start: request.selection.start, end: request.selection.end } }),
      originalText: ownedParent?.originalText ?? request.text.trim(),
      ...(ownedParent === null ? {} : { parentId: ownedParent._id }),
      status: "pending",
      usageIds: [],
      chargedMicroUsd: 0,
      createdAt: Date.now(),
    });
    return { ok: true, improvementId, ownerId };
  },
});

const finishStatusValidator = v.union(
  v.literal("suggested"),
  v.literal("already_clear"),
  v.literal("not_an_idea"),
  v.literal("rejected"),
  v.literal("failed"),
);

/** Records how the call ended. Only a `pending` row is written. */
export const finish = internalMutation({
  args: {
    improvementId: v.id("wizard_idea_improvements"),
    status: finishStatusValidator,
    suggestion: v.optional(v.string()),
    changeNote: v.optional(v.string()),
    hints: v.optional(v.object({
      audience: v.union(v.string(), v.null()),
      coreAction: v.union(v.string(), v.null()),
      offer: v.union(v.string(), v.null()),
    })),
    reason: v.optional(v.string()),
    usageIds: v.array(v.string()),
    chargedMicroUsd: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get("wizard_idea_improvements", args.improvementId);
    if (row === null || row.status !== "pending") return null;
    await ctx.db.patch("wizard_idea_improvements", args.improvementId, {
      status: args.status,
      ...(args.suggestion === undefined ? {} : { suggestion: args.suggestion }),
      ...(args.changeNote === undefined ? {} : { changeNote: args.changeNote }),
      ...(args.hints === undefined ? {} : { hints: args.hints }),
      ...(args.reason === undefined ? {} : { reason: args.reason.slice(0, 120) }),
      usageIds: args.usageIds,
      chargedMicroUsd: args.chargedMicroUsd,
    });
    return null;
  },
});

async function requireOwnedSuggestion(
  ctx: MutationCtx,
  improvementId: Id<"wizard_idea_improvements">,
): Promise<Doc<"wizard_idea_improvements">> {
  const user = await requireCurrentPlatformUserForMutation(ctx);
  const row = await ctx.db.get("wizard_idea_improvements", improvementId);
  // Not found and not yours read the same, so ids cannot be probed.
  if (row === null || row.ownerId !== user._id || row.status !== "suggested") {
    throw new ConvexError({ code: "RESOURCE_NOT_FOUND" });
  }
  return row;
}

/** What the founder did with a suggestion. The latest decision wins. */
export const decide = mutation({
  args: {
    improvementId: v.id("wizard_idea_improvements"),
    outcome: v.union(v.literal("accepted"), v.literal("dismissed"), v.literal("retried"), v.literal("undone")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await assertFeatureEnabled(ctx, "workspace");
    await requireOwnedSuggestion(ctx, args.improvementId);
    await ctx.db.patch("wizard_idea_improvements", args.improvementId, { outcome: args.outcome, decidedAt: Date.now() });
    return null;
  },
});

/**
 * Whether the Improve button should show. False when the workspace or AI is
 * switched off for this founder; the field works the same either way. The
 * daily cap is not read here: the action answers `rate_limited` instead.
 */
export const availability = query({
  args: {},
  returns: v.object({ enabled: v.boolean() }),
  handler: async (ctx) => {
    try {
      await assertFeatureEnabled(ctx, "workspace");
      await assertFeatureEnabled(ctx, "ai");
      await requireCurrentPlatformUser(ctx);
      return { enabled: true };
    } catch (error) {
      if (error instanceof ConvexError) return { enabled: false };
      throw error;
    }
  },
});

// ---------------------------------------------------------------------------
// The action
// ---------------------------------------------------------------------------

type ImproveCtx = Pick<ActionCtx, "runMutation">;
type ImproveArgs = { text: string; selection?: { start: number; end: number }; parentId?: Id<"wizard_idea_improvements"> };

function usageOf(run: GatewayRunResult): { usageIds: string[]; chargedMicroUsd: number } {
  return {
    usageIds: run.attempts.map((attempt) => attempt.usageId),
    chargedMicroUsd: run.attempts.reduce((sum, attempt) => sum + attempt.chargedMicroUsd + (attempt.lateAdjustmentMicroUsd ?? 0), 0),
  };
}

function verdictFrom(request: IdeaImproveRequest, outputJson: string): IdeaImproveVerdict | null {
  let raw: unknown;
  try {
    raw = JSON.parse(outputJson);
  } catch {
    return null;
  }
  const parsed = ideaImproveOutputSchema.safeParse(raw);
  return parsed.success ? judgeIdeaImprovement(request, parsed.data) : null;
}

/** The action's body, with the gateway call injectable (tests). */
export async function improveWith(
  ctx: ImproveCtx,
  args: ImproveArgs,
  runPrompt: (prompt: RunPromptArgs) => Promise<GatewayRunResult>,
): Promise<ImproveResult> {
  const parsed = parseIdeaImproveRequest(args.text, args.selection);
  if (!parsed.ok) return { status: parsed.error === "too_short" ? "too_short" : "invalid" };
  const { request } = parsed;

  const started: BeginResult = await ctx.runMutation(internal.workspace.ideaImprove.begin, {
    text: request.text,
    ...(request.selection === null ? {} : { selection: request.selection }),
    ...(args.parentId === undefined ? {} : { parentId: args.parentId }),
  });
  if (!started.ok) return { status: started.status };
  const { improvementId, ownerId } = started;

  const selected = request.selection === null ? null : request.text.slice(request.selection.start, request.selection.end);
  let run: GatewayRunResult | null = null;
  try {
    run = await runPrompt({
      promptRef: PROMPT_REF,
      inputs: { mode: modeOf(request), idea: request.text, selected },
      ownerId,
      attemptKey: { kind: "idea_improve", improvementId },
      timeoutMs: IMPROVE_TIMEOUT_MS,
    });
  } catch {
    run = null;
  }

  const finish = async (fields: Omit<Parameters<typeof recordFinish>[1], "improvementId">) =>
    await recordFinish(ctx, { improvementId, ...fields });

  if (run === null) {
    await finish({ status: "failed", reason: "gateway_threw", usageIds: [], chargedMicroUsd: 0 });
    return { status: "failed", improvementId };
  }
  const usage = usageOf(run);
  if (!run.ok) {
    const { failure } = run;
    const refused = failure.kind === "meter_refused";
    await finish({ status: "failed", reason: refused ? `meter_refused:${failure.error.code}` : failure.kind, ...usage });
    // A meter refusal (AI off, budget spent) is a calm "not now", like the switch being off.
    return refused ? { status: "unavailable" } : { status: "failed", improvementId };
  }

  const verdict = verdictFrom(request, run.outputJson);
  if (verdict === null) {
    await finish({ status: "failed", reason: "output_unparsed", ...usage });
    return { status: "failed", improvementId };
  }
  switch (verdict.status) {
    case "suggested":
      await finish({
        status: "suggested",
        suggestion: verdict.text,
        changeNote: verdict.changeNote,
        hints: { ...verdict.hints },
        ...usage,
      });
      return { status: "suggested", improvementId, mode: modeOf(request), text: verdict.text, changeNote: verdict.changeNote };
    case "rejected":
      await finish({ status: "rejected", reason: verdict.reason, ...usage });
      return { status: "rejected", improvementId };
    case "already_clear":
    case "not_an_idea":
      await finish({ status: verdict.status, ...usage });
      return { status: verdict.status, improvementId };
  }
}

type FinishArgs = {
  improvementId: Id<"wizard_idea_improvements">;
  status: "suggested" | "already_clear" | "not_an_idea" | "rejected" | "failed";
  suggestion?: string;
  changeNote?: string;
  hints?: { audience: string | null; coreAction: string | null; offer: string | null };
  reason?: string;
  usageIds: string[];
  chargedMicroUsd: number;
};

async function recordFinish(ctx: ImproveCtx, args: FinishArgs): Promise<void> {
  await ctx.runMutation(internal.workspace.ideaImprove.finish, args);
}

/** Sharpens the founder's idea sentence, or the selected words in it. Never throws on an expected ending. */
export const improve = action({
  args: improveArgs,
  returns: improveResultValidator,
  handler: async (ctx, args): Promise<ImproveResult> =>
    await improveWith(ctx, args, async (prompt) => await ctx.runAction(internal.ai.gatewayActions.runPrompt, prompt)),
});
