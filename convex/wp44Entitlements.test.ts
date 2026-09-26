/// <reference types="vite/client" />

import { convexTest, type TestConvex } from "convex-test";
import { ConvexError } from "convex/values";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { requireFeature } from "./platform/entitlements";
import {
  PLANS,
  PLAN_COMPARISON,
  PLAN_LIMITS,
  QUIET_PERIOD_MS,
  UPGRADE_LABEL,
  upgradeSheetAllowed,
  upsellVisible,
} from "./platform/plans";
import schema from "./schema";

// Stand-in for the subscription record: every test starts on Free, and a
// test can make its members Builder's Hub (PRD 9.3: stubbed resolver).
const stub = vi.hoisted(() => ({ hubOwners: new Set<string>() }));
vi.mock("./platform/planResolver", () => ({
  resolvePlan: async (_ctx: unknown, ownerId: string) => (stub.hubOwners.has(ownerId) ? "builders_hub" : "free"),
}));

const modules = import.meta.glob("./**/*.ts");

type Member = { userId: Id<"users">; sessionId: Id<"authSessions"> };

async function seedUser(t: TestConvex<typeof schema>, email: string): Promise<Member> {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { email });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: 9_999_999_999_999 });
    return { userId, sessionId };
  });
}

function asUser(t: TestConvex<typeof schema>, member: Member) {
  return t.withIdentity({
    subject: `${member.userId}|${member.sessionId}`,
    issuer: "https://local.test",
    tokenIdentifier: `https://local.test|${member.userId}`,
  });
}

async function seedIdea(t: TestConvex<typeof schema>, slug: string, title = slug) {
  return await t.run(async (ctx) =>
    ctx.db.insert("ideas", {
      slug,
      title,
      description: "desc",
      publishedAt: 0,
      category: "saas",
      buildTime: "10",
      revenueGoal: "5k-month",
      applicationCategory: "BusinessApplication",
      tools: ["cursor"],
      audiences: [],
      bodyMode: "mdx",
    }),
  );
}

function errorData(error: unknown) {
  return error instanceof ConvexError ? (error.data as Record<string, unknown>) : null;
}

afterEach(() => {
  stub.hubOwners.clear();
});

describe("WP44-S10 plan rules", () => {
  test("the real resolver says Free for everyone until the subscription WP", async () => {
    const real = await vi.importActual<typeof import("./platform/planResolver")>("./platform/planResolver");
    const t = convexTest(schema, modules);
    const member = await seedUser(t, "real@example.test");
    expect(await t.run((ctx) => real.resolvePlan(ctx, member.userId))).toBe("free");
  });

  test("one plan constant: id, name, price, limits and the upgrade label", () => {
    expect(Object.keys(PLANS)).toEqual(["free", "builders_hub"]);
    expect(PLANS.builders_hub.name).toBe("Builder’s Hub");
    expect(UPGRADE_LABEL).toBe("Upgrade to Builder’s Hub · $29/mo");
    expect(PLAN_LIMITS.free).toEqual({ activeWeekendPlans: 1, collections: false, promptPack: false, compareMax: 0 });
    expect(PLAN_LIMITS.builders_hub.activeWeekendPlans).toBeNull();
    expect(PLAN_COMPARISON.map((row) => row.feature)).toEqual(["weekend_plan", "collections", "prompt_pack", "compare"]);
    // R5 and R9: nothing about hosting or credits.
    const copy = JSON.stringify([PLANS, PLAN_COMPARISON, UPGRADE_LABEL]);
    expect(copy).not.toMatch(/hosting|credit|publish/i);
  });

  test("upsells: never for Builder's Hub, never with the flag off, never on day one", () => {
    const now = 10 * QUIET_PERIOD_MS;
    const old = now - 2 * QUIET_PERIOD_MS;
    expect(upsellVisible({ flagOn: true, plan: "free", joinedAt: old, now })).toBe(true);
    expect(upsellVisible({ flagOn: false, plan: "free", joinedAt: old, now })).toBe(false);
    expect(upsellVisible({ flagOn: true, plan: "builders_hub", joinedAt: old, now })).toBe(false);
    expect(upsellVisible({ flagOn: true, plan: "free", joinedAt: now - 1000, now })).toBe(false);
    // The sheet opens when a member reaches for a feature, even on day one.
    expect(upgradeSheetAllowed({ flagOn: true, plan: "free" })).toBe(true);
    expect(upgradeSheetAllowed({ flagOn: true, plan: "builders_hub" })).toBe(false);
    expect(upgradeSheetAllowed({ flagOn: false, plan: "free" })).toBe(false);
  });
});

