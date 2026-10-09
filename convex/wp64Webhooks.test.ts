/// <reference types="vite/client" />

import { register as registerRateLimiter } from "@convex-dev/rate-limiter/test";
import { convexTest, type TestConvex } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { MEMBERSHIP_BRIDGE_MAX_AGE_MS, signMembershipBridge, type MembershipBridgePayload } from "../lib/membership-bridge";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { MembershipEvent, SubscriptionSnapshot } from "./platform/membership/events";
import type { FoundingWindows } from "./platform/membership/windows";
import schema from "./schema";

// WP64-S4. Settlement of verified Stripe events: exactly once, in any order,
// never older over newer, and never more than 50 founding seats.

const windows = vi.hoisted(() => ({ buyers: null, newsletter: null, everyone: 1 }) as FoundingWindows);
vi.mock("./platform/membership/windows", () => ({ FOUNDING_WINDOWS: windows }));

const modules = import.meta.glob("./**/*.ts");
const SECRET = "membership-bridge-test-secret-0123456789abcdef";

type T = TestConvex<typeof schema>;
type Member = { userId: Id<"users">; sessionId: Id<"authSessions"> };
type OrderId = Id<"membership_orders">;

afterEach(() => {
  vi.unstubAllEnvs();
});

function setup() {
  const t = convexTest(schema, modules);
  registerRateLimiter(t);
  return t;
}

let counter = 0;
const next = () => (counter += 1);

async function seedUser(t: T) {
  const n = next();
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { email: `buyer${n}@example.test`, emailVerificationTime: 1 });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: 9_999_999_999_999 });
    return { userId, sessionId } satisfies Member;
  });
}

function asUser(t: T, member: Member) {
  return t.withIdentity({
    subject: `${member.userId}|${member.sessionId}`,
    issuer: "https://local.test",
    tokenIdentifier: `https://local.test|${member.userId}`,
  });
}

async function order(t: T, member: Member, term: "monthly" | "annual" | "lifetime", livemode = false) {
  const result = await asUser(t, member).mutation(internal.platform.membership.checkout.begin, {
    term,
    idempotencyKey: `membership:webhook-key-${next().toString().padStart(8, "0")}`,
    livemode,
  });
  if (!result.ok) throw new Error(`expected an order, got ${result.code}`);
  return result;
}

const seedSeats = (t: T) => t.mutation(internal.platform.membership.seats.seed, { apply: true });
const settle = (t: T, event: MembershipEvent) => t.mutation(internal.platform.membership.events.settle, { event });

function snapshot(orderId: string | null, extra: Partial<SubscriptionSnapshot> = {}): SubscriptionSnapshot {
  return {
    subscriptionId: "sub_one",
    customerId: "cus_one",
    orderId,
    status: "active",
    priceKey: "monthly",
    quantity: 1,
    currentPeriodEnd: 2_000_000_000_000,
    cancelAtPeriodEnd: false,
    endedAt: null,
    snapshotAt: 1_000,
    ...extra,
  };
}

type CheckoutEvent = Extract<MembershipEvent, { kind: "checkout" }>;
function checkout(orderId: string, extra: Partial<CheckoutEvent> = {}): CheckoutEvent {
  return {
    kind: "checkout",
    eventId: `evt_${next()}`,
    eventType: "checkout.session.completed",
    livemode: false,
    orderId,
    sessionId: "cs_test_one",
    status: "complete",
    paymentStatus: "paid",
    failed: false,
    customerId: "cus_one",
    paymentIntentId: null,
    priceKey: "monthly",
    quantity: 1,
    amountTotal: 3480,
    currency: "usd",
    subscription: null,
    ...extra,
  };
}

function subscriptionEvent(subscription: SubscriptionSnapshot, extra: { eventId?: string; livemode?: boolean } = {}): MembershipEvent {
  return {
    kind: "subscription",
    eventId: extra.eventId ?? `evt_${next()}`,
    eventType: "customer.subscription.updated",
    livemode: extra.livemode ?? false,
    subscription,
  };
}

function refund(extra: Partial<Extract<MembershipEvent, { kind: "refund" }>>): MembershipEvent {
  return {
    kind: "refund",
    eventId: `evt_${next()}`,
    eventType: "charge.refunded",
    livemode: false,
    target: "lifetime",
    orderId: null,
    subscriptionId: null,
    paymentIntentId: "pi_one",
    full: true,
    ...extra,
  };
}

function dispute(outcome: "open" | "won" | "lost", extra: Partial<Extract<MembershipEvent, { kind: "dispute" }>>): MembershipEvent {
  return {
    kind: "dispute",
    eventId: `evt_${next()}`,
    eventType: outcome === "open" ? "charge.dispute.created" : "charge.dispute.closed",
    livemode: false,
    target: "lifetime",
    orderId: null,
    subscriptionId: null,
    paymentIntentId: "pi_one",
    outcome,
    ...extra,
  };
}

