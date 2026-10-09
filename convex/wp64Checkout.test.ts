/// <reference types="vite/client" />

import { register as registerRateLimiter } from "@convex-dev/rate-limiter/test";
import { convexTest, type TestConvex } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { MEMBERSHIP_ERROR_CODES } from "../app/api/platform/membership/_contract";
import { signMembershipBridge, type MembershipBridgePayload } from "../lib/membership-bridge";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { CHECKOUT_REFUSAL_CODES, RESERVATION_MS, SESSION_GRACE_MS } from "./platform/membership/checkout";
import type { FoundingWindows } from "./platform/membership/windows";
import schema from "./schema";

// WP64-S3. Membership orders and founding seat reservations.

const windows = vi.hoisted(() => ({ buyers: null, newsletter: null, everyone: null }) as FoundingWindows);
vi.mock("./platform/membership/windows", () => ({ FOUNDING_WINDOWS: windows }));

const modules = import.meta.glob("./**/*.ts");
const SECRET = "membership-bridge-test-secret-0123456789abcdef";

type T = TestConvex<typeof schema>;
type Member = { userId: Id<"users">; sessionId: Id<"authSessions"> };

afterEach(() => {
  Object.assign(windows, { buyers: null, newsletter: null, everyone: null });
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

function setup() {
  const t = convexTest(schema, modules);
  registerRateLimiter(t);
  return t;
}

let emails = 0;
async function seedUser(t: T, extra: { emailVerificationTime?: number; isAnonymous?: boolean } = { emailVerificationTime: 1 }) {
  emails += 1;
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { email: `member${emails}@example.test`, ...extra });
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

let keys = 0;
const newKey = () => `membership:test-key-${(keys += 1).toString().padStart(8, "0")}`;

function begin(t: T, member: Member, term: "monthly" | "annual" | "lifetime", idempotencyKey = newKey(), livemode = false) {
  return asUser(t, member).mutation(internal.platform.membership.checkout.begin, { term, idempotencyKey, livemode });
}

async function seedSeats(t: T) {
  await t.mutation(internal.platform.membership.seats.seed, { apply: true });
}

function openEveryone() {
  Object.assign(windows, { buyers: null, newsletter: null, everyone: 1 });
}

const orders = (t: T) => t.run((ctx) => ctx.db.query("membership_orders").take(100));
const seat = (t: T, seatNumber: number) =>
  t.run((ctx) =>
    ctx.db
      .query("founding_seats")
      .withIndex("by_seatNumber", (q) => q.eq("seatNumber", seatNumber))
      .unique(),
  );

async function errorCode(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run();
  } catch (error) {
    return (error as { data?: { code?: unknown } }).data?.code ?? String(error);
  }
  return "no error";
}

async function subscribe(t: T, member: Member, status: "active" | "past_due" | "canceled" = "active") {
  await t.run(async (ctx) => {
    await ctx.db.insert("plan_subscriptions", {
      ownerId: member.userId,
      stripeSubscriptionId: `sub_${member.userId}`,
      stripeCustomerId: `cus_${member.userId}`,
      term: "monthly",
      status,
      cancelAtPeriodEnd: false,
      snapshotAt: 1,
      updatedAt: 1,
      livemode: false,
    });
  });
}

async function grant(t: T, member: Member, kind: "lifetime" | "comp", extra: Record<string, unknown> = {}) {
  await t.run(async (ctx) => {
    await ctx.db.insert("plan_grants", { ownerId: member.userId, kind, grantedAt: 1, ...extra });
  });
}

describe("WP64-S3 subscription orders", () => {
  test("a verified free member opens a monthly order; the same key returns the same order", async () => {
    const t = setup();
    const member = await seedUser(t);
    const key = newKey();
    const first = await begin(t, member, "monthly", key);
    expect(first).toMatchObject({
      ok: true,
      term: "monthly",
      priceKey: "monthly",
      seatNumber: null,
      sessionExpiresAt: null,
      checkoutSessionId: null,
      stripeCustomerId: null,
      supersede: [],
    });
    expect(first.ok && first.email).toMatch(/^member\d+@example\.test$/);
    const again = await begin(t, member, "monthly", key);
    expect(again.ok && again.orderId).toBe(first.ok && first.orderId);
    const rows = await orders(t);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: "pending", livemode: false, ownerId: member.userId, idempotencyKey: key });
  });

  test("the same key for another term or mode is refused", async () => {
    const t = setup();
    const member = await seedUser(t);
    const key = newKey();
    await begin(t, member, "monthly", key);
    expect(await begin(t, member, "annual", key)).toEqual({ ok: false, code: "INVALID_REQUEST" });
    expect(await begin(t, member, "monthly", key, true)).toEqual({ ok: false, code: "INVALID_REQUEST" });
    expect(await begin(t, member, "monthly", "short")).toEqual({ ok: false, code: "INVALID_REQUEST" });
    expect(await orders(t)).toHaveLength(1);
  });

  test("two members get separate orders, and keys are per member", async () => {
    const t = setup();
    const [a, b] = [await seedUser(t), await seedUser(t)];
    const key = newKey();
    const first = await begin(t, a, "monthly", key);
    const second = await begin(t, b, "monthly", key);
    expect(first.ok && second.ok && first.orderId !== second.orderId).toBe(true);
  });

  test("an unverified email, an anonymous user and no session are refused before any write", async () => {
    const t = setup();
    const unverified = await seedUser(t, {});
    expect(await begin(t, unverified, "monthly")).toEqual({ ok: false, code: "EMAIL_NOT_VERIFIED" });
    const anonymous = await seedUser(t, { emailVerificationTime: 1, isAnonymous: true });
    expect(await errorCode(() => begin(t, anonymous, "monthly"))).toBe("UNAUTHENTICATED");
    expect(
      await errorCode(() =>
        t.mutation(internal.platform.membership.checkout.begin, { term: "monthly", idempotencyKey: newKey(), livemode: false }),
      ),
    ).toBe("UNAUTHENTICATED");
    expect(await orders(t)).toHaveLength(0);
  });

  test("one plan per member: a live subscription, a comp or a lifetime grant already has it", async () => {
    const t = setup();
    const subscriber = await seedUser(t);
    await subscribe(t, subscriber);
    expect(await begin(t, subscriber, "annual")).toEqual({ ok: false, code: "ALREADY_SUBSCRIBED" });
    const pastDue = await seedUser(t);
    await subscribe(t, pastDue, "past_due");
    expect(await begin(t, pastDue, "monthly")).toEqual({ ok: false, code: "ALREADY_SUBSCRIBED" });
    const comp = await seedUser(t);
    await grant(t, comp, "comp");
    expect(await begin(t, comp, "monthly")).toEqual({ ok: false, code: "ALREADY_SUBSCRIBED" });
    const lifetime = await seedUser(t);
    await grant(t, lifetime, "lifetime", { seatNumber: 3 });
    expect(await begin(t, lifetime, "monthly")).toEqual({ ok: false, code: "ALREADY_SUBSCRIBED" });
    // A canceled subscription no longer counts.
    const lapsed = await seedUser(t);
    await subscribe(t, lapsed, "canceled");
    expect((await begin(t, lapsed, "monthly")).ok).toBe(true);
    expect(await orders(t)).toHaveLength(1);
  });

  test("a lost dispute flags the account (O9)", async () => {
    const t = setup();
    const member = await seedUser(t);
    await grant(t, member, "lifetime", { seatNumber: 4, revokedAt: 2, revokeReason: "dispute_lost" });
    expect(await begin(t, member, "monthly")).toEqual({ ok: false, code: "ACCOUNT_REVIEW" });
    expect(await begin(t, member, "lifetime")).toEqual({ ok: false, code: "ACCOUNT_REVIEW" });
  });

  test("a new attempt lists the member's other open sessions for the route to expire", async () => {
    const t = setup();
    const member = await seedUser(t);
    const first = await begin(t, member, "monthly");
    if (!first.ok) throw new Error("expected an order");
    await asUser(t, member).mutation(internal.platform.membership.checkout.attachSession, {
      orderId: first.orderId,
      checkoutSessionId: "cs_test_first",
    });
    const second = await begin(t, member, "annual");
    expect(second).toMatchObject({ ok: true, term: "annual", supersede: ["cs_test_first"] });
    // Never on a replay.
    const replay = await begin(t, member, "annual", (await orders(t)).find((o) => o.term === "annual")!.idempotencyKey);
    expect(replay).toMatchObject({ ok: true, supersede: [] });
  });

  test("open sessions from the other mode are left alone", async () => {
    const t = setup();
    const member = await seedUser(t);
    const live = await begin(t, member, "monthly", newKey(), true);
    if (!live.ok) throw new Error("expected an order");
    await asUser(t, member).mutation(internal.platform.membership.checkout.attachSession, {
      orderId: live.orderId,
      checkoutSessionId: "cs_live_other",
    });
    expect(await begin(t, member, "annual")).toMatchObject({ ok: true, supersede: [] });
  });

  test("a paid order is not reopened, and a day-old order is not replayed", async () => {
    const t = setup();
    const member = await seedUser(t);
    const key = newKey();
    const first = await begin(t, member, "monthly", key);
    if (!first.ok) throw new Error("expected an order");
    await t.run((ctx) => ctx.db.patch("membership_orders", first.orderId, { status: "paid" }));
    expect(await begin(t, member, "monthly", key)).toEqual({ ok: false, code: "ALREADY_SUBSCRIBED" });

    const oldKey = newKey();
    const old = await begin(t, member, "annual", oldKey);
    if (!old.ok) throw new Error("expected an order");
    await t.run((ctx) => ctx.db.patch("membership_orders", old.orderId, { createdAt: Date.now() - 23 * 60 * 60 * 1000 - 1 }));
    expect(await begin(t, member, "annual", oldKey)).toEqual({ ok: false, code: "INVALID_REQUEST" });
  });

  test("an existing Stripe customer in the same mode is reused", async () => {
    const t = setup();
    const member = await seedUser(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("billing_customers", { ownerId: member.userId, stripeCustomerId: "cus_live", livemode: true, createdAt: 1 });
      await ctx.db.insert("billing_customers", { ownerId: member.userId, stripeCustomerId: "cus_test", livemode: false, createdAt: 1 });
    });
    expect(await begin(t, member, "monthly")).toMatchObject({ ok: true, stripeCustomerId: "cus_test" });
  });
});

