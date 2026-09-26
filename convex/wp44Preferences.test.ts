/// <reference types="vite/client" />

import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { rankForYou } from "./platform/forYou";
import {
  SETUP_GOALS,
  SETUP_HOURS,
  SETUP_TOOLS,
  fitsWeekend,
  reasonText,
} from "./platform/setupOptions";
import {
  setupGoalValidator,
  setupHoursValidator,
  setupToolValidator,
} from "./platform/setupValidators";
import schema from "./schema";

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

type Seed = {
  slug: string;
  title?: string;
  category?: string;
  tools?: string[];
  buildTime?: string;
  revenueGoal?: string;
  score?: number;
  publishedAt?: number;
};

async function seedIdea(t: TestConvex<typeof schema>, seed: Seed) {
  return await t.run(async (ctx) =>
    ctx.db.insert("ideas", {
      slug: seed.slug,
      title: seed.title ?? seed.slug,
      description: "desc",
      publishedAt: seed.publishedAt ?? 0,
      category: seed.category ?? "saas",
      buildTime: seed.buildTime ?? "10",
      revenueGoal: seed.revenueGoal ?? "5k-month",
      applicationCategory: "BusinessApplication",
      tools: seed.tools ?? ["cursor"],
      audiences: [],
      bodyMode: "mdx",
      scores: {
        opportunity: seed.score ?? 7,
        pain: seed.score ?? 7,
        timing: seed.score ?? 7,
        builder_confidence: seed.score ?? 7,
      },
    }),
  );
}

describe("WP44-S8 setup vocabulary", () => {
  test("the Convex validators match the shared lists", () => {
    const literals = (validator: { members: { value: string }[] }) => validator.members.map((m) => m.value);
    expect(literals(setupToolValidator)).toEqual([...SETUP_TOOLS]);
    expect(literals(setupHoursValidator)).toEqual([...SETUP_HOURS]);
    expect(literals(setupGoalValidator)).toEqual([...SETUP_GOALS]);
  });

  test("a weekend fits when the build is no longer than the time", () => {
    expect(fitsWeekend(8, "8")).toBe(true);
    expect(fitsWeekend(10, "8")).toBe(false);
    expect(fitsWeekend(12, "12")).toBe(true);
    expect(fitsWeekend(20, "20")).toBe(true);
    expect(fitsWeekend(40, "more")).toBe(true);
    expect(fitsWeekend(0, "12")).toBe(false);
  });

  test("reasons read as plain sentences", () => {
    expect(reasonText({ kind: "saved_like", title: "SlackToDoc" })).toBe("Like SlackToDoc, which you saved");
    expect(reasonText({ kind: "hours", hours: "12" })).toBe("Fits a 12-hour weekend");
    expect(reasonText({ kind: "tool", tool: "bolt" })).toBe("You build with Bolt");
    expect(reasonText({ kind: "goal", goal: "side-income" })).toBe("Fits your side income goal");
  });
});

