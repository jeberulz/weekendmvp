/// <reference types="vite/client" />

import { convexTest, type TestConvex } from "convex-test";
import { ConvexError } from "convex/values";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { requireFeature } from "./platform/entitlements";
import { JOIN_OPENS_BEFORE_MS, endOf, liveStatusAt, readHttpsUrl } from "./platform/liveBuildRules";
import { BILLING_COMPARISON, PLANS, PLAN_COMPARISON, PLAN_LIMITS } from "./platform/plans";
import schema from "./schema";

// WP63-S8. Live builds: stored status flipped by scheduled mutations, links
// only for Builder's Hub members, operator-only writes.

const modules = import.meta.glob("./**/*.ts");

type T = TestConvex<typeof schema>;
type Member = { userId: Id<"users">; sessionId: Id<"authSessions"> };
type Row = Omit<Doc<"live_builds">, "_id" | "_creationTime">;

const HOUR = 60 * 60 * 1000;
const JOIN = "https://meet.example.test/live-1";
const REPLAY = "https://video.example.test/replay-1";

afterEach(() => {
  vi.useRealTimers();
});

async function seedUser(t: T, email: string): Promise<Member> {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { email, emailVerificationTime: 1 });
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

async function addRow(t: T, row: Partial<Row>) {
  return await t.run(async (ctx) =>
    ctx.db.insert("live_builds", {
      title: "Build a waitlist app live",
      summary: "One idea, ninety minutes.",
      startsAt: 1_000_000,
      durationMin: 90,
      status: "scheduled",
      createdAt: 1,
      updatedAt: 1,
      ...row,
    }),
  );
}

async function errorCode(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run();
  } catch (error) {
    return error instanceof ConvexError ? (error.data as { code?: unknown }).code : String(error);
  }
  return "no error";
}

async function list(t: T, member: Member) {
  return await asUser(t, member).query(api.platform.liveBuilds.list, {});
}

async function scheduledTimes(t: T): Promise<number[]> {
  return await t.run(async (ctx) => {
    const jobs = await ctx.db.system.query("_scheduled_functions").collect();
    return jobs.filter((job) => job.state.kind === "pending").map((job) => job.scheduledTime).sort((a, b) => a - b);
  });
}

describe("WP63-S8 status rules", () => {
  const session = { startsAt: 100 * HOUR, durationMin: 90 };

  test("scheduled, then open 24 hours before, then ended at the end", () => {
    expect(liveStatusAt(session, 100 * HOUR - JOIN_OPENS_BEFORE_MS - 1)).toBe("scheduled");
    expect(liveStatusAt(session, 100 * HOUR - JOIN_OPENS_BEFORE_MS)).toBe("open");
    expect(liveStatusAt(session, 100 * HOUR)).toBe("open");
    expect(liveStatusAt(session, endOf(session) - 1)).toBe("open");
    expect(liveStatusAt(session, endOf(session))).toBe("ended");
    expect(liveStatusAt({ ...session, status: "canceled" }, endOf(session))).toBe("canceled");
    expect(endOf(session)).toBe(100 * HOUR + 90 * 60_000);
  });

  test("links are https only, with no credentials", () => {
    expect(readHttpsUrl(" https://meet.example.test/x ")).toBe("https://meet.example.test/x");
    for (const bad of ["http://meet.example.test/x", "https://user:pw@meet.example.test", "javascript:alert(1)", "not a link", `https://x.test/${"a".repeat(2050)}`]) {
      expect(readHttpsUrl(bad), bad).toBeNull();
    }
  });

  test("the plan lists live builds now that the hub ships", () => {
    expect(PLANS.builders_hub.adds).toContain("One live build a month, with replays");
    expect(PLAN_LIMITS.free.liveBuilds).toBe(false);
    expect(PLAN_LIMITS.builders_hub.liveBuilds).toBe(true);
    expect(PLAN_COMPARISON.at(-1)).toEqual({ feature: "live_builds", free: "See the schedule", hub: "Join live, watch replays" });
    expect(BILLING_COMPARISON.find((row) => row.label === "Live builds")).toEqual({
      label: "Live builds",
      free: "See the schedule",
      hub: "One a month, with replays",
    });
  });
});

