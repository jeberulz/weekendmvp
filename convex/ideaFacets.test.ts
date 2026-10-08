/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

type IdeaInsert = Omit<Doc<"ideas">, "_id" | "_creationTime">;

function idea(
  slug: string,
  publishedAt: number,
  overrides: Partial<IdeaInsert> = {},
): IdeaInsert {
  return {
    slug,
    title: `Title: ${slug}`,
    description: `Description: ${slug}`,
    publishedAt,
    category: "saas",
    buildTime: "8",
    revenueGoal: "1k",
    applicationCategory: "BusinessApplication",
    tools: ["cursor"],
    audiences: ["developers"],
    bodyMode: "mdx",
    ...overrides,
  };
}

describe("ideaFacets + byTool/byAudience", () => {
  test("legacy scan works before any facet rows exist", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert(
        "ideas",
        idea("a", 200, {
          tools: ["cursor", "claude"],
          scores: { opportunity: 1, pain: 1, timing: 1, builder_confidence: 9 },
        }),
      );
      await ctx.db.insert(
        "ideas",
        idea("b", 100, {
          tools: ["cursor"],
          scores: { opportunity: 1, pain: 1, timing: 1, builder_confidence: 5 },
        }),
      );
      await ctx.db.insert(
        "ideas",
        idea("c", 50, { tools: ["lovable"], audiences: ["designers"] }),
      );
    });

    expect((await t.query(api.ideas.byTool, { tool: "cursor" })).map((row) => row.slug)).toEqual([
      "a",
      "b",
    ]);
    // c has designers, not developers
    expect(
      (await t.query(api.ideas.byAudience, { audience: "developers" })).map((row) => row.slug),
    ).toEqual(["a", "b"]);
  });

  test("backfill then index path returns the same order and respects limit", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert(
        "ideas",
        idea("high", 10, {
          tools: ["cursor"],
          audiences: ["developers"],
          scores: { opportunity: 1, pain: 1, timing: 1, builder_confidence: 9 },
        }),
      );
      await ctx.db.insert(
        "ideas",
        idea("mid", 20, {
          tools: ["cursor"],
          audiences: ["developers"],
          scores: { opportunity: 1, pain: 1, timing: 1, builder_confidence: 6 },
        }),
      );
      await ctx.db.insert(
        "ideas",
        idea("low", 30, {
          tools: ["cursor", "claude"],
          audiences: ["developers", "founders"],
          scores: { opportunity: 1, pain: 1, timing: 1, builder_confidence: 2 },
        }),
      );
      await ctx.db.insert(
        "ideas",
        idea("other", 40, { tools: ["lovable"], audiences: ["designers"] }),
      );
    });

    const dry = await t.mutation(internal.ideaFacets.backfill, { dryRun: true });
    expect(dry).toMatchObject({ dryRun: true, scanned: 4, written: 0, isDone: true });

    const written = await t.mutation(internal.ideaFacets.backfill, { dryRun: false });
    expect(written).toMatchObject({ dryRun: false, scanned: 4, written: 4, isDone: true });

    const toolLinks = await t.run(async (ctx) => ctx.db.query("idea_tools").take(20));
    expect(toolLinks.length).toBe(5); // cursor×3 + claude×1 + lovable×1

    expect((await t.query(api.ideas.byTool, { tool: "cursor" })).map((row) => row.slug)).toEqual([
      "high",
      "mid",
      "low",
    ]);
    expect(
      (await t.query(api.ideas.byTool, { tool: "cursor", limit: 2 })).map((row) => row.slug),
    ).toEqual(["high", "mid"]);
    expect(
      (await t.query(api.ideas.byAudience, { audience: "developers" })).map((row) => row.slug),
    ).toEqual(["high", "mid", "low"]);
    expect((await t.query(api.ideas.byTool, { tool: "lovable" })).map((row) => row.slug)).toEqual([
      "other",
    ]);
  });

  test("upsertBySlug dual-writes facet rows", async () => {
    const t = convexTest(schema, modules);
    // Seed one facet row so facetsReady prefers the index path.
    await t.run(async (ctx) => {
      const id = await ctx.db.insert(
        "ideas",
        idea("seed", 1, { tools: ["bolt"], audiences: ["founders"] }),
      );
      await ctx.db.insert("idea_tools", { tool: "bolt", ideaId: id, builderConfidence: -1 });
      await ctx.db.insert("idea_audiences", {
        audience: "founders",
        ideaId: id,
        builderConfidence: -1,
      });
    });

    await t.mutation(internal.ideas.upsertBySlug, {
      ...idea("fresh", 99, {
        tools: ["cursor"],
        audiences: ["developers"],
        scores: { opportunity: 1, pain: 1, timing: 1, builder_confidence: 8 },
      }),
    });

    expect((await t.query(api.ideas.byTool, { tool: "cursor" })).map((row) => row.slug)).toEqual([
      "fresh",
    ]);
    expect(
      (await t.query(api.ideas.byAudience, { audience: "developers" })).map((row) => row.slug),
    ).toEqual(["fresh"]);
  });
});
