"use node";

import { ConvexError, v } from "convex/values";
import {
  LiveBridgeError,
  assertFresh,
  verifyLiveWorkshopEvent,
} from "../../lib/live/workshop-bridge";
import { internal } from "../_generated/api";
import { action, env } from "../_generated/server";

/**
 * Signed hand-off from `/api/live/*` into workshop seat/order mutations.
 * Member kinds (begin/attach) forward the caller's auth token from Next.
 * Server kinds (paid/expired/refunded/reconcile) carry issuedAt.
 */
export const accept = action({
  args: { payload: v.string(), signature: v.string() },
  returns: v.any(),
  handler: async (ctx, args): Promise<unknown> => {
    let event;
    try {
      event = verifyLiveWorkshopEvent(
        args.payload,
        args.signature,
        env.LIVE_WORKSHOP_BILLING_BRIDGE_SECRET,
      );
    } catch (error) {
      if (error instanceof LiveBridgeError) {
        throw new ConvexError({ code: error.code });
      }
      throw error;
    }

    switch (event.kind) {
      case "begin_checkout":
        return await ctx.runMutation(internal.live.workshopCheckout.begin, {
          eventKey: event.eventKey,
          lookupKey: event.lookupKey,
          idempotencyKey: event.idempotencyKey,
          livemode: event.livemode,
        });
      case "attach_session":
        return await ctx.runMutation(internal.live.workshopCheckout.attachSession, {
          orderId: event.orderId as never,
          checkoutSessionId: event.checkoutSessionId,
          priceId: event.priceId,
        });
      case "mark_paid": {
        assertFresh(event.issuedAt);
        return await ctx.runMutation(internal.live.workshopEvents.markPaid, {
          checkoutSessionId: event.checkoutSessionId,
          stripeEventId: event.stripeEventId,
          priceId: event.priceId,
        });
      }
      case "mark_expired": {
        assertFresh(event.issuedAt);
        return await ctx.runMutation(internal.live.workshopEvents.markExpired, {
          checkoutSessionId: event.checkoutSessionId,
        });
      }
      case "mark_refunded": {
        assertFresh(event.issuedAt);
        return await ctx.runMutation(internal.live.workshopEvents.markRefunded, {
          checkoutSessionId: event.checkoutSessionId,
          stripeEventId: event.stripeEventId,
        });
      }
      case "release_expired_holds": {
        assertFresh(event.issuedAt);
        return await ctx.runMutation(internal.live.workshopEvents.releaseExpiredHolds, {
          eventKey: event.eventKey,
        });
      }
      default:
        throw new ConvexError({ code: "INVALID_BRIDGE_PAYLOAD" });
    }
  },
});
