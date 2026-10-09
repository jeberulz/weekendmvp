import { HOUR, MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { v } from "convex/values";
import { components } from "../../_generated/api";
import { internalMutation } from "../../_generated/server";
import { requireCurrentPlatformUserForMutation } from "../authz";
import { MEMBERSHIP_SCAN_CAP } from "./state";

/**
 * WP64-S5. Which Stripe customer the Billing Portal opens for. Reached only
 * through the signed bridge (`provider.ts`) with the member's own auth, so
 * the customer always belongs to the signed-in member and never comes from
 * input. A mutation only because the rate limiter writes; it changes no
 * membership row.
 *
 * The customer is the one on the member's running subscription in this mode
 * (the newest one when none is running), and it must be linked to this
 * member alone. A member with no subscription
 * (Free, comp or Founding Lifetime) has nothing for the portal to manage.
 * The subscription id goes back too, so a plan switch can only ever name the
 * member's own newest subscription.
 */

const CUSTOMER_READ = 5;
/** Stripe statuses of a subscription that still renews. */
const RUNNING: ReadonlySet<string> = new Set(["active", "past_due", "trialing"]);

const rateLimiter = new RateLimiter(components.rateLimiter, {
  membershipPortalBurst: { kind: "token bucket", rate: 5, period: MINUTE },
  membershipPortalSustained: { kind: "token bucket", rate: 30, period: HOUR },
});

/** The route contract's codes a portal request can end with. */
export const PORTAL_REFUSAL_CODES = ["RATE_LIMITED", "INVALID_REQUEST"] as const;

/** `{ customerId, subscriptionId }` has no `ok`, so it never reads as an opened checkout order. */
export const portalCustomerValidator = v.union(
  v.object({ customerId: v.string(), subscriptionId: v.string() }),
  v.object({ ok: v.literal(false), code: v.union(v.literal("RATE_LIMITED"), v.literal("INVALID_REQUEST")) }),
);

export const open = internalMutation({
  args: { livemode: v.boolean() },
  returns: portalCustomerValidator,
  handler: async (ctx, args) => {
    const member = await requireCurrentPlatformUserForMutation(ctx);
    const burst = await rateLimiter.limit(ctx, "membershipPortalBurst", { key: member._id });
    if (!burst.ok) return { ok: false as const, code: "RATE_LIMITED" as const };
    const sustained = await rateLimiter.limit(ctx, "membershipPortalSustained", { key: member._id });
    if (!sustained.ok) return { ok: false as const, code: "RATE_LIMITED" as const };

    const subscriptions = await ctx.db
      .query("plan_subscriptions")
      .withIndex("by_ownerId_and_updatedAt", (q) => q.eq("ownerId", member._id))
      .order("desc")
      .take(MEMBERSHIP_SCAN_CAP);
    // The running subscription first, so a canceled duplicate (refunded after a
    // checkout race, possibly under another customer) never hides the one that renews.
    const inMode = subscriptions.filter((row) => row.livemode === args.livemode);
    const newest = inMode.find((row) => RUNNING.has(row.status)) ?? inMode[0];
    if (!newest) return { ok: false as const, code: "INVALID_REQUEST" as const };

    // A customer linked to anyone else is never opened, even if a row names it.
    const links = await ctx.db
      .query("billing_customers")
      .withIndex("by_stripeCustomerId", (q) => q.eq("stripeCustomerId", newest.stripeCustomerId))
      .take(CUSTOMER_READ);
    const ours = links.length > 0 && links.every((link) => link.ownerId === member._id && link.livemode === args.livemode);
    if (!ours) return { ok: false as const, code: "INVALID_REQUEST" as const };
    return { customerId: newest.stripeCustomerId, subscriptionId: newest.stripeSubscriptionId };
  },
});