describe("WP63-S8 operator writes", () => {
  test("create stores a session and schedules the open and end flips", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(10 * HOUR);
    const t = convexTest(schema, modules);
    const startsAt = 100 * HOUR;
    const created = await t.mutation(internal.platform.liveBuildsOperator.create, {
      title: "  Build a waitlist app live  ",
      summary: "One idea, ninety minutes.",
      startsAt,
      durationMin: 90,
      joinUrl: JOIN,
    });
    expect(created.status).toBe("scheduled");
    expect(Object.keys(created).sort()).toEqual(["id", "status"]);
    const row = await t.run((ctx) => ctx.db.get("live_builds", created.id));
    expect(row).toMatchObject({ title: "Build a waitlist app live", status: "scheduled", joinUrl: JOIN });
    expect(await scheduledTimes(t)).toEqual([startsAt - JOIN_OPENS_BEFORE_MS, endOf({ startsAt, durationMin: 90 })]);
  });

  test("inside the 24 hours a session starts open, with only the end flip left", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(10 * HOUR);
    const t = convexTest(schema, modules);
    const created = await t.mutation(internal.platform.liveBuildsOperator.create, {
      title: "Soon",
      summary: "",
      startsAt: 12 * HOUR,
      durationMin: 60,
    });
    expect(created.status).toBe("open");
    expect(await scheduledTimes(t)).toEqual([12 * HOUR + 60 * 60_000]);
  });

  test("advance follows the server clock, and a job from an old time does nothing", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(10 * HOUR);
    const t = convexTest(schema, modules);
    const { id } = await t.mutation(internal.platform.liveBuildsOperator.create, {
      title: "Moving",
      summary: "",
      startsAt: 100 * HOUR,
      durationMin: 60,
    });
    await t.mutation(internal.platform.liveBuildsOperator.update, { id, startsAt: 200 * HOUR });
    const status = async () => (await t.run((ctx) => ctx.db.get("live_builds", id)))?.status;

    vi.setSystemTime(100 * HOUR - JOIN_OPENS_BEFORE_MS);
    await t.mutation(internal.platform.liveBuildsOperator.advance, { id });
    expect(await status()).toBe("scheduled");

    vi.setSystemTime(200 * HOUR - JOIN_OPENS_BEFORE_MS);
    await t.mutation(internal.platform.liveBuildsOperator.advance, { id });
    expect(await status()).toBe("open");

    vi.setSystemTime(200 * HOUR + 60 * 60_000);
    await t.mutation(internal.platform.liveBuildsOperator.advance, { id });
    expect(await status()).toBe("ended");
  });

  test("the scheduler itself carries a session through to ended", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    const { id } = await t.mutation(internal.platform.liveBuildsOperator.create, {
      title: "Scheduled",
      summary: "",
      startsAt: Date.now() + 48 * HOUR,
      durationMin: 30,
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect((await t.run((ctx) => ctx.db.get("live_builds", id)))?.status).toBe("ended");
  });

  test("bad input is refused and writes nothing", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(10 * HOUR);
    const t = convexTest(schema, modules);
    const base = { title: "Ok", summary: "", startsAt: 100 * HOUR, durationMin: 60 };
    const create = (args: Partial<typeof base> & { joinUrl?: string }) =>
      errorCode(() => t.mutation(internal.platform.liveBuildsOperator.create, { ...base, ...args }));
    expect(await create({ title: "   " })).toBe("INVALID_TITLE");
    expect(await create({ title: "x".repeat(121) })).toBe("INVALID_TITLE");
    expect(await create({ summary: "x".repeat(601) })).toBe("INVALID_SUMMARY");
    expect(await create({ startsAt: 10 * HOUR })).toBe("INVALID_START");
    expect(await create({ startsAt: 100.5 * HOUR + 0.5 })).toBe("INVALID_START");
    expect(await create({ durationMin: 14 })).toBe("INVALID_DURATION");
    expect(await create({ durationMin: 241 })).toBe("INVALID_DURATION");
    expect(await create({ durationMin: 60.5 })).toBe("INVALID_DURATION");
    expect(await create({ joinUrl: "http://meet.example.test/x" })).toBe("INVALID_LINK");
    expect(await t.run((ctx) => ctx.db.query("live_builds").take(5))).toHaveLength(0);
  });

  test("update clears a link with null, refuses a past time, and cancel locks the session", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(10 * HOUR);
    const t = convexTest(schema, modules);
    const { id } = await t.mutation(internal.platform.liveBuildsOperator.create, {
      title: "Ok",
      summary: "",
      startsAt: 100 * HOUR,
      durationMin: 60,
      joinUrl: JOIN,
    });
    await t.mutation(internal.platform.liveBuildsOperator.update, { id, joinUrl: null, title: " Renamed " });
    const renamed = await t.run((ctx) => ctx.db.get("live_builds", id));
    expect(renamed?.title).toBe("Renamed");
    expect(renamed && "joinUrl" in renamed).toBe(false);
    expect(await errorCode(() => t.mutation(internal.platform.liveBuildsOperator.update, { id, startsAt: 5 * HOUR }))).toBe(
      "INVALID_START",
    );
    expect(await t.mutation(internal.platform.liveBuildsOperator.cancel, { id })).toEqual({ id, status: "canceled" });
    expect(await errorCode(() => t.mutation(internal.platform.liveBuildsOperator.update, { id, title: "x" }))).toBe(
      "LIVE_BUILD_CANCELED",
    );
    expect(await errorCode(() => t.mutation(internal.platform.liveBuildsOperator.setReplay, { id, replayUrl: REPLAY }))).toBe(
      "LIVE_BUILD_CANCELED",
    );
    // A leftover flip never revives a canceled session.
    vi.setSystemTime(200 * HOUR);
    await t.mutation(internal.platform.liveBuildsOperator.advance, { id });
    expect((await t.run((ctx) => ctx.db.get("live_builds", id)))?.status).toBe("canceled");
  });
});

