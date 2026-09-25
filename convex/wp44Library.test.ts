/// <reference types="vite/client" />

import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  hoursBucketValidator,
  librarySortValidator,
  libraryViewValidator,
} from "./platform/ideas";
import {
  HOURS_BUCKETS,
  LIBRARY_SORTS,
  LIBRARY_VIEWS,
  MAX_LIBRARY_LIMIT,
  effectiveSort,
  hoursBucket,
} from "./platform/libraryFilters";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

type Member = { userId: Id<"users">; sessionId: Id<"authSessions"> };

async function seedUser(t: TestConvex<typeof schema>, email: string): Promise<Member> {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { email });
    const sessionId = await ctx.db.insert("authSessions", {
      userId,
      expirationTime: 9_999_999_999_999,
    });
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

type IdeaSeed = {
  slug: string;
  title?: string;
  description?: string;
  publishedAt?: number;
  category?: string;
  buildTime?: string;
  revenueGoal?: string;
  tools?: string[];
  score?: number;
  art?: boolean;
};

async function seedIdea(t: TestConvex<typeof schema>, seed: IdeaSeed) {
  return await t.run(async (ctx) =>
    ctx.db.insert("ideas", {
      slug: seed.slug,
      title: seed.title ?? `Idea ${seed.slug}`,
      description: seed.description ?? "A plain description",
      publishedAt: seed.publishedAt ?? 0,
      category: seed.category ?? "saas",
      buildTime: seed.buildTime ?? "10",
      revenueGoal: seed.revenueGoal ?? "5k-month",
      applicationCategory: "BusinessApplication",
      tools: seed.tools ?? ["cursor"],
      audiences: ["solo-founders"],
      bodyMode: "mdx",
      ...(seed.score === undefined
        ? {}
        : {
            scores: {
              opportunity: seed.score,
              pain: seed.score,
              timing: seed.score,
              builder_confidence: seed.score,
            },
          }),
      ...(seed.art ? { og: { status: "ready" } } : {}),
    }),
  );
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

const all = { view: "all" as const, limit: 24 };

describe("WP44-S5 library vocabulary", () => {
  test("the Convex validators match the shared lists", () => {
    const literals = (validator: { members: { value: string }[] }) =>
      validator.members.map((member) => member.value);
    expect(literals(libraryViewValidator)).toEqual([...LIBRARY_VIEWS]);
    expect(literals(librarySortValidator)).toEqual([...LIBRARY_SORTS]);
    expect(literals(hoursBucketValidator)).toEqual([...HOURS_BUCKETS]);
  });

  test("buckets build time by weekend length", () => {
    expect([0, 8, 9, 12, 13, 16, 17, 20].map(hoursBucket)).toEqual([
      "8", "8", "12", "12", "16", "16", "more", "more",
    ]);
  });

  test("each tab fixes its own sort, and relevance needs a search", () => {
    expect(effectiveSort("for_you", "score", false)).toBe("recommended");
    expect(effectiveSort("new", "score", true)).toBe("newest");
    expect(effectiveSort("all", undefined, true)).toBe("relevance");
    expect(effectiveSort("all", undefined, false)).toBe("newest");
    expect(effectiveSort("all", "relevance", false)).toBe("newest");
    expect(effectiveSort("all", "score", true)).toBe("score");
  });
});

describe("WP44-S5 library query", () => {
  test("denies anonymous callers", async () => {
    const t = convexTest(schema, modules);
    await expect(t.query(api.platform.ideas.library, all)).rejects.toThrow("UNAUTHENTICATED");
    await expect(t.query(api.platform.dashboard.savedList, { limit: 10 })).rejects.toThrow(
      "UNAUTHENTICATED",
    );
  });

  test("search finds matches anywhere in the library, not just the first page", async () => {
    const t = convexTest(schema, modules);
    const member = await seedUser(t, "search@example.test");
    // The matches are the three oldest of 60, far past any first page.
    for (let i = 0; i < 60; i++) {
      await seedIdea(t, {
        slug: `idea-${i}`,
        title: i < 2 ? `Invoice chaser ${i}` : `Plain tool ${i}`,
        description: i === 2 ? "Chases every unpaid invoice for freelancers" : "Nothing to see",
        publishedAt: i,
      });
    }

    const result = await asUser(t, member).query(api.platform.ideas.library, {
      ...all,
      search: "invoice",
      limit: 10,
    });

    expect(result.total).toBe(3);
    // Title matches come before the description-only match.
    expect(result.items.map((item) => item.slug).slice(2)).toEqual(["idea-2"]);
    expect(result.items.slice(0, 2).map((item) => item.slug).sort()).toEqual(["idea-0", "idea-1"]);
  });

  test("filters combine, and each facet ignores its own choice", async () => {
    const t = convexTest(schema, modules);
    const member = await seedUser(t, "filters@example.test");
    await seedIdea(t, { slug: "a", category: "health", tools: ["cursor", "bolt"], buildTime: "8", revenueGoal: "1k-month" });
    await seedIdea(t, { slug: "b", category: "health", tools: ["v0"], buildTime: "12", revenueGoal: "1k-month" });
    await seedIdea(t, { slug: "c", category: "saas", tools: ["bolt"], buildTime: "8", revenueGoal: "5k-month" });
    await seedIdea(t, { slug: "d", category: "saas", tools: ["cursor"], buildTime: "20", revenueGoal: "1k-month" });

    const result = await asUser(t, member).query(api.platform.ideas.library, {
      ...all,
      category: "health",
      tools: ["bolt", "v0"],
      goal: "1k-month",
    });

    expect(result.items.map((item) => item.slug).sort()).toEqual(["a", "b"]);
    expect(result.total).toBe(2);
    // Category counts apply the tools and goal filters, not the category one.
    expect(result.facets.category).toEqual([{ value: "health", count: 2 }]);
    // Tool counts apply category and goal, not tools.
    expect(result.facets.tools).toEqual([
      { value: "bolt", count: 1 },
      { value: "cursor", count: 1 },
      { value: "v0", count: 1 },
    ]);
    expect(result.facets.hours).toEqual([
      { value: "8", count: 1 },
      { value: "12", count: 1 },
      { value: "16", count: 0 },
      { value: "more", count: 0 },
    ]);

    const byHours = await asUser(t, member).query(api.platform.ideas.library, { ...all, hours: "more" });
    expect(byHours.items.map((item) => item.slug)).toEqual(["d"]);
  });

  test("New covers only ideas published after the bound the client passes", async () => {
    const t = convexTest(schema, modules);
    const member = await seedUser(t, "new@example.test");
    await seedIdea(t, { slug: "old", publishedAt: 100 });
    await seedIdea(t, { slug: "fresh", publishedAt: 500 });
    await seedIdea(t, { slug: "freshest", publishedAt: 900 });

    const result = await asUser(t, member).query(api.platform.ideas.library, {
      view: "new",
      publishedAfter: 400,
      sort: "score",
      limit: 10,
    });

    expect(result.items.map((item) => item.slug)).toEqual(["freshest", "fresh"]);
  });

  test("sorts by score, newest and recommended", async () => {
    const t = convexTest(schema, modules);
    const member = await seedUser(t, "sort@example.test");
    const low = await seedIdea(t, { slug: "low", category: "health", score: 6, publishedAt: 3 });
    await seedIdea(t, { slug: "high", category: "saas", score: 8, publishedAt: 1 });
    const mid = await seedIdea(t, { slug: "mid", category: "health", score: 7.9, publishedAt: 2 });
    await seedIdea(t, { slug: "unscored", category: "saas", publishedAt: 4 });
    // Two saved health ideas boost health by 0.1 each.
    await seedIntent(t, member.userId, low, { saved: true, interested: false }, 1);
    await seedIntent(t, member.userId, mid, { saved: false, interested: true }, 2);

    const member1 = asUser(t, member);
    const byScore = await member1.query(api.platform.ideas.library, { ...all, sort: "score" });
    expect(byScore.items.map((item) => item.slug)).toEqual(["high", "mid", "low", "unscored"]);
    const byNewest = await member1.query(api.platform.ideas.library, { ...all, sort: "newest" });
    expect(byNewest.items.map((item) => item.slug)).toEqual(["unscored", "low", "mid", "high"]);
    const forYou = await member1.query(api.platform.ideas.library, { view: "for_you", limit: 24 });
    // mid 7.9 + 0.2 = 8.1 passes high (8.0). low 6 + 0.2 stays below.
    expect(forYou.items.map((item) => item.slug)).toEqual(["mid", "high", "low", "unscored"]);
  });

  test("marks saved and interested ideas as saved, and can leave them out (R3)", async () => {
    const t = convexTest(schema, modules);
    const member = await seedUser(t, "saved@example.test");
    const saved = await seedIdea(t, { slug: "saved", publishedAt: 3 });
    const interested = await seedIdea(t, { slug: "interested", publishedAt: 2 });
    await seedIdea(t, { slug: "fresh", publishedAt: 1 });
    await seedIntent(t, member.userId, saved, { saved: true, interested: false }, 1);
    await seedIntent(t, member.userId, interested, { saved: false, interested: true }, 2);

    const result = await asUser(t, member).query(api.platform.ideas.library, all);
    expect(result.items.map((item) => [item.slug, item.saved])).toEqual([
      ["saved", true],
      ["interested", true],
      ["fresh", false],
    ]);

    const unsaved = await asUser(t, member).query(api.platform.ideas.library, {
      ...all,
      unsavedOnly: true,
    });
    expect(unsaved.items.map((item) => item.slug)).toEqual(["fresh"]);
  });

  test("one member's saves never mark cards for another", async () => {
    const t = convexTest(schema, modules);
    const alice = await seedUser(t, "alice@example.test");
    const bob = await seedUser(t, "bob@example.test");
    const ideaId = await seedIdea(t, { slug: "shared" });
    await seedIntent(t, alice.userId, ideaId, { saved: true, interested: false }, 1);

    const bobView = await asUser(t, bob).query(api.platform.ideas.library, all);
    expect(bobView.items[0].saved).toBe(false);
  });

  test("clamps the page size and still reports the full total", async () => {
    const t = convexTest(schema, modules);
    const member = await seedUser(t, "limits@example.test");
    for (let i = 0; i < 5; i++) await seedIdea(t, { slug: `idea-${i}`, publishedAt: i });

    const small = await asUser(t, member).query(api.platform.ideas.library, { ...all, limit: 2 });
    expect(small.items).toHaveLength(2);
    expect(small.total).toBe(5);
    expect(small.truncated).toBe(false);

    const silly = await asUser(t, member).query(api.platform.ideas.library, { ...all, limit: -3 });
    expect(silly.items).toHaveLength(1);
    const huge = await asUser(t, member).query(api.platform.ideas.library, {
      ...all,
      limit: MAX_LIBRARY_LIMIT * 10,
    });
    expect(huge.items).toHaveLength(5);
  });

  test("cards carry art, scores and a numeric build time", async () => {
    const t = convexTest(schema, modules);
    const member = await seedUser(t, "cards@example.test");
    await seedIdea(t, { slug: "card", buildTime: "12", score: 7, art: true, tools: ["a", "b", "c", "d", "e"] });

    const [card] = (await asUser(t, member).query(api.platform.ideas.library, all)).items;
    expect(card).toMatchObject({
      slug: "card",
      buildTime: 12,
      score: 7,
      hasArt: true,
      tools: ["a", "b", "c", "d"],
      scores: { opportunity: 7, pain: 7, timing: 7, builder_confidence: 7 },
    });
  });
});

describe("WP44-S5 Saved page query", () => {
  test("lists saved and interested ideas, newest save first, per member", async () => {
    const t = convexTest(schema, modules);
    const alice = await seedUser(t, "alice@example.test");
    const bob = await seedUser(t, "bob@example.test");
    const a = await seedIdea(t, { slug: "a" });
    const b = await seedIdea(t, { slug: "b" });
    const c = await seedIdea(t, { slug: "c" });
    await seedIntent(t, alice.userId, a, { saved: true, interested: false }, 10);
    await seedIntent(t, alice.userId, b, { saved: false, interested: true }, 30);
    await seedIntent(t, alice.userId, c, { saved: false, interested: false }, 40);
    await seedIntent(t, bob.userId, c, { saved: true, interested: false }, 50);

    const aliceList = await asUser(t, alice).query(api.platform.dashboard.savedList, { limit: 10 });
    expect(aliceList.items.map((item) => [item.card.slug, item.savedAt])).toEqual([
      ["b", 30],
      ["a", 10],
    ]);
    expect(aliceList.items.every((item) => item.card.saved)).toBe(true);
    expect(aliceList.total).toBe(2);

    const bobList = await asUser(t, bob).query(api.platform.dashboard.savedList, { limit: 10 });
    expect(bobList.items.map((item) => item.card.slug)).toEqual(["c"]);
  });

  test("removing an idea takes it off the list and clears both flags (R3)", async () => {
    const t = convexTest(schema, modules);
    const member = await seedUser(t, "remove@example.test");
    const ideaId = await seedIdea(t, { slug: "both" });
    await seedIntent(t, member.userId, ideaId, { saved: true, interested: true }, 1);
    const client = asUser(t, member);

    await client.mutation(api.platform.dashboard.setSaved, { slug: "both", saved: false });

    const list = await client.query(api.platform.dashboard.savedList, { limit: 10 });
    expect(list.items).toEqual([]);
    expect(list.total).toBe(0);
  });

  test("pages with a limit and skips ideas that no longer exist", async () => {
    const t = convexTest(schema, modules);
    const member = await seedUser(t, "page@example.test");
    const ids: Id<"ideas">[] = [];
    for (let i = 0; i < 4; i++) ids.push(await seedIdea(t, { slug: `idea-${i}` }));
    for (const [i, ideaId] of ids.entries()) {
      await seedIntent(t, member.userId, ideaId, { saved: true, interested: false }, i);
    }
    await t.run(async (ctx) => ctx.db.delete("ideas", ids[3]));

    const list = await asUser(t, member).query(api.platform.dashboard.savedList, { limit: 2 });
    expect(list.items.map((item) => item.card.slug)).toEqual(["idea-2"]);
    expect(list.total).toBe(4);
  });
});
