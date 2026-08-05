/// <reference types="vite/client" />

import { convexTest, type TestConvex } from "convex-test";
import type { Doc } from "./_generated/dataModel";
import { api } from "./_generated/api";
import schema from "./schema";
import { describe, expect, test } from "vitest";

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
    tools: [],
    audiences: [],
    bodyMode: "mdx",
    ...overrides,
  };
}

async function seedIdeas(t: TestConvex<typeof schema>, ideas: IdeaInsert[]) {
  await t.run(async (ctx) => {
    for (const row of ideas) {
      await ctx.db.insert("ideas", row);
    }
  });
}

describe("ideas.bySlug", () => {
  test("preserves an idea validation contract", async () => {
    const t = convexTest(schema, modules);
    const validation = {
      audience: "solo-founders",
      hypothesis: "Solo founders copy a prompt after reading the evidence.",
      primaryAction: "idea_prompt_copied" as const,
    };
    await seedIdeas(t, [idea("validated", 100, { validation })]);

    const result = await t.query(api.ideas.bySlug, { slug: "validated" });

    expect(result?.validation).toEqual(validation);
  });
});

describe("ideas.relatedFor", () => {
  test("preserves category-first eligibility, ordering, deduplication, and exclusion", async () => {
    const t = convexTest(schema, modules);
    await seedIdeas(t, [
      idea("self", 100, {
        category: "saas",
        audiences: ["founders", "developers"],
      }),
      idea("category-new", 500, {
        category: "saas",
        audiences: ["founders"],
      }),
      idea("category-old", 300, { category: "saas" }),
      idea("audience-new", 900, {
        category: "automation",
        audiences: ["developers"],
      }),
      idea("audience-old", 200, {
        category: "education",
        audiences: ["founders"],
      }),
      idea("ineligible", 1_000, {
        category: "health",
        audiences: ["designers"],
      }),
    ]);

    const result = await t.query(api.ideas.relatedFor, {
      slug: "self",
      limit: 4,
    });

    expect(result).toEqual([
      {
        slug: "category-new",
        title: "Title: category-new",
        category: "saas",
      },
      {
        slug: "category-old",
        title: "Title: category-old",
        category: "saas",
      },
      {
        slug: "audience-new",
        title: "Title: audience-new",
        category: "automation",
      },
      {
        slug: "audience-old",
        title: "Title: audience-old",
        category: "education",
      },
    ]);
  });

  test("honors default, explicit, zero, and hard maximum limits", async () => {
    const t = convexTest(schema, modules);
    await seedIdeas(t, [
      idea("self", 0),
      ...Array.from({ length: 20 }, (_, index) =>
        idea(`related-${index}`, 100 - index),
      ),
    ]);

    const defaultResult = await t.query(api.ideas.relatedFor, { slug: "self" });
    const explicitResult = await t.query(api.ideas.relatedFor, {
      slug: "self",
      limit: 2,
    });
    const zeroResult = await t.query(api.ideas.relatedFor, {
      slug: "self",
      limit: 0,
    });
    const cappedResult = await t.query(api.ideas.relatedFor, {
      slug: "self",
      limit: 100,
    });

    expect(defaultResult.map(({ slug }) => slug)).toEqual([
      "related-0",
      "related-1",
      "related-2",
    ]);
    expect(explicitResult.map(({ slug }) => slug)).toEqual([
      "related-0",
      "related-1",
    ]);
    expect(zeroResult).toEqual([]);
    expect(cappedResult).toHaveLength(12);
  });

  test("keeps the common four-card category path within six document reads", async () => {
    const t = convexTest({
      schema,
      modules,
      transactionLimits: { documentsRead: 6 },
    });
    await seedIdeas(t, [
      idea("self", 0),
      ...Array.from({ length: 24 }, (_, index) =>
        idea(`related-${index}`, 100 - index),
      ),
    ]);

    const result = await t.query(api.ideas.relatedFor, {
      slug: "self",
      limit: 4,
    });

    expect(result.map(({ slug }) => slug)).toEqual([
      "related-0",
      "related-1",
      "related-2",
      "related-3",
    ]);
  });

  test("returns an empty array for an unknown slug or no eligible ideas", async () => {
    const t = convexTest(schema, modules);
    await seedIdeas(t, [
      idea("self", 100, {
        category: "saas",
        audiences: ["founders"],
      }),
      idea("other", 200, {
        category: "health",
        audiences: ["designers"],
      }),
    ]);

    await expect(
      t.query(api.ideas.relatedFor, { slug: "missing", limit: 4 }),
    ).resolves.toEqual([]);
    await expect(
      t.query(api.ideas.relatedFor, { slug: "self", limit: 4 }),
    ).resolves.toEqual([]);
  });

  test("remains public and tolerates missing optional idea fields", async () => {
    const t = convexTest(schema, modules);
    await seedIdeas(t, [
      idea("self", 100, {
        category: "saas",
        audiences: ["founders"],
      }),
      idea("related", 200, {
        category: "saas",
        audiences: ["founders"],
      }),
    ]);

    const anonymous = await t.query(api.ideas.relatedFor, {
      slug: "self",
      limit: 1,
    });
    const authenticated = await t
      .withIdentity({ tokenIdentifier: "test|user" })
      .query(api.ideas.relatedFor, { slug: "self", limit: 1 });

    expect(anonymous).toEqual([
      {
        slug: "related",
        title: "Title: related",
        category: "saas",
      },
    ]);
    expect(authenticated).toEqual(anonymous);
  });
});
