import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { requireCurrentPlatformUser } from "./authz";
import { billingSummaryValidator, readMembershipState } from "./membership/state";
import { resolvePlan } from "./planResolver";
import { PLAN_LIMITS, UPGRADE_REQUIRED, type GatedFeature } from "./plans";

/**
 * WP44-S10 entitlements (PRD 9.3, FR-21 to FR-24). The one server-side
 * answer to "what may this member do". Every gated mutation calls it, and
 * the client never decides access: the UI only mirrors what this returns.
 */

/** Usage is exact through this count; the response explicitly flags any overflow. */
const ACTIVE_COUNT_CAP = 50;

export async function getEntitlements(ctx: QueryCtx, ownerId: Id<"users">) {
  const plan = await resolvePlan(ctx, ownerId);
  return { plan, limits: PLAN_LIMITS[plan] };
}

/** The typed error the UI turns into the upgrade sheet for `feature`. */
export function upgradeRequired(feature: GatedFeature, detail: Record<string, string> = {}) {
  return new ConvexError({ ...detail, code: UPGRADE_REQUIRED, feature });
}

/** For the on/off features (S11): collections, prompt pack export, compare, and live builds (WP63-S8). */
export async function requireFeature(
  ctx: QueryCtx,
  ownerId: Id<"users">,
  feature: Exclude<GatedFeature, "weekend_plan">,
) {
  const { limits } = await getEntitlements(ctx, ownerId);
  const allowed =
    feature === "collections"
      ? limits.collections
      : feature === "prompt_pack"
        ? limits.promptPack
        : feature === "live_builds"
          ? limits.liveBuilds
          : limits.compareMax > 0;
  if (!allowed) throw upgradeRequired(feature);
}

const planValidator = v.union(v.literal("free"), v.literal("builders_hub"));

/**
 * The UI asks before it opens a Builder's Hub form or view, so a free member
 * sees the sheet at the click, not after typing. It is only a courtesy: every
 * gated mutation and query checks again on its own.
 */
export const check = query({
  args: {
    feature: v.union(v.literal("collections"), v.literal("prompt_pack"), v.literal("compare"), v.literal("live_builds")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireCurrentPlatformUser(ctx);
    await requireFeature(ctx, user._id, args.feature);
    return null;
  },
});

/** What the Plan card, the sheet and Plan and billing show. Mirrors, never grants. */
export const mine = query({
  args: {},
  returns: v.object({
    plan: planValidator,
    limits: v.object({
      activeWeekendPlans: v.union(v.number(), v.null()),
      collections: v.boolean(),
      promptPack: v.boolean(),
      compareMax: v.number(),
      liveBuilds: v.boolean(),
    }),
    usage: v.object({ activeWeekendPlans: v.number(), activeWeekendPlansCapped: v.boolean() }),
    /** Account creation time. The client applies the first-day quiet period with its own clock. */
    joinedAt: v.number(),
    /** WP63-S2. Term, status, dates and founding seat. Never a Stripe id. */
    billing: billingSummaryValidator,
  }),
  handler: async (ctx) => {
    const user = await requireCurrentPlatformUser(ctx);
    const [{ plan, limits }, membership, active] = await Promise.all([
      getEntitlements(ctx, user._id),
      readMembershipState(ctx, user._id),
      ctx.db
        .query("weekend_plans")
        .withIndex("by_ownerId_and_status_and_updatedAt", (q) =>
          q.eq("ownerId", user._id).eq("status", "active"),
        )
        .take(ACTIVE_COUNT_CAP + 1),
    ]);
    return {
      plan,
      limits,
      usage: { activeWeekendPlans: Math.min(active.length, ACTIVE_COUNT_CAP), activeWeekendPlansCapped: active.length > ACTIVE_COUNT_CAP },
      joinedAt: user._creationTime,
      billing: membership.billing,
    };
  },
});
