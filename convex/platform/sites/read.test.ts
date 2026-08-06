import { readFile } from "node:fs/promises";
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "../../schema";
import { api } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { serializeSiteRenderSpec } from "../preview/renderSpec";

const modules = import.meta.glob("/convex/**/*.ts");

const HOSTNAME = "acme.weekendmvp.app";

function renderSpec() {
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

type Overrides = {
  siteStatus?: "draft" | "ready" | "published";
  versionStatus?: "draft" | "ready" | "published" | "retired";
  hostname?: string;
  clearCurrentVersion?: boolean;
  archiveSite?: boolean;
  archiveProject?: boolean;
  archiveDocument?: boolean;
  crossOwnerVersion?: boolean;
  danglingPointer?: boolean;
};

/**
 * Builds a complete, publishable project graph and then applies exactly one
 * deviation, so each test isolates a single reason to refuse.
 */
async function seed(t: ReturnType<typeof convexTest>, overrides: Overrides = {}) {
  return await t.run(async (ctx) => {
    const now = Date.now();
    const ownerId = await ctx.db.insert("users", { name: "Owner" });
    const otherOwnerId = await ctx.db.insert("users", { name: "Other" });

    const projectId = await ctx.db.insert("projects", {
      ownerId,
      title: "Collectible verification",
      source: "repository_idea",
      status: "draft",
      idempotencyKey: `wp28:test:${now}`,
      createdAt: now,
      updatedAt: now,
      ...(overrides.archiveProject ? { archivedAt: now } : {}),
    });

    const documentId = await ctx.db.insert("documents", {
      ownerId,
      projectId,
      kind: "site_copy",
      format: "json",
      title: "Site copy",
      body: renderSpec(),
      createdAt: now,
      updatedAt: now,
      ...(overrides.archiveDocument ? { archivedAt: now } : {}),
    });

    const siteConfigId = await ctx.db.insert("site_configs", {
      ownerId,
      projectId,
      status: overrides.siteStatus ?? "published",
      hostname: overrides.hostname ?? HOSTNAME,
      createdAt: now,
      updatedAt: now,
      ...(overrides.archiveSite ? { archivedAt: now } : {}),
    });

    const versionId = await ctx.db.insert("site_versions", {
      ownerId: overrides.crossOwnerVersion ? otherOwnerId : ownerId,
      projectId,
      siteConfigId,
      status: overrides.versionStatus ?? "published",
      version: 1n,
      documentId,
      createdAt: now,
      publishedAt: now,
    });

    if (!overrides.clearCurrentVersion) {
      await ctx.db.patch(siteConfigId, {
        currentVersionId: overrides.danglingPointer
          ? await ctx.db.insert("site_versions", {
              ownerId,
              projectId,
              // Points at a version belonging to a different site config.
              siteConfigId: await ctx.db.insert("site_configs", {
                ownerId,
                projectId,
                status: "published",
                createdAt: now,
                updatedAt: now,
              }),
              status: "published",
              version: 1n,
              documentId,
              createdAt: now,
              publishedAt: now,
            })
          : versionId,
      });
    }

    return { ownerId, projectId, siteConfigId, versionId, documentId };
  });
}

const resolve = (t: ReturnType<typeof convexTest>, hostname = HOSTNAME) =>
  t.query(api.platform.sites.read.resolvePublishedSite, { hostname });

describe("resolvePublishedSite", () => {
  test("serves a fully published site", async () => {
    const t = convexTest(schema, modules);
    await seed(t);
    const result = await resolve(t);
    expect(result).not.toBeNull();
    expect(result?.renderSpec).toContain("Verify any collectible");
  });

  test("returns only the render spec and nothing about the account", async () => {
    const t = convexTest(schema, modules);
    await seed(t);
    const result = await resolve(t);
    // The public shape is the whole security boundary for this query.
    expect(Object.keys(result ?? {})).toEqual(["renderSpec"]);
  });

  test.each<[string, Overrides]>([
    ["an unknown hostname", {}],
    ["a draft site", { siteStatus: "draft" }],
    ["a ready-but-unpublished site", { siteStatus: "ready" }],
    ["a site with no current version", { clearCurrentVersion: true }],
    ["a retired current version", { versionStatus: "retired" }],
    ["a draft current version", { versionStatus: "draft" }],
    ["an archived site", { archiveSite: true }],
    ["an archived project", { archiveProject: true }],
    ["an archived document", { archiveDocument: true }],
    ["a version owned by someone else", { crossOwnerVersion: true }],
    ["a pointer into another site config", { danglingPointer: true }],
  ])("refuses %s", async (_label, overrides) => {
    const t = convexTest(schema, modules);
    await seed(t, overrides);
    const hostname = Object.keys(overrides).length === 0 ? "nope.weekendmvp.app" : HOSTNAME;
    expect(await resolve(t, hostname)).toBeNull();
  });

  test("every refusal is indistinguishable from the others", async () => {
    // The point of the table above is not just that each case fails, but that
    // they fail identically — no status, no message, no timing tell that
    // would let a stranger enumerate which subdomains are taken.
    const cases: Overrides[] = [
      { siteStatus: "draft" },
      { clearCurrentVersion: true },
      { versionStatus: "retired" },
      { archiveProject: true },
    ];
    for (const overrides of cases) {
      const t = convexTest(schema, modules);
      await seed(t, overrides);
      expect(await resolve(t)).toBeNull();
    }
  });

  test("refuses when two sites claim the same hostname", async () => {
    const t = convexTest(schema, modules);
    const { projectId, ownerId } = await seed(t);
    await t.run(async (ctx) => {
      const now = Date.now();
      await ctx.db.insert("site_configs", {
        ownerId,
        projectId,
        status: "published",
        hostname: HOSTNAME,
        createdAt: now,
        updatedAt: now,
      });
    });
    // Serving one of the two would non-deterministically hand a hostname to
    // whichever row the index returned first.
    expect(await resolve(t)).toBeNull();
  });

  test("does not match a site that stored no hostname", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const now = Date.now();
      const ownerId = await ctx.db.insert("users", { name: "Owner" });
      const projectId = await ctx.db.insert("projects", {
        ownerId,
        title: "Hostless",
        source: "repository_idea",
        status: "draft",
        idempotencyKey: `wp28:test:hostless:${now}`,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("site_configs", {
        ownerId,
        projectId,
        status: "published",
        createdAt: now,
        updatedAt: now,
      });
    });
    // WP27 leaves `hostname` undefined on every claimed preview. Those rows
    // must stay unreachable until WP28-S4 assigns a host deliberately.
    expect(await resolve(t, "")).toBeNull();
  });

  test("takes no owner or project argument", async () => {
    // Asserted against the source, not the generated `api`. The generated
    // object is a proxy: `Object.keys(api.foo.bar._args)` is `[]`, so an
    // assertion built on it passes forever regardless of the real signature.
    // Verified empirically before rewriting this test.
    const source = (
      await readFile(new URL("./read.ts", import.meta.url), "utf8")
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .filter((line) => !/^\s*(\/\/|\*)/.test(line))
      .join("\n");

    expect(source).toMatch(/args:\s*\{\s*hostname:\s*v\.string\(\)\s*\}/);
    expect(source).not.toMatch(/args\.(ownerId|userId|projectId|siteConfigId)/);
    // A public query must never accept identity it can be handed.
    expect(source).not.toMatch(/ownerId:\s*v\./);
  });
});

describe("unpublish is expressible without a status change", () => {
  test("clearing currentVersionId takes a published site down", async () => {
    const t = convexTest(schema, modules);
    const { siteConfigId } = await seed(t);
    expect(await resolve(t)).not.toBeNull();

    await t.run(async (ctx) => {
      const site = await ctx.db.get(siteConfigId as Id<"site_configs">);
      expect(site?.status).toBe("published");
      await ctx.db.patch(siteConfigId as Id<"site_configs">, {
        currentVersionId: undefined,
      });
    });

    // `siteTransitions.published` is terminal in the frozen WP22 machine, so
    // the pointer is the only takedown mechanism. This is the behaviour
    // WP30's kill switch will depend on.
    expect(await resolve(t)).toBeNull();
  });
});
