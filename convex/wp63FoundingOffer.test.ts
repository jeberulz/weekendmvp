/// <reference types="vite/client" />

import { convexTest, type TestConvex } from "convex-test";
import { ConvexError } from "convex/values";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { normalizeEmail } from "./authEmail";
import { cohortEmailHash, normalizeCohortEmail } from "./platform/membership/cohortHash";
import {
  assertFoundingEligible,
  foundingEligibleFrom,
  isFoundingOpen,
  readFoundingEligibleFrom,
  windowsInOrder,
  type FoundingCohort,
} from "./platform/membership/offer";
import type { FoundingWindows } from "./platform/membership/windows";
import { QUIET_PERIOD_MS } from "./platform/plans";
import schema from "./schema";

// WP63-S7. The windows are config, so each test sets them through this mock.
const windows = vi.hoisted(() => ({ buyers: null, newsletter: null, everyone: null }) as FoundingWindows);
vi.mock("./platform/membership/windows", () => ({ FOUNDING_WINDOWS: windows }));

const modules = import.meta.glob("./**/*.ts");

type T = TestConvex<typeof schema>;
type Member = { userId: Id<"users">; sessionId: Id<"authSessions"> };

const W1 = 1_000_000;
const W2 = 2_000_000;
const W3 = 3_000_000;
const LATER = Date.now() + 10 * QUIET_PERIOD_MS;

afterEach(() => {
  Object.assign(windows, { buyers: null, newsletter: null, everyone: null });
});

function setWindows(next: Partial<FoundingWindows>) {
  Object.assign(windows, { buyers: null, newsletter: null, everyone: null }, next);
}

async function seedUser(
  t: T,
  email: string,
  extra: { emailVerificationTime?: number; isAnonymous?: boolean } = { emailVerificationTime: 1 },
): Promise<Member> {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { email, ...extra });
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

let batches = 0;

async function importCohort(t: T, cohort: FoundingCohort, emails: string[]) {
  const emailHashes = [...new Set(await Promise.all(emails.map(cohortEmailHash)))];
  batches += 1;
  const batchId = `${cohort}-${batches.toString(16).padStart(16, "0")}`;
  return await t.mutation(internal.platform.membership.cohorts.importBatch, { cohort, batchId, emailHashes });
}

async function eligibleFrom(t: T, member: Member) {
  return (await asUser(t, member).query(api.platform.membership.queries.ladder, {})).eligibleFrom;
}

async function seedSeats(t: T) {
  await t.mutation(internal.platform.membership.seats.seed, { apply: true });
}

async function errorData(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run();
  } catch (error) {
    return error instanceof ConvexError ? error.data : String(error);
  }
  return "no error";
}

