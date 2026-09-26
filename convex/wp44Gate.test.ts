/// <reference types="vite/client" />

import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

// WP44-S13 gate review fixes: paging past 240 items.
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

async function seedIdeas(t: TestConvex<typeof schema>, count: number) {
  return await t.run(async (ctx) => {
    const ids: Id<"ideas">[] = [];
    for (let i = 0; i < count; i++) {
      ids.push(
        await ctx.db.insert("ideas", {
          slug: `idea-${i}`,
          title: `Idea ${i}`,
          description: "desc",
          publishedAt: i,
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
    return ids;
  });
}

describe("WP44-S13 paging past 240", () => {
  test("Show more reaches every idea in a library of 250", async () => {
    const t = convexTest(schema, modules);
    const member = asUser(t, await seedUser(t, "pager@example.test"));
    await seedIdeas(t, 250);
    const page = await member.query(api.platform.ideas.library, { view: "all", limit: 264 });
    expect(page.total).toBe(250);
    expect(page.items).toHaveLength(250);
  });

  test("Saved: more saves than one page, and a save whose idea is gone", async () => {
    const t = convexTest(schema, modules);
    const seeded = await seedUser(t, "saver@example.test");
    const member = asUser(t, seeded);
    const ideaIds = await seedIdeas(t, 260);
    await t.run(async (ctx) => {
      for (const [i, ideaId] of ideaIds.entries()) {
        await ctx.db.insert("idea_intents", { ownerId: seeded.userId, ideaId, saved: true, interested: false, updatedAt: i });
      }
    });
    const first = await member.query(api.platform.dashboard.savedList, { limit: 240 });
    expect(first).toMatchObject({ total: 260, hasMore: true });
    const all = await member.query(api.platform.dashboard.savedList, { limit: 264 });
    expect(all.items).toHaveLength(260);
    expect(all.hasMore).toBe(false);

    // The newest saved idea is deleted: its save stays, its row does not.
    await t.run((ctx) => ctx.db.delete("ideas", ideaIds[259]));
    const gone = await member.query(api.platform.dashboard.savedList, { limit: 264 });
    expect(gone.items).toHaveLength(259);
    expect(gone.hasMore).toBe(false);
  });
});
