import { ConvexError, v } from "convex/values";
import { query } from "../_generated/server";
import { PLATFORM_AUTH_ERROR, requireCurrentPlatformUser } from "./authz";
import { requireFeature } from "./entitlements";
import { hoursOf } from "./ideaCards";

/**
 * WP44-S11 prompt pack export (Builder's Hub). The download route calls this
 * with the member's session before it builds anything, so the gate and the
 * idea's details come from one server-side read.
 */
export const source = query({
  args: { slug: v.string() },
  returns: v.object({
    slug: v.string(),
    title: v.string(),
    description: v.string(),
    category: v.string(),
    buildTime: v.number(),
    tools: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const user = await requireCurrentPlatformUser(ctx);
    await requireFeature(ctx, user._id, "prompt_pack");
    const idea = await ctx.db
      .query("ideas")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (idea === null) throw new ConvexError({ code: PLATFORM_AUTH_ERROR.notFound });
    return {
      slug: idea.slug,
      title: idea.title,
      description: idea.description,
      category: idea.category,
      buildTime: hoursOf(idea),
      tools: idea.tools,
    };
  },
});
