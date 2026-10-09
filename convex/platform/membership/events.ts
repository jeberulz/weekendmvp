import { v, type Infer } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "../../_generated/server";
import { PRICING } from "../plans";
import { MEMBERSHIP_SCAN_CAP, countSeats } from "./state";
import {
  billingEventOutcomeValidator,
  priceKeyValidator,
  stripeSubscriptionStatusValidator,
} from "./validators";

/**
 * WP64-S4. Settles verified Stripe events into membership state, exactly
 * once per event id and in any order (frozen contract 6). The webhook route
 * verifies the signature, fetches the current Stripe objects and sends these
 * normalized snapshots through the signed bridge. Convex never holds a key.
 *
 * Owners come from our own orders, subscription rows and customer links,
 * never from metadata alone: `order_id` in metadata only points at an order
 * we created, and a customer already linked to another owner is refused.
 *
 * Anything that needs a Stripe call (a refund, a cancellation) comes back as
 * a follow-up the route performs with an idempotency key. Follow-ups are
 * worked out from stored state on every delivery, a duplicate included, so a
 * failed call is retried when Stripe redelivers the event.
 */

const priceKeyOrNull = v.union(priceKeyValidator, v.null());
const stringOrNull = v.union(v.string(), v.null());
const numberOrNull = v.union(v.number(), v.null());

export const subscriptionSnapshotValidator = v.object({
  subscriptionId: v.string(),
  customerId: v.string(),
  /** `order_id` from the subscription's metadata. */
  orderId: stringOrNull,
  status: stripeSubscriptionStatusValidator,
  priceKey: priceKeyOrNull,
  quantity: v.number(),
  /** Milliseconds. Read from the subscription item on current API versions. */
  currentPeriodEnd: numberOrNull,
  cancelAtPeriodEnd: v.boolean(),
  endedAt: numberOrNull,
  /** When the route fetched the subscription. A newer fetch always wins. */
  snapshotAt: v.number(),
});

const target = v.union(v.literal("lifetime"), v.literal("subscription"));
const header = { eventId: v.string(), eventType: v.string(), livemode: v.boolean() };

export const membershipEventValidator = v.union(
  v.object({
    kind: v.literal("checkout"),
    ...header,
    orderId: v.string(),
    sessionId: v.string(),
    status: v.union(v.literal("complete"), v.literal("expired"), v.literal("open")),
    paymentStatus: v.union(v.literal("paid"), v.literal("unpaid"), v.literal("no_payment_required")),
    /** `checkout.session.async_payment_failed`. */
    failed: v.boolean(),
    customerId: stringOrNull,
    paymentIntentId: stringOrNull,
    priceKey: priceKeyOrNull,
    quantity: v.number(),
    amountTotal: numberOrNull,
    currency: stringOrNull,
    subscription: v.union(subscriptionSnapshotValidator, v.null()),
  }),
  v.object({ kind: v.literal("subscription"), ...header, subscription: subscriptionSnapshotValidator }),
  v.object({
    kind: v.literal("refund"),
    ...header,
    target,
    orderId: stringOrNull,
    subscriptionId: stringOrNull,
    paymentIntentId: v.string(),
    full: v.boolean(),
  }),
  v.object({
    kind: v.literal("dispute"),
    ...header,
    target,
    orderId: stringOrNull,
    subscriptionId: stringOrNull,
    paymentIntentId: v.string(),
    outcome: v.union(v.literal("open"), v.literal("won"), v.literal("lost")),
  }),
);

export const followUpValidator = v.union(
  v.object({ type: v.literal("refund_payment"), paymentIntentId: v.string() }),
  v.object({ type: v.literal("cancel_subscription_now"), subscriptionId: v.string() }),
  v.object({ type: v.literal("cancel_at_period_end"), subscriptionId: v.string() }),
  v.object({ type: v.literal("cancel_duplicate"), subscriptionId: v.string() }),
);

