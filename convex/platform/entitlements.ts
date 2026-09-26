import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { requireCurrentPlatformUser } from "./authz";
import { resolvePlan } from "./planResolver";
import { PLAN_LIMITS, UPGRADE_REQUIRED, type GatedFeature } from "./plans";

/**
 * WP44-S10 entitlements (PRD 9.3, FR-21 to FR-24). The one server-side
 * answer to "what may this member do". Every gated mutation calls it, and
 * the client never decides access: the UI only mirrors what this returns.
 */

/** Bounded read for the usage meter. Far above any real count. */
const ACTIVE_COUNT_CAP = 50;

export async function getEntitlements(ctx: QueryCtx, ownerId: Id<"users">) {
  const plan = await resolvePlan(ctx, ownerId);
  return { plan, limits: PLAN_LIMITS[plan] };
}

/** The typed error the UI turns into the upgrade sheet for `feature`. */
export function upgradeRequired(feature: GatedFeature, detail: Record<string, string> = {}) {
  return new ConvexError({ ...detail, code: UPGRADE_REQUIRED, feature });
}

/** For the on/off features (S11): collections, prompt pack export, compare. */
export async function requireFeature(
  ctx: QueryCtx,
  ownerId: Id<"users">,
  feature: Exclude<GatedFeature, "weekend_plan">,
) {
  const { limits } = await getEntitlements(ctx, ownerId);
  const allowed =
    feature === "collections" ? limits.collections : feature === "prompt_pack" ? limits.promptPack : limits.compareMax > 0;
  if (!allowed) throw upgradeRequired(feature);
}

const planValidator = v.union(v.literal("free"), v.literal("builders_hub"));

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
    }),
    usage: v.object({ activeWeekendPlans: v.number() }),
    /** Account creation time. The client applies the first-day quiet period with its own clock. */
    joinedAt: v.number(),
  }),
  handler: async (ctx) => {
    const user = await requireCurrentPlatformUser(ctx);
    const [{ plan, limits }, active] = await Promise.all([
      getEntitlements(ctx, user._id),
      ctx.db
        .query("weekend_plans")
        .withIndex("by_ownerId_and_status_and_updatedAt", (q) =>
          q.eq("ownerId", user._id).eq("status", "active"),
        )
        .take(ACTIVE_COUNT_CAP),
    ]);
    return {
      plan,
      limits,
      usage: { activeWeekendPlans: active.length },
      joinedAt: user._creationTime,
    };
  },
});
