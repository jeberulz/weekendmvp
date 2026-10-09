/// <reference types="vite/client" />

import { convexTest, type TestConvex } from "convex-test";
import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { requireFeature } from "./platform/entitlements";
import { NO_BILLING, countSeats } from "./platform/membership/state";
import { PRICE_KEY_VALUES } from "./platform/membership/validators";
import { resolvePlan } from "./platform/planResolver";
import {
  ANNUAL_SAVING_PERCENT,
  PLANS,
  PLAN_LIMITS,
  PRICING,
  UPGRADE_LABEL,
  amountForPriceKey,
  formatUsd,
  lifetimeTrancheForSeat,
} from "./platform/plans";
import schema from "./schema";

// WP64-S2. The real resolver, never stubbed here: every test reads the
// membership tables through `resolvePlan` and `entitlements.mine`.

const modules = import.meta.glob("./**/*.ts");

type T = TestConvex<typeof schema>;
type Member = { userId: Id<"users">; sessionId: Id<"authSessions"> };
type SubscriptionFields = Omit<Doc<"plan_subscriptions">, "_id" | "_creationTime" | "ownerId">;
type GrantFields = Omit<Doc<"plan_grants">, "_id" | "_creationTime" | "ownerId">;

const PERIOD_END = 1_900_000_000_000;
const ENDED_AT = 1_800_000_000_000;

async function seedUser(t: T, email: string): Promise<Member> {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { email });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: 9_999_999_999_999 });
    return { userId, sessionId };
  });
}

function asUser(t: T, member: Member) {
  return t.withIdentity({
    subject: `${member.userId}|${member.sessionId}`,
    issuer: "https://local.test",
    tokenIdentifier: `https://local.test|${member.userId}`,
  });
}

let sequence = 0;

async function addSubscription(t: T, ownerId: Id<"users">, fields: Partial<SubscriptionFields> = {}) {
  sequence += 1;
  return await t.run(async (ctx) =>
    ctx.db.insert("plan_subscriptions", {
      ownerId,
      stripeSubscriptionId: `sub_test_${sequence}`,
      stripeCustomerId: `cus_test_${sequence}`,
      term: "monthly",
      status: "active",
      currentPeriodEnd: PERIOD_END,
      cancelAtPeriodEnd: false,
      snapshotAt: sequence,
      updatedAt: sequence,
      livemode: false,
      ...fields,
    }),
  );
}

async function addOrder(t: T, ownerId: Id<"users">) {
  sequence += 1;
  return await t.run(async (ctx) =>
    ctx.db.insert("membership_orders", {
      ownerId,
      term: "lifetime",
      priceKey: "lifetime_t1",
      status: "paid",
      idempotencyKey: `order-${sequence}`,
      stripeCheckoutSessionId: `cs_test_${sequence}`,
      seatNumber: 7,
      createdAt: sequence,
      updatedAt: sequence,
      livemode: false,
    }),
  );
}

async function addLifetime(t: T, ownerId: Id<"users">, fields: Partial<GrantFields> = {}) {
  const orderId = await addOrder(t, ownerId);
  return await t.run(async (ctx) =>
    ctx.db.insert("plan_grants", { ownerId, kind: "lifetime", orderId, seatNumber: 7, grantedAt: 1, ...fields }),
  );
}

async function addComp(t: T, ownerId: Id<"users">, fields: Partial<GrantFields> = {}) {
  return await t.run(async (ctx) => ctx.db.insert("plan_grants", { ownerId, kind: "comp", grantedAt: 1, ...fields }));
}

async function mine(t: T, member: Member) {
  return await asUser(t, member).query(api.platform.entitlements.mine, {});
}

async function plan(t: T, member: Member) {
  return await t.run((ctx) => resolvePlan(ctx, member.userId));
}

async function errorCode(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run();
  } catch (error) {
    return error instanceof ConvexError ? (error.data as { code?: unknown }).code : String(error);
  }
  return "no error";
}