export type MembershipEvent = Infer<typeof membershipEventValidator>;
export type SubscriptionSnapshot = Infer<typeof subscriptionSnapshotValidator>;
export type FollowUp = Infer<typeof followUpValidator>;
type Outcome = Infer<typeof billingEventOutcomeValidator>;
type Order = Doc<"membership_orders">;
type Settled = { outcome: Outcome; ownerId: Id<"users"> | null };

/** Statuses that mean Stripe holds a running subscription. */
const RUNNING = ["active", "past_due", "trialing"] as const;
const running = (status: string) => (RUNNING as readonly string[]).includes(status);
const FAILED_ORDER_READ = 5;

async function orderFor(ctx: QueryCtx, orderId: string | null, livemode: boolean): Promise<Order | null> {
  if (!orderId) return null;
  const id = ctx.db.normalizeId("membership_orders", orderId);
  if (!id) return null;
  const order = await ctx.db.get("membership_orders", id);
  return order && order.livemode === livemode ? order : null;
}

async function orderByPayment(ctx: QueryCtx, paymentIntentId: string, livemode: boolean): Promise<Order | null> {
  const order = await ctx.db
    .query("membership_orders")
    .withIndex("by_stripePaymentIntentId", (q) => q.eq("stripePaymentIntentId", paymentIntentId))
    .first();
  return order && order.livemode === livemode ? order : null;
}

async function subscriptionRow(ctx: QueryCtx, subscriptionId: string | null, livemode: boolean) {
  if (!subscriptionId) return null;
  const row = await ctx.db
    .query("plan_subscriptions")
    .withIndex("by_stripeSubscriptionId", (q) => q.eq("stripeSubscriptionId", subscriptionId))
    .unique();
  return row && row.livemode === livemode ? row : null;
}

async function lifetimeOrder(ctx: QueryCtx, event: { orderId: string | null; paymentIntentId: string; livemode: boolean }) {
  const order = (await orderFor(ctx, event.orderId, event.livemode)) ?? (await orderByPayment(ctx, event.paymentIntentId, event.livemode));
  return order?.term === "lifetime" ? order : null;
}

/** Links a Stripe customer to an owner once. False when it already belongs to someone else. */
async function linkCustomer(ctx: MutationCtx, ownerId: Id<"users">, customerId: string, livemode: boolean, now: number) {
  const rows = await ctx.db
    .query("billing_customers")
    .withIndex("by_stripeCustomerId", (q) => q.eq("stripeCustomerId", customerId))
    .take(2);
  if (rows.length > 0) return rows.every((row) => row.ownerId === ownerId);
  await ctx.db.insert("billing_customers", { ownerId, stripeCustomerId: customerId, livemode, createdAt: now });
  return true;
}

async function seatFor(ctx: QueryCtx, seatNumber: number | undefined) {
  if (seatNumber === undefined) return null;
  return await ctx.db
    .query("founding_seats")
    .withIndex("by_seatNumber", (q) => q.eq("seatNumber", seatNumber))
    .unique();
}

/** Returns a seat to the pool, only while it still belongs to this order. */
async function freeSeat(ctx: MutationCtx, order: Order, now: number) {
  const seat = await seatFor(ctx, order.seatNumber);
  if (!seat || seat.orderId !== order._id || seat.status === "free") return;
  await ctx.db.patch("founding_seats", seat._id, {
    status: "free",
    ownerId: undefined,
    orderId: undefined,
    reservedUntil: undefined,
    updatedAt: now,
  });
}

async function lifetimeGrantFor(ctx: QueryCtx, order: Order) {
  if (order.seatNumber === undefined) return null;
  const grants = await ctx.db
    .query("plan_grants")
    .withIndex("by_kind_and_seatNumber", (q) => q.eq("kind", "lifetime").eq("seatNumber", order.seatNumber))
    .take(MEMBERSHIP_SCAN_CAP);
  return grants.find((grant) => grant.orderId === order._id) ?? null;
}

/** True when the owner already holds a lifetime grant from a different order. */
async function holdsOtherLifetime(ctx: QueryCtx, ownerId: Id<"users">, orderId: Id<"membership_orders">) {
  const grants = await ctx.db
    .query("plan_grants")
    .withIndex("by_ownerId", (q) => q.eq("ownerId", ownerId))
    .order("desc")
    .take(MEMBERSHIP_SCAN_CAP);
  return grants.some((grant) => grant.kind === "lifetime" && grant.revokedAt === undefined && grant.orderId !== orderId);
}

