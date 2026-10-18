import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { requireCurrentPlatformUserForMutation } from "../platform/authz";

/** Hold length — matches founding seats. */
export const RESERVATION_MS = 35 * 60 * 1000;
/** Stripe session expires this much sooner than the hold (≈31 min). */
export const SESSION_GRACE_MS = 4 * 60 * 1000;
/** Clock reclaim only after hold + this grace (delayed webhook room). */
export const LAPSED_HOLD_GRACE_MS = 30 * 60 * 1000;

export const SEATS_TOTAL = 20;
export const DEFAULT_EVENT_KEY = "build-along-2026-11-14";

const IDEMPOTENCY_KEY = /^[A-Za-z0-9_:-]{16,80}$/;

type Seat = Doc<"workshop_seats">;
type Order = Doc<"workshop_orders">;

async function refreshCount(ctx: MutationCtx, eventKey: string, now: number) {
  const rows = await ctx.db
    .query("workshop_seats")
    .withIndex("by_eventKey_and_status_and_seatNumber", (q) => q.eq("eventKey", eventKey))
    .take(SEATS_TOTAL);
  let free = 0;
  let reserved = 0;
  let sold = 0;
  for (const row of rows) {
    if (row.status === "free") free += 1;
    else if (row.status === "reserved") reserved += 1;
    else sold += 1;
  }
  const existing = await ctx.db
    .query("workshop_seat_counts")
    .withIndex("by_eventKey", (q) => q.eq("eventKey", eventKey))
    .unique();
  if (existing) {
    await ctx.db.patch(existing._id, { free, reserved, sold, updatedAt: now });
  } else {
    await ctx.db.insert("workshop_seat_counts", {
      eventKey,
      free,
      reserved,
      sold,
      updatedAt: now,
    });
  }
  return { free, reserved, sold };
}

/** Idempotent seed of 20 free seats + count row. */
export const seedSeats = internalMutation({
  args: { eventKey: v.optional(v.string()), apply: v.optional(v.boolean()) },
  returns: v.object({ created: v.number(), already: v.number() }),
  handler: async (ctx, args) => {
    const eventKey = args.eventKey ?? DEFAULT_EVENT_KEY;
    const apply = args.apply === true;
    let created = 0;
    let already = 0;
    const now = Date.now();
    for (let n = 1; n <= SEATS_TOTAL; n += 1) {
      const existing = await ctx.db
        .query("workshop_seats")
        .withIndex("by_eventKey_and_seatNumber", (q) =>
          q.eq("eventKey", eventKey).eq("seatNumber", n),
        )
        .unique();
      if (existing) {
        already += 1;
        continue;
      }
      created += 1;
      if (apply) {
        await ctx.db.insert("workshop_seats", {
          eventKey,
          seatNumber: n,
          status: "free",
          updatedAt: now,
        });
      }
    }
    if (apply) await refreshCount(ctx, eventKey, now);
    return { created, already };
  },
});

const openedValidator = v.object({
  ok: v.literal(true),
  orderId: v.id("workshop_orders"),
  seatNumber: v.number(),
  reservedUntil: v.number(),
  sessionExpiresAt: v.number(),
  email: v.string(),
  checkoutSessionId: v.optional(v.string()),
});

const refusalValidator = v.object({
  ok: v.literal(false),
  code: v.union(
    v.literal("AUTHENTICATION_REQUIRED"),
    v.literal("EMAIL_NOT_VERIFIED"),
    v.literal("SOLD_OUT"),
    v.literal("ALREADY_PAID"),
    v.literal("INVALID_REQUEST"),
  ),
});

/**
 * Reserve a seat and open a pending order for the signed-in member.
 * Reached only through the signed workshop bridge.
 */