describe("WP64-S2 price ladder", () => {
  test("PRICING holds the approved ladder in minor units", () => {
    expect(PRICING.currency).toBe("usd");
    expect(PRICING.monthly).toEqual({ priceKey: "monthly", amountMinor: 2_900, interval: "month" });
    expect(PRICING.annual).toEqual({ priceKey: "annual", amountMinor: 19_900, interval: "year" });
    expect(PRICING.lifetime.seats).toBe(50);
    expect(PRICING.lifetime.tranches).toEqual([
      { priceKey: "lifetime_t1", firstSeat: 1, lastSeat: 15, amountMinor: 24_900 },
      { priceKey: "lifetime_t2", firstSeat: 16, lastSeat: 50, amountMinor: 34_900 },
    ]);
  });

  test("tranches cover seats 1 to 50 with no gap or overlap, and the seat picks the price", () => {
    for (let seat = 1; seat <= 50; seat += 1) {
      expect(lifetimeTrancheForSeat(seat)?.priceKey).toBe(seat <= 15 ? "lifetime_t1" : "lifetime_t2");
    }
    for (const outside of [0, 51, -1, 1.5, Number.NaN]) expect(lifetimeTrancheForSeat(outside)).toBeNull();
  });

  test("every price key has one amount, and the schema accepts exactly those keys", () => {
    expect([...PRICE_KEY_VALUES]).toEqual(["monthly", "annual", "lifetime_t1", "lifetime_t2"]);
    expect(PRICE_KEY_VALUES.map(amountForPriceKey)).toEqual([2_900, 19_900, 24_900, 34_900]);
  });

  test("UI strings derive from the ladder (S6 moved the plan copy to it)", () => {
    expect(formatUsd(2_900)).toBe("$29");
    expect(formatUsd(19_900)).toBe("$199");
    expect(formatUsd(2_950)).toBe("$29.50");
    expect(formatUsd(2_905)).toBe("$29.05");
    expect(ANNUAL_SAVING_PERCENT).toBe(43);
    expect(PLANS.builders_hub.priceMonthlyUsd).toBe(29);
    expect(PLANS.builders_hub.priceLabel).toBe("$29 a month or $199 a year");
    expect(UPGRADE_LABEL).toBe("Upgrade to Builder’s Hub · $29/mo");
  });
});

describe("WP64-S2 schema", () => {
  const contract: Record<string, string[][]> = {
    billing_customers: [["ownerId"], ["stripeCustomerId"]],
    plan_subscriptions: [["ownerId", "updatedAt"], ["stripeSubscriptionId"], ["stripeCustomerId"]],
    membership_orders: [
      ["ownerId", "idempotencyKey"],
      ["ownerId", "status", "createdAt"],
      ["stripeCheckoutSessionId"],
      ["stripePaymentIntentId"],
    ],
    plan_grants: [["ownerId"], ["kind", "seatNumber"]],
    founding_seats: [["seatNumber"], ["status", "seatNumber"]],
    billing_events: [["stripeEventId"]],
  };

  test("the six tables carry exactly the indexes in the data contract, named by their fields", () => {
    for (const [table, expected] of Object.entries(contract)) {
      const indexes = (
        schema.tables[table as keyof typeof schema.tables] as unknown as {
          " indexes": () => { indexDescriptor: string; fields: string[] }[];
        }
      )[" indexes"]();
      expect(indexes.map((index) => index.fields), table).toEqual(expected);
      for (const index of indexes) expect(index.indexDescriptor).toBe(`by_${index.fields.join("_and_")}`);
    }
  });

  test("no membership table stores an array, so no row can grow without bound", () => {
    type Node = { kind: string; fields?: Record<string, Node>; members?: Node[]; element?: Node };
    const kinds = (node: Node): string[] => [
      node.kind,
      ...Object.values(node.fields ?? {}).flatMap(kinds),
      ...(node.members ?? []).flatMap(kinds),
      ...(node.element ? kinds(node.element) : []),
    ];
    for (const table of Object.keys(contract)) {
      const validator = schema.tables[table as keyof typeof schema.tables].validator as unknown as Node;
      expect(kinds(validator), table).not.toContain("array");
      expect(kinds(validator), table).not.toContain("record");
    }
  });
});

