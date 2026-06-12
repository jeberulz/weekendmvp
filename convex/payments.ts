import { v } from "convex/values";
import { mutation } from "./_generated/server";

/**
 * Record a Stripe webhook event. Idempotent: Stripe retries webhooks, so a
 * duplicate `stripeEventId` is acknowledged without inserting a second row.
 * Called from the Next.js stripe-webhook API route after signature
 * verification.
 */
export const recordEvent = mutation({
  args: {
    stripeEventId: v.string(),
    type: v.string(),
    email: v.optional(v.string()),
    customerId: v.optional(v.string()),
    amount: v.optional(v.number()),
    currency: v.optional(v.string()),
    paymentLinkId: v.optional(v.string()),
    rawPayload: v.optional(v.string()),
  },
  returns: v.object({ duplicate: v.boolean() }),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("stripe_events")
      .withIndex("by_stripeEventId", (q) =>
        q.eq("stripeEventId", args.stripeEventId),
      )
      .unique();
    if (existing) {
      return { duplicate: true };
    }
    await ctx.db.insert("stripe_events", {
      ...args,
      createdAt: Date.now(),
    });
    return { duplicate: false };
  },
});
