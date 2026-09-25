import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, query, type QueryCtx } from "../_generated/server";
import { PLATFORM_AUTH_ERROR, requireCurrentPlatformUser } from "./authz";

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
  revenueGoal: v.string(),
  tools: v.array(v.string()),
  /** Mean of the four research scores, one decimal. Null when unscored. */
  score: v.union(v.number(), v.null()),
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

/** Same formula as Explore's canonical score. */
function meanScore(idea: Doc<"ideas">): number | null {
  if (idea.scores === undefined) return null;
  const { opportunity, pain, timing, builder_confidence } = idea.scores;
  return Math.round(((opportunity + pain + timing + builder_confidence) / 4) * 10) / 10;
}

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
            revenueGoal: idea.revenueGoal,
            tools: idea.tools.slice(0, 4),
            score: meanScore(idea),
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

async function ideaBySlug(ctx: QueryCtx, slug: string) {
  return await ctx.db
    .query("ideas")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique();
}

async function ownerIntentFor(
  ctx: QueryCtx,
  ownerId: Id<"users">,
  ideaId: Id<"ideas">,
) {
  return await ctx.db
    .query("idea_intents")
    .withIndex("by_ownerId_and_ideaId", (q) =>
      q.eq("ownerId", ownerId).eq("ideaId", ideaId),
    )
    .unique();
}

/**
 * Whether the signed-in member has this idea in Saved. Keyed by slug because
 * editorial cards come from the manifest, not Convex. Null when the idea is
 * not in Convex yet (published but not seeded), so the button can hide.
 */
export const savedState = query({
  args: { slug: v.string() },
  returns: v.union(v.object({ saved: v.boolean() }), v.null()),
  handler: async (ctx, args) => {
    const user = await requireCurrentPlatformUser(ctx);
    const idea = await ideaBySlug(ctx, args.slug);
    if (idea === null) return null;
    const intent = await ownerIntentFor(ctx, user._id, idea._id);
    // Ruling R3: Interested reads as Saved on screen.
    return { saved: (intent?.saved ?? false) || (intent?.interested ?? false) };
  },
});

/**
 * The one Save toggle on screen. Saving sets `saved`. Removing clears both
 * flags (ruling R3), so an idea never lingers in Saved as Interested.
 */
export const setSaved = mutation({
  args: { slug: v.string(), saved: v.boolean() },
  returns: v.object({ saved: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await requireCurrentPlatformUser(ctx);
    const idea = await ideaBySlug(ctx, args.slug);
    if (idea === null) {
      throw new ConvexError({ code: PLATFORM_AUTH_ERROR.notFound });
    }
    const existing = await ownerIntentFor(ctx, user._id, idea._id);
    const updatedAt = Date.now();
    const next = args.saved
      ? { saved: true, interested: existing?.interested ?? false }
      : { saved: false, interested: false };

    if (existing === null) {
      // Nothing to remove, and no row needed to say so.
      if (!args.saved) return { saved: false };
      await ctx.db.insert("idea_intents", {
        ownerId: user._id,
        ideaId: idea._id,
        ...next,
        updatedAt,
      });
    } else {
      await ctx.db.patch("idea_intents", existing._id, { ...next, updatedAt });
    }
    return { saved: args.saved };
  },
});
