/// <reference types="vite/client" />

import { register as registerRateLimiter } from "@convex-dev/rate-limiter/test";
import { convexTest, type TestConvex } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { signMembershipBridge } from "../lib/membership-bridge";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { SubscriptionSnapshot } from "./platform/membership/events";
import schema from "./schema";

// WP64-S5. The Billing Portal opens only for the member's own Stripe
// customer, and what the portal changes reaches the billing page through
// settlement: past due keeps access, unpaid and canceled end it, cancel at
// period end keeps it to a stated date, and a plan switch changes the term.

const modules = import.meta.glob("./**/*.ts");
const SECRET = "membership-bridge-test-secret-0123456789abcdef";
const PERIOD_END = 1_900_000_000_000;

type T = TestConvex<typeof schema>;
type Member = { userId: Id<"users">; sessionId: Id<"authSessions"> };

afterEach(() => {
  vi.unstubAllEnvs();
});

function setup() {
  const t = convexTest(schema, modules);
  registerRateLimiter(t);
  return t;
}

let counter = 0;
async function seedUser(t: T) {
  counter += 1;
  const n = counter;
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { email: `portal${n}@example.test`, emailVerificationTime: 1 });
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

const openPortal = (t: T, member: Member, livemode = false) =>
  asUser(t, member).mutation(internal.platform.membership.portal.open, { livemode });

/** A paid subscription the way settlement stores it: order, customer link and row. */
async function subscribe(t: T, member: Member, extra: Partial<SubscriptionSnapshot> = {}, livemode = false) {
  counter += 1;
  const opened = await asUser(t, member).mutation(internal.platform.membership.checkout.begin, {
    term: extra.priceKey === "annual" ? "annual" : "monthly",
    idempotencyKey: `membership:portal-key-${counter.toString().padStart(8, "0")}`,
    livemode,
  });
  if (!opened.ok) throw new Error(`expected an order, got ${opened.code}`);
  const subscription = snapshot(opened.orderId, { customerId: `cus_${member.userId}`, subscriptionId: `sub_${counter}`, ...extra });
  await settle(t, subscription, livemode);
  return subscription;
}

function snapshot(orderId: string, extra: Partial<SubscriptionSnapshot> = {}): SubscriptionSnapshot {
  return {
    subscriptionId: "sub_one",
    customerId: "cus_one",
    orderId,
    status: "active",
    priceKey: "monthly",
    quantity: 1,
    currentPeriodEnd: PERIOD_END,
    cancelAtPeriodEnd: false,
    endedAt: null,
    snapshotAt: 1_000,
    ...extra,
  };
}

let events = 0;
const settle = (t: T, subscription: SubscriptionSnapshot, livemode = false) =>
  t.mutation(internal.platform.membership.events.settle, {
    event: { kind: "subscription", eventId: `evt_portal_${(events += 1)}`, eventType: "customer.subscription.updated", livemode, subscription },
  });

const mine = (t: T, member: Member) => asUser(t, member).query(api.platform.entitlements.mine, {});

async function errorCode(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run();
  } catch (error) {
    return (error as { data?: { code?: unknown } }).data?.code ?? String(error);
  }
  return "no error";
}