describe("WP63-S7 window matrix (fixed windows passed in)", () => {
  const none = new Set<FoundingCohort>();
  const buyers = new Set<FoundingCohort>(["buyers"]);
  const newsletter = new Set<FoundingCohort>(["newsletter"]);
  const both = new Set<FoundingCohort>(["buyers", "newsletter"]);

  test("each cohort opens at its own window, and windows only add people", () => {
    const all = { buyers: W1, newsletter: W2, everyone: W3 };
    expect(foundingEligibleFrom(buyers, all)).toBe(W1);
    expect(foundingEligibleFrom(both, all)).toBe(W1);
    expect(foundingEligibleFrom(newsletter, all)).toBe(W2);
    expect(foundingEligibleFrom(none, all)).toBe(W3);
  });

  test("undated windows stay closed, and a buyer is in every later window", () => {
    const closed = { buyers: null, newsletter: null, everyone: null };
    for (const cohorts of [none, buyers, newsletter, both]) expect(foundingEligibleFrom(cohorts, closed)).toBeNull();
    const firstOnly = { buyers: W1, newsletter: null, everyone: null };
    expect(foundingEligibleFrom(buyers, firstOnly)).toBe(W1);
    expect(foundingEligibleFrom(newsletter, firstOnly)).toBeNull();
    expect(foundingEligibleFrom(none, firstOnly)).toBeNull();
    const secondOnly = { buyers: null, newsletter: W2, everyone: null };
    expect(foundingEligibleFrom(buyers, secondOnly)).toBe(W2);
    expect(foundingEligibleFrom(newsletter, secondOnly)).toBe(W2);
    expect(foundingEligibleFrom(none, secondOnly)).toBeNull();
    const lastOnly = { buyers: null, newsletter: null, everyone: W3 };
    for (const cohorts of [none, buyers, newsletter, both]) expect(foundingEligibleFrom(cohorts, lastOnly)).toBe(W3);
  });

  test("open from the exact start, never before, never without a date", () => {
    expect(isFoundingOpen(W1, W1)).toBe(true);
    expect(isFoundingOpen(W1, W1 - 1)).toBe(false);
    expect(isFoundingOpen(null, Number.MAX_SAFE_INTEGER)).toBe(false);
  });

  test("dated windows must run in order; the real config is undated", async () => {
    expect(windowsInOrder({ buyers: W1, newsletter: W2, everyone: W3 })).toBe(true);
    expect(windowsInOrder({ buyers: W1, newsletter: null, everyone: W3 })).toBe(true);
    expect(windowsInOrder({ buyers: W2, newsletter: W1, everyone: W3 })).toBe(false);
    expect(windowsInOrder({ buyers: null, newsletter: W3, everyone: W2 })).toBe(false);
    const real = await vi.importActual<typeof import("./platform/membership/windows")>("./platform/membership/windows");
    expect(real.FOUNDING_WINDOWS).toEqual({ buyers: null, newsletter: null, everyone: null });
    expect(windowsInOrder(real.FOUNDING_WINDOWS)).toBe(true);
  });
});

describe("WP63-S7 cohort emails are hashed", () => {
  test("the hash uses the sign-in normalization, so case and spaces do not matter", async () => {
    for (const sample of ["  Buyer@Example.TEST ", "ｂｕｙｅｒ@example.test", "x@y.zz"]) {
      expect(normalizeCohortEmail(sample)).toBe(normalizeEmail(sample));
    }
    const hash = await cohortEmailHash("buyer@example.test");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(await cohortEmailHash("  BUYER@example.test ")).toBe(hash);
    expect(await cohortEmailHash("other@example.test")).not.toBe(hash);
  });

  test("stored rows hold the hash and the batch, never the address", async () => {
    const t = convexTest(schema, modules);
    await importCohort(t, "buyers", ["Buyer@Example.test"]);
    const rows = await t.run((ctx) => ctx.db.query("offer_cohorts").take(10));
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows)).not.toMatch(/@|example/i);
    expect(rows[0].emailHash).toBe(await cohortEmailHash("buyer@example.test"));
  });
});

