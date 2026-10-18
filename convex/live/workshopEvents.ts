import { v } from "convex/values";
import { internalMutation, type MutationCtx } from "../_generated/server";
import {
  DEFAULT_EVENT_KEY,
  LAPSED_HOLD_GRACE_MS,
  SEATS_TOTAL,
  refreshCount,
  type Order,
} from "./workshopCheckout";

async function freeSeat(ctx: MutationCtx, order: Order, now: number) {
  if (order.seatNumber === undefined) return;
  const seat = await ctx.db
    .query("workshop_seats")
    .withIndex("by_eventKey_and_seatNumber", (q) =>
      q.eq("eventKey", order.eventKey).eq("seatNumber", order.seatNumber!),
    )
    .unique();
  if (!seat || seat.orderId !== order._id || seat.status === "free") return;
  await ctx.db.patch(seat._id, {
    status: "free",
    ownerId: undefined,
    orderId: undefined,
    reservedUntil: undefined,
    updatedAt: now,
  });
}

export const markPaid = internalMutation({
  args: {
    checkoutSessionId: v.string(),
    stripeEventId: v.string(),
    priceId: v.optional(v.string()),
  },
  returns: v.object({
    duplicate: v.boolean(),
    sold: v.number(),
    soldOut: v.boolean(),
    orderId: v.optional(v.id("workshop_orders")),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const order = await ctx.db
      .query("workshop_orders")
      .withIndex("by_stripeCheckoutSessionId", (q) =>
        q.eq("stripeCheckoutSessionId", args.checkoutSessionId),
      )
      .unique();
    if (!order) {
      return { duplicate: false, sold: 0, soldOut: false };
    }
    if (order.status === "paid") {
      const count = await ctx.db
        .query("workshop_seat_counts")
        .withIndex("by_eventKey", (q) => q.eq("eventKey", order.eventKey))
        .unique();
      return {
        duplicate: true,
        sold: count?.sold ?? 0,
        soldOut: (count?.sold ?? 0) >= SEATS_TOTAL,
        orderId: order._id,
      };
    }

    if (order.seatNumber !== undefined) {
      const seat = await ctx.db
        .query("workshop_seats")
        .withIndex("by_eventKey_and_seatNumber", (q) =>
          q.eq("eventKey", order.eventKey).eq("seatNumber", order.seatNumber!),
        )
        .unique();
      const ours =
        seat !== null &&
        (seat.status === "free" ||
          (seat.status === "reserved" && seat.orderId === order._id));
      if (seat && ours) {
        await ctx.db.patch(seat._id, {
          status: "taken",
          ownerId: order.ownerId,
          orderId: order._id,
          reservedUntil: undefined,
          updatedAt: now,
        });
      }
    }

    await ctx.db.patch(order._id, {
      status: "paid",
      priceId: args.priceId ?? order.priceId,
      updatedAt: now,
    });
    const tallied = await refreshCount(ctx, order.eventKey, now);
    return {
      duplicate: false,
      sold: tallied.sold,
      soldOut: tallied.sold >= SEATS_TOTAL,
      orderId: order._id,
    };
  },
});

export const markExpired = internalMutation({
  args: { checkoutSessionId: v.string() },
  returns: v.object({ freed: v.boolean() }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const order = await ctx.db
      .query("workshop_orders")
      .withIndex("by_stripeCheckoutSessionId", (q) =>
        q.eq("stripeCheckoutSessionId", args.checkoutSessionId),
      )
      .unique();
    if (!order || order.status !== "pending") return { freed: false };
    await freeSeat(ctx, order, now);
    await ctx.db.patch(order._id, { status: "expired", updatedAt: now });
    await refreshCount(ctx, order.eventKey, now);
    return { freed: true };
  },
});

export const markRefunded = internalMutation({
  args: { checkoutSessionId: v.string(), stripeEventId: v.string() },
  returns: v.object({ freed: v.boolean() }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const order = await ctx.db
      .query("workshop_orders")
      .withIndex("by_stripeCheckoutSessionId", (q) =>
        q.eq("stripeCheckoutSessionId", args.checkoutSessionId),
      )
      .unique();
    if (!order || order.status === "refunded") return { freed: false };
    await freeSeat(ctx, order, now);
    await ctx.db.patch(order._id, { status: "refunded", updatedAt: now });
    await refreshCount(ctx, order.eventKey, now);
    return { freed: true };
  },
});

/** Daily reconcile: free lapsed reserved seats + expire their pending orders. */
export const releaseExpiredHolds = internalMutation({
  args: { eventKey: v.optional(v.string()) },
  returns: v.object({ released: v.number() }),
  handler: async (ctx, args) => {
    const eventKey = args.eventKey ?? DEFAULT_EVENT_KEY;
    const now = Date.now();
    const reserved = await ctx.db
      .query("workshop_seats")
      .withIndex("by_eventKey_and_status_and_seatNumber", (q) =>
        q.eq("eventKey", eventKey).eq("status", "reserved"),
      )
      .take(SEATS_TOTAL);
    let released = 0;
    for (const seat of reserved) {
      if ((seat.reservedUntil ?? 0) > now - LAPSED_HOLD_GRACE_MS) continue;
      if (seat.orderId) {
        const order = await ctx.db.get(seat.orderId);
        if (order && order.status === "pending") {
          await ctx.db.patch(order._id, { status: "expired", updatedAt: now });
        }
      }
      await ctx.db.patch(seat._id, {
        status: "free",
        ownerId: undefined,
        orderId: undefined,
        reservedUntil: undefined,
        updatedAt: now,
      });
      released += 1;
    }
    if (released > 0) await refreshCount(ctx, eventKey, now);
    return { released };
  },
});
