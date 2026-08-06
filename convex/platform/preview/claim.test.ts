/// <reference types="vite/client" />

import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import schema from "../../schema";
import { PLATFORM_AUTH_ERROR } from "../authz";
import {
  SITE_INPUT_CONTRACT_VERSION,
  type SiteInputPayload,
} from "../engine/contracts";
import {
  capabilityExpiresAt,
  generateCapabilityToken,
  hashCapabilityToken,
} from "./capabilities";
import {
  PREVIEW_TEMPLATE_VALUES,
  SITE_RENDER_SPEC_CONTRACT_VERSION,
  parseSiteRenderSpec,
  serializeSiteRenderSpec,
  type PreviewTemplate,
  type SiteRenderSpec,
} from "./renderSpec";

/** Root-absolute so `t.mutation` can resolve modules. See `read.test.ts`. */
const modules = import.meta.glob("/convex/**/*.ts");

function validSiteInput(): SiteInputPayload {
  return {
    contractVersion: SITE_INPUT_CONTRACT_VERSION,
    headline: "Ship fewer bugs, write zero test cases by hand",
    subheadline: "Turn your product spec into regression tests.",
    problemStatement:
      "QA engineers spend 40% of their time writing repetitive tests.",
    keyBenefits: ["Generates tests from plain-English specs", "Runs in CI"],
    socialProof: [],
    callToAction: { label: "Preview this idea" },
  };
}