describe("WP63-S7 eligibility on the server", () => {
  test("a verified buyer opens at window 1, a subscriber at 2, everyone else at 3", async () => {
    setWindows({ buyers: W1, newsletter: W2, everyone: W3 });
    const t = convexTest(schema, modules);
    const buyer = await seedUser(t, "Buyer@Example.test");
    const reader = await seedUser(t, "reader@example.test");
    const member = await seedUser(t, "member@example.test");
    await importCohort(t, "buyers", ["buyer@example.test"]);
    await importCohort(t, "newsletter", ["reader@example.test", "buyer@example.test"]);
    expect(await eligibleFrom(t, buyer)).toBe(W1);
    expect(await eligibleFrom(t, reader)).toBe(W2);
    expect(await eligibleFrom(t, member)).toBe(W3);
  });

  test("an unverified or anonymous account gets no cohort, only the public window", async () => {
    setWindows({ buyers: W1, newsletter: W2, everyone: W3 });
    const t = convexTest(schema, modules);
    const unverified = await seedUser(t, "buyer@example.test", {});
    const anonymous = await seedUser(t, "buyer2@example.test", { emailVerificationTime: 1, isAnonymous: true });
    await importCohort(t, "buyers", ["buyer@example.test", "buyer2@example.test"]);
    // The dashboard refuses anonymous sessions outright, so read the rule directly.
    const direct = (who: Member) =>
      t.run(async (ctx) => {
        const user = await ctx.db.get("users", who.userId);
        if (!user) throw new Error("missing user");
        return await readFoundingEligibleFrom(ctx, user);
      });
    expect(await direct(unverified)).toBe(W3);
    expect(await direct(anonymous)).toBe(W3);
  });

  test("an empty window 1 cohort is normal: nobody is eligible until window 2 or 3 is dated", async () => {
    setWindows({ buyers: W1 });
    const t = convexTest(schema, modules);
    const member = await seedUser(t, "member@example.test");
    expect(await eligibleFrom(t, member)).toBeNull();
    await seedSeats(t);
    expect(await asUser(t, member).query(api.platform.dashboard.offer, { now: LATER, foundingOffer: true })).not.toMatchObject({
      kind: "founding_lifetime",
    });
  });

  test("a forged payment-log or subscription row gains nothing", async () => {
    setWindows({ buyers: W1, newsletter: W2 });
    const t = convexTest(schema, modules);
    const forger = await seedUser(t, "forger@example.test");
    await t.run(async (ctx) => {
      await ctx.db.insert("stripe_events", {
        stripeEventId: "evt_forged",
        type: "checkout.session.completed",
        email: "forger@example.test",
        paymentLinkId: "plink_shipable",
        amount: 900,
        currency: "usd",
        createdAt: 1,
      });
      await ctx.db.insert("subscriptions", {
        email: "forger@example.test",
        normalizedEmail: "forger@example.test",
        source: "subscribe",
        automationIds: [],
        createdAt: 1,
      });
    });
    expect(await eligibleFrom(t, forger)).toBeNull();
  });

  test("one member's cohort never reaches another", async () => {
    setWindows({ buyers: W1, everyone: W3 });
    const t = convexTest(schema, modules);
    const buyer = await seedUser(t, "buyer@example.test");
    const other = await seedUser(t, "other@example.test");
    await importCohort(t, "buyers", ["buyer@example.test"]);
    expect(await eligibleFrom(t, buyer)).toBe(W1);
    expect(await eligibleFrom(t, other)).toBe(W3);
  });

  test("the checkout guard refuses before the window with the opening date, and passes after", async () => {
    setWindows({ buyers: W1, everyone: W3 });
    const t = convexTest(schema, modules);
    const buyer = await seedUser(t, "buyer@example.test");
    const member = await seedUser(t, "member@example.test");
    await importCohort(t, "buyers", ["buyer@example.test"]);
    const guard = (who: Member, now: number) =>
      t.run(async (ctx) => {
        const user = await ctx.db.get("users", who.userId);
        if (!user) throw new Error("missing user");
        await assertFoundingEligible(ctx, user, now);
        return "allowed";
      });
    expect(await errorData(() => guard(buyer, W1 - 1))).toEqual({ code: "NOT_YET_ELIGIBLE", opensAt: W1 });
    expect(await guard(buyer, W1)).toBe("allowed");
    expect(await errorData(() => guard(member, W2))).toEqual({ code: "NOT_YET_ELIGIBLE", opensAt: W3 });
    expect(await guard(member, W3)).toBe("allowed");
    setWindows({});
    expect(await errorData(() => guard(buyer, LATER))).toEqual({ code: "NOT_YET_ELIGIBLE" });
  });
});

