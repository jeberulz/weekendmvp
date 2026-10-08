import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, mutation, type MutationCtx } from "./_generated/server";

/**
 * The legacy ship·able payment log. It is an append-only record of Stripe
 * events and never decides access, entitlement or offer eligibility.
 *
 * WP63-S1 moves writes behind a signed hand-off. Rollout is expand, switch,
 * contract, across separate deploys so the live webhook never breaks:
 *   1. Expand (this change): `recordEventInternal` and the signed action in
 *      `paymentsBridge.ts` exist next to the old public `recordEvent`.
 *   2. Switch (operator): set `LEGACY_PAYMENTS_BRIDGE_SECRET` in Convex first,
 *      then in Vercel. The route then uses the bridge.
 *   3. Contract (later deploy): delete `recordEvent` and the route's fallback.
 */

type StripeEventFields = Omit<Doc<"stripe_events">, "_id" | "_creationTime" | "createdAt">;

const eventFields = {
  stripeEventId: v.string(),
  type: v.string(),
  email: v.optional(v.string()),
  customerId: v.optional(v.string()),
  amount: v.optional(v.number()),
  currency: v.optional(v.string()),
  paymentLinkId: v.optional(v.string()),
};

/** Idempotent by Stripe event id: Stripe retries, so a duplicate is acknowledged. */
async function insertEventOnce(
  ctx: MutationCtx,
  fields: StripeEventFields,
): Promise<{ duplicate: boolean }> {
  const existing = await ctx.db
    .query("stripe_events")
    .withIndex("by_stripeEventId", (q) => q.eq("stripeEventId", fields.stripeEventId))
    .unique();
  if (existing) {
    return { duplicate: true };
  }
  await ctx.db.insert("stripe_events", {
    ...fields,
    createdAt: Date.now(),
  });
  return { duplicate: false };
}

/**
 * Public, so callable by any client. Kept only until the switch is done (see
 * the rollout above), then removed. Do not add callers.
 */
export const recordEvent = mutation({
  args: { ...eventFields, rawPayload: v.optional(v.string()) },
  returns: v.object({ duplicate: v.boolean() }),
  handler: async (ctx, args) => await insertEventOnce(ctx, args),
});

/** Reached only through `paymentsBridge.accept`, after the signature checks out. */
export const recordEventInternal = internalMutation({
  args: eventFields,
  returns: v.object({ duplicate: v.boolean() }),
  handler: async (ctx, args) => await insertEventOnce(ctx, args),
});