function validRenderSpec(
  templateId: PreviewTemplate = "editorial",
): SiteRenderSpec {
  return {
    contractVersion: SITE_RENDER_SPEC_CONTRACT_VERSION,
    templateId,
    siteInput: validSiteInput(),
  };
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

async function seedCapability(
  t: TestConvex<typeof schema>,
  overrides: {
    expiresAt?: number;
    templateId?: PreviewTemplate;
    claimedByUserId?: Id<"users">;
  } = {},
) {
  const now = Date.now();
  const token = generateCapabilityToken();
  const tokenHash = await hashCapabilityToken(token);
  const templateId = overrides.templateId ?? "editorial";
  const capabilityId = await t.run(async (ctx) => {
    const ideaId = await ctx.db.insert("ideas", {
      slug: "ai-qa-test-case-generator",
      title: "AI QA Test Case Generator",
      description: "Generates regression test cases from a product spec.",
      publishedAt: Date.UTC(2026, 0, 1),
      category: "developer-tools",
      buildTime: "8",
      revenueGoal: "$5k MRR",
      applicationCategory: "DeveloperApplication",
      tools: ["claude-code"],
      audiences: ["developers"],
      bodyMode: "mdx",
    });
    return await ctx.db.insert("preview_capabilities", {
      tokenHash,
      sourceIdeaId: ideaId,
      templateId,
      renderSpec: serializeSiteRenderSpec(validRenderSpec(templateId)),
      expiresAt: overrides.expiresAt ?? capabilityExpiresAt(now),
      createdAt: now,
      ...(overrides.claimedByUserId
        ? { claimedByUserId: overrides.claimedByUserId, claimedAt: now }
        : {}),
    });
  });
  return { token, capabilityId, now };
}

describe("claiming an anonymous preview", () => {
  test("creates one owned project, site config, and site version", async () => {
    const t = convexTest(schema, modules);
    const owner = await seedUser(t, "owner@example.com");
    const { token } = await seedCapability(t);

    const graph = await asUser(t, owner.userId, owner.sessionId).mutation(
      api.platform.preview.claim.claim,
      { token },
    );

    expect(graph.created).toBe(true);
    const stored = await t.run(async (ctx) => ({
      project: await ctx.db.get("projects", graph.projectId),
      siteConfig: await ctx.db.get("site_configs", graph.siteConfigId),
      siteVersion: await ctx.db.get("site_versions", graph.siteVersionId),
      projectCount: (await ctx.db.query("projects").collect()).length,
      configCount: (await ctx.db.query("site_configs").collect()).length,
      versionCount: (await ctx.db.query("site_versions").collect()).length,
    }));

    expect(stored.projectCount).toBe(1);
    expect(stored.configCount).toBe(1);
    expect(stored.versionCount).toBe(1);
    expect(stored.project?.ownerId).toBe(owner.userId);
    expect(stored.project?.source).toBe("repository_idea");
    expect(stored.project?.status).toBe("draft");
    expect(stored.siteConfig?.currentVersionId).toBe(graph.siteVersionId);
    expect(stored.siteVersion?.version).toBe(1n);
  });

  test("every child record carries the claiming owner, never another", async () => {
    const t = convexTest(schema, modules);
    const owner = await seedUser(t, "owner@example.com");
    await seedUser(t, "bystander@example.com");
    const { token } = await seedCapability(t);

    await asUser(t, owner.userId, owner.sessionId).mutation(
      api.platform.preview.claim.claim,
      { token },
    );

    const owners = await t.run(async (ctx) => [
      ...(await ctx.db.query("projects").collect()).map((r) => r.ownerId),
      ...(await ctx.db.query("site_configs").collect()).map((r) => r.ownerId),
      ...(await ctx.db.query("site_versions").collect()).map((r) => r.ownerId),
      ...(await ctx.db.query("documents").collect()).map((r) => r.ownerId),
    ]);
    expect(owners).toHaveLength(4);
    expect(new Set(owners)).toEqual(new Set([owner.userId]));
  });

  test("carries templateId and siteInput forward unchanged", async () => {
    for (const templateId of PREVIEW_TEMPLATE_VALUES) {
      const t = convexTest(schema, modules);
      const owner = await seedUser(t, "owner@example.com");
      const { token } = await seedCapability(t, { templateId });

      const graph = await asUser(t, owner.userId, owner.sessionId).mutation(
        api.platform.preview.claim.claim,
        { token },
      );

      const body = await t.run(async (ctx) => {
        const version = await ctx.db.get("site_versions", graph.siteVersionId);
        const document = version?.documentId
          ? await ctx.db.get("documents", version.documentId)
          : null;
        return document?.body;
      });
      // Round-trips through the real parser, so this asserts contract
      // conformance rather than string equality of whatever was written.
      expect(parseSiteRenderSpec(body)).toEqual(validRenderSpec(templateId));
    }
  });

  test("a repeated claim returns the same graph and creates nothing new", async () => {
    const t = convexTest(schema, modules);
    const owner = await seedUser(t, "owner@example.com");
    const { token } = await seedCapability(t);
    const as = asUser(t, owner.userId, owner.sessionId);

    const first = await as.mutation(api.platform.preview.claim.claim, { token });
    const second = await as.mutation(api.platform.preview.claim.claim, { token });
    const third = await as.mutation(api.platform.preview.claim.claim, { token });

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(third.created).toBe(false);
    expect(second.projectId).toBe(first.projectId);
    expect(second.siteConfigId).toBe(first.siteConfigId);
    expect(second.siteVersionId).toBe(first.siteVersionId);
    expect(third).toEqual(second);

    const counts = await t.run(async (ctx) => ({
      projects: (await ctx.db.query("projects").collect()).length,
      versions: (await ctx.db.query("site_versions").collect()).length,
      documents: (await ctx.db.query("documents").collect()).length,
    }));
    expect(counts).toEqual({ projects: 1, versions: 1, documents: 1 });
  });

  test("concurrent duplicate claims yield exactly one project graph", async () => {
    const t = convexTest(schema, modules);
    const owner = await seedUser(t, "owner@example.com");
    const { token } = await seedCapability(t);
    const as = asUser(t, owner.userId, owner.sessionId);

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        as.mutation(api.platform.preview.claim.claim, { token }),
      ),
    );

    // Exactly one call did the creating; the rest replayed it.
    expect(results.filter((r) => r.created)).toHaveLength(1);
    expect(new Set(results.map((r) => r.projectId)).size).toBe(1);

    const counts = await t.run(async (ctx) => ({
      projects: (await ctx.db.query("projects").collect()).length,
      configs: (await ctx.db.query("site_configs").collect()).length,
      versions: (await ctx.db.query("site_versions").collect()).length,
      documents: (await ctx.db.query("documents").collect()).length,
    }));
    expect(counts).toEqual({
      projects: 1,
      configs: 1,
      versions: 1,
      documents: 1,
    });
  });

  test("marks the capability claimed and points it at the created project", async () => {
    const t = convexTest(schema, modules);
    const owner = await seedUser(t, "owner@example.com");
    const { token, capabilityId } = await seedCapability(t);

    const graph = await asUser(t, owner.userId, owner.sessionId).mutation(
      api.platform.preview.claim.claim,
      { token },
    );

    const capability = await t.run(
      async (ctx) => await ctx.db.get("preview_capabilities", capabilityId),
    );
    expect(capability?.claimedByUserId).toBe(owner.userId);
    expect(capability?.claimedProjectId).toBe(graph.projectId);
    expect(capability?.claimedAt).toEqual(expect.any(Number));
    // Still hashed, still no plaintext anywhere in the row.
    expect(JSON.stringify(capability)).not.toContain(token);
  });

  test("a capability claimed by A cannot be claimed by B", async () => {
    const t = convexTest(schema, modules);
    const a = await seedUser(t, "a@example.com");
    const b = await seedUser(t, "b@example.com");
    const { token } = await seedCapability(t);

    await asUser(t, a.userId, a.sessionId).mutation(
      api.platform.preview.claim.claim,
      { token },
    );

    await expect(
      asUser(t, b.userId, b.sessionId).mutation(
        api.platform.preview.claim.claim,
        { token },
      ),
    ).rejects.toThrow(PLATFORM_AUTH_ERROR.notFound);

    const owners = await t.run(async (ctx) =>
      (await ctx.db.query("projects").collect()).map((p) => p.ownerId),
    );
    expect(owners).toEqual([a.userId]);
  });

  test("B's denial is identical to an unknown token, so ownership does not leak", async () => {
    const t = convexTest(schema, modules);
    const a = await seedUser(t, "a@example.com");
    const b = await seedUser(t, "b@example.com");
    const { token } = await seedCapability(t);
    await asUser(t, a.userId, a.sessionId).mutation(
      api.platform.preview.claim.claim,
      { token },
    );
    const asB = asUser(t, b.userId, b.sessionId);

    const errors: string[] = [];
    for (const candidate of [token, generateCapabilityToken(), "not-a-token"]) {
      try {
        await asB.mutation(api.platform.preview.claim.claim, {
          token: candidate,
        });
        errors.push("NO_ERROR");
      } catch (error) {
        errors.push(String((error as Error).message));
      }
    }
    // "Someone else owns this" must read exactly like "this never existed".
    expect(new Set(errors).size).toBe(1);
    expect(errors[0]).toContain(PLATFORM_AUTH_ERROR.notFound);
  });

  test("an expired capability cannot be claimed at all", async () => {
    const t = convexTest(schema, modules);
    const owner = await seedUser(t, "owner@example.com");
    const { token } = await seedCapability(t, { expiresAt: Date.now() - 1 });

    await expect(
      asUser(t, owner.userId, owner.sessionId).mutation(
        api.platform.preview.claim.claim,
        { token },
      ),
    ).rejects.toThrow(PLATFORM_AUTH_ERROR.notFound);

    const projects = await t.run(
      async (ctx) => await ctx.db.query("projects").collect(),
    );
    expect(projects).toHaveLength(0);
  });

  test("an unauthenticated caller cannot claim anything", async () => {
    const t = convexTest(schema, modules);
    const { token } = await seedCapability(t);

    await expect(
      t.mutation(api.platform.preview.claim.claim, { token }),
    ).rejects.toThrow(PLATFORM_AUTH_ERROR.unauthenticated);

    const projects = await t.run(
      async (ctx) => await ctx.db.query("projects").collect(),
    );
    expect(projects).toHaveLength(0);
  });

  test("the claim takes no owner argument, so identity cannot be supplied", async () => {
    const t = convexTest(schema, modules);
    const a = await seedUser(t, "a@example.com");
    const b = await seedUser(t, "b@example.com");
    const { token } = await seedCapability(t);

    await expect(
      asUser(t, a.userId, a.sessionId).mutation(
        api.platform.preview.claim.claim,
        // @ts-expect-error - `ownerId` is not a declared argument. The
        // directive failing to error would mean the WP22 invariant that
        // identity is derived server-side had been broken.
        { token, ownerId: b.userId },
      ),
    ).rejects.toThrow(/Unexpected field `ownerId`/);
  });

  test("a claimed project that was archived is not silently recreated", async () => {
    const t = convexTest(schema, modules);
    const owner = await seedUser(t, "owner@example.com");
    const { token } = await seedCapability(t);
    const as = asUser(t, owner.userId, owner.sessionId);

    const graph = await as.mutation(api.platform.preview.claim.claim, { token });
    await t.run(async (ctx) => {
      await ctx.db.patch("projects", graph.projectId, {
        archivedAt: Date.now(),
      });
    });

    await expect(
      as.mutation(api.platform.preview.claim.claim, { token }),
    ).rejects.toThrow(PLATFORM_AUTH_ERROR.notFound);

    const projects = await t.run(
      async (ctx) => await ctx.db.query("projects").collect(),
    );
    expect(projects).toHaveLength(1);
  });

  test("no hostname is reserved or implied, since WP28 owns host routing", async () => {
    const t = convexTest(schema, modules);
    const owner = await seedUser(t, "owner@example.com");
    const { token } = await seedCapability(t);

    const graph = await asUser(t, owner.userId, owner.sessionId).mutation(
      api.platform.preview.claim.claim,
      { token },
    );

    const siteConfig = await t.run(
      async (ctx) => await ctx.db.get("site_configs", graph.siteConfigId),
    );
    expect(siteConfig?.hostname).toBeUndefined();
    expect(siteConfig?.status).toBe("draft");
  });

  test("the claimed project appears in the owner's list and nobody else's", async () => {
    const t = convexTest(schema, modules);
    const owner = await seedUser(t, "owner@example.com");
    const other = await seedUser(t, "other@example.com");
    const { token } = await seedCapability(t);

    await asUser(t, owner.userId, owner.sessionId).mutation(
      api.platform.preview.claim.claim,
      { token },
    );

    const page = { numItems: 10, cursor: null };
    const mine = await asUser(t, owner.userId, owner.sessionId).query(
      api.platform.projects.listOwned,
      { paginationOpts: page },
    );
    const theirs = await asUser(t, other.userId, other.sessionId).query(
      api.platform.projects.listOwned,
      { paginationOpts: page },
    );

    expect(mine.page).toHaveLength(1);
    expect(mine.page[0].source).toBe("repository_idea");
    // A preview claim creates no brief, so the card must not offer to resume
    // one. Asserted because `listOwned` derives `nextAction` from briefs.
    expect(mine.page[0].nextAction).toBe("continue_project");
    expect(theirs.page).toHaveLength(0);
  });
});