describe("WP44-S8 preferences", () => {
  test("deny anonymous callers", async () => {
    const t = convexTest(schema, modules);
    await expect(t.query(api.platform.preferences.get, {})).rejects.toThrow("UNAUTHENTICATED");
    await expect(t.mutation(api.platform.preferences.saveSetup, { tools: [] })).rejects.toThrow("UNAUTHENTICATED");
    await expect(t.mutation(api.platform.preferences.skipSetup, {})).rejects.toThrow("UNAUTHENTICATED");
  });

  test("start empty, save answers, and keep the first setup time", async () => {
    const t = convexTest(schema, modules);
    const member = asUser(t, await seedUser(t, "setup@example.test"));

    expect(await member.query(api.platform.preferences.get, {})).toEqual({
      tools: [],
      weeklyHours: null,
      goal: null,
      setupDone: false,
      setupSkipped: false,
      updatedAt: null,
    });

    await member.mutation(api.platform.preferences.saveSetup, {
      tools: ["bolt", "cursor", "bolt"],
      weeklyHours: "12",
      goal: "side-income",
    });
    const first = await member.query(api.platform.preferences.get, {});
    // Deduped, and in the allowlist's order.
    expect(first).toMatchObject({ tools: ["cursor", "bolt"], weeklyHours: "12", goal: "side-income", setupDone: true });

    // Leaving an answer out clears it.
    await member.mutation(api.platform.preferences.saveSetup, { tools: ["v0"] });
    const second = await member.query(api.platform.preferences.get, {});
    expect(second).toMatchObject({ tools: ["v0"], weeklyHours: null, goal: null, setupDone: true });

    const home = await member.query(api.platform.dashboard.home, {});
    expect(home.setupDone).toBe(true);
    expect(home.setupSkipped).toBe(false);
  });

  test("reject tools outside the allowlist", async () => {
    const t = convexTest(schema, modules);
    const member = asUser(t, await seedUser(t, "bad@example.test"));
    await expect(
      member.mutation(api.platform.preferences.saveSetup, { tools: ["cursor", "<script>"] }),
    ).rejects.toThrow("INVALID_SETUP");
    await expect(
      member.mutation(api.platform.preferences.saveSetup, { tools: Array(9).fill("cursor") }),
    ).rejects.toThrow("INVALID_SETUP");
  });

  test("skip records the choice and keeps any answers (R7)", async () => {
    const t = convexTest(schema, modules);
    const member = asUser(t, await seedUser(t, "skip@example.test"));

    await member.mutation(api.platform.preferences.skipSetup, {});
    expect(await member.query(api.platform.preferences.get, {})).toMatchObject({
      setupDone: false,
      setupSkipped: true,
      tools: [],
    });
    const home = await member.query(api.platform.dashboard.home, {});
    expect(home).toMatchObject({ setupDone: false, setupSkipped: true });

    await member.mutation(api.platform.preferences.saveSetup, { tools: ["claude"] });
    await member.mutation(api.platform.preferences.skipSetup, {});
    expect(await member.query(api.platform.preferences.get, {})).toMatchObject({
      tools: ["claude"],
      setupDone: true,
      setupSkipped: true,
    });
  });

  test("one member's answers never reach another", async () => {
    const t = convexTest(schema, modules);
    const alice = asUser(t, await seedUser(t, "alice@example.test"));
    const bob = asUser(t, await seedUser(t, "bob@example.test"));
    await alice.mutation(api.platform.preferences.saveSetup, { tools: ["lovable"], weeklyHours: "8" });

    expect(await bob.query(api.platform.preferences.get, {})).toMatchObject({
      tools: [],
      weeklyHours: null,
      setupDone: false,
    });
    const rows = await t.run(async (ctx) => ctx.db.query("user_preferences").take(10));
    expect(rows).toHaveLength(1);
  });
});

describe("WP44-S8 For you ranking and reasons", () => {
  test("answers move the ranking, and a miss on weekend time costs the most", async () => {
    const t = convexTest(schema, modules);
    const member = asUser(t, await seedUser(t, "rank@example.test"));
    await seedIdea(t, { slug: "long-build", buildTime: "20", score: 8, publishedAt: 3 });
    await seedIdea(t, { slug: "fits", buildTime: "8", score: 7.5, publishedAt: 2 });
    await seedIdea(t, { slug: "fits-goal", buildTime: "8", score: 7, revenueGoal: "10k-month", publishedAt: 1 });

    const before = await member.query(api.platform.ideas.library, { view: "for_you", limit: 10 });
    expect(before.items.map((i) => i.slug)).toEqual(["long-build", "fits", "fits-goal"]);
    expect(before.items.every((i) => i.reason === undefined)).toBe(true);

    await member.mutation(api.platform.preferences.saveSetup, { tools: [], weeklyHours: "8", goal: "replace-job" });
    const after = await member.query(api.platform.ideas.library, { view: "for_you", limit: 10 });
    // fits 7.5 + 0.4 = 7.9, fits-goal 7 + 0.4 + 0.3 = 7.7, long-build 8 - 0.6 = 7.4.
    expect(after.items.map((i) => i.slug)).toEqual(["fits", "fits-goal", "long-build"]);
    expect(after.items.find((i) => i.slug === "fits-goal")?.reason).toEqual({ kind: "goal", goal: "replace-job" });
    expect(after.items.find((i) => i.slug === "fits")?.reason).toEqual({ kind: "hours", hours: "8" });
    expect(after.items.find((i) => i.slug === "long-build")?.reason).toBeUndefined();
  });

  test("a saved idea's category earns a 'like' reason naming the saved idea", async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedUser(t, "like@example.test");
    const member = asUser(t, seeded);
    const slackToDoc = await seedIdea(t, { slug: "slacktodoc", title: "SlackToDoc", category: "automation" });
    await seedIdea(t, { slug: "zap-notes", category: "automation" });
    await seedIdea(t, { slug: "other", category: "health" });
    await t.run(async (ctx) => {
      await ctx.db.insert("idea_intents", { ownerId: seeded.userId, ideaId: slackToDoc, saved: true, interested: false, updatedAt: 1 });
    });

    const result = await member.query(api.platform.ideas.library, { view: "for_you", limit: 10 });
    expect(result.items.find((i) => i.slug === "zap-notes")?.reason).toEqual({ kind: "saved_like", title: "SlackToDoc" });
    // Never "like itself".
    expect(result.items.find((i) => i.slug === "slacktodoc")?.reason).toBeUndefined();
    expect(result.items.find((i) => i.slug === "other")?.reason).toBeUndefined();
  });

  test("reasons appear only in For you", async () => {
    const t = convexTest(schema, modules);
    const member = asUser(t, await seedUser(t, "views@example.test"));
    await seedIdea(t, { slug: "a", buildTime: "8", publishedAt: 2 });
    await seedIdea(t, { slug: "b", buildTime: "20", publishedAt: 1 });
    await member.mutation(api.platform.preferences.saveSetup, { tools: [], weeklyHours: "8" });
    const all = await member.query(api.platform.ideas.library, { view: "all", limit: 10 });
    expect(all.items.every((item) => item.reason === undefined)).toBe(true);
    const forYou = await member.query(api.platform.ideas.library, { view: "for_you", limit: 10 });
    expect(forYou.items.find((item) => item.slug === "a")?.reason).toEqual({ kind: "hours", hours: "8" });
  });

  test("two members with different answers see different orders", async () => {
    const t = convexTest(schema, modules);
    const alice = asUser(t, await seedUser(t, "a@example.test"));
    const bob = asUser(t, await seedUser(t, "b@example.test"));
    await seedIdea(t, { slug: "quick", buildTime: "8", score: 7 });
    await seedIdea(t, { slug: "big", buildTime: "20", score: 7.3, revenueGoal: "10k-month" });
    await alice.mutation(api.platform.preferences.saveSetup, { tools: [], weeklyHours: "8" });
    await bob.mutation(api.platform.preferences.saveSetup, { tools: [], weeklyHours: "20", goal: "replace-job" });

    const a = await alice.query(api.platform.ideas.library, { view: "for_you", limit: 10 });
    const b = await bob.query(api.platform.ideas.library, { view: "for_you", limit: 10 });
    expect(a.items[0].slug).toBe("quick");
    expect(b.items[0].slug).toBe("big");
  });
});

