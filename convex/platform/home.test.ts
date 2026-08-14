/// <reference types="vite/client" />

import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "../schema";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { serializeSiteRenderSpec } from "./preview/renderSpec";

const modules = import.meta.glob("/convex/**/*.ts");

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

async function seedUser(t: TestConvex<typeof schema>, email: string) {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { email });
    const sessionId = await ctx.db.insert("authSessions", {
      userId,
      expirationTime: Date.now() + 60 * 60 * 1000,
    });
    return { userId, sessionId };
  });
}

function spec() {
  return serializeSiteRenderSpec({
    contractVersion: 1,
    templateId: "editorial",
    siteInput: {
      contractVersion: 1,
      headline: "Still in the cart. Still yours.",
      subheadline: "One-mail recovery for shops that already have Stripe.",
      problemStatement: "Carts go cold overnight.",
      keyBenefits: ["One sequence"],
      socialProof: [],
      callToAction: { label: "Get the sequence" },
    },
  });
}

async function seedIdea(
  t: TestConvex<typeof schema>,
  fields: {
    slug: string;
    title: string;
    publishedAt: number;
    opportunity: number;
  },
) {
  return await t.run(async (ctx) =>
    ctx.db.insert("ideas", {
      slug: fields.slug,
      title: fields.title,
      description: `${fields.title} description`,
      publishedAt: fields.publishedAt,
      category: "saas",
      buildTime: "8",
      revenueGoal: "1k-month",
      applicationCategory: "BusinessApplication",
      tools: ["nextjs"],
      audiences: ["indie-founders"],
      bodyMode: "mdx",
      scores: {
        opportunity: fields.opportunity,
        pain: fields.opportunity,
        timing: fields.opportunity,
        builder_confidence: fields.opportunity,
      },
    }),
  );
}