describe("WP63-S7 operator import", () => {
  test("imports once, counts repeats, and keeps cohorts apart", async () => {
    const t = convexTest(schema, modules);
    const hashes = await Promise.all(["a@example.test", "b@example.test"].map(cohortEmailHash));
    const call = (cohort: FoundingCohort, batchId: string, emailHashes: string[]) =>
      t.mutation(internal.platform.membership.cohorts.importBatch, { cohort, batchId, emailHashes });
    expect(await call("buyers", "buyers-00000000000000aa", hashes)).toEqual({ inserted: 2, existing: 0 });
    expect(await call("buyers", "buyers-00000000000000ab", hashes)).toEqual({ inserted: 0, existing: 2 });
    expect(await call("newsletter", "newsletter-00000000000000ac", hashes)).toEqual({ inserted: 2, existing: 0 });
  });

  test("a bad hash, a repeat, a bad batch id or a bad size writes nothing", async () => {
    const t = convexTest(schema, modules);
    const good = await cohortEmailHash("a@example.test");
    const call = (cohort: FoundingCohort, batchId: string, emailHashes: string[]) =>
      errorData(() => t.mutation(internal.platform.membership.cohorts.importBatch, { cohort, batchId, emailHashes }));
    expect(await call("buyers", "buyers-00000000000000aa", [good, "a@example.test"])).toEqual({ code: "INVALID_EMAIL_HASH" });
    expect(await call("buyers", "buyers-00000000000000aa", [good, good])).toEqual({ code: "INVALID_EMAIL_HASH" });
    expect(await call("buyers", "newsletter-00000000000000aa", [good])).toEqual({ code: "INVALID_BATCH_ID" });
    expect(await call("buyers", "buyers-1", [good])).toEqual({ code: "INVALID_BATCH_ID" });
    expect(await call("buyers", "buyers-00000000000000aa", [])).toEqual({ code: "INVALID_BATCH_SIZE" });
    const tooMany = Array.from({ length: 201 }, (_, index) => index.toString(16).padStart(64, "0"));
    expect(await call("buyers", "buyers-00000000000000aa", tooMany)).toEqual({ code: "INVALID_BATCH_SIZE" });
    expect(await t.run((ctx) => ctx.db.query("offer_cohorts").take(10))).toHaveLength(0);
  });

  test("an import can be undone by its batch id, a page at a time", async () => {
    const t = convexTest(schema, modules);
    const keep = await cohortEmailHash("keep@example.test");
    await t.mutation(internal.platform.membership.cohorts.importBatch, {
      cohort: "newsletter",
      batchId: "newsletter-00000000000000ff",
      emailHashes: [keep],
    });
    const many = Array.from({ length: 200 }, (_, index) => index.toString(16).padStart(64, "0"));
    const more = Array.from({ length: 5 }, (_, index) => (index + 500).toString(16).padStart(64, "0"));
    for (const emailHashes of [many, more]) {
      await t.mutation(internal.platform.membership.cohorts.importBatch, {
        cohort: "buyers",
        batchId: "buyers-00000000000000ee",
        emailHashes,
      });
    }
    const undo = () => t.mutation(internal.platform.membership.cohorts.removeBatch, { batchId: "buyers-00000000000000ee" });
    expect(await undo()).toEqual({ removed: 200, more: true });
    expect(await undo()).toEqual({ removed: 5, more: false });
    const left = await t.run((ctx) => ctx.db.query("offer_cohorts").take(10));
    expect(left.map((row) => row.emailHash)).toEqual([keep]);
  });

  test("the launch check reports seats and windows for the S12 checklist", async () => {
    setWindows({ buyers: W1, newsletter: W2, everyone: W3 });
    const t = convexTest(schema, modules);
    await seedSeats(t);
    expect(await t.query(internal.platform.membership.cohorts.launchCheck, {})).toEqual({
      seats: { free: 50, reserved: 0, taken: 0, overflow: false },
      windows: { buyers: W1, newsletter: W2, everyone: W3 },
      windowsInOrder: true,
    });
  });
});