describe("WP44-S8 rankForYou (pure)", () => {
  const idea = (slug: string, extra: Partial<Parameters<typeof rankForYou>[0][number]> = {}) => ({
    _id: slug as Id<"ideas">,
    slug,
    title: slug,
    category: "saas",
    tools: ["cursor"],
    buildTime: "10",
    revenueGoal: "5k-month",
    publishedAt: 0,
    scores: { opportunity: 7, pain: 7, timing: 7, builder_confidence: 7 },
    ...extra,
  });

  test("the rarest applicable input wins, and near-universal ones never show", () => {
    const ideas = [
      idea("both", { buildTime: "8", revenueGoal: "5k-month" }),
      idea("goal-only", { buildTime: "20", revenueGoal: "5k-month" }),
      idea("goal-too", { buildTime: "20", revenueGoal: "1k-month" }),
      idea("neither", { buildTime: "20", revenueGoal: "10k-month" }),
    ];
    // Side income matches 3 of 4 (75%), an 8-hour weekend 1 of 4 (25%).
    const { reasons } = rankForYou(ideas, { tools: [], weeklyHours: "8", goal: "side-income", savedNewestFirst: [] });
    expect(reasons.get("both" as Id<"ideas">)).toEqual({ kind: "hours", hours: "8" });
    expect(reasons.get("goal-only" as Id<"ideas">)).toEqual({ kind: "goal", goal: "side-income" });
    expect(reasons.get("neither" as Id<"ideas">)).toBeNull();
  });

  test("a tool on nearly every idea is never a reason, a rarer one is", () => {
    const ideas = [
      idea("a", { tools: ["cursor", "lovable"] }),
      idea("b", { tools: ["cursor"] }),
      idea("c", { tools: ["cursor"] }),
      idea("d", { tools: ["cursor"] }),
      idea("e", { tools: ["cursor"] }),
    ];
    const { reasons } = rankForYou(ideas, { tools: ["cursor", "lovable"], savedNewestFirst: [] });
    expect(reasons.get("a" as Id<"ideas">)).toEqual({ kind: "tool", tool: "lovable" });
    expect(reasons.get("b" as Id<"ideas">)).toBeNull();
  });

  test("no answers and no saves means research score order and no reasons", () => {
    const ideas = [idea("low", { scores: { opportunity: 5, pain: 5, timing: 5, builder_confidence: 5 } }), idea("high")];
    const { ordered, reasons } = rankForYou(ideas, { tools: [], savedNewestFirst: [] });
    expect(ordered.map((i) => i.slug)).toEqual(["high", "low"]);
    expect([...reasons.values()].every((r) => r === null)).toBe(true);
  });
});
