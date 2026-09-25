/// <reference types="vite/client" />

import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { SAVED_COUNT_CAP } from "./platform/dashboard";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function seedUser(
  t: TestConvex<typeof schema>,
  email: string,
  profile: { name?: string; displayName?: string } = {},
) {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { email, ...profile });
    const sessionId = await ctx.db.insert("authSessions", {
      userId,
      expirationTime: 9_999_999_999_999,
    });
    return { userId, sessionId };
  });
}

function asUser(
  t: TestConvex<typeof schema>,
  user: { userId: Id<"users">; sessionId: Id<"authSessions"> },
) {
  return t.withIdentity({
    subject: `${user.userId}|${user.sessionId}`,
    issuer: "https://local.test",
    tokenIdentifier: `https://local.test|${user.userId}`,
  });
}

async function seedIdeas(t: TestConvex<typeof schema>, count: number, prefix = "idea") {
  return await t.run(async (ctx) => {
    const ids: Id<"ideas">[] = [];
    for (let i = 0; i < count; i++) {
      ids.push(
        await ctx.db.insert("ideas", {
          slug: `${prefix}-${i}`,
          title: `Idea ${prefix} ${i}`,
          description: `Description ${i}`,
          publishedAt: i,
          category: "automation",
          buildTime: "12",
          revenueGoal: "5k-month",
          applicationCategory: "BusinessApplication",
          tools: ["cursor"],
          audiences: ["solo-founders"],
          bodyMode: "mdx",
        }),
      );
    }
    return ids;
  });
}

async function seedIntent(
  t: TestConvex<typeof schema>,
  ownerId: Id<"users">,
  ideaId: Id<"ideas">,
  flags: { saved: boolean; interested: boolean },
  updatedAt: number,
) {
  await t.run(async (ctx) => {
    await ctx.db.insert("idea_intents", { ownerId, ideaId, ...flags, updatedAt });
  });
}

describe("WP44-S3 dashboard home query", () => {
  test("denies anonymous callers", async () => {
    const t = convexTest(schema, modules);
    await expect(t.query(api.platform.dashboard.home, {})).rejects.toThrow(
      "UNAUTHENTICATED",
    );
  });

  test("counts saved and interested as one list, newest first (R3)", async () => {
    const t = convexTest(schema, modules);
    const owner = await seedUser(t, "owner@example.test", { name: "John Iseghohi" });
    const [savedOnly, interestedOnly, both, neither] = await seedIdeas(t, 4);
    await seedIntent(t, owner.userId, savedOnly, { saved: true, interested: false }, 10);
    await seedIntent(t, owner.userId, interestedOnly, { saved: false, interested: true }, 30);
    await seedIntent(t, owner.userId, both, { saved: true, interested: true }, 20);
    await seedIntent(t, owner.userId, neither, { saved: false, interested: false }, 40);

    const home = await asUser(t, owner).query(api.platform.dashboard.home, {});

    expect(home.firstName).toBe("John");
    expect(home.saved.count).toBe(3);
    expect(home.saved.capped).toBe(false);
    expect(home.saved.latest.map((row) => row.ideaId)).toEqual([
      interestedOnly,
      both,
      savedOnly,
    ]);
    expect(home.saved.latest[0]).toMatchObject({
      slug: "idea-1",
      title: "Idea idea 1",
      category: "automation",
      buildTime: "12",
      updatedAt: 30,
    });
  });

  test("returns the empty defaults later stories fill in", async () => {
    const t = convexTest(schema, modules);
    const owner = await seedUser(t, "blank@example.test");

    const home = await asUser(t, owner).query(api.platform.dashboard.home, {});

    expect(home).toEqual({
      firstName: null,
      saved: { count: 0, capped: false, latest: [] },
      setupDone: false,
      activePlan: null,
      plan: "free",
    });
  });

  test("prefers the display name for the greeting", async () => {
    const t = convexTest(schema, modules);
    const owner = await seedUser(t, "named@example.test", {
      name: "Jonathan Iseghohi",
      displayName: "  John  I.  ",
    });

    const home = await asUser(t, owner).query(api.platform.dashboard.home, {});

    expect(home.firstName).toBe("John");
  });

  test("never shows one member's saves to another", async () => {
    const t = convexTest(schema, modules);
    const alice = await seedUser(t, "alice@example.test", { name: "Alice" });
    const bob = await seedUser(t, "bob@example.test", { name: "Bob" });
    const ideas = await seedIdeas(t, 3);
    for (const [i, ideaId] of ideas.entries()) {
      await seedIntent(t, alice.userId, ideaId, { saved: true, interested: false }, i);
    }

    const bobHome = await asUser(t, bob).query(api.platform.dashboard.home, {});
    const aliceHome = await asUser(t, alice).query(api.platform.dashboard.home, {});

    expect(bobHome.saved).toEqual({ count: 0, capped: false, latest: [] });
    expect(bobHome.firstName).toBe("Bob");
    expect(aliceHome.saved.count).toBe(3);
  });

  test("caps the count and keeps only five latest", async () => {
    const t = convexTest(schema, modules);
    const owner = await seedUser(t, "collector@example.test");
    const ideas = await seedIdeas(t, SAVED_COUNT_CAP + 6, "bulk");
    for (const [i, ideaId] of ideas.entries()) {
      await seedIntent(
        t,
        owner.userId,
        ideaId,
        { saved: i % 2 === 0, interested: i % 2 === 1 },
        i,
      );
    }

    const home = await asUser(t, owner).query(api.platform.dashboard.home, {});

    expect(home.saved.count).toBe(SAVED_COUNT_CAP);
    expect(home.saved.capped).toBe(true);
    expect(home.saved.latest).toHaveLength(5);
    expect(home.saved.latest[0].slug).toBe(`bulk-${SAVED_COUNT_CAP + 5}`);
  });

  test("skips saves whose idea no longer exists", async () => {
    const t = convexTest(schema, modules);
    const owner = await seedUser(t, "gone@example.test");
    const [kept, removed] = await seedIdeas(t, 2);
    await seedIntent(t, owner.userId, kept, { saved: true, interested: false }, 1);
    await seedIntent(t, owner.userId, removed, { saved: true, interested: false }, 2);
    await t.run(async (ctx) => {
      await ctx.db.delete("ideas", removed);
    });

    const home = await asUser(t, owner).query(api.platform.dashboard.home, {});

    expect(home.saved.latest.map((row) => row.ideaId)).toEqual([kept]);
  });
});