describe("WP64-S3 founding seats", () => {
  test("closed windows refuse lifetime, with the opening date when it is set", async () => {
    const t = setup();
    await seedSeats(t);
    const member = await seedUser(t);
    expect(await begin(t, member, "lifetime")).toEqual({ ok: false, code: "NOT_YET_ELIGIBLE" });
    const later = Date.now() + 86_400_000;
    Object.assign(windows, { buyers: null, newsletter: null, everyone: later });
    expect(await begin(t, member, "lifetime")).toEqual({ ok: false, code: "NOT_YET_ELIGIBLE", opensAt: later });
    expect(await orders(t)).toHaveLength(0);
  });

  test("the lowest free seat is reserved in the same step, with the tranche's price", async () => {
    const t = setup();
    await seedSeats(t);
    openEveryone();
    const [a, b] = [await seedUser(t), await seedUser(t)];
    const before = Date.now();
    const first = await begin(t, a, "lifetime");
    const after = Date.now();
    expect(first).toMatchObject({ ok: true, term: "lifetime", priceKey: "lifetime_t1", seatNumber: 1 });
    const held = await seat(t, 1);
    expect(held).toMatchObject({ status: "reserved", ownerId: a.userId, orderId: first.ok && first.orderId });
    expect(held!.reservedUntil!).toBeGreaterThanOrEqual(before + RESERVATION_MS);
    expect(held!.reservedUntil!).toBeLessThanOrEqual(after + RESERVATION_MS);
    expect(first.ok && first.sessionExpiresAt).toBe(held!.reservedUntil! - SESSION_GRACE_MS);
    expect(await begin(t, b, "lifetime")).toMatchObject({ ok: true, seatNumber: 2, priceKey: "lifetime_t1" });
  });

  test("seat 16 is the second tranche", async () => {
    const t = setup();
    await seedSeats(t);
    openEveryone();
    await t.run(async (ctx) => {
      const rows = await ctx.db.query("founding_seats").withIndex("by_seatNumber").take(15);
      for (const row of rows) await ctx.db.patch("founding_seats", row._id, { status: "taken" });
    });
    expect(await begin(t, await seedUser(t), "lifetime")).toMatchObject({ ok: true, seatNumber: 16, priceKey: "lifetime_t2" });
  });

  test("an unseeded or full table is sold out", async () => {
    const t = setup();
    openEveryone();
    const member = await seedUser(t);
    expect(await begin(t, member, "lifetime")).toEqual({ ok: false, code: "SOLD_OUT" });
    await seedSeats(t);
    await t.run(async (ctx) => {
      for (const row of await ctx.db.query("founding_seats").withIndex("by_seatNumber").take(50)) {
        await ctx.db.patch("founding_seats", row._id, { status: "taken" });
      }
    });
    expect(await begin(t, member, "lifetime")).toEqual({ ok: false, code: "SOLD_OUT" });
    expect(await orders(t)).toHaveLength(0);
  });

  test("one open reservation per member: a second attempt continues the first", async () => {
    const t = setup();
    await seedSeats(t);
    openEveryone();
    const member = await seedUser(t);
    const first = await begin(t, member, "lifetime");
    const second = await begin(t, member, "lifetime");
    expect(second.ok && second.orderId).toBe(first.ok && first.orderId);
    expect(await orders(t)).toHaveLength(1);
    expect(await seat(t, 2)).toMatchObject({ status: "free" });
  });

  test("a lapsed hold is taken back: its order expires and the seat goes to the next buyer", async () => {
    const t = setup();
    await seedSeats(t);
    openEveryone();
    const [a, b] = [await seedUser(t), await seedUser(t)];
    const first = await begin(t, a, "lifetime");
    if (!first.ok) throw new Error("expected an order");
    await t.run(async (ctx) => {
      const row = await ctx.db.query("founding_seats").withIndex("by_seatNumber", (q) => q.eq("seatNumber", 1)).unique();
      await ctx.db.patch("founding_seats", row!._id, { reservedUntil: Date.now() - 1 });
    });
    expect(await begin(t, b, "lifetime")).toMatchObject({ ok: true, seatNumber: 1 });
    expect(await seat(t, 1)).toMatchObject({ ownerId: b.userId });
    const rows = await orders(t);
    expect(rows.find((o) => o._id === first.orderId)?.status).toBe("expired");
    // A's key now refuses: the seat is no longer theirs.
    expect(await begin(t, a, "lifetime", rows.find((o) => o._id === first.orderId)!.idempotencyKey)).toEqual({
      ok: false,
      code: "INVALID_REQUEST",
    });
  });

  test("a free seat below a lapsed hold goes first", async () => {
    const t = setup();
    await seedSeats(t);
    openEveryone();
    await t.run(async (ctx) => {
      for (const seatNumber of [1, 2, 3]) {
        const row = await ctx.db.query("founding_seats").withIndex("by_seatNumber", (q) => q.eq("seatNumber", seatNumber)).unique();
        if (seatNumber === 1) continue;
        await ctx.db.patch("founding_seats", row!._id, seatNumber === 3 ? { status: "reserved", reservedUntil: 1 } : { status: "taken" });
      }
    });
    expect(await begin(t, await seedUser(t), "lifetime")).toMatchObject({ ok: true, seatNumber: 1 });
    expect(await begin(t, await seedUser(t), "lifetime")).toMatchObject({ ok: true, seatNumber: 3 });
  });

  test("the hold lasts 35 minutes and the session closes 4 minutes before it, above Stripe's 30", () => {
    expect(RESERVATION_MS).toBe(35 * 60 * 1000);
    expect(SESSION_GRACE_MS).toBe(4 * 60 * 1000);
    expect(RESERVATION_MS - SESSION_GRACE_MS).toBeGreaterThanOrEqual(31 * 60 * 1000);
  });

  test("O5: a subscriber may buy lifetime; a live lifetime grant may not buy again", async () => {
    const t = setup();
    await seedSeats(t);
    openEveryone();
    const subscriber = await seedUser(t);
    await subscribe(t, subscriber);
    expect(await begin(t, subscriber, "lifetime")).toMatchObject({ ok: true, seatNumber: 1 });
    const owner = await seedUser(t);
    await grant(t, owner, "lifetime", { seatNumber: 9 });
    expect(await begin(t, owner, "lifetime")).toEqual({ ok: false, code: "ALREADY_SUBSCRIBED" });
    // A suspended (disputed) lifetime grant still blocks a second seat.
    const disputed = await seedUser(t);
    await grant(t, disputed, "lifetime", { seatNumber: 10, suspendedAt: 2 });
    expect(await begin(t, disputed, "lifetime")).toEqual({ ok: false, code: "ALREADY_SUBSCRIBED" });
  });
});