/** Upserts a subscription row from a snapshot. Never lets an older snapshot overwrite a newer one. */
export async function applySubscription(
  ctx: MutationCtx,
  snapshot: SubscriptionSnapshot,
  livemode: boolean,
  now: number,
): Promise<Settled> {
  const existing = await ctx.db
    .query("plan_subscriptions")
    .withIndex("by_stripeSubscriptionId", (q) => q.eq("stripeSubscriptionId", snapshot.subscriptionId))
    .unique();
  if (existing && existing.livemode !== livemode) return { outcome: "rejected", ownerId: null };
  let ownerId: Id<"users">;
  if (existing) {
    ownerId = existing.ownerId;
  } else {
    // An unknown subscription is someone else's: ours always carry our order id.
    const order = await orderFor(ctx, snapshot.orderId, livemode);
    if (!order || order.term === "lifetime") return { outcome: "ignored", ownerId: null };
    ownerId = order.ownerId;
    // Settlement checks identity: a first snapshot must carry the order's Price (frozen contract 7).
    if (snapshot.priceKey !== order.priceKey || snapshot.quantity !== 1) {
      if (order.status === "pending") await ctx.db.patch("membership_orders", order._id, { status: "failed", updatedAt: now });
      return { outcome: "rejected", ownerId };
    }
  }
  const term = snapshot.priceKey === "monthly" || snapshot.priceKey === "annual" ? snapshot.priceKey : null;
  if (!term || snapshot.quantity !== 1) return { outcome: "rejected", ownerId };
  if (!(await linkCustomer(ctx, ownerId, snapshot.customerId, livemode, now))) {
    const order = existing ? null : await orderFor(ctx, snapshot.orderId, livemode);
    if (order?.status === "pending") await ctx.db.patch("membership_orders", order._id, { status: "failed", updatedAt: now });
    return { outcome: "rejected", ownerId };
  }
  if (existing && existing.snapshotAt >= snapshot.snapshotAt) return { outcome: "stale", ownerId };

  const fields = {
    ownerId,
    stripeSubscriptionId: snapshot.subscriptionId,
    stripeCustomerId: snapshot.customerId,
    term,
    status: snapshot.status,
    currentPeriodEnd: snapshot.currentPeriodEnd ?? undefined,
    cancelAtPeriodEnd: snapshot.cancelAtPeriodEnd,
    canceledAt: snapshot.status === "canceled" ? (snapshot.endedAt ?? now) : undefined,
    snapshotAt: snapshot.snapshotAt,
    updatedAt: now,
    livemode,
  };
  if (existing) {
    // `disputedAt` belongs to the dispute events and is kept.
    await ctx.db.patch("plan_subscriptions", existing._id, fields);
  } else {
    await ctx.db.insert("plan_subscriptions", fields);
  }
  const order = await orderFor(ctx, snapshot.orderId, livemode);
  if (order && order.ownerId === ownerId && order.status === "pending" && running(snapshot.status)) {
    await ctx.db.patch("membership_orders", order._id, { status: "paid", updatedAt: now });
  }
  return { outcome: "applied", ownerId };
}

