import type { Doc, Id } from "../_generated/dataModel";
import { hoursOf, meanScore } from "./ideaCards";
import {
  GOAL_REVENUE,
  fitsWeekend,
  type PickReason,
  type SetupGoal,
  type SetupHours,
  type SetupTool,
} from "./setupOptions";

/**
 * WP44-S8 For you ranking (PRD 6.2 module 3, FR-14). Pure: the query reads
 * the rows, this orders them. Rank = research score plus small, bounded
 * nudges from the member's answers and saves. Each idea gets at most one
 * reason, and a reason only ever names an input that actually moved it.
 */

export const AFFINITY_STEP = 0.1;
export const MAX_AFFINITY_BOOST = 0.5;
export const HOURS_FIT = 0.4;
export const HOURS_MISS = -0.6;
export const GOAL_MATCH = 0.3;
export const TOOL_MATCH = 0.3;
/**
 * An input that matches more than this share of ideas says nothing, so it is
 * never a reason. Among the inputs that do apply, the rarest one wins.
 */
export const REASON_MAX_SHARE = 0.8;

type Idea = Pick<
  Doc<"ideas">,
  "_id" | "slug" | "title" | "category" | "tools" | "buildTime" | "revenueGoal" | "scores" | "publishedAt"
>;

export type ForYouInputs = {
  tools: readonly SetupTool[];
  weeklyHours?: SetupHours;
  goal?: SetupGoal;
  /** The member's saved ideas, newest save first (bounded by the caller). */
  savedNewestFirst: readonly Idea[];
};

export function rankForYou<T extends Idea>(ideas: readonly T[], inputs: ForYouInputs) {
  const affinity = new Map<string, number>();
  const latestSavedIn = new Map<string, Idea>();
  for (const saved of inputs.savedNewestFirst) {
    affinity.set(saved.category, (affinity.get(saved.category) ?? 0) + 1);
    if (!latestSavedIn.has(saved.category)) latestSavedIn.set(saved.category, saved);
  }

  const goalRevenue: readonly string[] = inputs.goal ? GOAL_REVENUE[inputs.goal] : [];
  const facts = ideas.map((idea) => ({
    idea,
    fits: inputs.weeklyHours ? fitsWeekend(hoursOf(idea), inputs.weeklyHours) : null,
    goalHit: goalRevenue.includes(idea.revenueGoal),
    matchedTools: inputs.tools.filter((tool) => idea.tools.includes(tool)),
  }));

  // How common each input is across the ideas being ranked.
  const total = Math.max(facts.length, 1);
  const goalShare = facts.filter((f) => f.goalHit).length / total;
  const hoursShare = facts.filter((f) => f.fits === true).length / total;
  const toolCount = new Map<string, number>();
  for (const { idea } of facts) {
    for (const tool of idea.tools) toolCount.set(tool, (toolCount.get(tool) ?? 0) + 1);
  }

  const scored = facts.map(({ idea, fits, goalHit, matchedTools }) => {
    const affinityBoost = Math.min((affinity.get(idea.category) ?? 0) * AFFINITY_STEP, MAX_AFFINITY_BOOST);
    const rank =
      (meanScore(idea) ?? 0) +
      affinityBoost +
      (fits === null ? 0 : fits ? HOURS_FIT : HOURS_MISS) +
      (goalHit ? GOAL_MATCH : 0) +
      (matchedTools.length > 0 ? TOOL_MATCH : 0);

    let reason: PickReason | null = null;
    const alike = latestSavedIn.get(idea.category);
    if (affinityBoost > 0 && alike && alike._id !== idea._id) {
      reason = { kind: "saved_like", title: alike.title };
    } else {
      const options: { reason: PickReason; share: number }[] = [];
      if (goalHit && inputs.goal) options.push({ reason: { kind: "goal", goal: inputs.goal }, share: goalShare });
      if (fits && inputs.weeklyHours && inputs.weeklyHours !== "more") {
        options.push({ reason: { kind: "hours", hours: inputs.weeklyHours }, share: hoursShare });
      }
      for (const tool of matchedTools) {
        options.push({ reason: { kind: "tool", tool }, share: (toolCount.get(tool) ?? 0) / total });
      }
      const best = options
        .filter((option) => option.share <= REASON_MAX_SHARE)
        .reduce<{ reason: PickReason; share: number } | null>(
          (min, option) => (min === null || option.share < min.share ? option : min),
          null,
        );
      reason = best?.reason ?? null;
    }
    return { idea, rank, reason };
  });

  scored.sort(
    (a, b) =>
      b.rank - a.rank ||
      b.idea.publishedAt - a.idea.publishedAt ||
      a.idea.slug.localeCompare(b.idea.slug),
  );
  const reasons = new Map<Id<"ideas">, PickReason | null>(
    scored.map(({ idea, reason }) => [idea._id, reason]),
  );
  return { ordered: scored.map(({ idea }) => idea), reasons };
}
