import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type { PickReason } from "./setupOptions";
import { pickReasonValidator } from "./setupValidators";

/**
 * The card every WP44 idea list returns (Ideas, Saved, Home picks). Owner
 * state is only `saved`: ruling R3 folds Interested into Saved on screen.
 */
export const ideaCardValidator = v.object({
  ideaId: v.id("ideas"),
  slug: v.string(),
  title: v.string(),
  description: v.string(),
  category: v.string(),
  /** Hours as a number. 0 when the stored value does not parse. */
  buildTime: v.number(),
  revenueGoal: v.string(),
  tools: v.array(v.string()),
  scores: v.union(
    v.object({
      opportunity: v.number(),
      pain: v.number(),
      timing: v.number(),
      builder_confidence: v.number(),
    }),
    v.null(),
  ),
  /** Mean of the four scores, one decimal. Null when unscored. */
  score: v.union(v.number(), v.null()),
  /** True when the OG card exists, so the art band can crop it. */
  hasArt: v.boolean(),
  publishedAt: v.number(),
  saved: v.boolean(),
  /** For you only (WP44-S8): the one input that lifted this idea, if any. */
  reason: v.optional(pickReasonValidator),
  /** True when this idea has the member's active weekend plan (WP44-S9). */
  building: v.optional(v.boolean()),
});

const MAX_CARD_TOOLS = 4;

export function hoursOf(idea: Pick<Doc<"ideas">, "buildTime">): number {
  const hours = Number(idea.buildTime);
  return Number.isFinite(hours) && hours > 0 ? hours : 0;
}

/** Same formula Explore used for its canonical score. */
export function meanScore(idea: Pick<Doc<"ideas">, "scores">): number | null {
  if (idea.scores === undefined) return null;
  const { opportunity, pain, timing, builder_confidence } = idea.scores;
  return Math.round(((opportunity + pain + timing + builder_confidence) / 4) * 10) / 10;
}

export function toIdeaCard(
  idea: Doc<"ideas">,
  saved: boolean,
  reason?: PickReason | null,
  building = false,
) {
  return {
    ...(reason ? { reason } : {}),
    ...(building ? { building: true } : {}),
    ideaId: idea._id,
    slug: idea.slug,
    title: idea.title,
    description: idea.description,
    category: idea.category,
    buildTime: hoursOf(idea),
    revenueGoal: idea.revenueGoal,
    tools: idea.tools.slice(0, MAX_CARD_TOOLS),
    scores: idea.scores ?? null,
    score: meanScore(idea),
    hasArt: idea.og?.status === "ready",
    publishedAt: idea.publishedAt,
    saved,
  };
}

/**
 * The member's Saved list (ruling R3: `saved` or `interested`), newest first,
 * merged from the two flag indexes. Reads at most `cap + 1` rows from each, so
 * `capped` is exact: a list that stops short of the cap is complete.
 */
export async function readSavedIntents(
  ctx: QueryCtx,
  ownerId: Id<"users">,
  cap: number,
) {
  const [savedRows, interestedRows] = await Promise.all([
    ctx.db
      .query("idea_intents")
      .withIndex("by_ownerId_and_saved_and_updatedAt", (q) =>
        q.eq("ownerId", ownerId).eq("saved", true),
      )
      .order("desc")
      .take(cap + 1),
    ctx.db
      .query("idea_intents")
      .withIndex("by_ownerId_and_interested_and_updatedAt", (q) =>
        q.eq("ownerId", ownerId).eq("interested", true),
      )
      .order("desc")
      .take(cap + 1),
  ]);
  const byIdea = new Map<Id<"ideas">, Doc<"idea_intents">>();
  for (const row of [...savedRows, ...interestedRows]) byIdea.set(row.ideaId, row);
  const newestFirst = [...byIdea.values()].sort((a, b) => b.updatedAt - a.updatedAt);
  return { rows: newestFirst.slice(0, cap), capped: newestFirst.length > cap };
}
