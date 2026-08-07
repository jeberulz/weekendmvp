import { convexTest, type TestConvex } from "convex-test";
import { register as registerRateLimiter } from "@convex-dev/rate-limiter/test";
import { describe, expect, test } from "vitest";
import schema from "../../schema";
import { api } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { serializeSiteRenderSpec } from "../preview/renderSpec";

const modules = import.meta.glob("/convex/**/*.ts");

/**
 * The rate limiter is a Convex component with its own function namespace,
 * which `convexTest` cannot resolve from the app's module glob. Registering
 * it means the limit assertions below exercise the real component rather than
 * a stub — the same setup `convex/platform/preview/generate.test.ts` uses.
 */
function testConvex() {
  const t = convexTest(schema, modules);
  registerRateLimiter(t);
  return t;
}

const HOSTNAME = "acme.weekendmvp.app";

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

async function seedSite(
  t: TestConvex<typeof schema>,
  ownerId: Id<"users">,
  options: { hostname?: string; published?: boolean } = {},
) {
  return await t.run(async (ctx) => {
    const now = Date.now();
    const published = options.published ?? true;
    const projectId = await ctx.db.insert("projects", {
      ownerId,
      title: "Collectible verification",
      source: "repository_idea",
      status: "draft",
      idempotencyKey: `wp28:lead:${now}:${Math.random()}`,
      createdAt: now,
      updatedAt: now,
    });
    const documentId = await ctx.db.insert("documents", {
      ownerId,
      projectId,
      kind: "site_copy",
      format: "json",
      title: "Site copy",
      body: serializeSiteRenderSpec({
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
      }),
      createdAt: now,
      updatedAt: now,
    });
    const siteConfigId = await ctx.db.insert("site_configs", {
      ownerId,
      projectId,
      status: published ? "published" : "draft",
      hostname: options.hostname ?? HOSTNAME,
      createdAt: now,
      updatedAt: now,
    });
    const versionId = await ctx.db.insert("site_versions", {
      ownerId,
      projectId,
      siteConfigId,
      status: published ? "published" : "draft",
      version: 1n,
      documentId,
      createdAt: now,
      publishedAt: now,
    });
    if (published) {
      await ctx.db.patch(siteConfigId, { currentVersionId: versionId });
    }
    return { projectId, siteConfigId, versionId };
  });
}

const record = (t: TestConvex<typeof schema>, hostname: string, key = "ip:1.2.3.4") =>
  t.mutation(api.platform.sites.leads.recordSynthetic, {
    hostname,
    rateLimitKey: key,
  });

