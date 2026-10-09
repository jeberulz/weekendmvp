import { v } from "convex/values";
import { query } from "../../_generated/server";
import { requireCurrentPlatformUser } from "../authz";
import { readFoundingEligibleFrom } from "./offer";
import { readSeatOffer } from "./state";

/**
 * WP63-S6 and S7. What the Founding Lifetime option shows: the true number
 * of free seats, the next seat's price, and when this member's window opens.
 * Read-only and clock-free: the browser compares `eligibleFrom` with its own
 * clock for display, and checkout (S3) checks again with the server clock.
 * Signed-in members only. No owner, order, cohort or Stripe id.
 *
 * The option stays hidden while `open` is false (seats not seeded) or
 * `eligibleFrom` is null (no window dated for this member yet).
 */
export const ladder = query({
  args: {},
  returns: v.object({
    open: v.boolean(),
    seatsTotal: v.number(),
    seatsLeft: v.number(),
    /** Held by an unfinished checkout. They come back if it expires. */
    seatsHeld: v.number(),
    nextSeatAmountMinor: v.union(v.number(), v.null()),
    eligibleFrom: v.union(v.number(), v.null()),
  }),
  handler: async (ctx) => {
    const user = await requireCurrentPlatformUser(ctx);
    const [seats, eligibleFrom] = await Promise.all([readSeatOffer(ctx), readFoundingEligibleFrom(ctx, user)]);
    return { ...seats, eligibleFrom };
  },
});
