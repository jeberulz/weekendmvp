/// <reference types="vite/client" />

import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  STAGES,
  STEP_KEYS,
  currentStage,
  nextStepLabel,
  normalizeLiveUrl,
  progress,
} from "./platform/weekendSteps";
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

describe("WP44-S9 step model", () => {
  test("four stages in the homepage order, with unique step keys", () => {
    expect(STAGES.map((stage) => stage.id)).toEqual(["fri", "sat", "sun", "mon"]);
    expect(new Set(STEP_KEYS).size).toBe(STEP_KEYS.length);
  });

  test("progress, current stage and next step follow the checked steps", () => {
    expect(progress([])).toEqual({ done: 0, total: STEP_KEYS.length });
    expect(currentStage([])).toBe("fri");
    expect(currentStage(["fri-research", "fri-scope"])).toBe("sat");
    expect(nextStepLabel(["fri-research"])).toBe("Write down the one core feature you will build");
    expect(currentStage([...STEP_KEYS])).toBe("mon");
    expect(nextStepLabel([...STEP_KEYS])).toBeNull();
  });

  test("live links are http or https, with no credentials", () => {
    expect(normalizeLiveUrl("myapp.vercel.app")).toBe("https://myapp.vercel.app/");
    expect(normalizeLiveUrl("http://example.com/x")).toBe("http://example.com/x");
    expect(normalizeLiveUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeLiveUrl("https://user:pass@example.com")).toBeNull();
    expect(normalizeLiveUrl("localhost")).toBeNull();
    expect(normalizeLiveUrl(`https://example.com/${"a".repeat(400)}`)).toBeNull();
  });
});

