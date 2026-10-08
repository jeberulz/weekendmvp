import { v } from "convex/values";
import { query } from "../../_generated/server";
import { requireCurrentPlatformUser } from "../authz";
import { PRICING, lifetimeTrancheForSeat } from "../plans";
import { countSeats } from "./state";

/**
 * WP63-S6. What the Founding Lifetime option shows: the true number of free
 * seats and the price of the next one. Read-only and clock-free. Signed-in
 * members only, like every dashboard read. No owner, order or Stripe id.
 *
 * `open` is false until the operator seeds the seats (S12), and the option
 * stays hidden until then.
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
  }),
  handler: async (ctx) => {
    await requireCurrentPlatformUser(ctx);
    const [counts, nextFree] = await Promise.all([
      countSeats(ctx),
      ctx.db
        .query("founding_seats")
        .withIndex("by_status_and_seatNumber", (q) => q.eq("status", "free"))
        .first(),
    ]);
    const tranche = nextFree ? lifetimeTrancheForSeat(nextFree.seatNumber) : null;
    return {
      open: counts.free + counts.reserved + counts.taken > 0,
      seatsTotal: PRICING.lifetime.seats,
      seatsLeft: counts.free,
      seatsHeld: counts.reserved,
      nextSeatAmountMinor: tranche?.amountMinor ?? null,
    };
  },
});