describe("WP64-S2 resolver matrix", () => {
  test("free: no grant and no subscription", async () => {
    const t = convexTest(schema, modules);
    const member = await seedUser(t, "free@example.test");
    expect(await plan(t, member)).toBe("free");
    expect(await mine(t, member)).toMatchObject({ plan: "free", limits: PLAN_LIMITS.free, billing: NO_BILLING });
  });

  test("active monthly: Builder's Hub, renews at the period end", async () => {
    const t = convexTest(schema, modules);
    const member = await seedUser(t, "monthly@example.test");
    await addSubscription(t, member.userId);
    expect(await mine(t, member)).toMatchObject({
      plan: "builders_hub",
      limits: PLAN_LIMITS.builders_hub,
      billing: { term: "monthly", status: "active", renewsAt: PERIOD_END, endsAt: null, foundingSeat: null },
    });
  });

  test("active annual set to cancel: access until the period end, no renewal date", async () => {
    const t = convexTest(schema, modules);
    const member = await seedUser(t, "annual@example.test");
    await addSubscription(t, member.userId, { term: "annual", cancelAtPeriodEnd: true });
    expect(await mine(t, member)).toMatchObject({
      plan: "builders_hub",
      billing: { term: "annual", status: "active", renewsAt: null, endsAt: PERIOD_END },
    });
  });

  test("past_due keeps access while Stripe retries (O9)", async () => {
    const t = convexTest(schema, modules);
    const member = await seedUser(t, "pastdue@example.test");
    await addSubscription(t, member.userId, { status: "past_due" });
    expect(await mine(t, member)).toMatchObject({
      plan: "builders_hub",
      billing: { term: "monthly", status: "past_due", renewsAt: PERIOD_END },
    });
  });

  test("canceled ends access and reports when it ended", async () => {
    const t = convexTest(schema, modules);
    const member = await seedUser(t, "canceled@example.test");
    await addSubscription(t, member.userId, { status: "canceled", canceledAt: ENDED_AT });
    expect(await mine(t, member)).toMatchObject({
      plan: "free",
      billing: { term: "monthly", status: "canceled", renewsAt: null, endsAt: ENDED_AT },
    });
  });

  test("unpaid and paused end access with no date", async () => {
    const t = convexTest(schema, modules);
    for (const status of ["unpaid", "paused"] as const) {
      const member = await seedUser(t, `${status}@example.test`);
      await addSubscription(t, member.userId, { status });
      expect(await mine(t, member)).toMatchObject({
        plan: "free",
        billing: { term: "monthly", status, renewsAt: null, endsAt: null },
      });
    }
  });

  test("unfinished subscriptions grant nothing and show nothing", async () => {
    const t = convexTest(schema, modules);
    for (const status of ["incomplete", "incomplete_expired", "trialing"] as const) {
      const member = await seedUser(t, `${status}@example.test`);
      await addSubscription(t, member.userId, { status });
      expect(await mine(t, member), status).toMatchObject({ plan: "free", billing: NO_BILLING });
    }
  });

  test("a disputed subscription is suspended even while Stripe says active (O9)", async () => {
    const t = convexTest(schema, modules);
    const member = await seedUser(t, "disputed@example.test");
    await addSubscription(t, member.userId, { disputedAt: 5 });
    expect(await mine(t, member)).toMatchObject({
      plan: "free",
      billing: { term: "monthly", status: "suspended", renewsAt: null },
    });
  });

  test("lifetime: Builder's Hub with the founding seat number", async () => {
    const t = convexTest(schema, modules);
    const member = await seedUser(t, "lifetime@example.test");
    await addLifetime(t, member.userId);
    expect(await mine(t, member)).toMatchObject({
      plan: "builders_hub",
      billing: { term: "lifetime", status: "active", renewsAt: null, endsAt: null, foundingSeat: 7 },
    });
  });

  test("suspended lifetime: no access while the dispute is open, seat still shown", async () => {
    const t = convexTest(schema, modules);
    const member = await seedUser(t, "suspended@example.test");
    await addLifetime(t, member.userId, { suspendedAt: 5 });
    expect(await mine(t, member)).toMatchObject({
      plan: "free",
      billing: { term: "lifetime", status: "suspended", foundingSeat: 7 },
    });
  });

  test("revoked lifetime: refunded or lost, so free and nothing to show", async () => {
    const t = convexTest(schema, modules);
    const member = await seedUser(t, "revoked@example.test");
    await addLifetime(t, member.userId, { revokedAt: 5, revokeReason: "refund" });
    expect(await mine(t, member)).toMatchObject({ plan: "free", billing: NO_BILLING });
    // A revoke wins over a suspension on the same grant.
    const both = await seedUser(t, "revoked-suspended@example.test");
    await addLifetime(t, both.userId, { suspendedAt: 4, revokedAt: 5, revokeReason: "dispute_lost" });
    expect(await mine(t, both)).toMatchObject({ plan: "free", billing: NO_BILLING });
  });

  test("comp: Builder's Hub with no dates and no seat", async () => {
    const t = convexTest(schema, modules);
    const member = await seedUser(t, "comp@example.test");
    await addComp(t, member.userId);
    expect(await mine(t, member)).toMatchObject({
      plan: "builders_hub",
      billing: { term: "comp", status: "active", renewsAt: null, endsAt: null, foundingSeat: null },
    });
  });

  test("precedence: lifetime over a subscription, a subscription over comp", async () => {
    const t = convexTest(schema, modules);
    const upgraded = await seedUser(t, "upgraded@example.test");
    await addSubscription(t, upgraded.userId, { cancelAtPeriodEnd: true });
    await addLifetime(t, upgraded.userId);
    expect((await mine(t, upgraded)).billing).toMatchObject({ term: "lifetime", foundingSeat: 7 });

    const paying = await seedUser(t, "paying-tester@example.test");
    await addComp(t, paying.userId);
    await addSubscription(t, paying.userId, { term: "annual" });
    expect((await mine(t, paying)).billing).toMatchObject({ term: "annual", status: "active" });
  });

  test("a live subscription wins over an older ended one, whatever the insert order", async () => {
    const t = convexTest(schema, modules);
    const member = await seedUser(t, "resubscribed@example.test");
    await addSubscription(t, member.userId, { status: "active", updatedAt: 200 });
    await addSubscription(t, member.userId, { status: "canceled", canceledAt: ENDED_AT, updatedAt: 100 });
    expect(await mine(t, member)).toMatchObject({ plan: "builders_hub", billing: { status: "active" } });
  });

  test("with only ended subscriptions, the newest one shows", async () => {
    const t = convexTest(schema, modules);
    const member = await seedUser(t, "lapsed@example.test");
    await addSubscription(t, member.userId, { status: "canceled", canceledAt: ENDED_AT + 2, updatedAt: 300 });
    await addSubscription(t, member.userId, { status: "canceled", canceledAt: ENDED_AT, updatedAt: 100 });
    expect(await mine(t, member)).toMatchObject({ plan: "free", billing: { endsAt: ENDED_AT + 2 } });
  });

  test("a live grant is found behind newer revoked grants", async () => {
    const t = convexTest(schema, modules);
    const member = await seedUser(t, "history@example.test");
    await addLifetime(t, member.userId);
    for (let index = 0; index < 5; index += 1) {
      await addComp(t, member.userId, { revokedAt: 5, revokeReason: "operator" });
    }
    expect(await plan(t, member)).toBe("builders_hub");
  });

  test("the real resolver opens every gate for a paying member", async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedUser(t, "gates@example.test");
    await addSubscription(t, seeded.userId, { term: "annual" });
    for (const feature of ["collections", "prompt_pack", "compare"] as const) {
      await t.run((ctx) => requireFeature(ctx, seeded.userId, feature));
    }
    const member = asUser(t, seeded);
    await t.run(async (ctx) => {
      for (const slug of ["a", "b"]) {
        await ctx.db.insert("ideas", {
          slug,
          title: slug,
          description: "desc",
          publishedAt: 0,
          category: "saas",
          buildTime: "10",
          revenueGoal: "5k-month",
          applicationCategory: "BusinessApplication",
          tools: ["cursor"],
          audiences: [],
          bodyMode: "mdx",
        });
      }
    });
    await member.mutation(api.platform.weekendPlans.start, { slug: "a" });
    await member.mutation(api.platform.weekendPlans.start, { slug: "b" });
    expect((await mine(t, seeded)).usage.activeWeekendPlans).toBe(2);
  });
});