describe("recordSynthetic", () => {
  test("attaches the lead to the owner the hostname resolves to", async () => {
    const t = testConvex();
    const owner = await seedUser(t, "owner@example.com");
    const { projectId, siteConfigId } = await seedSite(t, owner.userId);

    expect(await record(t, HOSTNAME)).toEqual({ recorded: true });

    const leads = await t.run(async (ctx) => await ctx.db.query("leads").collect());
    expect(leads.length).toBe(1);
    expect(leads[0].ownerId).toBe(owner.userId);
    expect(leads[0].projectId).toBe(projectId);
    expect(leads[0].siteConfigId).toBe(siteConfigId);
  });

  test("stores no personal data at all", async () => {
    const t = testConvex();
    const owner = await seedUser(t, "owner@example.com");
    await seedSite(t, owner.userId);
    await record(t, HOSTNAME);

    const [lead] = await t.run(async (ctx) => await ctx.db.query("leads").collect());
    expect(lead.synthetic).toBe(true);
    // Genuinely absent, not blanked — a blanked row would be
    // indistinguishable from a real lead whose contents were lost.
    expect(lead.email).toBeUndefined();
    expect(lead.payload).toBeUndefined();
  });

  test.each([
    ["an unpublished site", { published: false }],
    ["an unknown hostname", { hostname: "nobody.weekendmvp.app" }],
  ])("refuses %s", async (_label, options) => {
    const t = testConvex();
    const owner = await seedUser(t, "owner@example.com");
    await seedSite(t, owner.userId, options);

    await expect(record(t, HOSTNAME)).rejects.toThrow(
      /TENANT_SITE_NOT_PUBLISHED/,
    );
    const leads = await t.run(async (ctx) => await ctx.db.query("leads").collect());
    expect(leads.length).toBe(0);
  });

  test("refuses when a site was taken down", async () => {
    const t = testConvex();
    const owner = await seedUser(t, "owner@example.com");
    const { siteConfigId } = await seedSite(t, owner.userId);
    await t.run(async (ctx) => {
      await ctx.db.patch(siteConfigId, { currentVersionId: undefined });
    });

    await expect(record(t, HOSTNAME)).rejects.toThrow(/TENANT_SITE_NOT_PUBLISHED/);
  });

  test("refuses when two sites share a hostname", async () => {
    const t = testConvex();
    const a = await seedUser(t, "a@example.com");
    const b = await seedUser(t, "b@example.com");
    await seedSite(t, a.userId);
    await seedSite(t, b.userId);

    // Attributing the lead to whichever row the index returned first would
    // hand one customer's visitor to another customer.
    await expect(record(t, HOSTNAME)).rejects.toThrow(/TENANT_SITE_NOT_PUBLISHED/);
  });

  test("rate limits per key and does not write once limited", async () => {
    const t = testConvex();
    const owner = await seedUser(t, "owner@example.com");
    await seedSite(t, owner.userId);

    const results = await Promise.allSettled(
      Array.from({ length: 9 }, () => record(t, HOSTNAME, "ip:9.9.9.9")),
    );
    const rejected = results.filter((r) => r.status === "rejected");
    expect(rejected.length).toBeGreaterThan(0);

    const leads = await t.run(async (ctx) => await ctx.db.query("leads").collect());
    // Never more rows than requests that succeeded.
    expect(leads.length).toBe(results.length - rejected.length);
  });

  test("a separate key has its own budget", async () => {
    const t = testConvex();
    const owner = await seedUser(t, "owner@example.com");
    await seedSite(t, owner.userId);

    await record(t, HOSTNAME, "ip:1.1.1.1");
    expect(await record(t, HOSTNAME, "ip:2.2.2.2")).toEqual({ recorded: true });
  });
});

describe("listForProject", () => {
  test("returns the owner's leads and nothing about the visitor", async () => {
    const t = testConvex();
    const owner = await seedUser(t, "owner@example.com");
    const { projectId } = await seedSite(t, owner.userId);
    await record(t, HOSTNAME);

    const leads = await asUser(t, owner.userId, owner.sessionId).query(
      api.platform.sites.leads.listForProject,
      { projectId },
    );
    expect(leads.length).toBe(1);
    expect(Object.keys(leads[0]).sort()).toEqual(["_id", "createdAt", "synthetic"]);
  });

  test("refuses another user's project", async () => {
    const t = testConvex();
    const owner = await seedUser(t, "owner@example.com");
    const other = await seedUser(t, "other@example.com");
    const { projectId } = await seedSite(t, owner.userId);
    await record(t, HOSTNAME);

    await expect(
      asUser(t, other.userId, other.sessionId).query(
        api.platform.sites.leads.listForProject,
        { projectId },
      ),
    ).rejects.toThrow(/RESOURCE_NOT_FOUND/);
  });

  test("refuses an anonymous caller", async () => {
    const t = testConvex();
    const owner = await seedUser(t, "owner@example.com");
    const { projectId } = await seedSite(t, owner.userId);

    await expect(
      t.query(api.platform.sites.leads.listForProject, { projectId }),
    ).rejects.toThrow(/UNAUTHENTICATED|RESOURCE_NOT_FOUND/);
  });

  test("never returns another owner's lead rows", async () => {
    const t = testConvex();
    const a = await seedUser(t, "a@example.com");
    const b = await seedUser(t, "b@example.com");
    const siteA = await seedSite(t, a.userId, { hostname: "a-co.weekendmvp.app" });
    await record(t, "a-co.weekendmvp.app");

    // A lead row mis-parented to A's project but owned by B must not surface.
    await t.run(async (ctx) => {
      await ctx.db.insert("leads", {
        ownerId: b.userId,
        projectId: siteA.projectId,
        siteConfigId: siteA.siteConfigId,
        synthetic: true,
        createdAt: Date.now(),
      });
    });

    const leads = await asUser(t, a.userId, a.sessionId).query(
      api.platform.sites.leads.listForProject,
      { projectId: siteA.projectId },
    );
    expect(leads.length).toBe(1);
  });
});
