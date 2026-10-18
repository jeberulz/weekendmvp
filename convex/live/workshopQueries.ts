import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireCurrentPlatformUser } from "../platform/authz";
import { DEFAULT_EVENT_KEY, SEATS_TOTAL } from "./workshopCheckout";

/** Sat 14 Nov 2026 15:00 GMT — keep in sync with lib/live/config BUILD_ALONG.startAt. */
const SESSION_STARTS_AT = Date.parse("2026-11-14T15:00:00.000Z");

/**
 * Public seat tally — one document read. Pages should wrap this in a tagged
 * Next cache; do not subscribe from the client.
 */
export const seatCount = query({
  args: { eventKey: v.optional(v.string()) },
  returns: v.union(
    v.null(),
    v.object({
      sold: v.number(),
      reserved: v.number(),
      free: v.number(),
      left: v.number(),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const eventKey = args.eventKey ?? DEFAULT_EVENT_KEY;
    const row = await ctx.db
      .query("workshop_seat_counts")
      .withIndex("by_eventKey", (q) => q.eq("eventKey", eventKey))
      .unique();
    if (!row) return null;
    // Available to buy = free seats (holds reduce left until they lapse).
    const left = Math.max(0, Math.min(SEATS_TOTAL, row.free));
    return {
      sold: row.sold,
      reserved: row.reserved,
      free: row.free,
      left,
      updatedAt: row.updatedAt,
    };
  },
});

/**
 * One small dashboard query: workshop status for the signed-in user.
 * none | pending (abandoned hold) | paid. Also returns seats left.
 * No live subscription — call once on dashboard load.
 */
export const myStatus = query({
  args: { eventKey: v.optional(v.string()), nowMs: v.number() },
  returns: v.object({
    kind: v.union(v.literal("none"), v.literal("pending"), v.literal("paid")),
    seatsLeft: v.union(v.null(), v.number()),
    seatNumber: v.optional(v.number()),
    sessionStartsAt: v.number(),
    orderId: v.optional(v.id("workshop_orders")),
  }),
  handler: async (ctx, args) => {
    const eventKey = args.eventKey ?? DEFAULT_EVENT_KEY;
    const count = await ctx.db
      .query("workshop_seat_counts")
      .withIndex("by_eventKey", (q) => q.eq("eventKey", eventKey))
      .unique();
    const seatsLeft = count ? Math.max(0, Math.min(SEATS_TOTAL, count.free)) : null;

    let member;
    try {
      member = await requireCurrentPlatformUser(ctx);
    } catch {
      return {
        kind: "none" as const,
        seatsLeft,
        sessionStartsAt: SESSION_STARTS_AT,
      };
    }

    const paid = await ctx.db
      .query("workshop_orders")
      .withIndex("by_ownerId_and_status", (q) =>
        q.eq("ownerId", member._id).eq("status", "paid"),
      )
      .first();
    if (paid && paid.eventKey === eventKey) {
      return {
        kind: "paid" as const,
        seatsLeft,
        seatNumber: paid.seatNumber,
        sessionStartsAt: SESSION_STARTS_AT,
        orderId: paid._id,
      };
    }

    const pending = await ctx.db
      .query("workshop_orders")
      .withIndex("by_ownerId_and_status", (q) =>
        q.eq("ownerId", member._id).eq("status", "pending"),
      )
      .first();
    if (pending && pending.eventKey === eventKey) {
      return {
        kind: "pending" as const,
        seatsLeft,
        seatNumber: pending.seatNumber,
        sessionStartsAt: SESSION_STARTS_AT,
        orderId: pending._id,
      };
    }

    return {
      kind: "none" as const,
      seatsLeft,
      sessionStartsAt: SESSION_STARTS_AT,
    };
  },
});