describe("WP64-S5 which customer the portal opens", () => {
  test("a subscriber gets their own customer; Free, comp and lifetime members get nothing to manage", async () => {
    const t = setup();
    const subscriber = await seedUser(t);
    const own = await subscribe(t, subscriber);
    expect(await openPortal(t, subscriber)).toEqual({ customerId: `cus_${subscriber.userId}`, subscriptionId: own.subscriptionId });

    const free = await seedUser(t);
    expect(await openPortal(t, free)).toEqual({ ok: false, code: "INVALID_REQUEST" });
    const lifetime = await seedUser(t);
    await t.run((ctx) => ctx.db.insert("plan_grants", { ownerId: lifetime.userId, kind: "lifetime", seatNumber: 3, grantedAt: 1 }));
    expect(await openPortal(t, lifetime)).toEqual({ ok: false, code: "INVALID_REQUEST" });
  });

  test("an ended subscription still opens the portal, for invoices and a card update", async () => {
    const t = setup();
    const member = await seedUser(t);
    const own = await subscribe(t, member, { status: "unpaid" });
    expect(await openPortal(t, member)).toEqual({ customerId: `cus_${member.userId}`, subscriptionId: own.subscriptionId });
  });

  test("only the mode the deployment runs in", async () => {
    const t = setup();
    const member = await seedUser(t);
    const own = await subscribe(t, member, { customerId: "cus_test_side" });
    expect(await openPortal(t, member, true)).toEqual({ ok: false, code: "INVALID_REQUEST" });
    // A newer subscription in the other mode never hides this mode's customer.
    // Inserted directly: one deployment runs one mode, so checkout never opens both.
    await t.run(async (ctx) => {
      await ctx.db.insert("plan_subscriptions", {
        ownerId: member.userId,
        stripeSubscriptionId: "sub_live_side",
        stripeCustomerId: "cus_live_side",
        term: "monthly",
        status: "active",
        cancelAtPeriodEnd: false,
        snapshotAt: 5_000,
        updatedAt: Date.now() + 1_000,
        livemode: true,
      });
      await ctx.db.insert("billing_customers", { ownerId: member.userId, stripeCustomerId: "cus_live_side", livemode: true, createdAt: 1 });
    });
    expect(await openPortal(t, member, false)).toEqual({ customerId: "cus_test_side", subscriptionId: own.subscriptionId });
    expect(await openPortal(t, member, true)).toEqual({ customerId: "cus_live_side", subscriptionId: "sub_live_side" });
  });

  test("the newest subscription's customer", async () => {
    const t = setup();
    const member = await seedUser(t);
    await subscribe(t, member, { status: "canceled", endedAt: 1_500, snapshotAt: 1_500, customerId: "cus_old" });
    const newest = await subscribe(t, member, { customerId: "cus_new", snapshotAt: 2_000 });
    expect(await openPortal(t, member)).toEqual({ customerId: "cus_new", subscriptionId: newest.subscriptionId });
  });

  test("a customer linked to anyone else is never opened", async () => {
    const t = setup();
    const member = await seedUser(t);
    await subscribe(t, member);
    const other = await seedUser(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("billing_customers", {
        ownerId: other.userId,
        stripeCustomerId: `cus_${member.userId}`,
        livemode: false,
        createdAt: 1,
      });
    });
    expect(await openPortal(t, member)).toEqual({ ok: false, code: "INVALID_REQUEST" });
    expect(await openPortal(t, other)).toEqual({ ok: false, code: "INVALID_REQUEST" });
  });

  test("a row whose customer was never linked is not opened", async () => {
    const t = setup();
    const member = await seedUser(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("plan_subscriptions", {
        ownerId: member.userId,
        stripeSubscriptionId: "sub_bare",
        stripeCustomerId: "cus_bare",
        term: "monthly",
        status: "active",
        cancelAtPeriodEnd: false,
        snapshotAt: 1,
        updatedAt: 1,
        livemode: false,
      });
    });
    expect(await openPortal(t, member)).toEqual({ ok: false, code: "INVALID_REQUEST" });
  });

  test("a customer linked only in the other mode is not opened", async () => {
    const t = setup();
    const member = await seedUser(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("plan_subscriptions", {
        ownerId: member.userId,
        stripeSubscriptionId: "sub_mixed",
        stripeCustomerId: "cus_mixed",
        term: "monthly",
        status: "active",
        cancelAtPeriodEnd: false,
        snapshotAt: 1,
        updatedAt: 1,
        livemode: false,
      });
      await ctx.db.insert("billing_customers", { ownerId: member.userId, stripeCustomerId: "cus_mixed", livemode: true, createdAt: 1 });
    });
    expect(await openPortal(t, member)).toEqual({ ok: false, code: "INVALID_REQUEST" });
  });

  test("the hourly limit holds even when calls are spread out", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const t = setup();
      const member = await seedUser(t);
      await subscribe(t, member);
      let now = Date.now();
      const results = [];
      for (let round = 0; round < 7; round += 1) {
        for (let i = 0; i < 5; i += 1) results.push(await openPortal(t, member));
        now += 61_000;
        vi.setSystemTime(now);
      }
      // 35 calls in about six minutes: the burst limit never bites, the hourly one does.
      // The hourly bucket refills half a call a minute, so a few past 30 still get through.
      expect(results.slice(0, 30).every((result) => "customerId" in result)).toBe(true);
      expect(results.at(-1)).toEqual({ ok: false, code: "RATE_LIMITED" });
      expect(results.filter((result) => "customerId" in result).length).toBeLessThan(35);
    } finally {
      vi.useRealTimers();
    }
  });

  test("signed-in members only, and rate limited per member", async () => {
    const t = setup();
    expect(await errorCode(() => t.mutation(internal.platform.membership.portal.open, { livemode: false }))).toBe("UNAUTHENTICATED");
    const [a, b] = [await seedUser(t), await seedUser(t)];
    await subscribe(t, a);
    const results = [];
    for (let i = 0; i < 6; i += 1) results.push(await openPortal(t, a));
    expect(results.slice(0, 5).every((result) => "customerId" in result)).toBe(true);
    expect(results[5]).toEqual({ ok: false, code: "RATE_LIMITED" });
    expect(await openPortal(t, b)).toEqual({ ok: false, code: "INVALID_REQUEST" });
  });
});