const table = <N extends "membership_orders" | "plan_subscriptions" | "plan_grants" | "billing_events" | "billing_customers">(
  t: T,
  name: N,
) => t.run((ctx) => ctx.db.query(name).take(100));
const orderRow = async (t: T, orderId: OrderId) => (await table(t, "membership_orders")).find((row) => row._id === orderId);
const seat = (t: T, seatNumber: number) =>
  t.run((ctx) =>
    ctx.db
      .query("founding_seats")
      .withIndex("by_seatNumber", (q) => q.eq("seatNumber", seatNumber))
      .unique(),
  );
const plan = (t: T, member: Member) => asUser(t, member).query(api.platform.entitlements.mine, {});

async function lifetimeBuyer(t: T) {
  const member = await seedUser(t);
  const opened = await order(t, member, "lifetime");
  return { member, opened, orderId: opened.orderId as OrderId, seatNumber: opened.seatNumber as number };
}

function paid(orderId: string, seatNumber: number, extra: Partial<CheckoutEvent> = {}) {
  return checkout(orderId, {
    priceKey: seatNumber <= 15 ? "lifetime_t1" : "lifetime_t2",
    paymentIntentId: `pi_${orderId}`,
    customerId: `cus_${orderId}`,
    ...extra,
  });
}

describe("WP64-S4 subscriptions", () => {
  test("a paid checkout settles once: order paid, one subscription, customer linked; a replay changes nothing", async () => {
    const t = setup();
    const member = await seedUser(t);
    const opened = await order(t, member, "monthly");
    const event = checkout(opened.orderId, { subscription: snapshot(opened.orderId) });
    expect(await settle(t, event)).toEqual({ outcome: "applied", duplicate: false, actions: [] });
    expect(await settle(t, event)).toEqual({ outcome: "applied", duplicate: true, actions: [] });
    expect(await orderRow(t, opened.orderId)).toMatchObject({
      status: "paid",
      stripeCheckoutSessionId: "cs_test_one",
      presentedAmountMinor: 3480,
      presentedCurrency: "usd",
    });
    const rows = await table(t, "plan_subscriptions");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ ownerId: member.userId, term: "monthly", status: "active", livemode: false });
    expect(await table(t, "billing_customers")).toHaveLength(1);
    expect(await table(t, "billing_events")).toHaveLength(1);
    expect((await plan(t, member)).plan).toBe("builders_hub");
  });

  test("subscription first or checkout first converges to the same state", async () => {
    const run = async (subscriptionFirst: boolean) => {
      const t = setup();
      const member = await seedUser(t);
      const opened = await order(t, member, "annual");
      const snap = snapshot(opened.orderId, { priceKey: "annual" });
      const steps = [
        () => settle(t, subscriptionEvent(snap)),
        () => settle(t, checkout(opened.orderId, { priceKey: "annual", subscription: { ...snap, snapshotAt: 1_001 } })),
      ];
      for (const step of subscriptionFirst ? steps : steps.reverse()) await step();
      const rows = await table(t, "plan_subscriptions");
      return {
        order: (await orderRow(t, opened.orderId))?.status,
        subscriptions: rows.map((row) => [row.stripeSubscriptionId, row.term, row.status, row.currentPeriodEnd, row.cancelAtPeriodEnd]),
        customers: (await table(t, "billing_customers")).length,
        grants: (await table(t, "plan_grants")).length,
      };
    };
    const a = await run(true);
    const b = await run(false);
    expect(a).toEqual(b);
    expect(a.order).toBe("paid");
  });

  test("a subscription event alone settles its pending order", async () => {
    const t = setup();
    const member = await seedUser(t);
    const opened = await order(t, member, "monthly");
    await settle(t, subscriptionEvent(snapshot(opened.orderId, { status: "incomplete" })));
    expect((await orderRow(t, opened.orderId))?.status).toBe("pending");
    await settle(t, subscriptionEvent(snapshot(opened.orderId, { snapshotAt: 2_000 })));
    expect((await orderRow(t, opened.orderId))?.status).toBe("paid");
    expect((await plan(t, member)).plan).toBe("builders_hub");
  });

  test("an older snapshot never overwrites a newer one", async () => {
    const t = setup();
    const member = await seedUser(t);
    const opened = await order(t, member, "monthly");
    await settle(t, subscriptionEvent(snapshot(opened.orderId, { status: "past_due", snapshotAt: 5_000 })));
    const older = await settle(t, subscriptionEvent(snapshot(opened.orderId, { status: "active", snapshotAt: 4_000 })));
    expect(older.outcome).toBe("stale");
    expect((await table(t, "plan_subscriptions"))[0].status).toBe("past_due");
    await settle(t, subscriptionEvent(snapshot(opened.orderId, { status: "canceled", endedAt: 6_000, snapshotAt: 6_000 })));
    expect((await table(t, "plan_subscriptions"))[0]).toMatchObject({ status: "canceled", canceledAt: 6_000 });
    expect((await plan(t, member)).plan).toBe("free");
  });

  test("a subscription that is not ours is ignored: no order, a lifetime order, or the other mode", async () => {
    const t = setup();
    await seedSeats(t);
    const member = await seedUser(t);
    expect((await settle(t, subscriptionEvent(snapshot(null)))).outcome).toBe("ignored");
    expect((await settle(t, subscriptionEvent(snapshot("not-an-id")))).outcome).toBe("ignored");
    const lifetime = await order(t, member, "lifetime");
    expect((await settle(t, subscriptionEvent(snapshot(lifetime.orderId)))).outcome).toBe("ignored");
    const monthly = await order(t, await seedUser(t), "monthly");
    expect((await settle(t, subscriptionEvent(snapshot(monthly.orderId), { livemode: true }))).outcome).toBe("ignored");
    expect(await table(t, "plan_subscriptions")).toHaveLength(0);
  });

  test("a stored subscription from the other mode is rejected", async () => {
    const t = setup();
    const opened = await order(t, await seedUser(t), "monthly");
    await settle(t, subscriptionEvent(snapshot(opened.orderId)));
    const crossed = await settle(t, subscriptionEvent(snapshot(opened.orderId, { snapshotAt: 9_000 }), { livemode: true }));
    expect(crossed.outcome).toBe("rejected");
  });

  test("a subscription at the wrong Price fails its order and is canceled, in either order", async () => {
    for (const first of ["checkout", "subscription"] as const) {
      const t = setup();
      const member = await seedUser(t);
      const opened = await order(t, member, "monthly");
      const wrong = snapshot(opened.orderId, { priceKey: "annual" });
      const result =
        first === "checkout"
          ? await settle(t, checkout(opened.orderId, { priceKey: "annual", subscription: wrong }))
          : await settle(t, subscriptionEvent(wrong));
      expect(result).toEqual({
        outcome: "rejected",
        duplicate: false,
        actions: [{ type: "cancel_subscription_now", subscriptionId: "sub_one" }],
      });
      expect((await orderRow(t, opened.orderId))?.status).toBe("failed");
      expect(await table(t, "plan_subscriptions")).toHaveLength(0);
      expect((await plan(t, member)).plan).toBe("free");
    }
  });

  test("a quantity other than one is rejected, first or later", async () => {
    const t = setup();
    const opened = await order(t, await seedUser(t), "monthly");
    expect((await settle(t, subscriptionEvent(snapshot(opened.orderId, { quantity: 2 })))).outcome).toBe("rejected");
    expect(await table(t, "plan_subscriptions")).toHaveLength(0);
    const other = await order(t, await seedUser(t), "monthly");
    await settle(t, subscriptionEvent(snapshot(other.orderId, { subscriptionId: "sub_two", customerId: "cus_two" })));
    const later = snapshot(other.orderId, { subscriptionId: "sub_two", customerId: "cus_two", quantity: 3, status: "past_due", snapshotAt: 9_000 });
    expect((await settle(t, subscriptionEvent(later))).outcome).toBe("rejected");
    expect((await table(t, "plan_subscriptions"))[0]).toMatchObject({ status: "active", snapshotAt: 1_000 });
  });

  test("a Stripe customer already linked to another member is refused, and the payment does not stand", async () => {
    const t = setup();
    await seedSeats(t);
    const a = await order(t, await seedUser(t), "monthly");
    await settle(t, subscriptionEvent(snapshot(a.orderId)));
    const b = await order(t, await seedUser(t), "monthly");
    const result = await settle(t, subscriptionEvent(snapshot(b.orderId, { subscriptionId: "sub_two" })));
    expect(result).toEqual({
      outcome: "rejected",
      duplicate: false,
      actions: [{ type: "cancel_subscription_now", subscriptionId: "sub_two" }],
    });
    expect((await orderRow(t, b.orderId))?.status).toBe("failed");
    expect(await table(t, "plan_subscriptions")).toHaveLength(1);
    // The same for a lifetime payment: refunded, seat back.
    const c = await lifetimeBuyer(t);
    const paidWithA = await settle(t, paid(c.orderId, c.seatNumber, { customerId: "cus_one" }));
    expect(paidWithA.actions).toEqual([{ type: "refund_payment", paymentIntentId: `pi_${c.orderId}` }]);
    expect(await seat(t, c.seatNumber)).toMatchObject({ status: "free" });
  });

  test("an unpaid or open checkout waits for its own event", async () => {
    const t = setup();
    const opened = await order(t, await seedUser(t), "monthly");
    expect((await settle(t, checkout(opened.orderId, { paymentStatus: "unpaid" }))).outcome).toBe("ignored");
    expect((await settle(t, checkout(opened.orderId, { status: "open", paymentStatus: "unpaid" }))).outcome).toBe("ignored");
    expect((await orderRow(t, opened.orderId))?.status).toBe("pending");
  });

  test("a checkout for a session other than the one attached is rejected", async () => {
    const t = setup();
    const member = await seedUser(t);
    const opened = await order(t, member, "monthly");
    await asUser(t, member).mutation(internal.platform.membership.checkout.attachSession, {
      orderId: opened.orderId,
      checkoutSessionId: "cs_test_attached",
    });
    expect((await settle(t, checkout(opened.orderId, { sessionId: "cs_test_other" }))).outcome).toBe("rejected");
    expect((await orderRow(t, opened.orderId))?.status).toBe("pending");
  });

  test("a full refund of a subscription charge cancels it; a partial one changes nothing", async () => {
    const t = setup();
    const opened = await order(t, await seedUser(t), "monthly");
    await settle(t, subscriptionEvent(snapshot(opened.orderId)));
    expect(await settle(t, refund({ target: "subscription", subscriptionId: "sub_one", full: false }))).toEqual({
      outcome: "ignored",
      duplicate: false,
      actions: [],
    });
    expect(await settle(t, refund({ target: "subscription", subscriptionId: "sub_one" }))).toEqual({
      outcome: "applied",
      duplicate: false,
      actions: [{ type: "cancel_subscription_now", subscriptionId: "sub_one" }],
    });
    // Once Stripe reports it canceled, nothing more is owed.
    await settle(t, subscriptionEvent(snapshot(opened.orderId, { status: "canceled", endedAt: 2_000, snapshotAt: 2_000 })));
    const again = await settle(t, refund({ target: "subscription", subscriptionId: "sub_one" }));
    expect(again.actions).toEqual([]);
  });

  test("a refund for an unknown subscription is ignored", async () => {
    const t = setup();
    expect((await settle(t, refund({ target: "subscription", subscriptionId: "sub_unknown" }))).outcome).toBe("ignored");
  });

  test("dispute on a subscription (O9): open suspends and flags, won restores, lost cancels and keeps the flag", async () => {
    const t = setup();
    const member = await seedUser(t);
    const opened = await order(t, member, "monthly");
    await settle(t, subscriptionEvent(snapshot(opened.orderId)));
    const on = { target: "subscription" as const, subscriptionId: "sub_one" };

    expect((await settle(t, dispute("open", on))).actions).toEqual([]);
    expect((await plan(t, member)).plan).toBe("free");
    expect(await order(t, member, "monthly").catch((error: Error) => error.message)).toMatch(/ACCOUNT_REVIEW/);

    await settle(t, dispute("won", on));
    expect((await plan(t, member)).plan).toBe("builders_hub");

    expect((await settle(t, dispute("lost", on))).actions).toEqual([{ type: "cancel_subscription_now", subscriptionId: "sub_one" }]);
    // A dispute on a subscription Stripe still runs is not the operator's to clear.
    expect(await t.mutation(internal.platform.membership.events.clearReview, { ownerId: member.userId })).toEqual({ cleared: 0 });
    await settle(t, subscriptionEvent(snapshot(opened.orderId, { status: "canceled", endedAt: 3_000, snapshotAt: 3_000 })));
    expect((await table(t, "plan_subscriptions"))[0].disputedAt).toBeDefined();
    expect(await order(t, member, "annual").catch((error: Error) => error.message)).toMatch(/ACCOUNT_REVIEW/);

    // The operator clears the flag after looking. Access is not restored by it.
    expect(await t.mutation(internal.platform.membership.events.clearReview, { ownerId: member.userId })).toEqual({ cleared: 1 });
    expect((await order(t, member, "annual")).ok).toBe(true);
  });

  test("an ended subscription is not a duplicate of a new one", async () => {
    const t = setup();
    const member = await seedUser(t);
    const first = await order(t, member, "monthly");
    await settle(t, subscriptionEvent(snapshot(first.orderId, { status: "canceled", endedAt: 1_500, snapshotAt: 1_500 })));
    const second = await order(t, member, "annual");
    const result = await settle(t, subscriptionEvent(snapshot(second.orderId, { subscriptionId: "sub_two", priceKey: "annual" })));
    expect(result).toEqual({ outcome: "applied", duplicate: false, actions: [] });
  });

  test("a second running subscription is canceled and refunded; the first stays", async () => {
    const t = setup();
    const member = await seedUser(t);
    const first = await order(t, member, "monthly");
    await settle(t, subscriptionEvent(snapshot(first.orderId)));
    // A race: both sessions were open and both were paid.
    const second = await t.run((ctx) =>
      ctx.db.insert("membership_orders", {
        ownerId: member.userId,
        term: "annual",
        priceKey: "annual",
        status: "pending",
        idempotencyKey: "membership:race-second-order",
        createdAt: 1,
        updatedAt: 1,
        livemode: false,
      }),
    );
    const result = await settle(t, subscriptionEvent(snapshot(second, { subscriptionId: "sub_two", priceKey: "annual" })));
    expect(result.actions).toEqual([{ type: "cancel_duplicate", subscriptionId: "sub_two" }]);
  });
});

