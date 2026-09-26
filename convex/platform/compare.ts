import { ConvexError, v } from "convex/values";
import { query } from "../_generated/server";
import { requireCurrentPlatformUser } from "./authz";
import { getEntitlements, upgradeRequired } from "./entitlements";
import { COMPARE_MIN } from "./hubLimits";
import { hoursOf, meanScore, savedAmong } from "./ideaCards";

/**
 * WP44-S11 compare (Builder's Hub): 2 to `compareMax` ideas side by side.
 * The gate is here, in the query the compare view reads, so a free member
 * who opens the URL directly gets UPGRADE_REQUIRED, not the table.
 */

export { COMPARE_MIN } from "./hubLimits";

const scoresValidator = v.object({
  opportunity: v.number(),
  pain: v.number(),
  timing: v.number(),
  builder_confidence: v.number(),
});

export const ideas = query({
  args: { slugs: v.array(v.string()) },
  returns: v.array(
    v.object({
      slug: v.string(),
      title: v.string(),
      category: v.string(),
      scores: v.union(scoresValidator, v.null()),
      score: v.union(v.number(), v.null()),
      buildTime: v.number(),
      tools: v.array(v.string()),
      revenueGoal: v.string(),
      saved: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await requireCurrentPlatformUser(ctx);
    const { limits } = await getEntitlements(ctx, user._id);
    if (limits.compareMax === 0) throw upgradeRequired("compare");
    const slugs = [...new Set(args.slugs)];
    if (slugs.length < COMPARE_MIN || slugs.length > limits.compareMax) {
      throw new ConvexError({ code: "COMPARE_SIZE", max: limits.compareMax });
    }
    const found = (
      await Promise.all(
        slugs.map((slug) =>
          ctx.db
            .query("ideas")
            .withIndex("by_slug", (q) => q.eq("slug", slug))
            .unique(),
        ),
      )
    ).filter((idea) => idea !== null);
    const savedIds = await savedAmong(
      ctx,
      user._id,
      found.map((idea) => idea._id),
    );
    return found.map((idea) => ({
      slug: idea.slug,
      title: idea.title,
      category: idea.category,
      scores: idea.scores ? { ...idea.scores } : null,
      score: meanScore(idea),
      buildTime: hoursOf(idea),
      tools: idea.tools,
      revenueGoal: idea.revenueGoal,
      saved: savedIds.has(idea._id),
    }));
  },
});
