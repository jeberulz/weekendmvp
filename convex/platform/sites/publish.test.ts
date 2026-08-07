import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "../../schema";
import { api } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { serializeSiteRenderSpec } from "../preview/renderSpec";

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

function spec(headline: string) {
  return serializeSiteRenderSpec({
    contractVersion: 1,
    templateId: "editorial",
    siteInput: {
      contractVersion: 1,
      headline,
      subheadline: "Photo in, provenance out for collectors who hate waiting.",
      problemStatement:
        "Collectors lose thousands to fakes because verification takes weeks and trusted labs are scarce.",
      keyBenefits: ["Instant photo-based authenticity scoring"],
      socialProof: [],
      callToAction: { label: "Verify my collectible" },
    },
  });
}

/** A project graph in the shape WP27's claim leaves behind: one draft version. */
async function seedProject(
  t: TestConvex<typeof schema>,
  ownerId: Id<"users">,
  headline = "Verify any collectible in under a minute",
) {
  return await t.run(async (ctx) => {
    const now = Date.now();
    const projectId = await ctx.db.insert("projects", {
      ownerId,
      title: "Collectible verification",
      source: "repository_idea",
      status: "draft",
      idempotencyKey: `wp28:test:${now}:${Math.random()}`,
      createdAt: now,
      updatedAt: now,
    });
    const documentId = await ctx.db.insert("documents", {
      ownerId,
      projectId,
      kind: "site_copy",
      format: "json",
      title: "Site copy",
      body: spec(headline),
      createdAt: now,
      updatedAt: now,
    });
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
      documentId,
      createdAt: now,
    });
    return { projectId, siteConfigId, documentId };
  });
}

const versionsOf = (t: TestConvex<typeof schema>, siteConfigId: Id<"site_configs">) =>
  t.run(async (ctx) =>
    await ctx.db
      .query("site_versions")
      .withIndex("by_siteConfigId_and_version", (q) => q.eq("siteConfigId", siteConfigId))
      .collect(),
  );

const siteOf = (t: TestConvex<typeof schema>, siteConfigId: Id<"site_configs">) =>
  t.run(async (ctx) => await ctx.db.get(siteConfigId));