describe("WP44-S10 entitlements on Free", () => {
  test("deny anonymous callers", async () => {
    const t = convexTest(schema, modules);
    await expect(t.query(api.platform.entitlements.mine, {})).rejects.toThrow("UNAUTHENTICATED");
  });

  test("mine reports the plan, limits, usage and join time", async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedUser(t, "free@example.test");
    const member = asUser(t, seeded);
    await seedIdea(t, "a");
    await member.mutation(api.platform.weekendPlans.start, { slug: "a" });
    const mine = await member.query(api.platform.entitlements.mine, {});
    expect(mine).toMatchObject({ plan: "free", limits: PLAN_LIMITS.free, usage: { activeWeekendPlans: 1 } });
    expect(mine.joinedAt).toBeGreaterThan(0);
    expect((await member.query(api.platform.dashboard.home, {})).plan).toBe("free");
  });

  test("a second plan throws UPGRADE_REQUIRED for weekend_plan, naming the free way forward", async () => {
    const t = convexTest(schema, modules);
    const member = asUser(t, await seedUser(t, "gate@example.test"));
    await seedIdea(t, "first", "First Idea");
    await seedIdea(t, "second", "Second Idea");
    const first = await member.mutation(api.platform.weekendPlans.start, { slug: "first" });

    const error = await member.mutation(api.platform.weekendPlans.start, { slug: "second" }).catch((e: unknown) => e);
    expect(errorData(error)).toEqual({
      code: "UPGRADE_REQUIRED",
      feature: "weekend_plan",
      activePlanId: first.planId,
      activeTitle: "First Idea",
    });
  });

  test("the client cannot bypass the limit", async () => {
    const t = convexTest(schema, modules);
    const member = asUser(t, await seedUser(t, "bypass@example.test"));
    await seedIdea(t, "first");
    await seedIdea(t, "second");
    await seedIdea(t, "third");
    await member.mutation(api.platform.weekendPlans.start, { slug: "first" });

    // No argument can name a plan or a limit: the validator refuses extras.
    const extras: Record<string, unknown>[] = [
      { plan: "builders_hub" },
      { limit: 5 },
      { entitlements: { activeWeekendPlans: null } },
    ];
    for (const extra of extras) {
      const args = { slug: "second", ...extra } as unknown as { slug: string };
      await expect(member.mutation(api.platform.weekendPlans.start, args)).rejects.toThrow(/Unexpected field/);
    }
    // The free way forward archives, so the count never goes above 1.
    await member.mutation(api.platform.weekendPlans.start, { slug: "second", replaceActive: true });
    await member.mutation(api.platform.weekendPlans.start, { slug: "third", replaceActive: true });
    const mine = await member.query(api.platform.entitlements.mine, {});
    expect(mine.usage.activeWeekendPlans).toBe(1);
    expect((await member.query(api.platform.weekendPlans.list, {})).active.map((plan) => plan.slug)).toEqual(["third"]);
    // Nor can plans be revived to get around it: closed plans stay closed.
    await expect(member.mutation(api.platform.weekendPlans.start, { slug: "second" })).rejects.toThrow(
      "UPGRADE_REQUIRED",
    );
  });

  test("on/off features refuse Free members on the server (for S11)", async () => {
    const t = convexTest(schema, modules);
    const member = await seedUser(t, "features@example.test");
    for (const feature of ["collections", "prompt_pack", "compare"] as const) {
      const error = await t.run((ctx) => requireFeature(ctx, member.userId, feature)).catch((e: unknown) => e);
      expect(errorData(error)).toEqual({ code: "UPGRADE_REQUIRED", feature });
    }
  });
});

describe("WP44-S10 entitlements on Builder's Hub (stubbed resolver)", () => {
  test("no limit on weekend plans, and no upgrade error anywhere", async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedUser(t, "hub@example.test");
    stub.hubOwners.add(seeded.userId);
    const member = asUser(t, seeded);
    await seedIdea(t, "first");
    await seedIdea(t, "second");
    await seedIdea(t, "third");

    await member.mutation(api.platform.weekendPlans.start, { slug: "first" });
    expect((await member.query(api.platform.weekendPlans.startPreview, { slug: "second" })).atLimit).toBe(false);
    await member.mutation(api.platform.weekendPlans.start, { slug: "second" });
    await member.mutation(api.platform.weekendPlans.start, { slug: "third" });

    const list = await member.query(api.platform.weekendPlans.list, {});
    expect(list.active.map((plan) => plan.slug).sort()).toEqual(["first", "second", "third"]);
    const mine = await member.query(api.platform.entitlements.mine, {});
    expect(mine).toMatchObject({ plan: "builders_hub", limits: PLAN_LIMITS.builders_hub, usage: { activeWeekendPlans: 3 } });
    expect((await member.query(api.platform.dashboard.home, {})).plan).toBe("builders_hub");

    // Every building idea shows the badge, not just the newest plan's.
    const library = await member.query(api.platform.ideas.library, { view: "all", limit: 10 });
    expect(library.items.filter((idea) => idea.building).map((idea) => idea.slug).sort()).toEqual([
      "first",
      "second",
      "third",
    ]);

    for (const feature of ["collections", "prompt_pack", "compare"] as const) {
      const allowed = await t.run(async (ctx) => {
        await requireFeature(ctx, seeded.userId, feature);
        return "allowed";
      });
      expect(allowed).toBe("allowed");
    }
  });

  test("the plan is per member: a Free member beside them keeps the limit", async () => {
    const t = convexTest(schema, modules);
    const hubMember = await seedUser(t, "hub2@example.test");
    stub.hubOwners.add(hubMember.userId);
    const hub = asUser(t, hubMember);
    const free = asUser(t, await seedUser(t, "still-free@example.test"));
    await seedIdea(t, "a");
    await seedIdea(t, "b");

    await hub.mutation(api.platform.weekendPlans.start, { slug: "a" });
    await hub.mutation(api.platform.weekendPlans.start, { slug: "b" });
    await free.mutation(api.platform.weekendPlans.start, { slug: "a" });
    await expect(free.mutation(api.platform.weekendPlans.start, { slug: "b" })).rejects.toThrow("UPGRADE_REQUIRED");
    expect((await free.query(api.platform.entitlements.mine, {})).plan).toBe("free");
    expect((await hub.query(api.platform.entitlements.mine, {})).plan).toBe("builders_hub");
  });
});
