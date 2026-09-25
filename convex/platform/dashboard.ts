import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, query, type QueryCtx } from "../_generated/server";
import { PLATFORM_AUTH_ERROR, requireCurrentPlatformUser } from "./authz";
import { ideaCardValidator, meanScore, readSavedIntents, toIdeaCard } from "./ideaCards";
import { readPreferences } from "./preferences";
import { activePlanOf, latestDonePlanOf, planSummaryValidator, summarize } from "./weekendPlans";

/**
 * WP44 dashboard data. Owner-scoped: identity always comes from the session,
 * never from an argument. Editorial data (idea of the week, newest ideas) is
 * not here. It comes from the same cached loader as the homepage.
 */

/** Nav badges read "99+" past this, so there is no reason to read further. */
export const SAVED_COUNT_CAP = 99;
const LATEST_SAVED_READ = 8;
const LATEST_SAVED_RESULT = 5;
/** The Saved page reads at most this many saves. The library is smaller. */
export const SAVED_LIST_CAP = 500;
const MAX_SAVED_LIST_LIMIT = 240;

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
  /** The setup questions were answered (WP44-S8). */
  setupDone: v.boolean(),
  /** The member chose "Skip for now" (ruling R7). */
  setupSkipped: v.boolean(),
  /** The active weekend plan (WP44-S9), or null. */
  activePlan: v.union(planSummaryValidator, v.null()),
  /** The most recently finished plan. Home shows "You shipped" for a week. */
  lastFinished: v.union(planSummaryValidator, v.null()),
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

    // Ruling R3: Saved shows ideas marked saved or interested.
    const [{ rows: newestFirst, capped }, prefs, active, lastDone] = await Promise.all([
      readSavedIntents(ctx, user._id, SAVED_COUNT_CAP),
      readPreferences(ctx, user._id),
      activePlanOf(ctx, user._id),
      latestDonePlanOf(ctx, user._id),
    ]);

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
        count: newestFirst.length,
        capped,
        latest,
      },
      setupDone: prefs?.onboardedAt !== undefined,
      setupSkipped: prefs?.skippedAt !== undefined,
      activePlan: active ? await summarize(ctx, active) : null,
      lastFinished: lastDone ? await summarize(ctx, lastDone) : null,
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

/**
 * The Saved page (WP44-S5): ideas marked saved or interested (R3), newest
 * save first. `total` is exact up to SAVED_LIST_CAP.
 */
export const savedList = query({
  args: { limit: v.number() },
  returns: v.object({
    items: v.array(v.object({ card: ideaCardValidator, savedAt: v.number() })),
    total: v.number(),
    capped: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const user = await requireCurrentPlatformUser(ctx);
    const limit = Math.max(1, Math.min(Math.floor(args.limit) || 1, MAX_SAVED_LIST_LIMIT));
    const [{ rows, capped }, active] = await Promise.all([
      readSavedIntents(ctx, user._id, SAVED_LIST_CAP),
      activePlanOf(ctx, user._id),
    ]);
    const items = (
      await Promise.all(
        rows.slice(0, limit).map(async (row) => {
          const idea = await ctx.db.get("ideas", row.ideaId);
          if (idea === null) return null;
          const card = toIdeaCard(idea, true, null, active?.ideaId === idea._id);
          return { card, savedAt: row.updatedAt };
        }),
      )
    ).filter((item) => item !== null);
    return { items, total: rows.length, capped };
  },
});