export const begin = internalMutation({
  args: {
    eventKey: v.string(),
    lookupKey: v.string(),
    idempotencyKey: v.string(),
    livemode: v.boolean(),
  },
  returns: v.union(openedValidator, refusalValidator),
  handler: async (ctx, args) => {
    let member;
    try {
      member = await requireCurrentPlatformUserForMutation(ctx);
    } catch {
      return { ok: false as const, code: "AUTHENTICATION_REQUIRED" as const };
    }
    if (!member.emailVerificationTime) {
      return { ok: false as const, code: "EMAIL_NOT_VERIFIED" as const };
    }
    const email = (member.email ?? "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return { ok: false as const, code: "INVALID_REQUEST" as const };
    }
    if (!IDEMPOTENCY_KEY.test(args.idempotencyKey)) {
      return { ok: false as const, code: "INVALID_REQUEST" as const };
    }

    const now = Date.now();

    const paid = await ctx.db
      .query("workshop_orders")
      .withIndex("by_ownerId_and_status", (q) =>
        q.eq("ownerId", member._id).eq("status", "paid"),
      )
      .first();
    if (paid && paid.eventKey === args.eventKey) {
      return { ok: false as const, code: "ALREADY_PAID" as const };
    }

    const prior = await ctx.db
      .query("workshop_orders")
      .withIndex("by_ownerId_and_idempotencyKey", (q) =>
        q.eq("ownerId", member._id).eq("idempotencyKey", args.idempotencyKey),
      )
      .unique();
    if (prior && prior.status === "pending" && prior.seatNumber !== undefined) {
      const seat = await seatByNumber(ctx, args.eventKey, prior.seatNumber);
      if (seat && seat.status === "reserved" && (seat.reservedUntil ?? 0) > now) {
        // Renew the hold so Checkout Session expires_at stays ≥ ~31 minutes
        // (Stripe rejects anything under 30 minutes from now).
        const reservedUntil = now + RESERVATION_MS;
        await ctx.db.patch(seat._id, { reservedUntil, updatedAt: now });
        await ctx.db.patch(prior._id, {
          lookupKey: args.lookupKey,
          updatedAt: now,
        });
        return {
          ok: true as const,
          orderId: prior._id,
          seatNumber: prior.seatNumber,
          reservedUntil,
          sessionExpiresAt: reservedUntil - SESSION_GRACE_MS,
          email,
          checkoutSessionId: prior.stripeCheckoutSessionId,
        };
      }
    }

    // Reuse this member's live hold if any (fresh Stripe session still created by Next).
    const reservedMine = await findReservedForOwner(ctx, args.eventKey, member._id, now);
    if (reservedMine) {
      const orderId = reservedMine.orderId!;
      const order = await ctx.db.get(orderId);
      if (order && order.status === "pending") {
        const reservedUntil = now + RESERVATION_MS;
        await ctx.db.patch(reservedMine._id, { reservedUntil, updatedAt: now });
        await ctx.db.patch(order._id, {
          lookupKey: args.lookupKey,
          idempotencyKey: args.idempotencyKey,
          updatedAt: now,
        });
        return {
          ok: true as const,
          orderId: order._id,
          seatNumber: reservedMine.seatNumber,
          reservedUntil,
          sessionExpiresAt: reservedUntil - SESSION_GRACE_MS,
          email,
          checkoutSessionId: order.stripeCheckoutSessionId,
        };
      }
    }

    // Drop stale pending rows (hold already lapsed) so Continue can open a new hold.
    await expireStalePending(ctx, args.eventKey, member._id, now);

    const seat = await pickSeat(ctx, args.eventKey, now);
    if (!seat) return { ok: false as const, code: "SOLD_OUT" as const };

    if (seat.status === "reserved" && seat.orderId) {
      const old = await ctx.db.get(seat.orderId);
      if (old && old.status === "pending") {
        await ctx.db.patch(old._id, { status: "expired", updatedAt: now });
      }
    }

    const orderId = await ctx.db.insert("workshop_orders", {
      eventKey: args.eventKey,
      ownerId: member._id,
      status: "pending",
      seatNumber: seat.seatNumber,
      lookupKey: args.lookupKey,
      idempotencyKey: args.idempotencyKey,
      livemode: args.livemode,
      createdAt: now,
      updatedAt: now,
    });

    const reservedUntil = now + RESERVATION_MS;
    await ctx.db.patch(seat._id, {
      status: "reserved",
      ownerId: member._id,
      orderId,
      reservedUntil,
      updatedAt: now,
    });
    await refreshCount(ctx, args.eventKey, now);

    return {
      ok: true as const,
      orderId,
      seatNumber: seat.seatNumber,
      reservedUntil,
      sessionExpiresAt: reservedUntil - SESSION_GRACE_MS,
      email,
      checkoutSessionId: undefined,
    };
  },
});