describe("WP63-S8 the member query", () => {
  async function scene(t: T) {
    const open = await addRow(t, { title: "Open now", startsAt: 2_000, status: "open", joinUrl: JOIN });
    const soon = await addRow(t, { title: "Next month", startsAt: 3_000, status: "scheduled", joinUrl: JOIN });
    const done = await addRow(t, { title: "Last month", startsAt: 1_000, status: "ended", replayUrl: REPLAY, joinUrl: JOIN });
    const noReplay = await addRow(t, { title: "Two months ago", startsAt: 500, status: "ended" });
    await addRow(t, { title: "Called off", startsAt: 2_500, status: "canceled", joinUrl: JOIN });
    return { open, soon, done, noReplay };
  }

  test("a Builder's Hub member gets the join link while open and the replay after", async () => {
    const t = convexTest(schema, modules);
    const ids = await scene(t);
    const member = await seedUser(t, "hub@example.test");
    await t.mutation(internal.platform.membership.comp.grant, { ownerId: member.userId });
    const result = await list(t, member);
    expect(result.entitled).toBe(true);
    expect(result.upcoming.map((session) => [session.id, session.status, session.joinUrl, session.hasJoinLink])).toEqual([
      [ids.open, "open", JOIN, true],
      [ids.soon, "scheduled", null, false],
    ]);
    expect(result.past.map((session) => [session.id, session.replayUrl, session.hasReplay])).toEqual([
      [ids.done, REPLAY, true],
      [ids.noReplay, null, false],
    ]);
    expect(result.past.every((session) => session.joinUrl === null)).toBe(true);
    expect(JSON.stringify(result)).not.toContain("Called off");
  });

  test("a free member sees the schedule and titles, never a link", async () => {
    const t = convexTest(schema, modules);
    await scene(t);
    const member = await seedUser(t, "free@example.test");
    const result = await list(t, member);
    expect(result.entitled).toBe(false);
    expect(result.upcoming.map((session) => session.title)).toEqual(["Open now", "Next month"]);
    expect(result.upcoming[0].hasJoinLink).toBe(true);
    expect(result.past[0].hasReplay).toBe(true);
    const json = JSON.stringify(result);
    expect(json).not.toContain(JOIN);
    expect(json).not.toContain(REPLAY);
    expect(json).not.toMatch(/https?:/);
  });

  test("entitlement matrix: every way to hold the plan opens links, everything else does not", async () => {
    const t = convexTest(schema, modules);
    await addRow(t, { title: "Open now", status: "open", joinUrl: JOIN });
    const cases: [string, (ownerId: Id<"users">) => Promise<unknown>, boolean][] = [
      ["free", async () => null, false],
      ["monthly", (ownerId) => subscription(t, ownerId, "monthly", "active"), true],
      ["annual", (ownerId) => subscription(t, ownerId, "annual", "active"), true],
      ["past_due", (ownerId) => subscription(t, ownerId, "monthly", "past_due"), true],
      ["canceled", (ownerId) => subscription(t, ownerId, "monthly", "canceled"), false],
      ["unpaid", (ownerId) => subscription(t, ownerId, "annual", "unpaid"), false],
      ["lifetime", (ownerId) => lifetime(t, ownerId, {}), true],
      ["suspended lifetime", (ownerId) => lifetime(t, ownerId, { suspendedAt: 5 }), false],
      ["revoked lifetime", (ownerId) => lifetime(t, ownerId, { revokedAt: 5, revokeReason: "refund" }), false],
      ["comp", (ownerId) => t.mutation(internal.platform.membership.comp.grant, { ownerId }), true],
    ];
    for (const [name, give, entitled] of cases) {
      const member = await seedUser(t, `${name.replace(/ /g, "-")}@example.test`);
      await give(member.userId);
      const result = await list(t, member);
      expect([name, result.entitled, result.upcoming[0].joinUrl]).toEqual([name, entitled, entitled ? JOIN : null]);
    }
  });

  test("two members in one moment: only the paying one gets the link", async () => {
    const t = convexTest(schema, modules);
    await addRow(t, { status: "open", joinUrl: JOIN });
    const hub = await seedUser(t, "hub2@example.test");
    const free = await seedUser(t, "free2@example.test");
    await subscription(t, hub.userId, "annual", "active");
    expect((await list(t, hub)).upcoming[0].joinUrl).toBe(JOIN);
    expect((await list(t, free)).upcoming[0].joinUrl).toBeNull();
  });

  test("signed-in members only, and an empty schedule is just empty", async () => {
    const t = convexTest(schema, modules);
    await expect(t.query(api.platform.liveBuilds.list, {})).rejects.toThrow("UNAUTHENTICATED");
    const member = await seedUser(t, "empty@example.test");
    expect(await list(t, member)).toEqual({ entitled: false, upcoming: [], past: [] });
  });

  test("the server gate refuses a free member and the UI check knows the feature", async () => {
    const t = convexTest(schema, modules);
    const member = await seedUser(t, "gate@example.test");
    const error = await t.run((ctx) => requireFeature(ctx, member.userId, "live_builds")).catch((caught: unknown) => caught);
    expect(error instanceof ConvexError ? error.data : error).toEqual({ code: "UPGRADE_REQUIRED", feature: "live_builds" });
    await expect(asUser(t, member).query(api.platform.entitlements.check, { feature: "live_builds" })).rejects.toThrow(
      "UPGRADE_REQUIRED",
    );
    await t.mutation(internal.platform.membership.comp.grant, { ownerId: member.userId });
    expect(await asUser(t, member).query(api.platform.entitlements.check, { feature: "live_builds" })).toBeNull();
  });
});