describe("WP64-S2 isolation and privacy", () => {
  test("one member's grant or subscription never reaches another member", async () => {
    const t = convexTest(schema, modules);
    const paid = await seedUser(t, "paid@example.test");
    const other = await seedUser(t, "other@example.test");
    await addLifetime(t, paid.userId);
    await addSubscription(t, paid.userId);
    expect(await plan(t, paid)).toBe("builders_hub");
    expect(await plan(t, other)).toBe("free");
    expect(await mine(t, other)).toMatchObject({ plan: "free", billing: NO_BILLING });
  });

  test("the billing summary carries no Stripe id, customer, order or livemode", async () => {
    const t = convexTest(schema, modules);
    const member = await seedUser(t, "private@example.test");
    await addSubscription(t, member.userId, { stripeSubscriptionId: "sub_secret", stripeCustomerId: "cus_secret" });
    await addLifetime(t, member.userId);
    const result = await mine(t, member);
    expect(Object.keys(result.billing).sort()).toEqual(["endsAt", "foundingSeat", "renewsAt", "status", "term"]);
    const json = JSON.stringify(result);
    for (const leak of ["sub_", "cus_", "cs_", "pi_", "secret", "stripe", "livemode", "order", "ownerId"]) {
      expect(json).not.toContain(leak);
    }
  });

  test("anonymous callers get nothing", async () => {
    const t = convexTest(schema, modules);
    await expect(t.query(api.platform.entitlements.mine, {})).rejects.toThrow("UNAUTHENTICATED");
  });
});