describe("signed-in home.current", () => {
  test("cold start returns three ideas ranked by canonical score", async () => {
    const t = convexTest(schema, modules);
    const owner = await seedUser(t, "cold@example.com");
    await seedIdea(t, {
      slug: "low",
      title: "Low",
      publishedAt: 3,
      opportunity: 2,
    });
    await seedIdea(t, {
      slug: "mid",
      title: "Mid",
      publishedAt: 2,
      opportunity: 6,
    });
    await seedIdea(t, {
      slug: "high",
      title: "High",
      publishedAt: 1,
      opportunity: 9,
    });
    await seedIdea(t, {
      slug: "also-high-newer",
      title: "Also high",
      publishedAt: 4,
      opportunity: 9,
    });

    const result = await asUser(t, owner.userId, owner.sessionId).query(
      api.platform.home.current,
      {},
    );

    expect(result.kind).toBe("cold");
    if (result.kind !== "cold") return;
    expect(result.cards.map((card) => card.slug)).toEqual([
      "also-high-newer",
      "high",
      "mid",
    ]);
    expect(result.cards).toHaveLength(3);
  });

  test("an unpublished owned project is Day 1 with a render spec", async () => {
    const t = convexTest(schema, modules);
    const owner = await seedUser(t, "day1@example.com");
    const { projectId } = await t.run(async (ctx) => {
      const now = Date.now();
      const ideaId = await ctx.db.insert("ideas", {
        slug: "cart-recovery",
        title: "Cart recovery",
        description: "Recover carts.",
        publishedAt: now,
        category: "saas",
        buildTime: "8",
        revenueGoal: "1k-month",
        applicationCategory: "BusinessApplication",
        tools: ["nextjs"],
        audiences: ["indie-founders"],
        bodyMode: "mdx",
      });
      const projectId = await ctx.db.insert("projects", {
        ownerId: owner.userId,
        title: "Cart recovery",
        source: "repository_idea",
        sourceIdeaId: ideaId,
        status: "draft",
        idempotencyKey: `home:day1:${now}`,
        createdAt: now,
        updatedAt: now,
      });
      const documentId = await ctx.db.insert("documents", {
        ownerId: owner.userId,
        projectId,
        kind: "site_copy",
        format: "json",
        title: "Site copy",
        body: spec(),
        createdAt: now,
        updatedAt: now,
      });
      const siteConfigId = await ctx.db.insert("site_configs", {
        ownerId: owner.userId,
        projectId,
        status: "draft",
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("site_versions", {
        ownerId: owner.userId,
        projectId,
        siteConfigId,
        status: "draft",
        version: 1n,
        documentId,
        createdAt: now,
      });
      return { projectId };
    });

    const result = await asUser(t, owner.userId, owner.sessionId).query(
      api.platform.home.current,
      {},
    );

    expect(result.kind).toBe("day1");
    if (result.kind !== "day1") return;
    expect(result.projectId).toBe(projectId);
    expect(result.title).toBe("Cart recovery");
    expect(result.sourceSlug).toBe("cart-recovery");
    expect(result.renderSpec).toBe(spec());
    expect(result.publishable).toBe(true);
    expect(result.paid).toBe(false);
  });

  test("a live hostname is Day n", async () => {
    const t = convexTest(schema, modules);
    const owner = await seedUser(t, "dayn@example.com");
    const { projectId } = await t.run(async (ctx) => {
      const now = Date.now();
      const ideaId = await ctx.db.insert("ideas", {
        slug: "cart-recovery",
        title: "Cart recovery",
        description: "Recover carts.",
        publishedAt: now,
        category: "saas",
        buildTime: "8",
        revenueGoal: "1k-month",
        applicationCategory: "BusinessApplication",
        tools: ["nextjs"],
        audiences: ["indie-founders"],
        bodyMode: "mdx",
      });
      const projectId = await ctx.db.insert("projects", {
        ownerId: owner.userId,
        title: "Cart recovery",
        source: "repository_idea",
        sourceIdeaId: ideaId,
        status: "draft",
        idempotencyKey: `home:dayn:${now}`,
        createdAt: now,
        updatedAt: now,
      });
      const documentId = await ctx.db.insert("documents", {
        ownerId: owner.userId,
        projectId,
        kind: "site_copy",
        format: "json",
        title: "Site copy",
        body: spec(),
        createdAt: now,
        updatedAt: now,
      });
      const siteConfigId = await ctx.db.insert("site_configs", {
        ownerId: owner.userId,
        projectId,
        status: "published",
        hostname: "cart.weekendmvp.app",
        createdAt: now,
        updatedAt: now,
      });
      const versionId = await ctx.db.insert("site_versions", {
        ownerId: owner.userId,
        projectId,
        siteConfigId,
        status: "published",
        version: 1n,
        documentId,
        createdAt: now,
      });
      await ctx.db.patch("site_configs", siteConfigId, {
        currentVersionId: versionId,
      });
      return { projectId };
    });

    const result = await asUser(t, owner.userId, owner.sessionId).query(
      api.platform.home.current,
      { projectId },
    );

    expect(result.kind).toBe("dayn");
    if (result.kind !== "dayn") return;
    expect(result.hostname).toBe("cart.weekendmvp.app");
    expect(result.others).toEqual([]);
  });

  test("newest owned project wins, and two projects populate others", async () => {
    const t = convexTest(schema, modules);
    const owner = await seedUser(t, "keep@example.com");
    const ids = await t.run(async (ctx) => {
      const older = Date.now() - 1_000;
      const newer = Date.now();
      const ideaA = await ctx.db.insert("ideas", {
        slug: "older-idea",
        title: "Older",
        description: "Older idea",
        publishedAt: older,
        category: "saas",
        buildTime: "8",
        revenueGoal: "1k-month",
        applicationCategory: "BusinessApplication",
        tools: ["nextjs"],
        audiences: ["indie-founders"],
        bodyMode: "mdx",
      });
      const ideaB = await ctx.db.insert("ideas", {
        slug: "newer-idea",
        title: "Newer",
        description: "Newer idea",
        publishedAt: newer,
        category: "saas",
        buildTime: "8",
        revenueGoal: "1k-month",
        applicationCategory: "BusinessApplication",
        tools: ["nextjs"],
        audiences: ["indie-founders"],
        bodyMode: "mdx",
      });
      const olderProject = await ctx.db.insert("projects", {
        ownerId: owner.userId,
        title: "Older keep",
        source: "repository_idea",
        sourceIdeaId: ideaA,
        status: "draft",
        idempotencyKey: `home:older:${older}`,
        createdAt: older,
        updatedAt: older,
      });
      const newerProject = await ctx.db.insert("projects", {
        ownerId: owner.userId,
        title: "Newer keep",
        source: "repository_idea",
        sourceIdeaId: ideaB,
        status: "draft",
        idempotencyKey: `home:newer:${newer}`,
        createdAt: newer,
        updatedAt: newer,
      });
      return { olderProject, newerProject };
    });

    const latest = await asUser(t, owner.userId, owner.sessionId).query(
      api.platform.home.current,
      {},
    );
    expect(latest.kind).toBe("day1");
    if (latest.kind !== "day1") return;
    expect(latest.projectId).toBe(ids.newerProject);
    expect(latest.others).toHaveLength(2);

    const switched = await asUser(t, owner.userId, owner.sessionId).query(
      api.platform.home.current,
      { projectId: ids.olderProject },
    );
    expect(switched.kind).toBe("day1");
    if (switched.kind !== "day1") return;
    expect(switched.projectId).toBe(ids.olderProject);
  });
});
