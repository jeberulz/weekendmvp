import { HOUR, MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { ConvexError, v, type Infer } from "convex/values";
import { components } from "../../_generated/api";
import type { Doc } from "../../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../../_generated/server";
import { requireCurrentPlatformUserForMutation } from "../authz";
import { PRICING, lifetimeTrancheForSeat, type PriceKey } from "../plans";
import { assertFoundingEligible } from "./offer";
import { MEMBERSHIP_SCAN_CAP, readMembershipState } from "./state";
import { membershipTermValidator, priceKeyValidator } from "./validators";

/**
 * WP64-S3. Opens a membership order for the signed-in member, and for
 * Founding Lifetime reserves the lowest free seat, all in one mutation so two
 * buyers can never hold the same seat (frozen contract 8). Reached only
 * through the signed bridge (`provider.ts`), which forwards the member's own
 * auth, so the owner always comes from the session and never from input.
 *
 * Refusals return `{ ok: false, code }` before any write. The route turns the
 * order into a Stripe Checkout Session and attaches it with `attachSession`.
 */

/** A seat is held this long. */
export const RESERVATION_MS = 35 * 60 * 1000;
/**
 * The lifetime session closes this much sooner than the hold, so Stripe can
 * never take a payment for a seat the hold has released. 35 minus 4 leaves 31
 * minutes, above Stripe's 30-minute minimum with a minute for the trip there.
 */
export const SESSION_GRACE_MS = 4 * 60 * 1000;
/**
 * A lapsed hold is reclaimed by the clock only this long after it lapses.
 * Stripe's `checkout.session.expired` frees an abandoned seat at once, so the
 * clock is the fallback, and the wait gives a payment whose webhook is
 * delayed (an outage, Stripe retries) time to settle before the seat moves.
 */
export const LAPSED_HOLD_GRACE_MS = 30 * 60 * 1000;
/** Stripe forgets an idempotency key after 24 hours, so an older order is never replayed. */
const REPLAY_WINDOW_MS = 23 * 60 * 60 * 1000;
/** Stripe sessions last at most 24 hours, so older pending orders have no live session. */
const OPEN_ORDER_WINDOW_MS = 24 * 60 * 60 * 1000;
const OPEN_ORDER_READ = 10;
const CUSTOMER_READ = 5;
/** Same rule as `IDEMPOTENCY_KEY_PATTERN` in `app/api/platform/membership/_contract.ts`. */
const IDEMPOTENCY_KEY = /^[A-Za-z0-9_:-]{16,80}$/;

const rateLimiter = new RateLimiter(components.rateLimiter, {
  membershipCheckoutBurst: { kind: "token bucket", rate: 5, period: MINUTE },
  membershipCheckoutSustained: { kind: "token bucket", rate: 20, period: HOUR },
});

/** The route contract's codes (`MEMBERSHIP_ERROR_CODES`); a test keeps them equal. */
export const CHECKOUT_REFUSAL_CODES = [
  "AUTHENTICATION_REQUIRED",
  "EMAIL_NOT_VERIFIED",
  "ACCOUNT_REVIEW",
  "SOLD_OUT",
  "ALREADY_SUBSCRIBED",
  "NOT_YET_ELIGIBLE",
  "RATE_LIMITED",
  "INVALID_REQUEST",
  "BILLING_UNAVAILABLE",
] as const;
type RefusalCode = (typeof CHECKOUT_REFUSAL_CODES)[number];

export const checkoutRefusalValidator = v.object({
  ok: v.literal(false),
  code: v.union(
    v.literal("AUTHENTICATION_REQUIRED"),
    v.literal("EMAIL_NOT_VERIFIED"),
    v.literal("ACCOUNT_REVIEW"),
    v.literal("SOLD_OUT"),
    v.literal("ALREADY_SUBSCRIBED"),
    v.literal("NOT_YET_ELIGIBLE"),
    v.literal("RATE_LIMITED"),
    v.literal("INVALID_REQUEST"),
    v.literal("BILLING_UNAVAILABLE"),
  ),
  opensAt: v.optional(v.number()),
});

export const openedOrderValidator = v.object({
  ok: v.literal(true),
  orderId: v.id("membership_orders"),
  term: membershipTermValidator,
  priceKey: priceKeyValidator,
  seatNumber: v.union(v.number(), v.null()),
  /** Lifetime only: when the Checkout Session must close, in milliseconds. */
  sessionExpiresAt: v.union(v.number(), v.null()),
  checkoutSessionId: v.union(v.string(), v.null()),
  stripeCustomerId: v.union(v.string(), v.null()),
  /** The verified account email, to prefill Checkout. Never logged. */
  email: v.string(),
  /** Other open Checkout Sessions of this member, for the route to expire. */
  supersede: v.array(v.string()),
});

type Refusal = Infer<typeof checkoutRefusalValidator>;
type Opened = Infer<typeof openedOrderValidator>;
type Member = Doc<"users"> & { email: string };
type Order = Doc<"membership_orders">;
type Seat = Doc<"founding_seats">;

const refuse = (code: RefusalCode, opensAt?: number): Refusal =>
  opensAt === undefined ? { ok: false, code } : { ok: false, code, opensAt };

async function stripeCustomerFor(ctx: MutationCtx, member: Member, livemode: boolean): Promise<string | null> {
  const customers = await ctx.db
    .query("billing_customers")
    .withIndex("by_ownerId", (q) => q.eq("ownerId", member._id))
    .take(CUSTOMER_READ);
  return customers.find((customer) => customer.livemode === livemode)?.stripeCustomerId ?? null;
}

/** Sessions of this member's other open orders in the same mode. */
async function openSessions(ctx: MutationCtx, member: Member, livemode: boolean, now: number): Promise<string[]> {
  const pending = await ctx.db
    .query("membership_orders")
    .withIndex("by_ownerId_and_status_and_createdAt", (q) =>
      q.eq("ownerId", member._id).eq("status", "pending").gte("createdAt", now - OPEN_ORDER_WINDOW_MS),
    )
    .order("desc")
    .take(OPEN_ORDER_READ);
  return pending.flatMap((order) =>
    order.livemode === livemode && order.stripeCheckoutSessionId ? [order.stripeCheckoutSessionId] : [],
  );
}

async function opened(
  ctx: MutationCtx,
  member: Member,
  order: Order,
  seat: Seat | null,
  supersede: string[],
): Promise<Opened> {
  return {
    ok: true,
    orderId: order._id,
    term: order.term,
    priceKey: order.priceKey,
    seatNumber: seat?.seatNumber ?? null,
    sessionExpiresAt: seat?.reservedUntil === undefined ? null : seat.reservedUntil - SESSION_GRACE_MS,
    checkoutSessionId: order.stripeCheckoutSessionId ?? null,
    stripeCustomerId: await stripeCustomerFor(ctx, member, order.livemode),
    email: member.email,
    supersede,
  };
}

/** The same key again: the same order, or a refusal when it can no longer pay. */
async function replay(
  ctx: MutationCtx,
  member: Member,
  order: Order,
  args: { term: Order["term"]; livemode: boolean },
  now: number,
): Promise<Opened | Refusal> {
  if (order.term !== args.term || order.livemode !== args.livemode) return refuse("INVALID_REQUEST");
  if (order.status === "paid") return refuse("ALREADY_SUBSCRIBED");
  if (order.status !== "pending" || now - order.createdAt > REPLAY_WINDOW_MS) return refuse("INVALID_REQUEST");
  if (order.term !== "lifetime") return await opened(ctx, member, order, null, []);
  const seat =
    order.seatNumber === undefined
      ? null
      : await ctx.db
          .query("founding_seats")
          .withIndex("by_seatNumber", (q) => q.eq("seatNumber", order.seatNumber as number))
          .unique();
  const held = seat !== null && seat.status === "reserved" && seat.orderId === order._id && (seat.reservedUntil ?? 0) > now;
  return held ? await opened(ctx, member, order, seat, []) : refuse("INVALID_REQUEST");
}

/** Counts a checkout attempt. Its own committed step, so a refused attempt still counts. */
export const consumeQuota = internalMutation({
  args: {},
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx) => {
    const member = await requireCurrentPlatformUserForMutation(ctx);
    const burst = await rateLimiter.limit(ctx, "membershipCheckoutBurst", { key: member._id });
    if (!burst.ok) return { ok: false };
    const sustained = await rateLimiter.limit(ctx, "membershipCheckoutSustained", { key: member._id });
    return { ok: sustained.ok };
  },
});

