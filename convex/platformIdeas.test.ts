/// <reference types="vite/client" />

import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function seedUser(t: TestConvex<typeof schema>, email: string) {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { email });
    const sessionId = await ctx.db.insert("authSessions", {
      userId,
      expirationTime: 9_999_999_999_999,
    });
    return { userId, sessionId };
  });
}

function asUser(
  t: TestConvex<typeof schema>,
  userId: Id<"users">,
  sessionId: Id<"authSessions">,
) {
  return t.withIdentity({
    subject: `${userId}|${sessionId}`,
    issuer: "https://local.test",
    tokenIdentifier: `https://local.test|${userId}`,
  });
}

async function seedIdea(
  t: TestConvex<typeof schema>,
  slug: string,
  publishedAt = 1,
  options: {
    category?: string;
    title?: string;
    score?: number;
  } = {},
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("ideas", {
      slug,
      title: options.title ?? `Idea ${slug}`,
      description: `Description for ${slug}`,
      publishedAt,
      category: options.category ?? "automation",
      buildTime: "8",
      revenueGoal: "5k-month",
      applicationCategory: "BusinessApplication",
      tools: ["cursor"],
      audiences: ["solo-founders"],
      scores:
        options.score === undefined
          ? undefined
          : {
              opportunity: options.score,
              pain: options.score,
              timing: options.score,
              builder_confidence: options.score,
            },
      bodyMode: "mdx",
    });
  });
}

describe("WP23 dashboard summary", () => {
  test("denies anonymous callers", async () => {
    const t = convexTest(schema, modules);
    await expect(t.query(api.platform.ideas.dashboardSummary, {})).rejects.toThrow(
      "UNAUTHENTICATED",
    );
  });

  test("returns only the current owner's bounded, non-archived state", async () => {
    const t = convexTest(schema, modules);
    const owner = await seedUser(t, "owner@example.test");
    const stranger = await seedUser(t, "stranger@example.test");
    const ownerIdeaId = await seedIdea(t, "owner-idea", 2);
    const strangerIdeaId = await seedIdea(t, "stranger-idea", 1);

    await t.run(async (ctx) => {
      await ctx.db.insert("projects", {
        ownerId: owner.userId,
        source: "repository_idea",
        sourceIdeaId: ownerIdeaId,
        title: "Owner project",
        status: "draft",
        idempotencyKey: "owner-project",
        createdAt: 1,
        updatedAt: 3,
      });
      await ctx.db.insert("projects", {
        ownerId: owner.userId,
        source: "own_idea",
        title: "Archived owner project",
        status: "ready",
        idempotencyKey: "archived-project",
        createdAt: 1,
        updatedAt: 4,
        archivedAt: 5,
      });
      await ctx.db.insert("projects", {
        ownerId: stranger.userId,
        source: "repository_idea",
        sourceIdeaId: strangerIdeaId,
        title: "Stranger project",
        status: "building",
        idempotencyKey: "stranger-project",
        createdAt: 1,
        updatedAt: 9,
      });
      await ctx.db.insert("idea_intents", {
        ownerId: owner.userId,
        ideaId: ownerIdeaId,
        saved: true,
        interested: false,
        updatedAt: 6,
      });
      await ctx.db.insert("idea_intents", {
        ownerId: stranger.userId,
        ideaId: strangerIdeaId,
        saved: true,
        interested: true,
        updatedAt: 8,
      });
      await ctx.db.insert("credit_accounts", {
        ownerId: owner.userId,
        balance: 25n,
        createdAt: 1,
        updatedAt: 1,
      });
    });

    const result = await asUser(t, owner.userId, owner.sessionId).query(
      api.platform.ideas.dashboardSummary,
      {},
    );

    expect(result.projects).toEqual([
      expect.objectContaining({ title: "Owner project", status: "draft" }),
    ]);
    expect(result.recentIntents).toEqual([
      expect.objectContaining({ slug: "owner-idea", saved: true }),
    ]);
    expect(result.creditBalance).toBe(25n);
    expect(JSON.stringify(result, (_, value) => (typeof value === "bigint" ? value.toString() : value))).not.toContain(
      "Stranger",
    );
  });
});

