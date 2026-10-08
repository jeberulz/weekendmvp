import { ConvexError, v } from "convex/values";
import { internalMutation } from "../../_generated/server";
import { PRICING } from "../plans";

/**
 * WP63-S2. Operator-only seed for the 50 founding seats (frozen contract 8).
 * Dry run unless `apply` is true. Idempotent: it inserts missing seat numbers
 * as free and never changes an existing row, so a re-run cannot free a
 * reserved or taken seat. Production runs it once, in S12, with the owner's
 * go-ahead:
 *
 *   npx convex run platform/membership/seats:seed '{}'
 *   npx convex run platform/membership/seats:seed '{"apply":true}'
 */
export const seed = internalMutation({
  args: { apply: v.optional(v.boolean()) },
  returns: v.object({
    applied: v.boolean(),
    existing: v.number(),
    created: v.number(),
    missing: v.number(),
  }),
  handler: async (ctx, args) => {
    const seats = PRICING.lifetime.seats;
    const rows = await ctx.db.query("founding_seats").withIndex("by_seatNumber").take(seats + 1);
    if (rows.length > seats) throw new ConvexError({ code: "SEAT_TABLE_OVERFLOW" });

    const present = new Set<number>();
    for (const row of rows) {
      const valid = Number.isInteger(row.seatNumber) && row.seatNumber >= 1 && row.seatNumber <= seats;
      if (!valid || present.has(row.seatNumber)) throw new ConvexError({ code: "SEAT_TABLE_INVALID" });
      present.add(row.seatNumber);
    }

    const missing: number[] = [];
    for (let seatNumber = 1; seatNumber <= seats; seatNumber += 1) {
      if (!present.has(seatNumber)) missing.push(seatNumber);
    }
    if (args.apply !== true) {
      return { applied: false, existing: rows.length, created: 0, missing: missing.length };
    }

    const now = Date.now();
    for (const seatNumber of missing) {
      await ctx.db.insert("founding_seats", { seatNumber, status: "free", updatedAt: now });
    }
    return { applied: true, existing: rows.length, created: missing.length, missing: 0 };
  },
});