async function applyCheckout(ctx: MutationCtx, event: Extract<MembershipEvent, { kind: "checkout" }>, now: number): Promise<Settled> {
  const order = await orderFor(ctx, event.orderId, event.livemode);
  if (!order) return { outcome: "ignored", ownerId: null };
  const ownerId = order.ownerId;
  if (order.stripeCheckoutSessionId && order.stripeCheckoutSessionId !== event.sessionId) return { outcome: "rejected", ownerId };

  if (event.failed || event.status === "expired") {
    if (order.status !== "pending") return { outcome: "ignored", ownerId };
    await ctx.db.patch("membership_orders", order._id, {
      status: event.failed ? "failed" : "expired",
      stripeCheckoutSessionId: event.sessionId,
      updatedAt: now,
    });
    await freeSeat(ctx, order, now);
    return { outcome: "applied", ownerId };
  }
  // An async payment that has not cleared yet waits for its own event.
  if (event.status !== "complete" || event.paymentStatus !== "paid") return { outcome: "ignored", ownerId };
  const reported = {
    stripeCheckoutSessionId: event.sessionId,
    ...(event.paymentIntentId ? { stripePaymentIntentId: event.paymentIntentId } : {}),
    ...(event.amountTotal !== null ? { presentedAmountMinor: event.amountTotal } : {}),
    ...(event.currency !== null ? { presentedCurrency: event.currency } : {}),
    updatedAt: now,
  };
  const settleable = order.status === "pending" || (order.term === "lifetime" && order.status === "expired");

  // Settlement checks identity: the paid Price and quantity must be the order's (frozen contract 7),
  // and the customer must not belong to another member. A failed order is refunded or canceled (follow-up).
  const customerOk = !event.customerId || (await linkCustomer(ctx, ownerId, event.customerId, event.livemode, now));
  if (!customerOk || event.priceKey !== order.priceKey || event.quantity !== 1) {
    if (settleable) {
      await ctx.db.patch("membership_orders", order._id, { ...reported, status: "failed" });
      await freeSeat(ctx, order, now);
    }
    return { outcome: "rejected", ownerId };
  }

  if (order.term !== "lifetime") {
    if (order.status === "pending") await ctx.db.patch("membership_orders", order._id, { ...reported, status: "paid" });
    if (event.subscription) await applySubscription(ctx, event.subscription, event.livemode, now);
    return { outcome: "applied", ownerId };
  }

  if (!settleable) return { outcome: "ignored", ownerId };
  // The seat is this order's while held or still free, and a member holds one seat.
  // Otherwise the payment goes back (follow-up).
  const seat = await seatFor(ctx, order.seatNumber);
  const ours = seat !== null && (seat.status === "free" || (seat.status === "reserved" && seat.orderId === order._id));
  if (!seat || !ours || (await holdsOtherLifetime(ctx, ownerId, order._id))) {
    await ctx.db.patch("membership_orders", order._id, { ...reported, status: "failed" });
    return { outcome: "applied", ownerId };
  }
  await ctx.db.patch("founding_seats", seat._id, {
    status: "taken",
    ownerId,
    orderId: order._id,
    reservedUntil: undefined,
    updatedAt: now,
  });
  if (!(await lifetimeGrantFor(ctx, order))) {
    await ctx.db.insert("plan_grants", {
      ownerId,
      kind: "lifetime",
      orderId: order._id,
      seatNumber: seat.seatNumber,
      grantedAt: now,
    });
  }
  await ctx.db.patch("membership_orders", order._id, { ...reported, status: "paid" });
  return { outcome: "applied", ownerId };
}

async function applyRefund(ctx: MutationCtx, event: Extract<MembershipEvent, { kind: "refund" }>, now: number): Promise<Settled> {
  if (event.target === "subscription") {
    const row = await subscriptionRow(ctx, event.subscriptionId, event.livemode);
    if (!row) return { outcome: "ignored", ownerId: null };
    // A full refund cancels the subscription (follow-up). A partial one changes nothing.
    return { outcome: event.full ? "applied" : "ignored", ownerId: row.ownerId };
  }
  const order = await lifetimeOrder(ctx, event);
  if (!order) return { outcome: "ignored", ownerId: null };
  if (!event.full || order.status === "refunded") return { outcome: "ignored", ownerId: order.ownerId };
  const grant = await lifetimeGrantFor(ctx, order);
  if (grant && grant.revokedAt === undefined) {
    await ctx.db.patch("plan_grants", grant._id, { revokedAt: now, revokeReason: "refund" });
  }
  await freeSeat(ctx, order, now);
  await ctx.db.patch("membership_orders", order._id, { status: "refunded", updatedAt: now });
  return { outcome: "applied", ownerId: order.ownerId };
}