describe("WP63-S7 Home founding card", () => {
  async function ready(t: T, email = "member@example.test") {
    setWindows({ everyone: W3 });
    await seedSeats(t);
    return await seedUser(t, email);
  }
  const offerFor = (t: T, member: Member, args: { now?: number; foundingOffer?: boolean } = {}) =>
    asUser(t, member).query(api.platform.dashboard.offer, { now: args.now ?? LATER, foundingOffer: args.foundingOffer ?? true });

  test("shows the true seats left and the next seat's price, and wins over the Starter Kit", async () => {
    const t = convexTest(schema, modules);
    const member = await ready(t);
    expect(await offerFor(t, member)).toEqual({
      id: "founding-lifetime",
      kind: "founding_lifetime",
      eyebrow: "Founding Lifetime · 50 of 50 seats left",
      title: "Become a founding member of Builder’s Hub",
      body: "$249 once. No renewal. Full refund within 30 days of your first payment.",
      items: [
        "Collections and a private note on each idea",
        "Unlimited weekend plans, with history",
        "Prompt pack export for your AI tool",
        "Compare up to 4 ideas side by side",
        "One live build a month, with replays",
      ],
      cta: { label: "See Founding Lifetime", href: "/dashboard/billing#builders-hub" },
    });
  });

  test("not with the flag off, not on day one, not before the window", async () => {
    const t = convexTest(schema, modules);
    const member = await ready(t);
    expect((await offerFor(t, member, { foundingOffer: false }))?.kind).not.toBe("founding_lifetime");
    expect((await asUser(t, member).query(api.platform.dashboard.offer, { now: LATER }))?.kind).not.toBe("founding_lifetime");
    expect((await offerFor(t, member, { now: Date.now() }))?.kind).not.toBe("founding_lifetime");
    setWindows({ everyone: LATER + 1 });
    expect((await offerFor(t, member))?.kind).not.toBe("founding_lifetime");
  });

  test("never for a Builder's Hub member", async () => {
    const t = convexTest(schema, modules);
    const member = await ready(t);
    await t.mutation(internal.platform.membership.comp.grant, { ownerId: member.userId });
    expect((await offerFor(t, member))?.kind).not.toBe("founding_lifetime");
  });

  test("retires when the seats are gone, and is hidden before the seed", async () => {
    const t = convexTest(schema, modules);
    setWindows({ everyone: W3 });
    const member = await seedUser(t, "member@example.test");
    expect((await offerFor(t, member))?.kind).not.toBe("founding_lifetime");
    await seedSeats(t);
    await t.run(async (ctx) => {
      const order = await ctx.db.insert("membership_orders", {
        ownerId: member.userId,
        term: "lifetime",
        priceKey: "lifetime_t1",
        status: "paid",
        idempotencyKey: "sold-out",
        createdAt: 1,
        updatedAt: 1,
        livemode: false,
      });
      for (const seat of await ctx.db.query("founding_seats").withIndex("by_seatNumber").take(60)) {
        await ctx.db.patch("founding_seats", seat._id, { status: "taken", ownerId: member.userId, orderId: order, updatedAt: 2 });
      }
    });
    expect((await offerFor(t, member))?.kind).not.toBe("founding_lifetime");
  });

  test("the price follows the next free seat", async () => {
    const t = convexTest(schema, modules);
    const member = await ready(t);
    await t.run(async (ctx) => {
      const order = await ctx.db.insert("membership_orders", {
        ownerId: member.userId,
        term: "lifetime",
        priceKey: "lifetime_t1",
        status: "paid",
        idempotencyKey: "tranche-1",
        createdAt: 1,
        updatedAt: 1,
        livemode: false,
      });
      for (const seat of await ctx.db.query("founding_seats").withIndex("by_seatNumber").take(15)) {
        await ctx.db.patch("founding_seats", seat._id, { status: "taken", ownerId: member.userId, orderId: order, updatedAt: 2 });
      }
    });
    expect(await offerFor(t, member)).toMatchObject({
      eyebrow: "Founding Lifetime · 35 of 50 seats left",
      body: "$349 once. No renewal. Full refund within 30 days of your first payment.",
    });
  });

  test("dismissing it is remembered for the member", async () => {
    const t = convexTest(schema, modules);
    const member = await ready(t);
    await asUser(t, member).mutation(api.platform.preferences.dismissOffer, { offerId: "founding-lifetime" });
    expect((await offerFor(t, member))?.kind).not.toBe("founding_lifetime");
  });

  test("the card carries no email, hash or cohort", async () => {
    const t = convexTest(schema, modules);
    const member = await ready(t, "buyer@example.test");
    await importCohort(t, "buyers", ["buyer@example.test"]);
    const json = JSON.stringify(await offerFor(t, member));
    expect(json).not.toMatch(/@|buyers|newsletter|[0-9a-f]{64}/);
  });
});