export const attachSession = internalMutation({
  args: {
    orderId: v.id("workshop_orders"),
    checkoutSessionId: v.string(),
    priceId: v.optional(v.string()),
  },
  returns: v.object({ attached: v.boolean() }),
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order || order.status !== "pending") return { attached: false };
    await ctx.db.patch(order._id, {
      stripeCheckoutSessionId: args.checkoutSessionId,
      priceId: args.priceId ?? order.priceId,
      updatedAt: Date.now(),
    });
    return { attached: true };
  },
});

async function seatByNumber(
  ctx: MutationCtx,
  eventKey: string,
  seatNumber: number,
): Promise<Seat | null> {
  return await ctx.db
    .query("workshop_seats")
    .withIndex("by_eventKey_and_seatNumber", (q) =>
      q.eq("eventKey", eventKey).eq("seatNumber", seatNumber),
    )
    .unique();
}

async function findReservedForOwner(
  ctx: MutationCtx,
  eventKey: string,
  ownerId: Id<"users">,
  now: number,
): Promise<Seat | null> {
  const reserved = await ctx.db
    .query("workshop_seats")
    .withIndex("by_eventKey_and_status_and_seatNumber", (q) =>
      q.eq("eventKey", eventKey).eq("status", "reserved"),
    )
    .take(SEATS_TOTAL);
  return (
    reserved.find(
      (row) => row.ownerId === ownerId && (row.reservedUntil ?? 0) > now,
    ) ?? null
  );
}

async function expireStalePending(
  ctx: MutationCtx,
  eventKey: string,
  ownerId: Id<"users">,
  now: number,
) {
  const pending = await ctx.db
    .query("workshop_orders")
    .withIndex("by_ownerId_and_status", (q) =>
      q.eq("ownerId", ownerId).eq("status", "pending"),
    )
    .take(10);
  for (const order of pending) {
    if (order.eventKey !== eventKey) continue;
    if (order.seatNumber !== undefined) {
      const seat = await seatByNumber(ctx, eventKey, order.seatNumber);
      if (
        seat &&
        seat.status === "reserved" &&
        seat.orderId === order._id &&
        (seat.reservedUntil ?? 0) > now
      ) {
        continue;
      }
      if (seat && seat.orderId === order._id && seat.status === "reserved") {
        await ctx.db.patch(seat._id, {
          status: "free",
          ownerId: undefined,
          orderId: undefined,
          reservedUntil: undefined,
          updatedAt: now,
        });
      }
    }
    await ctx.db.patch(order._id, { status: "expired", updatedAt: now });
  }
}

async function pickSeat(
  ctx: MutationCtx,
  eventKey: string,
  now: number,
): Promise<Seat | null> {
  const free = await ctx.db
    .query("workshop_seats")
    .withIndex("by_eventKey_and_status_and_seatNumber", (q) =>
      q.eq("eventKey", eventKey).eq("status", "free"),
    )
    .first();
  const reserved = await ctx.db
    .query("workshop_seats")
    .withIndex("by_eventKey_and_status_and_seatNumber", (q) =>
      q.eq("eventKey", eventKey).eq("status", "reserved"),
    )
    .take(SEATS_TOTAL);
  const lapsed =
    reserved.find((row) => (row.reservedUntil ?? 0) <= now - LAPSED_HOLD_GRACE_MS) ??
    null;
  if (free && (!lapsed || free.seatNumber < lapsed.seatNumber)) return free;
  return lapsed;
}

export { refreshCount };
export type { Order, Seat };
