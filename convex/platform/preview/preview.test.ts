/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";
import schema from "../../schema";
import {
  SITE_INPUT_CONTRACT_VERSION,
  type SiteInputPayload,
} from "../engine/contracts";
import { MAX_GENERATED_DOCUMENT_BODY_BYTES } from "../validators";
import {
  CAPABILITY_LIFETIME_MS,
  capabilityExpiresAt,
  generateCapabilityToken,
  hashCapabilityToken,
  isCapabilityExpired,
  normalizeCapabilityToken,
  resolveCapability,
} from "./capabilities";
import {
  PREVIEW_TEMPLATE_VALUES,
  SITE_RENDER_SPEC_CONTRACT_VERSION,
  isPreviewTemplate,
  parseSiteRenderSpec,
  serializeSiteRenderSpec,
  type SiteRenderSpec,
} from "./renderSpec";

const modules = import.meta.glob("../../**/*.ts");

function validSiteInput(): SiteInputPayload {
  return {
    contractVersion: SITE_INPUT_CONTRACT_VERSION,
    headline: "Ship fewer bugs, write zero test cases by hand",
    subheadline: "Turn your product spec into regression tests.",
    problemStatement: "QA engineers spend 40% of their time writing repetitive tests.",
    keyBenefits: ["Generates tests from plain-English specs", "Runs in CI"],
    // Empty is legal on the repository-idea preview path: an anonymous
    // preview has no Validation Report to cite yet.
    socialProof: [],
    callToAction: { label: "Preview this idea" },
  };
}

function validRenderSpec(): SiteRenderSpec {
  return {
    contractVersion: SITE_RENDER_SPEC_CONTRACT_VERSION,
    templateId: "editorial",
    siteInput: validSiteInput(),
  };
}

async function seedIdea(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) =>
    ctx.db.insert("ideas", {
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
    }),
  );
}

describe("site render spec contract", () => {
  test("a valid spec round-trips through serialize and parse", () => {
    const spec = validRenderSpec();
    expect(parseSiteRenderSpec(serializeSiteRenderSpec(spec))).toEqual(spec);
  });

  test("every declared template id is accepted", () => {
    for (const templateId of PREVIEW_TEMPLATE_VALUES) {
      const spec = { ...validRenderSpec(), templateId };
      expect(parseSiteRenderSpec(serializeSiteRenderSpec(spec)).templateId).toBe(
        templateId,
      );
    }
  });

  test("rejects an unknown template id rather than treating it as a lookup key", () => {
    for (const bad of ["../../etc/passwd", "Editorial", "", "constructor"]) {
      const spec = { ...validRenderSpec(), templateId: bad as never };
      // Assert the specific code, not merely that something threw: a bare
      // toThrow would still pass if the failure came from an unrelated check.
      expect(() => parseSiteRenderSpec(JSON.stringify(spec))).toThrow(
        expect.objectContaining({
          data: expect.objectContaining({ code: "UNKNOWN_PREVIEW_TEMPLATE" }),
        }),
      );
    }
  });

  test("isPreviewTemplate rejects non-string and prototype-shaped input", () => {
    expect(isPreviewTemplate("editorial")).toBe(true);
    expect(isPreviewTemplate("Editorial")).toBe(false);
    expect(isPreviewTemplate(null)).toBe(false);
    expect(isPreviewTemplate(undefined)).toBe(false);
    expect(isPreviewTemplate({ toString: () => "editorial" })).toBe(false);
    expect(isPreviewTemplate("constructor")).toBe(false);
  });

  test("rejects an unknown contract version on both parse and serialize", () => {
    const spec = { ...validRenderSpec(), contractVersion: 2 as never };
    const versionError = expect.objectContaining({
      data: expect.objectContaining({
        code: "UNSUPPORTED_SITE_RENDER_SPEC_CONTRACT_VERSION",
      }),
    });
    expect(() => parseSiteRenderSpec(JSON.stringify(spec))).toThrow(versionError);
    expect(() => serializeSiteRenderSpec(spec)).toThrow(versionError);
  });

  test("rejects malformed JSON and a missing body", () => {
    expect(() => parseSiteRenderSpec("{not json")).toThrow(ConvexError);
    expect(() => parseSiteRenderSpec(undefined)).toThrow(ConvexError);
  });

  test("a siteInput that fails the frozen WP26-S1 parser fails closed here too", () => {
    const spec = validRenderSpec();
    spec.siteInput.keyBenefits = [];
    expect(() => parseSiteRenderSpec(JSON.stringify(spec))).toThrow(ConvexError);
    expect(() => serializeSiteRenderSpec(spec)).toThrow(ConvexError);
  });

  test("serialize enforces the generated-document byte ceiling", () => {
    const spec = validRenderSpec();
    spec.siteInput.problemStatement = "x".repeat(MAX_GENERATED_DOCUMENT_BODY_BYTES);
    expect(() => serializeSiteRenderSpec(spec)).toThrow(ConvexError);
  });
});