describe("WP64-S2 founding seats (operator seed)", () => {
  test("an unseeded table has no free seat, so checkout will fail closed", async () => {
    const t = convexTest(schema, modules);
    expect(await t.run((ctx) => countSeats(ctx))).toEqual({ free: 0, reserved: 0, taken: 0, overflow: false });
  });

  test("dry run by default, then 50 free seats, then a re-run changes nothing", async () => {
    const t = convexTest(schema, modules);
    expect(await t.mutation(internal.platform.membership.seats.seed, {})).toEqual({
      applied: false,
      existing: 0,
      created: 0,
      missing: 50,
    });
    expect(await t.run((ctx) => countSeats(ctx))).toMatchObject({ free: 0 });

    expect(await t.mutation(internal.platform.membership.seats.seed, { apply: true })).toEqual({
      applied: true,
      existing: 0,
      created: 50,
      missing: 0,
    });
    const rows = await t.run((ctx) => ctx.db.query("founding_seats").withIndex("by_seatNumber").take(60));
    expect(rows.map((row) => row.seatNumber)).toEqual(Array.from({ length: 50 }, (_, index) => index + 1));
    expect(rows.every((row) => row.status === "free" && row.ownerId === undefined)).toBe(true);

    expect(await t.mutation(internal.platform.membership.seats.seed, { apply: true })).toMatchObject({
      created: 0,
      existing: 50,
    });
    expect(await t.run((ctx) => countSeats(ctx))).toEqual({ free: 50, reserved: 0, taken: 0, overflow: false });
  });

  test("a re-run never frees a taken or reserved seat", async () => {
    const t = convexTest(schema, modules);
    const buyer = await seedUser(t, "seat@example.test");
    const orderId = await addOrder(t, buyer.userId);
    await t.run(async (ctx) => {
      await ctx.db.insert("founding_seats", { seatNumber: 1, status: "taken", ownerId: buyer.userId, orderId, updatedAt: 1 });
      await ctx.db.insert("founding_seats", {
        seatNumber: 2,
        status: "reserved",
        ownerId: buyer.userId,
        orderId,
        reservedUntil: 9,
        updatedAt: 1,
      });
    });
    expect(await t.mutation(internal.platform.membership.seats.seed, { apply: true })).toMatchObject({
      existing: 2,
      created: 48,
    });
    expect(await t.run((ctx) => countSeats(ctx))).toEqual({ free: 48, reserved: 1, taken: 1, overflow: false });
  });

  test("a bad seat number or a duplicate stops the seed before it writes", async () => {
    for (const seatNumber of [0, 51, 3]) {
      const t = convexTest(schema, modules);
      await t.run(async (ctx) => {
        await ctx.db.insert("founding_seats", { seatNumber: 3, status: "free", updatedAt: 1 });
        await ctx.db.insert("founding_seats", { seatNumber, status: "free", updatedAt: 1 });
      });
      expect(await errorCode(() => t.mutation(internal.platform.membership.seats.seed, { apply: true }))).toBe(
        "SEAT_TABLE_INVALID",
      );
      expect(await t.run((ctx) => countSeats(ctx))).toMatchObject({ free: 2 });
    }
  });

  test("more rows than seats is reported, never counted past 50", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      for (let seatNumber = 1; seatNumber <= 51; seatNumber += 1) {
        await ctx.db.insert("founding_seats", { seatNumber, status: "free", updatedAt: 1 });
      }
    });
    expect(await t.run((ctx) => countSeats(ctx))).toEqual({ free: 50, reserved: 0, taken: 0, overflow: true });
    expect(await errorCode(() => t.mutation(internal.platform.membership.seats.seed, { apply: true }))).toBe(
      "SEAT_TABLE_OVERFLOW",
    );
  });
});