describe("WP64-S5 the signed bridge", () => {
  test("open_portal acts for the signed-in member only", async () => {
    vi.stubEnv("MEMBERSHIP_BILLING_BRIDGE_SECRET", SECRET);
    const t = setup();
    const member = await seedUser(t);
    const own = await subscribe(t, member);
    const signed = signMembershipBridge({ kind: "open_portal", livemode: false }, SECRET);
    expect(await asUser(t, member).action(api.platform.membership.provider.accept, signed)).toEqual({
      customerId: `cus_${member.userId}`,
      subscriptionId: own.subscriptionId,
    });
    expect(await t.action(api.platform.membership.provider.accept, signed)).toEqual({ ok: false, code: "AUTHENTICATION_REQUIRED" });
    const forged = signMembershipBridge({ kind: "open_portal", livemode: false }, "forged-bridge-test-secret-0123456789abcdef");
    expect(await errorCode(() => asUser(t, member).action(api.platform.membership.provider.accept, forged))).toBe(
      "INVALID_BRIDGE_SIGNATURE",
    );
  });
});

describe("WP64-S5 what the portal changes reaches the billing page", () => {
  test("a failed renewal keeps access while Stripe retries (past due), then ends it (unpaid)", async () => {
    const t = setup();
    const member = await seedUser(t);
    const first = await subscribe(t, member);
    await settle(t, { ...first, status: "past_due", snapshotAt: 2_000 });
    expect(await mine(t, member)).toMatchObject({
      plan: "builders_hub",
      billing: { term: "monthly", status: "past_due", renewsAt: PERIOD_END, endsAt: null },
    });
    await settle(t, { ...first, status: "unpaid", snapshotAt: 3_000 });
    expect(await mine(t, member)).toMatchObject({
      plan: "free",
      billing: { term: "monthly", status: "unpaid", renewsAt: null, endsAt: null },
    });
    // A new card pays the open invoice and Stripe reactivates it.
    await settle(t, { ...first, status: "active", snapshotAt: 4_000 });
    expect((await mine(t, member)).plan).toBe("builders_hub");
  });

  test("cancel at period end keeps access to the stated date; the end removes it", async () => {
    const t = setup();
    const member = await seedUser(t);
    const first = await subscribe(t, member);
    await settle(t, { ...first, cancelAtPeriodEnd: true, snapshotAt: 2_000 });
    expect(await mine(t, member)).toMatchObject({
      plan: "builders_hub",
      billing: { status: "active", renewsAt: null, endsAt: PERIOD_END },
    });
    // Changed their mind in the portal before the date.
    await settle(t, { ...first, cancelAtPeriodEnd: false, snapshotAt: 2_500 });
    expect((await mine(t, member)).billing).toMatchObject({ renewsAt: PERIOD_END, endsAt: null });
    await settle(t, { ...first, status: "canceled", endedAt: PERIOD_END, snapshotAt: 3_000 });
    expect(await mine(t, member)).toMatchObject({ plan: "free", billing: { status: "canceled", endsAt: PERIOD_END } });
  });

  test("monthly to annual applies at once; annual to monthly waits for the renewal", async () => {
    const t = setup();
    const member = await seedUser(t);
    const first = await subscribe(t, member);
    const annualEnd = PERIOD_END + 365 * 24 * 60 * 60 * 1000;
    await settle(t, { ...first, priceKey: "annual", currentPeriodEnd: annualEnd, snapshotAt: 2_000 });
    expect((await mine(t, member)).billing).toMatchObject({ term: "annual", renewsAt: annualEnd });
    // The portal schedules the switch back: until the renewal, Stripe still reports annual.
    await settle(t, { ...first, priceKey: "annual", currentPeriodEnd: annualEnd, snapshotAt: 2_500 });
    expect((await mine(t, member)).billing.term).toBe("annual");
    await settle(t, { ...first, priceKey: "monthly", currentPeriodEnd: annualEnd + 30 * 24 * 60 * 60 * 1000, snapshotAt: 3_000 });
    expect((await mine(t, member)).billing.term).toBe("monthly");
  });

  test("a Price that is not a subscription Price keeps the term but still carries Stripe's status", async () => {
    const t = setup();
    const member = await seedUser(t);
    const first = await subscribe(t, member);
    expect((await settle(t, { ...first, priceKey: "lifetime_t1", snapshotAt: 2_000 })).outcome).toBe("applied");
    expect((await mine(t, member)).billing.term).toBe("monthly");
    expect((await settle(t, { ...first, priceKey: null, status: "past_due", snapshotAt: 2_100 })).outcome).toBe("applied");
    expect((await mine(t, member)).billing).toMatchObject({ term: "monthly", status: "past_due" });
  });
});