describe("WP64-S3 attaching the Checkout Session", () => {
  async function pending(t: T, member: Member, livemode = false) {
    const order = await begin(t, member, "monthly", newKey(), livemode);
    if (!order.ok) throw new Error("expected an order");
    return order.orderId;
  }
  const attach = (t: T, member: Member, orderId: Id<"membership_orders">, checkoutSessionId: string) =>
    asUser(t, member).mutation(internal.platform.membership.checkout.attachSession, { orderId, checkoutSessionId });

  test("attaches once, idempotently, to the member's own order in its own mode", async () => {
    const t = setup();
    const [a, b] = [await seedUser(t), await seedUser(t)];
    const orderId = await pending(t, a);
    expect(await errorCode(() => attach(t, b, orderId, "cs_test_x"))).toBe("INVALID_REQUEST");
    expect(await errorCode(() => attach(t, a, orderId, "cs_live_x"))).toBe("INVALID_REQUEST");
    expect(await errorCode(() => attach(t, a, orderId, "pi_123"))).toBe("INVALID_REQUEST");
    expect(await attach(t, a, orderId, "cs_test_x")).toEqual({ attached: true });
    expect(await attach(t, a, orderId, "cs_test_x")).toEqual({ attached: true });
    expect(await errorCode(() => attach(t, a, orderId, "cs_test_other"))).toBe("CHECKOUT_SESSION_CONFLICT");
    const live = await pending(t, a, true);
    expect(await attach(t, a, live, "cs_live_y")).toEqual({ attached: true });
  });

  test("a settled order is not changed", async () => {
    const t = setup();
    const member = await seedUser(t);
    const orderId = await pending(t, member);
    await t.run((ctx) => ctx.db.patch("membership_orders", orderId, { status: "expired" }));
    expect(await attach(t, member, orderId, "cs_test_late")).toEqual({ attached: false });
    const row = (await orders(t)).find((o) => o._id === orderId);
    expect(row?.stripeCheckoutSessionId).toBeUndefined();
  });
});