let subscriptions = 0;

async function subscription(
  t: T,
  ownerId: Id<"users">,
  term: "monthly" | "annual",
  status: Doc<"plan_subscriptions">["status"],
) {
  subscriptions += 1;
  await t.run((ctx) =>
    ctx.db.insert("plan_subscriptions", {
      ownerId,
      stripeSubscriptionId: `sub_live_${subscriptions}`,
      stripeCustomerId: `cus_live_${subscriptions}`,
      term,
      status,
      currentPeriodEnd: 9_000_000_000_000,
      cancelAtPeriodEnd: false,
      snapshotAt: subscriptions,
      updatedAt: subscriptions,
      livemode: false,
    }),
  );
}

async function lifetime(t: T, ownerId: Id<"users">, extra: Partial<Doc<"plan_grants">>) {
  await t.run(async (ctx) => {
    const orderId = await ctx.db.insert("membership_orders", {
      ownerId,
      term: "lifetime",
      priceKey: "lifetime_t1",
      status: "paid",
      idempotencyKey: `live-${ownerId}`,
      seatNumber: 3,
      createdAt: 1,
      updatedAt: 1,
      livemode: false,
    });
    await ctx.db.insert("plan_grants", { ownerId, kind: "lifetime", orderId, seatNumber: 3, grantedAt: 1, ...extra });
  });
}