async function applyDispute(ctx: MutationCtx, event: Extract<MembershipEvent, { kind: "dispute" }>, now: number): Promise<Settled> {
  if (event.target === "subscription") {
    const row = await subscriptionRow(ctx, event.subscriptionId, event.livemode);
    if (!row) return { outcome: "ignored", ownerId: null };
    // O9: open suspends access, won restores it, lost keeps the flag and cancels (follow-up).
    if (event.outcome === "won") {
      if (row.disputedAt !== undefined) await ctx.db.patch("plan_subscriptions", row._id, { disputedAt: undefined, updatedAt: now });
    } else if (row.disputedAt === undefined) {
      await ctx.db.patch("plan_subscriptions", row._id, { disputedAt: now, updatedAt: now });
    }
    return { outcome: "applied", ownerId: row.ownerId };
  }
  const order = await lifetimeOrder(ctx, event);
  if (!order) return { outcome: "ignored", ownerId: null };
  const grant = await lifetimeGrantFor(ctx, order);
  if (!grant || grant.revokedAt !== undefined) return { outcome: "ignored", ownerId: order.ownerId };
  if (event.outcome === "open") {
    await ctx.db.patch("plan_grants", grant._id, { suspendedAt: grant.suspendedAt ?? now });
    await ctx.db.patch("membership_orders", order._id, { status: "disputed", updatedAt: now });
  } else if (event.outcome === "won") {
    await ctx.db.patch("plan_grants", grant._id, { suspendedAt: undefined });
    await ctx.db.patch("membership_orders", order._id, { status: "paid", updatedAt: now });
  } else {
    // Lost: the money went back, so the grant ends, the seat returns and the owner is flagged.
    await ctx.db.patch("plan_grants", grant._id, { revokedAt: now, revokeReason: "dispute_lost" });
    await freeSeat(ctx, order, now);
    await ctx.db.patch("membership_orders", order._id, { status: "disputed", updatedAt: now });
  }
  return { outcome: "applied", ownerId: order.ownerId };
}

/** The owner an event concerns, read-only, for a redelivered event. */
async function ownerOf(ctx: QueryCtx, event: MembershipEvent): Promise<Id<"users"> | null> {
  if (event.kind === "checkout") return (await orderFor(ctx, event.orderId, event.livemode))?.ownerId ?? null;
  if (event.kind === "subscription") {
    const row = await subscriptionRow(ctx, event.subscription.subscriptionId, event.livemode);
    return row?.ownerId ?? (await orderFor(ctx, event.subscription.orderId, event.livemode))?.ownerId ?? null;
  }
  if (event.target === "subscription") return (await subscriptionRow(ctx, event.subscriptionId, event.livemode))?.ownerId ?? null;
  return (await lifetimeOrder(ctx, event))?.ownerId ?? null;
}

/**
 * Stripe calls still owed, from the event and the owner's current state.
 * Idempotent: once Stripe has acted, the state that asked for the call is gone.
 */