describe("WP64-S3 the signed bridge", () => {
  const accept = (t: T, member: Member | null, payload: MembershipBridgePayload, secret = SECRET) => {
    const signed = signMembershipBridge(payload, secret);
    return member
      ? asUser(t, member).action(api.platform.membership.provider.accept, signed)
      : t.action(api.platform.membership.provider.accept, signed);
  };
  const beginPayload = (): MembershipBridgePayload => ({
    kind: "begin_checkout",
    term: "monthly",
    idempotencyKey: newKey(),
    livemode: false,
  });

  test("a signed request from a signed-in member opens an order and attaches a session", async () => {
    vi.stubEnv("MEMBERSHIP_BILLING_BRIDGE_SECRET", SECRET);
    const t = setup();
    const member = await seedUser(t);
    const opened = await accept(t, member, beginPayload());
    expect(opened).toMatchObject({ ok: true, priceKey: "monthly" });
    const orderId = "ok" in opened && opened.ok ? opened.orderId : "";
    expect(await accept(t, member, { kind: "attach_session", orderId, checkoutSessionId: "cs_test_bridge" })).toEqual({
      attached: true,
    });
  });

  test("a forged signature, a missing secret or no sign-in writes nothing", async () => {
    vi.stubEnv("MEMBERSHIP_BILLING_BRIDGE_SECRET", SECRET);
    const t = setup();
    const member = await seedUser(t);
    expect(await errorCode(() => accept(t, member, beginPayload(), "forged-bridge-test-secret-0123456789abcdef"))).toBe(
      "INVALID_BRIDGE_SIGNATURE",
    );
    const signed = signMembershipBridge(beginPayload(), SECRET);
    const tampered = { ...signed, payload: signed.payload.replace("monthly", "annual") };
    expect(await errorCode(() => asUser(t, member).action(api.platform.membership.provider.accept, tampered))).toBe(
      "INVALID_BRIDGE_SIGNATURE",
    );
    expect(await accept(t, null, beginPayload())).toEqual({ ok: false, code: "AUTHENTICATION_REQUIRED" });
    vi.stubEnv("MEMBERSHIP_BILLING_BRIDGE_SECRET", "short");
    expect(await errorCode(() => accept(t, member, beginPayload()))).toBe("BRIDGE_NOT_CONFIGURED");
    expect(await orders(t)).toHaveLength(0);
  });

  test("checkout attempts are rate limited per member", async () => {
    vi.stubEnv("MEMBERSHIP_BILLING_BRIDGE_SECRET", SECRET);
    const t = setup();
    const [a, b] = [await seedUser(t), await seedUser(t)];
    const results = [];
    for (let i = 0; i < 6; i += 1) results.push(await accept(t, a, beginPayload()));
    expect(results.slice(0, 5).every((result) => "ok" in result && result.ok)).toBe(true);
    expect(results[5]).toEqual({ ok: false, code: "RATE_LIMITED" });
    // Another member is unaffected.
    expect(await accept(t, b, beginPayload())).toMatchObject({ ok: true });
  });

  test("the refusal codes are the route contract's", () => {
    expect([...CHECKOUT_REFUSAL_CODES]).toEqual([...MEMBERSHIP_ERROR_CODES]);
  });
});