describe("WP64-S4 founding lifetime", () => {
  test("a paid lifetime order takes its seat and grants exactly once", async () => {
    const t = setup();
    await seedSeats(t);
    const { member, orderId, seatNumber } = await lifetimeBuyer(t);
    const event = paid(orderId, seatNumber);
    expect(await settle(t, event)).toEqual({ outcome: "applied", duplicate: false, actions: [] });
    expect(await settle(t, event)).toMatchObject({ duplicate: true, actions: [] });
    // The async-success event for the same session is a second id, and still grants nothing more.
    expect((await settle(t, { ...event, eventId: "evt_async", eventType: "checkout.session.async_payment_succeeded" })).outcome).toBe(
      "ignored",
    );
    expect(await seat(t, seatNumber)).toMatchObject({ status: "taken", ownerId: member.userId, orderId });
    expect(await table(t, "plan_grants")).toHaveLength(1);
    expect(await orderRow(t, orderId)).toMatchObject({ status: "paid", stripePaymentIntentId: `pi_${orderId}` });
    expect((await plan(t, member)).plan).toBe("builders_hub");
  });

  test("the wrong tranche or quantity is rejected and refunded", async () => {
    const t = setup();
    await seedSeats(t);
    const { orderId, seatNumber } = await lifetimeBuyer(t);
    const result = await settle(t, paid(orderId, seatNumber, { priceKey: "lifetime_t2" }));
    expect(result).toEqual({ outcome: "rejected", duplicate: false, actions: [{ type: "refund_payment", paymentIntentId: `pi_${orderId}` }] });
    expect(await table(t, "plan_grants")).toHaveLength(0);
    expect(await seat(t, seatNumber)).toMatchObject({ status: "free" });
  });

  test("a payment after its hold was released takes the same seat while it is still free", async () => {
    const t = setup();
    await seedSeats(t);
    const { orderId, seatNumber } = await lifetimeBuyer(t);
    await t.run(async (ctx) => {
      const row = await ctx.db.query("founding_seats").withIndex("by_seatNumber", (q) => q.eq("seatNumber", seatNumber)).unique();
      await ctx.db.patch("founding_seats", row!._id, { reservedUntil: Date.now() - 1 });
    });
    expect(await t.mutation(internal.platform.membership.events.releaseExpiredHolds, {})).toEqual({ released: 1 });
    expect((await orderRow(t, orderId))?.status).toBe("expired");
    expect((await settle(t, paid(orderId, seatNumber))).outcome).toBe("applied");
    expect(await seat(t, seatNumber)).toMatchObject({ status: "taken", orderId });
    expect((await orderRow(t, orderId))?.status).toBe("paid");
  });

  test("a payment after its seat went to someone else is refunded in full and grants nothing", async () => {
    const t = setup();
    await seedSeats(t);
    const late = await lifetimeBuyer(t);
    await t.run(async (ctx) => {
      const row = await ctx.db.query("founding_seats").withIndex("by_seatNumber", (q) => q.eq("seatNumber", late.seatNumber)).unique();
      await ctx.db.patch("founding_seats", row!._id, { reservedUntil: Date.now() - 1 });
    });
    const other = await lifetimeBuyer(t);
    expect(other.seatNumber).toBe(late.seatNumber);
    const result = await settle(t, paid(late.orderId, late.seatNumber));
    expect(result).toEqual({
      outcome: "applied",
      duplicate: false,
      actions: [{ type: "refund_payment", paymentIntentId: `pi_${late.orderId}` }],
    });
    expect(await seat(t, late.seatNumber)).toMatchObject({ status: "reserved", orderId: other.orderId });
    expect(await table(t, "plan_grants")).toHaveLength(0);
    // The refund's own event closes it out, and nothing more is owed.
    const closed = await settle(t, refund({ paymentIntentId: `pi_${late.orderId}`, orderId: late.orderId }));
    expect(closed.actions).toEqual([]);
    expect((await orderRow(t, late.orderId))?.status).toBe("refunded");
  });

  test("a member never holds two seats", async () => {
    const t = setup();
    await seedSeats(t);
    const member = await seedUser(t);
    const first = await order(t, member, "lifetime");
    await t.run(async (ctx) => {
      const row = await ctx.db.query("founding_seats").withIndex("by_seatNumber", (q) => q.eq("seatNumber", 1)).unique();
      await ctx.db.patch("founding_seats", row!._id, { reservedUntil: Date.now() - 1 });
    });
    await t.mutation(internal.platform.membership.events.releaseExpiredHolds, {});
    const second = await order(t, member, "lifetime");
    expect(second.seatNumber).toBe(1);
    // A stale order's seat number is still free elsewhere: free seat 2 for the first order.
    await t.run((ctx) => ctx.db.patch("membership_orders", first.orderId, { seatNumber: 2, priceKey: "lifetime_t1" }));
    await settle(t, paid(second.orderId, 1));
    const result = await settle(t, paid(first.orderId, 2));
    expect(result.actions).toEqual([{ type: "refund_payment", paymentIntentId: `pi_${first.orderId}` }]);
    expect(await seat(t, 2)).toMatchObject({ status: "free" });
    expect((await table(t, "plan_grants")).filter((row) => row.ownerId === member.userId)).toHaveLength(1);
  });

  test("an expired or failed checkout frees the seat; a late expiry never touches a paid order", async () => {
    const t = setup();
    await seedSeats(t);
    const expired = await lifetimeBuyer(t);
    await settle(t, paid(expired.orderId, expired.seatNumber, { status: "expired", paymentStatus: "unpaid", eventType: "checkout.session.expired" }));
    expect((await orderRow(t, expired.orderId))?.status).toBe("expired");
    expect(await seat(t, expired.seatNumber)).toMatchObject({ status: "free" });

    const failed = await lifetimeBuyer(t);
    await settle(t, paid(failed.orderId, failed.seatNumber, { failed: true, paymentStatus: "unpaid" }));
    expect((await orderRow(t, failed.orderId))?.status).toBe("failed");
    expect(await seat(t, failed.seatNumber)).toMatchObject({ status: "free" });

    const done = await lifetimeBuyer(t);
    await settle(t, paid(done.orderId, done.seatNumber));
    expect((await settle(t, paid(done.orderId, done.seatNumber, { status: "expired" }))).outcome).toBe("ignored");
    expect(await seat(t, done.seatNumber)).toMatchObject({ status: "taken" });
  });

  test("a full refund revokes the grant and returns the seat at its number; a partial one changes nothing", async () => {
    const t = setup();
    await seedSeats(t);
    const { member, orderId, seatNumber } = await lifetimeBuyer(t);
    await settle(t, paid(orderId, seatNumber));
    expect((await settle(t, refund({ paymentIntentId: `pi_${orderId}`, full: false }))).outcome).toBe("ignored");
    expect((await plan(t, member)).plan).toBe("builders_hub");
    // Found by payment id alone: refunds carry no order id when metadata is missing.
    expect((await settle(t, refund({ paymentIntentId: `pi_${orderId}` }))).outcome).toBe("applied");
    expect((await table(t, "plan_grants"))[0]).toMatchObject({ revokeReason: "refund" });
    expect(await seat(t, seatNumber)).toMatchObject({ status: "free" });
    expect((await orderRow(t, orderId))?.status).toBe("refunded");
    expect((await plan(t, member)).plan).toBe("free");
    expect((await settle(t, refund({ paymentIntentId: `pi_${orderId}` }))).outcome).toBe("ignored");
  });

  test("dispute on lifetime (O9): open suspends, won restores, lost revokes, frees the seat and flags", async () => {
    const t = setup();
    await seedSeats(t);
    const { member, orderId, seatNumber } = await lifetimeBuyer(t);
    await settle(t, paid(orderId, seatNumber));
    const on = { orderId, paymentIntentId: `pi_${orderId}` };
    await settle(t, dispute("open", on));
    expect((await plan(t, member)).plan).toBe("free");
    expect((await orderRow(t, orderId))?.status).toBe("disputed");
    expect(await order(t, member, "monthly").catch((error: Error) => error.message)).toMatch(/ACCOUNT_REVIEW/);
    await settle(t, dispute("won", on));
    expect((await plan(t, member)).plan).toBe("builders_hub");
    expect((await orderRow(t, orderId))?.status).toBe("paid");
    await settle(t, dispute("lost", on));
    expect((await table(t, "plan_grants"))[0]).toMatchObject({ revokeReason: "dispute_lost" });
    expect(await seat(t, seatNumber)).toMatchObject({ status: "free" });
    expect(await order(t, member, "monthly").catch((error: Error) => error.message)).toMatch(/ACCOUNT_REVIEW/);
    expect((await settle(t, dispute("lost", { ...on }))).outcome).toBe("ignored");
    // The operator clears the flag: the grant stays revoked, the account may buy again.
    expect(await t.mutation(internal.platform.membership.events.clearReview, { ownerId: member.userId })).toEqual({ cleared: 1 });
    expect((await table(t, "plan_grants"))[0]).toMatchObject({ revokeReason: "operator" });
    expect((await plan(t, member)).plan).toBe("free");
    expect((await order(t, member, "monthly")).ok).toBe(true);
  });

  test("O5: a subscriber who buys lifetime has the subscription end at period end, once", async () => {
    const t = setup();
    await seedSeats(t);
    const member = await seedUser(t);
    const monthly = await order(t, member, "monthly");
    await settle(t, subscriptionEvent(snapshot(monthly.orderId)));
    const lifetime = await order(t, member, "lifetime");
    const result = await settle(t, paid(lifetime.orderId, lifetime.seatNumber as number));
    expect(result.actions).toEqual([{ type: "cancel_at_period_end", subscriptionId: "sub_one" }]);
    await settle(t, subscriptionEvent(snapshot(monthly.orderId, { cancelAtPeriodEnd: true, snapshotAt: 2_000 })));
    const replay = await settle(t, paid(lifetime.orderId, lifetime.seatNumber as number));
    expect(replay.actions).toEqual([]);
  });

  test("the seat cap holds: 50 paid seats, then a late payment is refunded and the 51st buyer is sold out", async () => {
    const t = setup();
    await seedSeats(t);
    const late = await lifetimeBuyer(t);
    await t.run(async (ctx) => {
      const row = await ctx.db.query("founding_seats").withIndex("by_seatNumber", (q) => q.eq("seatNumber", 1)).unique();
      await ctx.db.patch("founding_seats", row!._id, { reservedUntil: Date.now() - 1 });
    });
    for (let i = 0; i < 50; i += 1) {
      const buyer = await lifetimeBuyer(t);
      await settle(t, paid(buyer.orderId, buyer.seatNumber));
    }
    const result = await settle(t, paid(late.orderId, 1));
    expect(result.actions).toEqual([{ type: "refund_payment", paymentIntentId: `pi_${late.orderId}` }]);
    const counts = await t.query(internal.platform.membership.events.counts, {});
    expect(counts.seats).toEqual({ free: 0, reserved: 0, taken: 50, overflow: false });
    const grants = await table(t, "plan_grants");
    expect(grants).toHaveLength(50);
    expect(new Set(grants.map((row) => row.seatNumber)).size).toBe(50);
    await expect(order(t, await seedUser(t), "lifetime")).rejects.toThrow(/SOLD_OUT/);
  });
});

