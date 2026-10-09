"use node";

import { ConvexError, v } from "convex/values";
import { MembershipBridgeError, verifyMembershipBridge } from "../../../lib/membership-bridge";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { action, env } from "../../_generated/server";
import { PLATFORM_AUTH_ERROR } from "../authz";

/**
 * WP64-S3. The membership routes' only way into Convex. The signature proves
 * the call came from our server (`MEMBERSHIP_BILLING_BRIDGE_SECRET`); the
 * member's forwarded auth decides whose order it is. Fails closed when the
 * secret is unset or short. S4 adds the webhook events here.
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

export type MembershipBridgeResult = BeginResult | { attached: boolean };

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