describe("publish", () => {
  test("publishes at the tenant hostname and makes the site resolvable", async () => {
    const t = convexTest(schema, modules);
    const owner = await seedUser(t, "owner@example.com");
    const { projectId, siteConfigId } = await seedProject(t, owner.userId);

    const result = await asUser(t, owner.userId, owner.sessionId).mutation(
      api.platform.sites.publish.publish,
      { projectId, slug: "acme" },
    );

    expect(result).toEqual({ hostname: "acme.weekendmvp.app", version: 2n, created: true });
    const site = await siteOf(t, siteConfigId);
    expect(site?.status).toBe("published");
    expect(site?.hostname).toBe("acme.weekendmvp.app");
    expect(site?.currentVersionId).toBeDefined();

    // The public resolver is the real proof it is live.
    const live = await t.query(api.platform.sites.read.resolvePublishedSite, {
      hostname: "acme.weekendmvp.app",
    });
    expect(live?.renderSpec).toContain("Verify any collectible");
  });

  test("derives identity server-side and takes no owner argument", async () => {
    const t = convexTest(schema, modules);
    const owner = await seedUser(t, "owner@example.com");
    const { projectId } = await seedProject(t, owner.userId);

    // Anonymous callers cannot publish at all.
    await expect(
      t.mutation(api.platform.sites.publish.publish, { projectId, slug: "acme" }),
    ).rejects.toThrow(/UNAUTHENTICATED|RESOURCE_NOT_FOUND/);
  });

  test("refuses to publish another user's project", async () => {
    const t = convexTest(schema, modules);
    const a = await seedUser(t, "a@example.com");
    const b = await seedUser(t, "b@example.com");
    const { projectId } = await seedProject(t, a.userId);

    await expect(
      asUser(t, b.userId, b.sessionId).mutation(api.platform.sites.publish.publish, {
        projectId,
        slug: "acme",
      }),
    ).rejects.toThrow(/RESOURCE_NOT_FOUND/);
  });

  test.each(["admin", "www", "api", "billing", "security"])(
    "refuses the reserved slug %s server-side",
    async (slug) => {
      const t = convexTest(schema, modules);
      const owner = await seedUser(t, "owner@example.com");
      const { projectId } = await seedProject(t, owner.userId);

      await expect(
        asUser(t, owner.userId, owner.sessionId).mutation(
          api.platform.sites.publish.publish,
          { projectId, slug },
        ),
      ).rejects.toThrow(/SITE_SLUG_UNAVAILABLE/);
    },
  );

  test.each(["-acme", "ac", "ACME", "acme_co", "ab--cdef", "a.b"])(
    "refuses the malformed slug %s",
    async (slug) => {
      const t = convexTest(schema, modules);
      const owner = await seedUser(t, "owner@example.com");
      const { projectId } = await seedProject(t, owner.userId);

      await expect(
        asUser(t, owner.userId, owner.sessionId).mutation(
          api.platform.sites.publish.publish,
          { projectId, slug },
        ),
      ).rejects.toThrow(/SITE_SLUG_UNAVAILABLE/);
    },
  );

  test("refuses a hostname another project already holds", async () => {
    const t = convexTest(schema, modules);
    const a = await seedUser(t, "a@example.com");
    const b = await seedUser(t, "b@example.com");
    const first = await seedProject(t, a.userId);
    const second = await seedProject(t, b.userId);

    await asUser(t, a.userId, a.sessionId).mutation(api.platform.sites.publish.publish, {
      projectId: first.projectId,
      slug: "acme",
    });

    await expect(
      asUser(t, b.userId, b.sessionId).mutation(api.platform.sites.publish.publish, {
        projectId: second.projectId,
        slug: "acme",
      }),
    ).rejects.toThrow(/SITE_SLUG_UNAVAILABLE/);

    // A taken slug and a reserved slug raise the same error, so this mutation
    // is not an oracle for which subdomains other customers hold.
    await expect(
      asUser(t, b.userId, b.sessionId).mutation(api.platform.sites.publish.publish, {
        projectId: second.projectId,
        slug: "admin",
      }),
    ).rejects.toThrow(/SITE_SLUG_UNAVAILABLE/);
  });

  test("republishing unchanged content creates no second version", async () => {
    const t = convexTest(schema, modules);
    const owner = await seedUser(t, "owner@example.com");
    const { projectId, siteConfigId } = await seedProject(t, owner.userId);
    const as = asUser(t, owner.userId, owner.sessionId);

    const first = await as.mutation(api.platform.sites.publish.publish, {
      projectId,
      slug: "acme",
    });
    const second = await as.mutation(api.platform.sites.publish.publish, {
      projectId,
      slug: "acme",
    });

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.version).toBe(first.version);
    expect((await versionsOf(t, siteConfigId)).length).toBe(2);
  });

  test("concurrent publishes never duplicate a version number", async () => {
    const t = convexTest(schema, modules);
    const owner = await seedUser(t, "owner@example.com");
    const { projectId, siteConfigId } = await seedProject(t, owner.userId);
    const as = asUser(t, owner.userId, owner.sessionId);

    // NOT real contention. Independent review established that `convex-test`
    // takes a global lock in `DatabaseFake.begin`, so `Promise.all` here runs
    // strictly sequentially — no OCC, no retry. My original comment claiming
    // otherwise was false about the harness.
    //
    // What this still proves: version numbers are derived server-side from
    // `by_siteConfigId_and_version` rather than passed in, so a second publish
    // cannot reuse the first's number. The true concurrency property depends
    // on Convex's serializable transactions and is NOT covered by any test in
    // this repo — see the open deviation in `docs/wp/wp28-stories.md` S4.
    await Promise.all([
      as.mutation(api.platform.sites.publish.publish, { projectId, slug: "acme" }),
      as.mutation(api.platform.sites.publish.publish, { projectId, slug: "acme" }),
    ]);

    const versions = await versionsOf(t, siteConfigId);
    const numbers = versions.map((v) => v.version.toString());
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  // Same harness limitation as above: sequential under `convex-test`. This
  // asserts the guard rejects a second claimant, not that it does so under
  // real contention.
  test("only one of two claims on the same hostname wins", async () => {
    const t = convexTest(schema, modules);
    const a = await seedUser(t, "a@example.com");
    const b = await seedUser(t, "b@example.com");
    const first = await seedProject(t, a.userId);
    const second = await seedProject(t, b.userId);

    const results = await Promise.allSettled([
      asUser(t, a.userId, a.sessionId).mutation(api.platform.sites.publish.publish, {
        projectId: first.projectId,
        slug: "contested",
      }),
      asUser(t, b.userId, b.sessionId).mutation(api.platform.sites.publish.publish, {
        projectId: second.projectId,
        slug: "contested",
      }),
    ]);

    expect(results.filter((r) => r.status === "fulfilled").length).toBe(1);
    // And exactly one row holds the hostname.
    const holders = await t.run(async (ctx) =>
      await ctx.db
        .query("site_configs")
        .withIndex("by_hostname", (q) => q.eq("hostname", "contested.weekendmvp.app"))
        .collect(),
    );
    expect(holders.length).toBe(1);
  });

  test("refuses a project with no publishable version", async () => {
    const t = convexTest(schema, modules);
    const owner = await seedUser(t, "owner@example.com");
    const projectId = await t.run(async (ctx) => {
      const now = Date.now();
      const id = await ctx.db.insert("projects", {
        ownerId: owner.userId,
        title: "Empty",
        source: "repository_idea",
        status: "draft",
        idempotencyKey: `wp28:test:empty:${now}`,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("site_configs", {
        ownerId: owner.userId,
        projectId: id,
        status: "draft",
        createdAt: now,
        updatedAt: now,
      });
      return id;
    });

    await expect(
      asUser(t, owner.userId, owner.sessionId).mutation(
        api.platform.sites.publish.publish,
        { projectId, slug: "empty" },
      ),
    ).rejects.toThrow(/SITE_NOT_PUBLISHABLE/);
  });

  test("writes an audit event", async () => {
    const t = convexTest(schema, modules);
    const owner = await seedUser(t, "owner@example.com");
    const { projectId } = await seedProject(t, owner.userId);
    await asUser(t, owner.userId, owner.sessionId).mutation(
      api.platform.sites.publish.publish,
      { projectId, slug: "acme" },
    );

    const events = await t.run(async (ctx) =>
      await ctx.db
        .query("audit_events")
        .withIndex("by_ownerId_and_createdAt", (q) => q.eq("ownerId", owner.userId))
        .collect(),
    );
    expect(events.map((e) => e.action)).toContain("site.published");
  });
});

describe("rollback", () => {
  async function publishTwice(t: TestConvex<typeof schema>) {
    const owner = await seedUser(t, "owner@example.com");
    const { projectId, siteConfigId } = await seedProject(t, owner.userId);
    const as = asUser(t, owner.userId, owner.sessionId);

    await as.mutation(api.platform.sites.publish.publish, { projectId, slug: "acme" });

    // New content, then publish again — the second publish must supersede.
    await t.run(async (ctx) => {
      const docs = await ctx.db
        .query("documents")
        .withIndex("by_projectId_and_updatedAt", (q) => q.eq("projectId", projectId))
        .collect();
      const now = Date.now();
      const documentId = await ctx.db.insert("documents", {
        ownerId: owner.userId,
        projectId,
        kind: "site_copy",
        format: "json",
        title: "Site copy v2",
        body: spec("Second headline entirely"),
        createdAt: now,
        updatedAt: now,
      });
      expect(docs.length).toBeGreaterThan(0);
      const latest = await ctx.db
        .query("site_versions")
        .withIndex("by_siteConfigId_and_version", (q) => q.eq("siteConfigId", siteConfigId))
        .order("desc")
        .first();
      await ctx.db.insert("site_versions", {
        ownerId: owner.userId,
        projectId,
        siteConfigId,
        status: "draft",
        version: (latest?.version ?? 1n) + 1n,
        documentId,
        createdAt: now,
      });
    });

    await as.mutation(api.platform.sites.publish.publish, { projectId, slug: "acme" });
    return { owner, projectId, siteConfigId, as };
  }

  test("restores earlier content as a new version, never un-retiring one", async () => {
    const t = convexTest(schema, modules);
    const { projectId, siteConfigId, as } = await publishTwice(t);

    const before = await versionsOf(t, siteConfigId);
    const result = await as.mutation(api.platform.sites.publish.rollback, {
      projectId,
      toVersion: 2n,
    });

    expect(result.created).toBe(true);
    // Forward-only: a brand new version number, not a revived row.
    expect(result.version).toBeGreaterThan(before[before.length - 1].version);

    const after = await versionsOf(t, siteConfigId);
    expect(after.length).toBe(before.length + 1);
    // Every previously retired row stays retired.
    for (const row of before.filter((r) => r.status === "retired")) {
      const still = after.find((r) => r._id === row._id);
      expect(still?.status).toBe("retired");
    }

    const live = await t.query(api.platform.sites.read.resolvePublishedSite, {
      hostname: "acme.weekendmvp.app",
    });
    expect(live?.renderSpec).toContain("Verify any collectible");
  });

  test("rolling back to the live version is a no-op", async () => {
    const t = convexTest(schema, modules);
    const { projectId, siteConfigId, as } = await publishTwice(t);
    const site = await siteOf(t, siteConfigId);
    const current = await t.run(async (ctx) => await ctx.db.get(site!.currentVersionId!));

    const result = await as.mutation(api.platform.sites.publish.rollback, {
      projectId,
      toVersion: current!.version,
    });
    expect(result.created).toBe(false);
  });

  test("refuses a version belonging to another site", async () => {
    const t = convexTest(schema, modules);
    const { projectId, as } = await publishTwice(t);
    await expect(
      as.mutation(api.platform.sites.publish.rollback, { projectId, toVersion: 99n }),
    ).rejects.toThrow(/RESOURCE_NOT_FOUND/);
  });

  test("refuses another user's project", async () => {
    const t = convexTest(schema, modules);
    const { projectId } = await publishTwice(t);
    const b = await seedUser(t, "b@example.com");
    await expect(
      asUser(t, b.userId, b.sessionId).mutation(api.platform.sites.publish.rollback, {
        projectId,
        toVersion: 2n,
      }),
    ).rejects.toThrow(/RESOURCE_NOT_FOUND/);
  });
});

describe("unpublish", () => {
  test("takes the site down without leaving the terminal published status", async () => {
    const t = convexTest(schema, modules);
    const owner = await seedUser(t, "owner@example.com");
    const { projectId, siteConfigId } = await seedProject(t, owner.userId);
    const as = asUser(t, owner.userId, owner.sessionId);
    await as.mutation(api.platform.sites.publish.publish, { projectId, slug: "acme" });

    const result = await as.mutation(api.platform.sites.publish.unpublish, { projectId });
    expect(result.changed).toBe(true);

    const site = await siteOf(t, siteConfigId);
    // `siteTransitions.published` is terminal, so the status legitimately
    // stays `published`; the pointer is what makes a site reachable.
    expect(site?.status).toBe("published");
    expect(site?.currentVersionId).toBeUndefined();

    expect(
      await t.query(api.platform.sites.read.resolvePublishedSite, {
        hostname: "acme.weekendmvp.app",
      }),
    ).toBeNull();
  });

  test("is idempotent and refuses another user", async () => {
    const t = convexTest(schema, modules);
    const owner = await seedUser(t, "owner@example.com");
    const b = await seedUser(t, "b@example.com");
    const { projectId } = await seedProject(t, owner.userId);
    const as = asUser(t, owner.userId, owner.sessionId);
    await as.mutation(api.platform.sites.publish.publish, { projectId, slug: "acme" });

    await as.mutation(api.platform.sites.publish.unpublish, { projectId });
    expect(await as.mutation(api.platform.sites.publish.unpublish, { projectId })).toEqual({
      changed: false,
    });

    await expect(
      asUser(t, b.userId, b.sessionId).mutation(api.platform.sites.publish.unpublish, {
        projectId,
      }),
    ).rejects.toThrow(/RESOURCE_NOT_FOUND/);
  });

  test("a site taken down can be published again", async () => {
    const t = convexTest(schema, modules);
    const owner = await seedUser(t, "owner@example.com");
    const { projectId } = await seedProject(t, owner.userId);
    const as = asUser(t, owner.userId, owner.sessionId);

    await as.mutation(api.platform.sites.publish.publish, { projectId, slug: "acme" });
    await as.mutation(api.platform.sites.publish.unpublish, { projectId });
    const again = await as.mutation(api.platform.sites.publish.publish, {
      projectId,
      slug: "acme",
    });

    expect(again.created).toBe(true);
    expect(
      await t.query(api.platform.sites.read.resolvePublishedSite, {
        hostname: "acme.weekendmvp.app",
      }),
    ).not.toBeNull();
  });
});
