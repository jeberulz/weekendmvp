"use node";

import { ConvexError, v } from "convex/values";
import { MembershipBridgeError, membershipBridgeFresh, verifyMembershipBridge } from "../../../lib/membership-bridge";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { action, env } from "../../_generated/server";
import { PLATFORM_AUTH_ERROR } from "../authz";
import type { FollowUp, MembershipEvent, SubscriptionSnapshot } from "./events";

/**
 * WP64-S3. The membership routes' only way into Convex. The signature proves
 * the call came from our server (`MEMBERSHIP_BILLING_BRIDGE_SECRET`); the
 * member's forwarded auth decides whose order it is. Fails closed when the
 * secret is unset or short.
 *
 * WP64-S4. The webhook and reconcile routes send verified Stripe events and
 * snapshots with no member session. Each must be fresh (`issuedAt`), and the
 * internal functions' validators check every field.
 *
 * WP64-S5. `open_portal` finds the member's own Stripe customer for the
 * Billing Portal, with the member's forwarded auth like checkout.
 */

type BeginResult =
  | {
      ok: true;
      orderId: Id<"membership_orders">;
      term: "monthly" | "annual" | "lifetime";
      priceKey: "monthly" | "annual" | "lifetime_t1" | "lifetime_t2";
      seatNumber: number | null;
      sessionExpiresAt: number | null;
      checkoutSessionId: string | null;
      stripeCustomerId: string | null;
      email: string;
      supersede: string[];
    }
  | { ok: false; code: string; opensAt?: number };

type Outcome = "applied" | "ignored" | "stale" | "rejected";

export type MembershipBridgeResult =
  | BeginResult
  | { attached: boolean }
  | { outcome: Outcome; duplicate: boolean; actions: FollowUp[] }
  | { outcome: Outcome; actions: FollowUp[] }
  | { released: number }
  | { ids: string[]; capped: boolean }
  | { customerId: string };

export const accept = action({
  args: { payload: v.string(), signature: v.string() },
  handler: async (ctx, args): Promise<MembershipBridgeResult> => {
    let payload;
    try {
      payload = verifyMembershipBridge(args.payload, args.signature, env.MEMBERSHIP_BILLING_BRIDGE_SECRET);
    } catch (error) {
      if (error instanceof MembershipBridgeError) throw new ConvexError({ code: error.code });
      throw error;
    }
    // Server-only kinds carry `issuedAt` and no member auth. Member kinds carry neither stamp nor owner.
    if ("issuedAt" in payload) {
      if (!membershipBridgeFresh(payload.issuedAt, Date.now())) throw new ConvexError({ code: "STALE_BRIDGE_PAYLOAD" });
      const events = internal.platform.membership.events;
      switch (payload.kind) {
        case "event":
          return await ctx.runMutation(events.settle, { event: payload.event as MembershipEvent });
        case "subscription_snapshot":
          return await ctx.runMutation(events.applySnapshot, {
            livemode: payload.livemode,
            subscription: payload.subscription as SubscriptionSnapshot,
          });
        case "release_expired_holds":
          return await ctx.runMutation(events.releaseExpiredHolds, {});
        case "running_subscriptions":
          return await ctx.runQuery(events.runningSubscriptionIds, { livemode: payload.livemode });
      }
    }
    try {
      if (payload.kind === "begin_checkout") {
        const quota = await ctx.runMutation(internal.platform.membership.checkout.consumeQuota, {});
        if (!quota.ok) return { ok: false, code: "RATE_LIMITED" };
        return await ctx.runMutation(internal.platform.membership.checkout.begin, {
          term: payload.term,
          idempotencyKey: payload.idempotencyKey,
          livemode: payload.livemode,
        });
      }
      if (payload.kind === "open_portal") {
        return await ctx.runMutation(internal.platform.membership.portal.open, { livemode: payload.livemode });
      }
      return await ctx.runMutation(internal.platform.membership.checkout.attachSession, {
        orderId: payload.orderId as Id<"membership_orders">,
        checkoutSessionId: payload.checkoutSessionId,
      });
    } catch (error) {
      if (error instanceof ConvexError && error.data?.code === PLATFORM_AUTH_ERROR.unauthenticated) {
        return { ok: false, code: "AUTHENTICATION_REQUIRED" };
      }
      throw error;
    }
  },
});