async function followUps(ctx: QueryCtx, event: MembershipEvent | null, ownerId: Id<"users"> | null): Promise<FollowUp[]> {
  const actions: FollowUp[] = [];
  if (event && (event.kind === "refund" || event.kind === "dispute") && event.target === "subscription") {
    const ends = event.kind === "refund" ? event.full : event.outcome === "lost";
    const row = await subscriptionRow(ctx, event.subscriptionId, event.livemode);
    if (ends && row && row.status !== "canceled") actions.push({ type: "cancel_subscription_now", subscriptionId: row.stripeSubscriptionId });
  }
  const snapshot = event?.kind === "checkout" ? event.subscription : event?.kind === "subscription" ? event.subscription : null;
  if (event && snapshot && running(snapshot.status)) {
    // A subscription on our failed order (wrong Price or quantity) is never kept.
    const order = await orderFor(ctx, snapshot.orderId, event.livemode);
    const row = await subscriptionRow(ctx, snapshot.subscriptionId, event.livemode);
    if (order && order.term !== "lifetime" && order.status === "failed" && !row) {
      actions.push({ type: "cancel_subscription_now", subscriptionId: snapshot.subscriptionId });
    }
  }
  if (!ownerId) return actions;

  const [grants, subscriptions, failed] = await Promise.all([
    ctx.db.query("plan_grants").withIndex("by_ownerId", (q) => q.eq("ownerId", ownerId)).order("desc").take(MEMBERSHIP_SCAN_CAP),
    ctx.db
      .query("plan_subscriptions")
      .withIndex("by_ownerId_and_updatedAt", (q) => q.eq("ownerId", ownerId))
      .order("desc")
      .take(MEMBERSHIP_SCAN_CAP),
    ctx.db
      .query("membership_orders")
      .withIndex("by_ownerId_and_status_and_createdAt", (q) => q.eq("ownerId", ownerId).eq("status", "failed"))
      .order("desc")
      .take(FAILED_ORDER_READ),
  ]);
  // A lifetime payment whose seat was gone, or whose Price was wrong, goes back in full.
  for (const order of failed) {
    if (order.term === "lifetime" && order.stripePaymentIntentId) {
      actions.push({ type: "refund_payment", paymentIntentId: order.stripePaymentIntentId });
    }
  }
  const live = subscriptions.filter((row) => running(row.status)).sort((a, b) => a._creationTime - b._creationTime);
  const lifetime = grants.some((grant) => grant.kind === "lifetime" && grant.revokedAt === undefined);
  if (lifetime) {
    // O5: lifetime replaces the subscription at the end of its paid period.
    for (const row of live) {
      if (!row.cancelAtPeriodEnd) actions.push({ type: "cancel_at_period_end", subscriptionId: row.stripeSubscriptionId });
    }
  } else {
    // One subscription per member: a second one is canceled and refunded.
    for (const row of live.slice(1)) actions.push({ type: "cancel_duplicate", subscriptionId: row.stripeSubscriptionId });
  }
  return actions;
}

const resultValidator = v.object({
  outcome: billingEventOutcomeValidator,
  duplicate: v.boolean(),
  actions: v.array(followUpValidator),
});

export const settle = internalMutation({
  args: { event: membershipEventValidator },
  returns: resultValidator,
  handler: async (ctx, { event }) => {
    const now = Date.now();
    const seen = await ctx.db
      .query("billing_events")
      .withIndex("by_stripeEventId", (q) => q.eq("stripeEventId", event.eventId))
      .unique();
    if (seen) {
      return { outcome: seen.outcome, duplicate: true, actions: await followUps(ctx, event, await ownerOf(ctx, event)) };
    }
    let settled: Settled;
    if (event.kind === "checkout") settled = await applyCheckout(ctx, event, now);
    else if (event.kind === "subscription") settled = await applySubscription(ctx, event.subscription, event.livemode, now);
    else if (event.kind === "refund") settled = await applyRefund(ctx, event, now);
    else settled = await applyDispute(ctx, event, now);
    await ctx.db.insert("billing_events", {
      stripeEventId: event.eventId,
      type: event.eventType,
      livemode: event.livemode,
      receivedAt: now,
      processedAt: now,
      outcome: settled.outcome,
    });
    return { outcome: settled.outcome, duplicate: false, actions: await followUps(ctx, event, settled.ownerId) };
  },
});

/** WP64-S4 reconcile: a fresh subscription snapshot, applied with the same rules but no event id. */
export const applySnapshot = internalMutation({
  args: { livemode: v.boolean(), subscription: subscriptionSnapshotValidator },
  returns: v.object({ outcome: billingEventOutcomeValidator, actions: v.array(followUpValidator) }),
  handler: async (ctx, args) => {
    const settled = await applySubscription(ctx, args.subscription, args.livemode, Date.now());
    return { outcome: settled.outcome, actions: await followUps(ctx, null, settled.ownerId) };
  },
});

