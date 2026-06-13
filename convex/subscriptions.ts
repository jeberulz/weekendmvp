import { v } from "convex/values";
import { mutation } from "./_generated/server";

/**
 * Record a subscription event. This is an append-only event log (not a user
 * identity table) — called from the Next.js subscribe API routes after the
 * Beehiiv call.
 */
export const record = mutation({
  args: {
    email: v.string(),
    source: v.string(),
    automationIds: v.array(v.string()),
    utm: v.optional(
      v.object({
        campaign: v.optional(v.string()),
        source: v.optional(v.string()),
        medium: v.optional(v.string()),
      }),
    ),
    beehiivStatus: v.optional(v.string()),
  },
  returns: v.id("subscriptions"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("subscriptions", {
      ...args,
      createdAt: Date.now(),
    });
  },
});