describe("capability token handling", () => {
  test("generated tokens are 64 hex chars and do not repeat", () => {
    const tokens = new Set(
      Array.from({ length: 50 }, () => generateCapabilityToken()),
    );
    expect(tokens.size).toBe(50);
    for (const token of tokens) expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  test("hashing is deterministic and does not return the plaintext", async () => {
    const token = generateCapabilityToken();
    const hash = await hashCapabilityToken(token);
    expect(hash).toBe(await hashCapabilityToken(token));
    expect(hash).not.toBe(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  test("a one-character difference produces a different hash", async () => {
    const a = "a".repeat(64);
    const b = `${"a".repeat(63)}b`;
    expect(await hashCapabilityToken(a)).not.toBe(await hashCapabilityToken(b));
  });

  test("normalize accepts a valid token and rejects every malformed shape", () => {
    const token = generateCapabilityToken();
    expect(normalizeCapabilityToken(token)).toBe(token);
    expect(normalizeCapabilityToken(token.toUpperCase())).toBe(token);
    expect(normalizeCapabilityToken(` ${token} `)).toBe(token);
    expect(normalizeCapabilityToken(token.slice(0, 63))).toBeNull();
    expect(normalizeCapabilityToken(`${token}0`)).toBeNull();
    expect(normalizeCapabilityToken("../../secret")).toBeNull();
    expect(normalizeCapabilityToken("z".repeat(64))).toBeNull();
    expect(normalizeCapabilityToken(null)).toBeNull();
    expect(normalizeCapabilityToken(12345)).toBeNull();
  });

  test("expiry is the ruled seven days and is evaluated against a passed-in now", () => {
    const now = Date.UTC(2026, 7, 6);
    expect(capabilityExpiresAt(now) - now).toBe(CAPABILITY_LIFETIME_MS);
    expect(CAPABILITY_LIFETIME_MS).toBe(7 * 24 * 60 * 60 * 1000);

    const capability = { expiresAt: capabilityExpiresAt(now) };
    expect(isCapabilityExpired(capability, now)).toBe(false);
    expect(isCapabilityExpired(capability, capability.expiresAt - 1)).toBe(false);
    // Boundary: expiry is inclusive, so the exact instant is already expired.
    expect(isCapabilityExpired(capability, capability.expiresAt)).toBe(true);
    expect(isCapabilityExpired(capability, capability.expiresAt + 1)).toBe(true);
  });
});

describe("capability resolution against the real schema", () => {
  async function seedCapability(
    t: ReturnType<typeof convexTest>,
    overrides: {
      now?: number;
      expiresAt?: number;
      renderSpec?: string;
      claimed?: boolean;
    } = {},
  ) {
    const now = overrides.now ?? Date.UTC(2026, 7, 6);
    const ideaId = await seedIdea(t);
    const token = generateCapabilityToken();
    const tokenHash = await hashCapabilityToken(token);
    await t.run(async (ctx) => {
      const userId = overrides.claimed
        ? await ctx.db.insert("users", { email: "claimer@example.com" })
        : undefined;
      await ctx.db.insert("preview_capabilities", {
        tokenHash,
        sourceIdeaId: ideaId,
        templateId: "editorial",
        renderSpec: overrides.renderSpec ?? serializeSiteRenderSpec(validRenderSpec()),
        expiresAt: overrides.expiresAt ?? capabilityExpiresAt(now),
        createdAt: now,
        ...(userId ? { claimedByUserId: userId, claimedAt: now } : {}),
      });
    });
    return { token, now, ideaId };
  }

  test("a valid unexpired token resolves with its parsed render spec", async () => {
    const t = convexTest(schema, modules);
    const { token, now, ideaId } = await seedCapability(t);
    const resolved = await t.run(
      async (ctx) => await resolveCapability(ctx, token, now),
    );
    expect(resolved).not.toBeNull();
    expect(resolved?.sourceIdeaId).toBe(ideaId);
    expect(resolved?.templateId).toBe("editorial");
    expect(resolved?.renderSpec.siteInput.headline).toBe(validSiteInput().headline);
  });

  test("an unknown token resolves to null", async () => {
    const t = convexTest(schema, modules);
    const { now } = await seedCapability(t);
    const resolved = await t.run(
      async (ctx) => await resolveCapability(ctx, generateCapabilityToken(), now),
    );
    expect(resolved).toBeNull();
  });

  test("an expired token resolves to null identically to an unknown one", async () => {
    const t = convexTest(schema, modules);
    const now = Date.UTC(2026, 7, 6);
    const { token } = await seedCapability(t, { now, expiresAt: now - 1 });
    const expired = await t.run(
      async (ctx) => await resolveCapability(ctx, token, now),
    );
    const unknown = await t.run(
      async (ctx) => await resolveCapability(ctx, generateCapabilityToken(), now),
    );
    // Constant shape: the caller cannot distinguish "expired" from
    // "never existed", so valid tokens cannot be enumerated.
    expect(expired).toBeNull();
    expect(expired).toEqual(unknown);
  });

  test("a token one character off the real one resolves to null", async () => {
    const t = convexTest(schema, modules);
    const { token, now } = await seedCapability(t);
    const nearMiss = `${token.slice(0, 63)}${token[63] === "a" ? "b" : "a"}`;
    const resolved = await t.run(
      async (ctx) => await resolveCapability(ctx, nearMiss, now),
    );
    expect(resolved).toBeNull();
  });

  test("a malformed token resolves to null without touching the database", async () => {
    // Proves the claim rather than asserting it: a ctx whose db.query throws
    // on contact. If the shape check did not short-circuit first, these
    // would surface the explosion instead of null.
    const exploding = {
      db: {
        query: () => {
          throw new Error("database was read for a malformed token");
        },
      },
    } as never;
    for (const bad of ["", "../../etc/passwd", "z".repeat(64), null, 42, {}]) {
      await expect(
        resolveCapability(exploding, bad, Date.UTC(2026, 7, 6)),
      ).resolves.toBeNull();
    }
  });

  test("a non-finite now fails closed instead of reviving expired capabilities", async () => {
    const t = convexTest(schema, modules);
    const now = Date.UTC(2026, 7, 6);
    // Long expired: any correct clock rejects it.
    const { token } = await seedCapability(t, { now, expiresAt: now - 1 });
    for (const hostileNow of [Number.NaN, Number.POSITIVE_INFINITY]) {
      const resolved = await t.run(
        async (ctx) => await resolveCapability(ctx, token, hostileNow),
      );
      expect(resolved).toBeNull();
    }
    // And a live capability is not resurrected by a non-finite clock either.
    const live = await seedCapability(t, { now });
    const resolvedLive = await t.run(
      async (ctx) => await resolveCapability(ctx, live.token, Number.NaN),
    );
    expect(resolvedLive).toBeNull();
  });

  test("isCapabilityExpired treats every non-finite clock as expired", () => {
    const capability = { expiresAt: Date.UTC(2099, 0, 1) };
    expect(isCapabilityExpired(capability, Number.NaN)).toBe(true);
    expect(isCapabilityExpired(capability, Number.POSITIVE_INFINITY)).toBe(true);
    expect(isCapabilityExpired(capability, Number.NEGATIVE_INFINITY)).toBe(true);
  });

  test("the plaintext token is never persisted in any stored field", async () => {
    const t = convexTest(schema, modules);
    const { token } = await seedCapability(t);
    const rows = await t.run(
      async (ctx) => await ctx.db.query("preview_capabilities").collect(),
    );
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows[0])).not.toContain(token);
    expect(rows[0].tokenHash).toBe(await hashCapabilityToken(token));
  });

  test("a stored spec that no longer parses fails closed rather than rendering", async () => {
    const t = convexTest(schema, modules);
    const { token, now } = await seedCapability(t, {
      renderSpec: '{"contractVersion":1,"templateId":"editorial"}',
    });
    const resolved = await t.run(
      async (ctx) => await resolveCapability(ctx, token, now),
    );
    expect(resolved).toBeNull();
  });

  test("a claimed but unexpired capability still resolves and reports its claimer", async () => {
    const t = convexTest(schema, modules);
    const { token, now } = await seedCapability(t, { claimed: true });
    const resolved = await t.run(
      async (ctx) => await resolveCapability(ctx, token, now),
    );
    expect(resolved).not.toBeNull();
    expect(resolved?.claimedByUserId).toBeDefined();
  });
});