export const begin = internalMutation({
  args: { term: membershipTermValidator, idempotencyKey: v.string(), livemode: v.boolean() },
  returns: v.union(openedOrderValidator, checkoutRefusalValidator),
  handler: async (ctx, args): Promise<Opened | Refusal> => {
    const user = await requireCurrentPlatformUserForMutation(ctx);
    if (!IDEMPOTENCY_KEY.test(args.idempotencyKey)) return refuse("INVALID_REQUEST");
    if (!user.email || user.emailVerificationTime === undefined) return refuse("EMAIL_NOT_VERIFIED");
    const member = user as Member;
    const now = Date.now();

    const grants = await ctx.db
      .query("plan_grants")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", member._id))
      .order("desc")
      .take(MEMBERSHIP_SCAN_CAP);
    // O9: a dispute, open or lost, flags the account until the owner clears it
    // (`membership/events:clearReview`).
    if (grants.some((grant) => grant.revokeReason === "dispute_lost" || (grant.revokedAt === undefined && grant.suspendedAt !== undefined))) {
      return refuse("ACCOUNT_REVIEW");
    }
    const subscriptions = await ctx.db
      .query("plan_subscriptions")
      .withIndex("by_ownerId_and_updatedAt", (q) => q.eq("ownerId", member._id))
      .order("desc")
      .take(MEMBERSHIP_SCAN_CAP);
    if (subscriptions.some((row) => row.disputedAt !== undefined)) return refuse("ACCOUNT_REVIEW");

    const existing = await ctx.db
      .query("membership_orders")
      .withIndex("by_ownerId_and_idempotencyKey", (q) =>
        q.eq("ownerId", member._id).eq("idempotencyKey", args.idempotencyKey),
      )
      .unique();
    if (existing) return await replay(ctx, member, existing, args, now);

    let priceKey: PriceKey;
    let seat: Seat | null = null;
    if (args.term !== "lifetime") {
      // One subscription or grant per member. A comp or lifetime member already has the plan.
      if ((await readMembershipState(ctx, member._id)).plan === "builders_hub") return refuse("ALREADY_SUBSCRIBED");
      priceKey = args.term;
    } else {
      // O5: a subscriber may buy lifetime; S4 sets the subscription to end at period end.
      if (grants.some((grant) => grant.kind === "lifetime" && grant.revokedAt === undefined)) {
        return refuse("ALREADY_SUBSCRIBED");
      }
      try {
        await assertFoundingEligible(ctx, member, now);
      } catch (error) {
        if (error instanceof ConvexError && error.data?.code === "NOT_YET_ELIGIBLE") {
          return refuse("NOT_YET_ELIGIBLE", typeof error.data.opensAt === "number" ? error.data.opensAt : undefined);
        }
        throw error;
      }

      const reserved = await ctx.db
        .query("founding_seats")
        .withIndex("by_status_and_seatNumber", (q) => q.eq("status", "reserved"))
        .take(PRICING.lifetime.seats);
      // One open reservation per member: a second attempt continues the first.
      const held = reserved.find(
        (row) => row.ownerId === member._id && row.orderId !== undefined && (row.reservedUntil ?? 0) > now,
      );
      if (held?.orderId) {
        const order = await ctx.db.get("membership_orders", held.orderId);
        if (order && order.status === "pending" && order.livemode === args.livemode) {
          return await opened(ctx, member, order, held, []);
        }
      }

      const free = await ctx.db
        .query("founding_seats")
        .withIndex("by_status_and_seatNumber", (q) => q.eq("status", "free"))
        .first();
      const lapsed = reserved.find((row) => (row.reservedUntil ?? 0) <= now - LAPSED_HOLD_GRACE_MS) ?? null;
      seat = free && (!lapsed || free.seatNumber < lapsed.seatNumber) ? free : lapsed;
      // An unseeded or full table is sold out. Checkout fails closed.
      const tranche = seat ? lifetimeTrancheForSeat(seat.seatNumber) : null;
      if (!seat || !tranche) return refuse("SOLD_OUT");
      if (seat.status === "reserved" && seat.orderId) {
        const lapsedOrder = await ctx.db.get("membership_orders", seat.orderId);
        if (lapsedOrder?.status === "pending") {
          await ctx.db.patch("membership_orders", lapsedOrder._id, { status: "expired", updatedAt: now });
        }
      }
      priceKey = tranche.priceKey;
    }

    const supersede = await openSessions(ctx, member, args.livemode, now);
    const orderId = await ctx.db.insert("membership_orders", {
      ownerId: member._id,
      term: args.term,
      priceKey,
      status: "pending",
      idempotencyKey: args.idempotencyKey,
      ...(seat ? { seatNumber: seat.seatNumber } : {}),
      createdAt: now,
      updatedAt: now,
      livemode: args.livemode,
    });
    if (seat) {
      await ctx.db.patch("founding_seats", seat._id, {
        status: "reserved",
        ownerId: member._id,
        orderId,
        reservedUntil: now + RESERVATION_MS,
        updatedAt: now,
      });
    }
    const order = await ctx.db.get("membership_orders", orderId);
    const heldSeat = seat ? await ctx.db.get("founding_seats", seat._id) : null;
    if (!order) throw new ConvexError({ code: "BILLING_UNAVAILABLE" });
    return await opened(ctx, member, order, heldSeat, supersede);
  },
});