describe("WP64-S6 seat query for the ladder", () => {
  async function seed(t: T) {
    await t.mutation(internal.platform.membership.seats.seed, { apply: true });
  }

  async function setSeat(t: T, seatNumber: number, status: "reserved" | "taken", ownerId: Id<"users">) {
    const orderId = await addOrder(t, ownerId);
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query("founding_seats")
        .withIndex("by_seatNumber", (q) => q.eq("seatNumber", seatNumber))
        .unique();
      if (!row) throw new Error("seat missing");
      await ctx.db.patch("founding_seats", row._id, {
        status,
        ownerId,
        orderId,
        ...(status === "reserved" ? { reservedUntil: 9 } : {}),
        updatedAt: 2,
      });
    });
  }

  test("signed-in members only", async () => {
    const t = convexTest(schema, modules);
    await expect(t.query(api.platform.membership.queries.ladder, {})).rejects.toThrow("UNAUTHENTICATED");
  });

  test("before the seed, Founding Lifetime is not open", async () => {
    const t = convexTest(schema, modules);
    const member = await seedUser(t, "early@example.test");
    expect(await asUser(t, member).query(api.platform.membership.queries.ladder, {})).toEqual({
      open: false,
      seatsTotal: 50,
      seatsLeft: 0,
      seatsHeld: 0,
      nextSeatAmountMinor: null,
      eligibleFrom: null,
    });
  });

  test("the next free seat sets the price, held seats are counted apart, and sold out has no price", async () => {
    const t = convexTest(schema, modules);
    const member = await seedUser(t, "ladder@example.test");
    const buyer = await seedUser(t, "buyer@example.test");
    await seed(t);
    const ladder = () => asUser(t, member).query(api.platform.membership.queries.ladder, {});
    expect(await ladder()).toEqual({ open: true, seatsTotal: 50, seatsLeft: 50, seatsHeld: 0, nextSeatAmountMinor: 24_900, eligibleFrom: null });

    for (let seat = 1; seat <= 14; seat += 1) await setSeat(t, seat, "taken", buyer.userId);
    await setSeat(t, 15, "reserved", buyer.userId);
    expect(await ladder()).toEqual({ open: true, seatsTotal: 50, seatsLeft: 35, seatsHeld: 1, nextSeatAmountMinor: 34_900, eligibleFrom: null });

    for (let seat = 16; seat <= 50; seat += 1) await setSeat(t, seat, "taken", buyer.userId);
    const soldOut = await ladder();
    expect(soldOut).toEqual({ open: true, seatsTotal: 50, seatsLeft: 0, seatsHeld: 1, nextSeatAmountMinor: null, eligibleFrom: null });
    expect(JSON.stringify(soldOut)).not.toMatch(/owner|order|users|membership_orders/);
  });
});

describe("WP64-S2 comp grants (operator)", () => {
  test("grant is idempotent and opens Builder's Hub, revoke closes it", async () => {
    const t = convexTest(schema, modules);
    const tester = await seedUser(t, "tester@example.test");
    expect(await t.mutation(internal.platform.membership.comp.grant, { ownerId: tester.userId })).toEqual({ created: true });
    expect(await t.mutation(internal.platform.membership.comp.grant, { ownerId: tester.userId })).toEqual({ created: false });
    expect(await mine(t, tester)).toMatchObject({ plan: "builders_hub", billing: { term: "comp" } });

    expect(await t.mutation(internal.platform.membership.comp.revoke, { ownerId: tester.userId })).toEqual({ revoked: 1 });
    expect(await mine(t, tester)).toMatchObject({ plan: "free", billing: NO_BILLING });
    const grants = await t.run((ctx) =>
      ctx.db.query("plan_grants").withIndex("by_ownerId", (q) => q.eq("ownerId", tester.userId)).take(10),
    );
    expect(grants).toHaveLength(1);
    expect(grants[0]).toMatchObject({ kind: "comp", revokeReason: "operator" });

    // A new grant after a revoke is a new row, so the history stays.
    expect(await t.mutation(internal.platform.membership.comp.grant, { ownerId: tester.userId })).toEqual({ created: true });
  });

  test("revoke never touches a lifetime grant", async () => {
    const t = convexTest(schema, modules);
    const founder = await seedUser(t, "founder@example.test");
    await addLifetime(t, founder.userId);
    expect(await t.mutation(internal.platform.membership.comp.revoke, { ownerId: founder.userId })).toEqual({ revoked: 0 });
    expect(await plan(t, founder)).toBe("builders_hub");
  });

  test("grant refuses an account that does not exist", async () => {
    const t = convexTest(schema, modules);
    const gone = await seedUser(t, "gone@example.test");
    await t.run((ctx) => ctx.db.delete("users", gone.userId));
    expect(await errorCode(() => t.mutation(internal.platform.membership.comp.grant, { ownerId: gone.userId }))).toBe(
      "OWNER_NOT_FOUND",
    );
  });
});