/** WP64-S4 reconcile: frees seats whose hold lapsed and expires their orders. At most 50 rows. */
export const releaseExpiredHolds = internalMutation({
  args: {},
  returns: v.object({ released: v.number() }),
  handler: async (ctx) => {
    const now = Date.now();
    const reserved = await ctx.db
      .query("founding_seats")
      .withIndex("by_status_and_seatNumber", (q) => q.eq("status", "reserved"))
      .take(PRICING.lifetime.seats);
    let released = 0;
    for (const seat of reserved) {
      if ((seat.reservedUntil ?? 0) > now) continue;
      if (seat.orderId) {
        const order = await ctx.db.get("membership_orders", seat.orderId);
        if (order?.status === "pending") {
          await ctx.db.patch("membership_orders", order._id, { status: "expired", updatedAt: now });
        }
      }
      await ctx.db.patch("founding_seats", seat._id, {
        status: "free",
        ownerId: undefined,
        orderId: undefined,
        reservedUntil: undefined,
        updatedAt: now,
      });
      released += 1;
    }
    return { released };
  },
});

/** The cap on subscriptions one reconcile run compares. */
export const RECONCILE_CAP = 1_000;

/**
 * WP64-S4 reconcile: our running subscriptions, so Stripe can be asked about
 * any it no longer runs. Ids only. The table's indexes are frozen and none
 * leads with status, so the newest rows are read, at most `RECONCILE_CAP`.
 */
export const runningSubscriptionIds = internalQuery({
  args: { livemode: v.boolean() },
  returns: v.object({ ids: v.array(v.string()), capped: v.boolean() }),
  handler: async (ctx, args) => {
    const rows = await ctx.db.query("plan_subscriptions").order("desc").take(RECONCILE_CAP);
    return {
      ids: rows.filter((row) => row.livemode === args.livemode && running(row.status)).map((row) => row.stripeSubscriptionId),
      capped: rows.length === RECONCILE_CAP,
    };
  },
});

/**
 * Operator only, after the owner has looked at the account (O9). Clears the
 * flags that block a new checkout: a lost-dispute grant becomes an operator
 * revocation and an ended subscription loses its dispute mark. Access is not
 * restored. A live dispute is left alone.
 *
 *   npx convex run platform/membership/events:clearReview '{"ownerId":"<users id>"}'
 */
export const clearReview = internalMutation({
  args: { ownerId: v.id("users") },
  returns: v.object({ cleared: v.number() }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const [grants, subscriptions] = await Promise.all([
      ctx.db.query("plan_grants").withIndex("by_ownerId", (q) => q.eq("ownerId", args.ownerId)).take(MEMBERSHIP_SCAN_CAP),
      ctx.db
        .query("plan_subscriptions")
        .withIndex("by_ownerId_and_updatedAt", (q) => q.eq("ownerId", args.ownerId))
        .take(MEMBERSHIP_SCAN_CAP),
    ]);
    let cleared = 0;
    for (const grant of grants) {
      if (grant.revokeReason !== "dispute_lost") continue;
      await ctx.db.patch("plan_grants", grant._id, { revokeReason: "operator" });
      cleared += 1;
    }
    for (const row of subscriptions) {
      if (row.disputedAt === undefined || running(row.status)) continue;
      await ctx.db.patch("plan_subscriptions", row._id, { disputedAt: undefined, updatedAt: now });
      cleared += 1;
    }
    return { cleared };
  },
});

/** Operator-only counts: events by outcome, subscriptions by status, seats by status. No emails, no ids. */
export const counts = internalQuery({
  args: {},
  returns: v.object({
    events: v.record(v.string(), v.number()),
    subscriptions: v.record(v.string(), v.number()),
    seats: v.object({ free: v.number(), reserved: v.number(), taken: v.number(), overflow: v.boolean() }),
    capped: v.boolean(),
  }),
  handler: async (ctx) => {
    const events = await ctx.db.query("billing_events").order("desc").take(RECONCILE_CAP);
    const subscriptions = await ctx.db.query("plan_subscriptions").order("desc").take(RECONCILE_CAP);
    const tally = (values: string[]) =>
      values.reduce<Record<string, number>>((all, value) => ({ ...all, [value]: (all[value] ?? 0) + 1 }), {});
    return {
      events: tally(events.map((row) => row.outcome)),
      subscriptions: tally(subscriptions.map((row) => row.status)),
      seats: await countSeats(ctx),
      capped: events.length === RECONCILE_CAP || subscriptions.length === RECONCILE_CAP,
    };
  },
});
