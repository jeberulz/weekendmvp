"use node";

import { ConvexError, v } from "convex/values";
import { LegacyBridgeError, verifyLegacyPaymentEvent } from "../lib/legacy-payments-bridge";
import { internal } from "./_generated/api";
import { action, env } from "./_generated/server";

/**
 * Verifies the signed event from `app/api/stripe-webhook/route.ts` and records
 * it through the internal mutation (WP64-S1). Fails closed when
 * `LEGACY_PAYMENTS_BRIDGE_SECRET` is unset or too short.
 */
export const accept = action({
  args: { payload: v.string(), signature: v.string() },
  returns: v.object({ duplicate: v.boolean() }),
  handler: async (ctx, args): Promise<{ duplicate: boolean }> => {
    let event;
    try {
      event = verifyLegacyPaymentEvent(
        args.payload,
        args.signature,
        env.LEGACY_PAYMENTS_BRIDGE_SECRET,
      );
    } catch (error) {
      if (error instanceof LegacyBridgeError) {
        throw new ConvexError({ code: error.code });
      }
      throw error;
    }
    return await ctx.runMutation(internal.payments.recordEventInternal, event);
  },
});