describe("WP64-S4 reconcile helpers", () => {
  test("releaseExpiredHolds frees lapsed holds only, and is safe to run twice", async () => {
    const t = setup();
    await seedSeats(t);
    const lapsed = await lifetimeBuyer(t);
    const live = await lifetimeBuyer(t);
    await t.run(async (ctx) => {
      const row = await ctx.db.query("founding_seats").withIndex("by_seatNumber", (q) => q.eq("seatNumber", lapsed.seatNumber)).unique();
      await ctx.db.patch("founding_seats", row!._id, { reservedUntil: Date.now() - 1 });
    });
    expect(await t.mutation(internal.platform.membership.events.releaseExpiredHolds, {})).toEqual({ released: 1 });
    expect(await t.mutation(internal.platform.membership.events.releaseExpiredHolds, {})).toEqual({ released: 0 });
    expect(await seat(t, lapsed.seatNumber)).toMatchObject({ status: "free" });
    expect(await seat(t, live.seatNumber)).toMatchObject({ status: "reserved", orderId: live.orderId });
    expect((await orderRow(t, lapsed.orderId))?.status).toBe("expired");
  });

  test("applySnapshot settles a fresh snapshot with the same rules and no ledger row", async () => {
    const t = setup();
    const member = await seedUser(t);
    const opened = await order(t, member, "monthly");
    const apply = (subscription: SubscriptionSnapshot) =>
      t.mutation(internal.platform.membership.events.applySnapshot, { livemode: false, subscription });
    expect(await apply(snapshot(opened.orderId))).toEqual({ outcome: "applied", actions: [] });
    expect(await apply(snapshot(opened.orderId))).toEqual({ outcome: "stale", actions: [] });
    expect(await table(t, "billing_events")).toHaveLength(0);
    expect((await plan(t, member)).plan).toBe("builders_hub");
  });

  test("runningSubscriptionIds lists running subscriptions in one mode", async () => {
    const t = setup();
    const a = await order(t, await seedUser(t), "monthly");
    const b = await order(t, await seedUser(t), "monthly");
    await settle(t, subscriptionEvent(snapshot(a.orderId)));
    await settle(t, subscriptionEvent(snapshot(b.orderId, { subscriptionId: "sub_ended", customerId: "cus_two", status: "canceled" })));
    expect(await t.query(internal.platform.membership.events.runningSubscriptionIds, { livemode: false })).toEqual({
      ids: ["sub_one"],
      capped: false,
    });
    expect(await t.query(internal.platform.membership.events.runningSubscriptionIds, { livemode: true })).toEqual({
      ids: [],
      capped: false,
    });
  });

  test("counts report outcomes and statuses only", async () => {
    const t = setup();
    await seedSeats(t);
    const opened = await order(t, await seedUser(t), "monthly");
    await settle(t, subscriptionEvent(snapshot(opened.orderId)));
    await settle(t, subscriptionEvent(snapshot(null, { subscriptionId: "sub_foreign" })));
    const counts = await t.query(internal.platform.membership.events.counts, {});
    expect(counts).toEqual({
      events: { applied: 1, ignored: 1 },
      subscriptions: { active: 1 },
      seats: { free: 50, reserved: 0, taken: 0, overflow: false },
      capped: false,
    });
    expect(JSON.stringify(counts)).not.toMatch(/@|sub_|cus_|evt_/);
  });
});