/** Records the Checkout Session the route created for the member's own pending order. */
export const attachSession = internalMutation({
  args: { orderId: v.id("membership_orders"), checkoutSessionId: v.string() },
  returns: v.object({ attached: v.boolean() }),
  handler: async (ctx, args) => {
    const member = await requireCurrentPlatformUserForMutation(ctx);
    const order = await ctx.db.get("membership_orders", args.orderId);
    if (!order || order.ownerId !== member._id) throw new ConvexError({ code: "INVALID_REQUEST" });
    const mode = order.livemode ? /^cs_live_[A-Za-z0-9_]+$/ : /^cs_test_[A-Za-z0-9_]+$/;
    if (!mode.test(args.checkoutSessionId)) throw new ConvexError({ code: "INVALID_REQUEST" });
    if (order.stripeCheckoutSessionId && order.stripeCheckoutSessionId !== args.checkoutSessionId) {
      throw new ConvexError({ code: "CHECKOUT_SESSION_CONFLICT" });
    }
    if (order.status !== "pending") return { attached: false };
    if (!order.stripeCheckoutSessionId) {
      await ctx.db.patch("membership_orders", order._id, {
        stripeCheckoutSessionId: args.checkoutSessionId,
        updatedAt: Date.now(),
      });
    }
    return { attached: true };
  },
});
