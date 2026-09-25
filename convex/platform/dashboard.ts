import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { requireCurrentPlatformUser } from "./authz";

/**
 * WP44 dashboard data. Owner-scoped: identity always comes from the session,
 * never from an argument. Editorial data (idea of the week, newest ideas) is
 * not here. It comes from the same cached loader as the homepage.
 */

/** Nav badges read "99+" past this, so there is no reason to read further. */
export const SAVED_COUNT_CAP = 99;
const LATEST_SAVED_READ = 8;
const LATEST_SAVED_RESULT = 5;

const savedIdeaValidator = v.object({
  ideaId: v.id("ideas"),
  slug: v.string(),
  title: v.string(),
  category: v.string(),
  buildTime: v.string(),
  updatedAt: v.number(),
});

const homeValidator = v.object({
  firstName: v.union(v.string(), v.null()),
  saved: v.object({
    /** Exact up to SAVED_COUNT_CAP. */
    count: v.number(),
    /** True when there are more than SAVED_COUNT_CAP saved ideas. */
    capped: v.boolean(),
    latest: v.array(savedIdeaValidator),
  }),
  /** WP44-S8 fills this from the setup questions. */
  setupDone: v.boolean(),
  /** WP44-S9 fills this with the active weekend plan. */
  activePlan: v.null(),
  /** WP44-S10 resolves this from entitlements. Free until then. */
  plan: v.union(v.literal("free"), v.literal("builders_hub")),
});

function firstNameOf(user: Doc<"users">): string | null {
  const full = (user.displayName ?? user.name ?? "").trim();
  if (full === "") return null;
  return full.split(/\s+/)[0] ?? null;
}

export const home = query({
  args: {},
  returns: homeValidator,
  handler: async (ctx) => {
    const user = await requireCurrentPlatformUser(ctx);

    // Ruling R3: Saved shows ideas marked saved or interested. Each flag has
    // its own index, so read both newest first, one past the cap, and merge.
    // A list that stops short of the cap is complete, so the merged count is
    // exact whenever it stays at or under the cap.
    const [savedRows, interestedRows] = await Promise.all([
      ctx.db
        .query("idea_intents")
        .withIndex("by_ownerId_and_saved_and_updatedAt", (q) =>
          q.eq("ownerId", user._id).eq("saved", true),
        )
        .order("desc")
        .take(SAVED_COUNT_CAP + 1),
      ctx.db
        .query("idea_intents")
        .withIndex("by_ownerId_and_interested_and_updatedAt", (q) =>
          q.eq("ownerId", user._id).eq("interested", true),
        )
        .order("desc")
        .take(SAVED_COUNT_CAP + 1),
    ]);

    const byIdea = new Map<Id<"ideas">, Doc<"idea_intents">>();
    for (const row of [...savedRows, ...interestedRows]) {
      byIdea.set(row.ideaId, row);
    }
    const newestFirst = [...byIdea.values()].sort(
      (a, b) => b.updatedAt - a.updatedAt,
    );

    const latest = (
      await Promise.all(
        newestFirst.slice(0, LATEST_SAVED_READ).map(async (intent) => {
          const idea = await ctx.db.get("ideas", intent.ideaId);
          if (idea === null) return null;
          return {
            ideaId: idea._id,
            slug: idea.slug,
            title: idea.title,
            category: idea.category,
            buildTime: idea.buildTime,
            updatedAt: intent.updatedAt,
          };
        }),
      )
    )
      .filter((row) => row !== null)
      .slice(0, LATEST_SAVED_RESULT);

    return {
      firstName: firstNameOf(user),
      saved: {
        count: Math.min(newestFirst.length, SAVED_COUNT_CAP),
        capped: newestFirst.length > SAVED_COUNT_CAP,
        latest,
      },
      setupDone: false,
      activePlan: null,
      plan: "free" as const,
    };
  },
});