describe("WP23 Explore discovery", () => {
  test("denies anonymous callers before returning canonical metadata", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.query(api.platform.ideas.explore, {
        paginationOpts: { numItems: 16, cursor: null },
        view: "all",
        sort: "newest",
      }),
    ).rejects.toThrow("UNAUTHENTICATED");
  });

  test("paginates the canonical index and applies honest per-page filters", async () => {
    const t = convexTest(schema, modules);
    const owner = await seedUser(t, "explorer@example.test");
    await seedIdea(t, "automation-match", 3, {
      category: "automation",
      title: "Inbox automation",
      score: 8,
    });
    await seedIdea(t, "automation-miss", 2, {
      category: "automation",
      title: "Calendar helper",
      score: 7,
    });
    await seedIdea(t, "health-match", 1, {
      category: "health",
      title: "Inbox for clinics",
      score: 9,
    });

    const result = await asUser(t, owner.userId, owner.sessionId).query(
      api.platform.ideas.explore,
      {
        paginationOpts: { numItems: 2, cursor: null },
        view: "all",
        sort: "newest",
        category: "automation",
        search: "inbox",
      },
    );

    expect(result.page.map((idea) => idea.slug)).toEqual(["automation-match"]);
    expect(result.continueCursor).toEqual(expect.any(String));
  });

  test("uses only owner intent for a bounded category boost with stable ties", async () => {
    const t = convexTest(schema, modules);
    const owner = await seedUser(t, "ranked@example.test");
    const canonicalLeaderId = await seedIdea(t, "canonical-leader", 4, {
      category: "health",
      score: 8,
    });
    const affinityIdeaId = await seedIdea(t, "affinity-candidate", 3, {
      category: "automation",
      score: 7.9,
    });
    await t.run(async (ctx) => {
      await ctx.db.insert("idea_intents", {
        ownerId: owner.userId,
        ideaId: affinityIdeaId,
        saved: true,
        interested: true,
        updatedAt: 5,
      });
    });

    const args = {
      paginationOpts: { numItems: 16, cursor: null },
      view: "for_you" as const,
      sort: "recommended" as const,
    };
    const currentUser = asUser(t, owner.userId, owner.sessionId);
    const first = await currentUser.query(api.platform.ideas.explore, args);
    const second = await currentUser.query(api.platform.ideas.explore, args);

    expect(first.page.map((idea) => idea.ideaId)).toEqual([
      affinityIdeaId,
      canonicalLeaderId,
    ]);
    expect(second.page.map((idea) => idea.slug)).toEqual(
      first.page.map((idea) => idea.slug),
    );
  });

  test("hydrates only the owner's Saved view", async () => {
    const t = convexTest(schema, modules);
    const owner = await seedUser(t, "saved@example.test");
    const stranger = await seedUser(t, "saved-stranger@example.test");
    const ownerIdeaId = await seedIdea(t, "saved-owner", 2);
    const strangerIdeaId = await seedIdea(t, "saved-stranger", 1);
    await t.run(async (ctx) => {
      await ctx.db.insert("idea_intents", {
        ownerId: owner.userId,
        ideaId: ownerIdeaId,
        saved: true,
        interested: false,
        updatedAt: 2,
      });
      await ctx.db.insert("idea_intents", {
        ownerId: stranger.userId,
        ideaId: strangerIdeaId,
        saved: true,
        interested: true,
        updatedAt: 3,
      });
    });

    const result = await asUser(t, owner.userId, owner.sessionId).query(
      api.platform.ideas.explore,
      {
        paginationOpts: { numItems: 16, cursor: null },
        view: "saved",
        sort: "newest",
      },
    );
    expect(result.page.map((idea) => idea.slug)).toEqual(["saved-owner"]);
  });
});