describe("WP64-S4 the signed bridge for server events", () => {
  const accept = (t: T, payload: MembershipBridgePayload, secret = SECRET) =>
    t.action(api.platform.membership.provider.accept, signMembershipBridge(payload, secret));
  const errorCode = async (run: () => Promise<unknown>) => {
    try {
      await run();
    } catch (error) {
      return (error as { data?: { code?: unknown } }).data?.code ?? String(error);
    }
    return "no error";
  };

  test("a fresh signed event settles without a member session", async () => {
    vi.stubEnv("MEMBERSHIP_BILLING_BRIDGE_SECRET", SECRET);
    const t = setup();
    const opened = await order(t, await seedUser(t), "monthly");
    const event = subscriptionEvent(snapshot(opened.orderId));
    expect(await accept(t, { kind: "event", issuedAt: Date.now(), event })).toEqual({ outcome: "applied", duplicate: false, actions: [] });
    expect(await accept(t, { kind: "running_subscriptions", issuedAt: Date.now(), livemode: false })).toEqual({
      ids: ["sub_one"],
      capped: false,
    });
    expect(await accept(t, { kind: "release_expired_holds", issuedAt: Date.now() })).toEqual({ released: 0 });
    expect(
      await accept(t, {
        kind: "subscription_snapshot",
        issuedAt: Date.now(),
        livemode: false,
        subscription: snapshot(opened.orderId, { snapshotAt: 9_000 }),
      }),
    ).toEqual({ outcome: "applied", actions: [] });
  });

  test("a stale, forged or malformed server payload writes nothing", async () => {
    vi.stubEnv("MEMBERSHIP_BILLING_BRIDGE_SECRET", SECRET);
    const t = setup();
    const opened = await order(t, await seedUser(t), "monthly");
    const event = subscriptionEvent(snapshot(opened.orderId));
    const old = Date.now() - MEMBERSHIP_BRIDGE_MAX_AGE_MS - 1_000;
    expect(await errorCode(() => accept(t, { kind: "event", issuedAt: old, event }))).toBe("STALE_BRIDGE_PAYLOAD");
    const ahead = Date.now() + MEMBERSHIP_BRIDGE_MAX_AGE_MS + 60_000;
    expect(await errorCode(() => accept(t, { kind: "event", issuedAt: ahead, event }))).toBe("STALE_BRIDGE_PAYLOAD");
    expect(
      await errorCode(() => accept(t, { kind: "event", issuedAt: Date.now(), event }, "forged-bridge-test-secret-0123456789abcdef")),
    ).toBe("INVALID_BRIDGE_SIGNATURE");
    const malformed = { kind: "event", issuedAt: Date.now(), event: { ...event, livemode: "yes" } };
    expect(await errorCode(() => accept(t, malformed as unknown as MembershipBridgePayload))).not.toBe("no error");
    expect(await table(t, "plan_subscriptions")).toHaveLength(0);
    expect(await table(t, "billing_events")).toHaveLength(0);
  });
});
