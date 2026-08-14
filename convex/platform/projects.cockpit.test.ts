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
      headline: "Verify any collectible in under a minute",
      subheadline: "Photo in, provenance out for collectors who hate waiting.",
      problemStatement:
        "Collectors lose thousands to fakes because verification takes weeks and trusted labs are scarce.",
      keyBenefits: ["Instant photo-based authenticity scoring"],
      socialProof: [],
      callToAction: { label: "Verify my collectible" },
    },
  });
}

async function seedProject(
  t: TestConvex<typeof schema>,
  ownerId: Id<"users">,
  options: { withSite?: boolean; withDocument?: boolean } = {},
) {
  const withSite = options.withSite ?? false;
  const withDocument = options.withDocument ?? true;
  return await t.run(async (ctx) => {
    const now = Date.now();
    const ideaId = await ctx.db.insert("ideas", {
      slug: "collectible-verifier",
      title: "Collectible verifier",
      description: "Verify collectibles from a photo.",
      publishedAt: now,
      category: "marketplace",
      buildTime: "8",
      revenueGoal: "1k-month",
      applicationCategory: "BusinessApplication",
      tools: ["nextjs"],
      audiences: ["indie-founders"],
      bodyMode: "mdx",
    });
    const projectId = await ctx.db.insert("projects", {
      ownerId,
      title: "Collectible verification",
      source: "repository_idea",
      sourceIdeaId: ideaId,
      status: "draft",
      idempotencyKey: `wp29:test:${now}:${Math.random()}`,
      createdAt: now,
      updatedAt: now,
    });
    if (!withSite) return { projectId, siteConfigId: null as Id<"site_configs"> | null };
    const documentId = withDocument
      ? await ctx.db.insert("documents", {
          ownerId,
          projectId,
          kind: "site_copy",
          format: "json",
          title: "Site copy",
          body: spec(),
          createdAt: now,
          updatedAt: now,
        })
      : undefined;
    const siteConfigId = await ctx.db.insert("site_configs", {
      ownerId,
      projectId,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("site_versions", {
      ownerId,
      projectId,
      siteConfigId,
      status: "draft",
      version: 1n,
      ...(documentId !== undefined ? { documentId } : {}),
      createdAt: now,
    });
    return { projectId, siteConfigId };
  });
}

describe("WP29-S2 getOwned site summary", () => {
  test("returns null site when the project has no site graph", async () => {
    const t = convexTest(schema, modules);
    const owner = await seedUser(t, "owner@example.com");
    const { projectId } = await seedProject(t, owner.userId);

    const result = await asUser(t, owner.userId, owner.sessionId).query(
      api.platform.projects.getOwned,
      { projectId },
    );

    expect(result.project.status).toBe("draft");
    expect(result.project.sourceSlug).toBe("collectible-verifier");
    expect(result.site).toBeNull();
  });

  test("marks a claimed preview site publishable but not live", async () => {
    const t = convexTest(schema, modules);
    const owner = await seedUser(t, "owner@example.com");
    const { projectId } = await seedProject(t, owner.userId, { withSite: true });

    const result = await asUser(t, owner.userId, owner.sessionId).query(
      api.platform.projects.getOwned,
      { projectId },
    );

    expect(result.site).toEqual({
      status: "draft",
      publishable: true,
      live: false,
    });
  });

  test("exposes hostname and live after a successful publish", async () => {
    const t = convexTest(schema, modules);
    const owner = await seedUser(t, "owner@example.com");
    const { projectId } = await seedProject(t, owner.userId, { withSite: true });
    const identity = asUser(t, owner.userId, owner.sessionId);

    await identity.mutation(api.platform.sites.publish.publish, {
      projectId,
      slug: "acme",
    });

    const result = await identity.query(api.platform.projects.getOwned, {
      projectId,
    });

    expect(result.project.status).toBe("draft");
    expect(result.site).toEqual({
      status: "published",
      hostname: "acme.weekendmvp.app",
      publishable: true,
      live: true,
    });
  });

  test("is not publishable when the latest version has no document", async () => {
    const t = convexTest(schema, modules);
    const owner = await seedUser(t, "owner@example.com");
    const { projectId } = await seedProject(t, owner.userId, {
      withSite: true,
      withDocument: false,
    });

    const result = await asUser(t, owner.userId, owner.sessionId).query(
      api.platform.projects.getOwned,
      { projectId },
    );

    expect(result.site).toEqual({
      status: "draft",
      publishable: false,
      live: false,
    });
  });

  test("refuses another owner's project", async () => {
    const t = convexTest(schema, modules);
    const owner = await seedUser(t, "owner@example.com");
    const stranger = await seedUser(t, "stranger@example.com");
    const { projectId } = await seedProject(t, owner.userId, { withSite: true });

    await expect(
      asUser(t, stranger.userId, stranger.sessionId).query(
        api.platform.projects.getOwned,
        { projectId },
      ),
    ).rejects.toThrow(/RESOURCE_NOT_FOUND/);
  });

  test("returns null site when two site rows share a project", async () => {
    const t = convexTest(schema, modules);
    const owner = await seedUser(t, "owner@example.com");
    const { projectId } = await seedProject(t, owner.userId, { withSite: true });
    await t.run(async (ctx) => {
      const now = Date.now();
      await ctx.db.insert("site_configs", {
        ownerId: owner.userId,
        projectId,
        status: "draft",
        createdAt: now,
        updatedAt: now,
      });
    });

    const result = await asUser(t, owner.userId, owner.sessionId).query(
      api.platform.projects.getOwned,
      { projectId },
    );

    expect(result.site).toBeNull();
  });
});
