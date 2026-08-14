/// <reference types="vite/client" />

import { register as registerRateLimiter } from "@convex-dev/rate-limiter/test";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { api } from "../../_generated/api";
import schema from "../../schema";
import { resolveCapability } from "./capabilities";

// Root-absolute, matching `convex/platform/billing/billing.test.ts`. A
// relative glob from this depth produces module keys convex-test cannot
// resolve back to function paths, so `t.mutation` fails with "Could not find
// module" — which `.rejects.toThrow()` would happily swallow as a pass.
const modules = import.meta.glob("/convex/**/*.ts");

/**
 * The rate limiter is a Convex component, so its functions live in their own
 * namespace that `convexTest` cannot resolve from the app's module glob
 * alone. The package ships its own `register` helper for this; using it
 * means the quota assertions below exercise the real component rather than a
 * stub, which is the whole point of testing the refund behaviour.
 */
function testConvex() {
  const t = convexTest(schema, modules);
  registerRateLimiter(t);
  return t;
}

const SECRET = "a-secure-test-only-preview-bridge-secret-123456";

async function sign(payload: object, secret = SECRET) {
  const serialized = JSON.stringify(payload);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(serialized),
  );
  const signature = btoa(String.fromCharCode(...new Uint8Array(mac)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return { payload: serialized, signature };
}

function validCustomisation() {
  return {
    headline: "Ship fewer bugs, write zero tests by hand",
    subheadline: "Turn your product spec into regression tests.",
    problemStatement:
      "QA engineers spend around 40% of their week writing repetitive tests.",
    keyBenefits: ["Generates tests from plain-English specs"],
    callToAction: "Get early access",
  };
}

function bridgeBody(overrides: Record<string, unknown> = {}) {
  return {
    slug: "ai-qa-test-case-generator",
    templateId: "editorial",
    clientKey: "ip:203.0.113.7",
    customisation: validCustomisation(),
    ...overrides,
  };
}

async function seedIdea(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) =>
    ctx.db.insert("ideas", {
      slug: "ai-qa-test-case-generator",
      title: "AI QA Test Case Generator",
      description: "Teams rewrite the same regression tests every release.",
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

describe("anonymous preview generation", () => {
  beforeEach(() => {
    process.env.PLATFORM_PREVIEW_BRIDGE_SECRET = SECRET;
  });
  afterEach(() => {
    delete process.env.PLATFORM_PREVIEW_BRIDGE_SECRET;
  });

  test("a correctly signed request creates exactly one capability", async () => {
    const t = testConvex();
    const ideaId = await seedIdea(t);

    const { token } = await t.mutation(
      api.platform.preview.generate.generateFromBridge,
      await sign(bridgeBody()),
    );
    expect(token).toMatch(/^[0-9a-f]{64}$/);

    const rows = await t.run(
      async (ctx) => await ctx.db.query("preview_capabilities").collect(),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].sourceIdeaId).toBe(ideaId);
    // Plaintext token is never stored.
    expect(JSON.stringify(rows[0])).not.toContain(token);

    // And the issued token actually resolves through the S1 reader.
    const resolved = await t.run(
      async (ctx) => await resolveCapability(ctx, token, Date.now()),
    );
    expect(resolved?.templateId).toBe("editorial");
  });

  test("a forged signature is rejected and writes nothing", async () => {
    const t = testConvex();
    await seedIdea(t);
    const signed = await sign(bridgeBody(), "an-attacker-guess-of-the-secret-xxxxx");

    await expect(
      t.mutation(api.platform.preview.generate.generateFromBridge, signed),
    ).rejects.toThrow(/INVALID_PREVIEW_BRIDGE_SIGNATURE/);

    const rows = await t.run(
      async (ctx) => await ctx.db.query("preview_capabilities").collect(),
    );
    expect(rows).toHaveLength(0);
  });

  test("a tampered payload no longer matches its signature", async () => {
    const t = testConvex();
    await seedIdea(t);
    const signed = await sign(bridgeBody());
    // Swapping the rate-limit bucket after signing must invalidate the call.
    const tampered = {
      payload: signed.payload.replace("ip:203.0.113.7", "ip:198.51.100.9"),
      signature: signed.signature,
    };
    await expect(
      t.mutation(api.platform.preview.generate.generateFromBridge, tampered),
    ).rejects.toThrow(/INVALID_PREVIEW_BRIDGE_SIGNATURE/);
  });

  test("an unset bridge secret fails closed rather than skipping verification", async () => {
    delete process.env.PLATFORM_PREVIEW_BRIDGE_SECRET;
    const t = testConvex();
    await seedIdea(t);
    await expect(
      t.mutation(
        api.platform.preview.generate.generateFromBridge,
        await sign(bridgeBody()),
      ),
    ).rejects.toThrow(/PREVIEW_BRIDGE_NOT_CONFIGURED/);
  });

  test("an unknown slug is rejected and writes nothing", async () => {
    const t = testConvex();
    await seedIdea(t);
    await expect(
      t.mutation(
        api.platform.preview.generate.generateFromBridge,
        await sign(bridgeBody({ slug: "no-such-idea" })),
      ),
    ).rejects.toThrow(/IDEA_NOT_FOUND/);
    const rows = await t.run(
      async (ctx) => await ctx.db.query("preview_capabilities").collect(),
    );
    expect(rows).toHaveLength(0);
  });

  test("an unknown template is rejected before the idea lookup", async () => {
    const t = testConvex();
    await seedIdea(t);
    await expect(
      t.mutation(
        api.platform.preview.generate.generateFromBridge,
        await sign(bridgeBody({ templateId: "../../etc/passwd" })),
      ),
    ).rejects.toThrow(/UNKNOWN_PREVIEW_TEMPLATE/);
  });

  test("out-of-bounds customisation is rejected and writes nothing", async () => {
    const t = testConvex();
    await seedIdea(t);
    await expect(
      t.mutation(
        api.platform.preview.generate.generateFromBridge,
        await sign(
          bridgeBody({
            customisation: { ...validCustomisation(), headline: "x" },
          }),
        ),
      ),
    ).rejects.toThrow(/INVALID_PREVIEW_FIELD/);
    const rows = await t.run(
      async (ctx) => await ctx.db.query("preview_capabilities").collect(),
    );
    expect(rows).toHaveLength(0);
  });

  test("an oversized bridge payload is rejected before parsing", async () => {
    const t = testConvex();
    await seedIdea(t);
    await expect(
      t.mutation(
        api.platform.preview.generate.generateFromBridge,
        await sign(bridgeBody({ padding: "x".repeat(9_000) })),
      ),
    ).rejects.toThrow(/INVALID_PREVIEW_BRIDGE_PAYLOAD/);
  });

  test("quota is consumed in its own mutation so failures cannot refund it", async () => {
    const t = testConvex();
    await seedIdea(t);
    const signed = await sign(bridgeBody());

    // Separating the two calls is the whole point: Convex mutations are
    // transactional, so a limit consumed inside a mutation that later throws
    // is rolled back with it, making every failed request free.
    await expect(
      t.mutation(api.platform.preview.generate.consumeGenerationQuota, signed),
    ).resolves.toEqual({ ok: true });

    // The burst limit is 5/minute; the sixth consumption must be refused
    // even though no generation ever succeeded.
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await t.mutation(api.platform.preview.generate.consumeGenerationQuota, signed);
    }
    // Assert RateLimited specifically — a bare `.rejects.toThrow()` also
    // passes on a module-resolution failure, the trap that made the earlier
    // harness look green while still broken.
    await expect(
      t.mutation(api.platform.preview.generate.consumeGenerationQuota, signed),
    ).rejects.toMatchObject({ data: { kind: "RateLimited" } });
  });

  test("a failed generation does not refund the quota it consumed", async () => {
    // The regression test for the review's HIGH finding. Convex mutations
    // are transactional and the limiter stores counters in the same
    // database, so a limit consumed *inside* the generation mutation is
    // rolled back when that mutation throws. That made every failing
    // request free: unknown slugs could be probed, and invalid input
    // retried, without ever consuming quota.
    const t = testConvex();
    await seedIdea(t);
    const good = await sign(bridgeBody());
    const bad = await sign(bridgeBody({ slug: "no-such-idea" }));

    // Burn four of the five burst tokens on requests whose generation step
    // fails, exactly as a prober would.
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await t.mutation(api.platform.preview.generate.consumeGenerationQuota, bad);
      await expect(
        t.mutation(api.platform.preview.generate.generateFromBridge, bad),
      ).rejects.toThrow(/IDEA_NOT_FOUND/);
    }

    // The fifth succeeds, proving four tokens really were spent...
    await t.mutation(api.platform.preview.generate.consumeGenerationQuota, good);
    // ...and the sixth is refused. Under the old design all four failures
    // would have refunded, leaving quota untouched and this call passing.
    await expect(
      t.mutation(api.platform.preview.generate.consumeGenerationQuota, good),
    ).rejects.toMatchObject({ data: { kind: "RateLimited" } });
  });

  test("quota is keyed per client, so one caller cannot exhaust another", async () => {
    const t = testConvex();
    await seedIdea(t);
    const noisy = await sign(bridgeBody({ clientKey: "ip:203.0.113.7" }));
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await t.mutation(api.platform.preview.generate.consumeGenerationQuota, noisy);
    }
    await expect(
      t.mutation(api.platform.preview.generate.consumeGenerationQuota, noisy),
    ).rejects.toMatchObject({ data: { kind: "RateLimited" } });

    const other = await sign(bridgeBody({ clientKey: "ip:198.51.100.4" }));
    await expect(
      t.mutation(api.platform.preview.generate.consumeGenerationQuota, other),
    ).resolves.toEqual({ ok: true });
  });
});