describe("WP23 owner intent", () => {
  test("denies anonymous mutations", async () => {
    const t = convexTest(schema, modules);
    const ideaId = await seedIdea(t, "anonymous-intent");
    await expect(
      t.mutation(api.platform.ideas.setIntent, {
        ideaId,
        flag: "saved",
        value: true,
      }),
    ).rejects.toThrow("UNAUTHENTICATED");
  });

  test("upserts one owner row, preserves the independent flag, and settles repeats", async () => {
    const t = convexTest(schema, modules);
    const owner = await seedUser(t, "intent@example.test");
    const stranger = await seedUser(t, "intent-stranger@example.test");
    const ideaId = await seedIdea(t, "independent-flags");
    const ownerClient = asUser(t, owner.userId, owner.sessionId);
    const strangerClient = asUser(t, stranger.userId, stranger.sessionId);

    await ownerClient.mutation(api.platform.ideas.setIntent, {
      ideaId,
      flag: "saved",
      value: true,
    });
    const both = await ownerClient.mutation(api.platform.ideas.setIntent, {
      ideaId,
      flag: "interested",
      value: true,
    });
    expect(both).toMatchObject({ saved: true, interested: true });
    const interestedOnly = await ownerClient.mutation(api.platform.ideas.setIntent, {
      ideaId,
      flag: "saved",
      value: false,
    });
    const repeated = await ownerClient.mutation(api.platform.ideas.setIntent, {
      ideaId,
      flag: "saved",
      value: false,
    });
    expect(interestedOnly).toMatchObject({ saved: false, interested: true });
    expect(repeated).toMatchObject({ saved: false, interested: true });

    await strangerClient.mutation(api.platform.ideas.setIntent, {
      ideaId,
      flag: "saved",
      value: true,
    });
    const rows = await t.run(async (ctx) => {
      return await ctx.db.query("idea_intents").collect();
    });
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.ownerId === owner.userId)).toMatchObject({
      saved: false,
      interested: true,
    });
    expect(rows.find((row) => row.ownerId === stranger.userId)).toMatchObject({
      saved: true,
      interested: false,
    });
  });

  test("derives Building exactly after more than 20 archived matches", async () => {
    const t = convexTest(schema, modules);
    const owner = await seedUser(t, "builder@example.test");
    const ideaId = await seedIdea(t, "building-derived");
    let projectId!: Id<"projects">;
    await t.run(async (ctx) => {
      projectId = await ctx.db.insert("projects", {
        ownerId: owner.userId,
        source: "repository_idea",
        sourceIdeaId: ideaId,
        title: "Derived project",
        status: "building",
        idempotencyKey: "derived-project",
        createdAt: 1,
        updatedAt: 2,
      });
      for (let index = 0; index < 25; index += 1) {
        await ctx.db.insert("projects", {
          ownerId: owner.userId,
          source: "repository_idea",
          sourceIdeaId: ideaId,
          title: `Archived duplicate ${index}`,
          status: "building",
          idempotencyKey: `archived-duplicate-${index}`,
          createdAt: index + 3,
          updatedAt: index + 3,
          archivedAt: index + 4,
        });
      }
    });
    const ownerClient = asUser(t, owner.userId, owner.sessionId);
    const args = {
      paginationOpts: { numItems: 16, cursor: null },
      view: "building" as const,
      sort: "newest" as const,
    };
    const active = await ownerClient.query(api.platform.ideas.explore, args);
    expect(active.page).toEqual([
      expect.objectContaining({ slug: "building-derived", building: true }),
    ]);

    await t.run(async (ctx) => {
      await ctx.db.patch("projects", projectId, { archivedAt: 3 });
    });
    const archived = await ownerClient.query(api.platform.ideas.explore, args);
    expect(archived.page).toEqual([]);
  });

  test("rejects an idea ID that no longer resolves", async () => {
    const t = convexTest(schema, modules);
    const owner = await seedUser(t, "missing-idea@example.test");
    const ideaId = await seedIdea(t, "missing-intent-target");
    await t.run(async (ctx) => {
      await ctx.db.delete("ideas", ideaId);
    });
    await expect(
      asUser(t, owner.userId, owner.sessionId).mutation(
        api.platform.ideas.setIntent,
        { ideaId, flag: "saved", value: true },
      ),
    ).rejects.toThrow("RESOURCE_NOT_FOUND");
  });
});