describe("WP44-S9 weekend plans", () => {
  test("deny anonymous callers", async () => {
    const t = convexTest(schema, modules);
    await seedIdea(t, "a");
    await expect(t.mutation(api.platform.weekendPlans.start, { slug: "a" })).rejects.toThrow("UNAUTHENTICATED");
    await expect(t.query(api.platform.weekendPlans.list, {})).rejects.toThrow("UNAUTHENTICATED");
    await expect(t.query(api.platform.weekendPlans.startPreview, { slug: "a" })).rejects.toThrow("UNAUTHENTICATED");
  });

  test("start a plan, check steps, and see it on Home", async () => {
    const t = convexTest(schema, modules);
    const member = asUser(t, await seedUser(t, "plan@example.test"));
    await seedIdea(t, "invoice-chaser", "Invoice Chaser");

    const { planId, created } = await member.mutation(api.platform.weekendPlans.start, { slug: "invoice-chaser" });
    expect(created).toBe(true);
    // Starting the same idea again returns the same plan.
    expect(await member.mutation(api.platform.weekendPlans.start, { slug: "invoice-chaser" })).toEqual({
      planId,
      created: false,
    });

    await member.mutation(api.platform.weekendPlans.toggleStep, { planId, key: "fri-research", done: true });
    await member.mutation(api.platform.weekendPlans.toggleStep, { planId, key: "fri-scope", done: true });
    await member.mutation(api.platform.weekendPlans.toggleStep, { planId, key: "fri-scope", done: false });
    await member.mutation(api.platform.weekendPlans.setCoreFeature, { planId, text: "  Chase one overdue invoice  " });

    const { plan, idea } = await member.query(api.platform.weekendPlans.get, { planId });
    // Writing the core feature checks "Write down the one core feature".
    expect(plan).toMatchObject({
      status: "active",
      doneKeys: ["fri-research", "fri-scope"],
      coreFeature: "Chase one overdue invoice",
    });
    expect(idea).toMatchObject({ slug: "invoice-chaser", title: "Invoice Chaser", buildTime: 10 });

    const home = await member.query(api.platform.dashboard.home, {});
    expect(home.activePlan).toMatchObject({ planId, title: "Invoice Chaser", doneKeys: ["fri-research", "fri-scope"] });
  });

  test("free members hold one active plan, with a way to switch (R2)", async () => {
    const t = convexTest(schema, modules);
    const member = asUser(t, await seedUser(t, "limit@example.test"));
    await seedIdea(t, "first", "First Idea");
    await seedIdea(t, "second", "Second Idea");

    const first = await member.mutation(api.platform.weekendPlans.start, { slug: "first" });
    await expect(member.mutation(api.platform.weekendPlans.start, { slug: "second" })).rejects.toThrow(
      "UPGRADE_REQUIRED",
    );

    // The confirm page sees the plan the new one would replace.
    const preview = await member.query(api.platform.weekendPlans.startPreview, { slug: "second" });
    expect(preview.idea?.title).toBe("Second Idea");
    expect(preview.active).toMatchObject({ planId: first.planId, title: "First Idea" });
    expect(preview.atLimit).toBe(true);
    expect((await member.query(api.platform.weekendPlans.startPreview, { slug: "gone" })).idea).toBeNull();

    const second = await member.mutation(api.platform.weekendPlans.start, { slug: "second", replaceActive: true });
    expect(second.created).toBe(true);
    const list = await member.query(api.platform.weekendPlans.list, {});
    expect(list.active.map((plan) => plan.slug)).toEqual(["second"]);
    // The replaced plan is archived: out of Builds, and frozen.
    expect(list.finished).toEqual([]);
    await expect(
      member.mutation(api.platform.weekendPlans.toggleStep, { planId: first.planId, key: "fri-research", done: true }),
    ).rejects.toThrow("PLAN_NOT_ACTIVE");
  });

  test("finish moves a plan to Builds with its live link, and frees the slot", async () => {
    const t = convexTest(schema, modules);
    const member = asUser(t, await seedUser(t, "ship@example.test"));
    await seedIdea(t, "shipped", "Shipped Idea");
    await seedIdea(t, "next", "Next Idea");

    const { planId } = await member.mutation(api.platform.weekendPlans.start, { slug: "shipped" });
    expect(await member.mutation(api.platform.weekendPlans.setLiveUrl, { planId, url: "shipped.app" })).toEqual({
      liveUrl: "https://shipped.app/",
    });
    await expect(
      member.mutation(api.platform.weekendPlans.setLiveUrl, { planId, url: "javascript:alert(1)" }),
    ).rejects.toThrow("INVALID_LIVE_URL");
    // Saving the link checks "Put it live and save the link".
    expect((await member.query(api.platform.weekendPlans.get, { planId })).plan.doneKeys).toEqual(["sun-live"]);
    await member.mutation(api.platform.weekendPlans.finish, { planId });

    const list = await member.query(api.platform.weekendPlans.list, {});
    expect(list.active).toEqual([]);
    expect(list.finished).toHaveLength(1);
    expect(list.finished[0]).toMatchObject({ status: "done", liveUrl: "https://shipped.app/" });
    expect(list.finished[0].completedAt).not.toBeNull();

    const home = await member.query(api.platform.dashboard.home, {});
    expect(home.activePlan).toBeNull();
    expect(home.lastFinished?.title).toBe("Shipped Idea");

    // A finished plan never blocks the next one.
    const next = await member.mutation(api.platform.weekendPlans.start, { slug: "next" });
    expect(next.created).toBe(true);
  });

  test("archive clears the active plan without listing it", async () => {
    const t = convexTest(schema, modules);
    const member = asUser(t, await seedUser(t, "archive@example.test"));
    await seedIdea(t, "a");
    const { planId } = await member.mutation(api.platform.weekendPlans.start, { slug: "a" });
    await member.mutation(api.platform.weekendPlans.archive, { planId });
    const list = await member.query(api.platform.weekendPlans.list, {});
    expect(list).toEqual({ active: [], finished: [] });
    await expect(member.mutation(api.platform.weekendPlans.finish, { planId })).rejects.toThrow("PLAN_NOT_ACTIVE");
  });

  test("another member's plan reads as not found, and so does a bad id", async () => {
    const t = convexTest(schema, modules);
    const alice = asUser(t, await seedUser(t, "alice@example.test"));
    const bob = asUser(t, await seedUser(t, "bob@example.test"));
    await seedIdea(t, "a");
    const { planId } = await alice.mutation(api.platform.weekendPlans.start, { slug: "a" });

    await expect(bob.query(api.platform.weekendPlans.get, { planId })).rejects.toThrow("RESOURCE_NOT_FOUND");
    await expect(
      bob.mutation(api.platform.weekendPlans.toggleStep, { planId, key: "fri-research", done: true }),
    ).rejects.toThrow("RESOURCE_NOT_FOUND");
    await expect(bob.mutation(api.platform.weekendPlans.finish, { planId })).rejects.toThrow("RESOURCE_NOT_FOUND");
    await expect(alice.query(api.platform.weekendPlans.get, { planId: "not-an-id" })).rejects.toThrow(
      "RESOURCE_NOT_FOUND",
    );
    expect((await bob.query(api.platform.weekendPlans.list, {})).active).toEqual([]);
    // Bob's own start is not blocked by Alice's plan.
    expect((await bob.mutation(api.platform.weekendPlans.start, { slug: "a" })).created).toBe(true);
  });

  test("rejects unknown steps and long core features", async () => {
    const t = convexTest(schema, modules);
    const member = asUser(t, await seedUser(t, "bad@example.test"));
    await seedIdea(t, "a");
    const { planId } = await member.mutation(api.platform.weekendPlans.start, { slug: "a" });
    await expect(
      member.mutation(api.platform.weekendPlans.toggleStep, { planId, key: "sat-anything", done: true }),
    ).rejects.toThrow("INVALID_STEP");
    await expect(
      member.mutation(api.platform.weekendPlans.setCoreFeature, { planId, text: "x".repeat(141) }),
    ).rejects.toThrow("CORE_FEATURE_TOO_LONG");
  });

  test("cards show Building for the idea with the active plan", async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedUser(t, "badge@example.test");
    const member = asUser(t, seeded);
    const ideaId = await seedIdea(t, "building-idea");
    await seedIdea(t, "other");
    await t.run(async (ctx) => {
      await ctx.db.insert("idea_intents", { ownerId: seeded.userId, ideaId, saved: true, interested: false, updatedAt: 1 });
    });
    await member.mutation(api.platform.weekendPlans.start, { slug: "building-idea" });

    const library = await member.query(api.platform.ideas.library, { view: "all", limit: 10 });
    expect(library.items.find((i) => i.slug === "building-idea")?.building).toBe(true);
    expect(library.items.find((i) => i.slug === "other")?.building).toBeUndefined();
    const saved = await member.query(api.platform.dashboard.savedList, { limit: 10 });
    expect(saved.items[0].card.building).toBe(true);
  });
});
