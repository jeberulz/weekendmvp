/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "../../_generated/api";
import schema from "../../schema";
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

/**
 * WP27-S4. The read path behind `/preview/{token}`.
 *
 * Root-absolute, not relative: a relative glob resolves against this file's
 * directory and silently registers nothing, at which point every `t.action`
 * fails with "Could not find module" while a bare `.rejects.toThrow()` still
 * passes. Every rejection below names the error it expects for the same
 * reason.
 */
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

function validRenderSpec(templateId: PreviewTemplate = "editorial"): SiteRenderSpec {
  return {
    contractVersion: SITE_RENDER_SPEC_CONTRACT_VERSION,
    templateId,
    siteInput: validSiteInput(),
  };
}

async function seedCapability(
  t: ReturnType<typeof convexTest>,
  overrides: {
    expiresAt?: number;
    renderSpec?: string;
    templateId?: PreviewTemplate;
    claimed?: boolean;
  } = {},
) {
  const now = Date.now();
  const token = generateCapabilityToken();
  const tokenHash = await hashCapabilityToken(token);
  const templateId = overrides.templateId ?? "editorial";
  await t.run(async (ctx) => {
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
    const userId = overrides.claimed
      ? await ctx.db.insert("users", { email: "claimer@example.com" })
      : undefined;
    await ctx.db.insert("preview_capabilities", {
      tokenHash,
      sourceIdeaId: ideaId,
      templateId,
      renderSpec:
        overrides.renderSpec ?? serializeSiteRenderSpec(validRenderSpec(templateId)),
      // Live by default. `Date.now()` is the real clock the action reads, so
      // seeding relative to it is what makes these tests exercise the
      // server-sourced timestamp rather than a fixture one.
      expiresAt: overrides.expiresAt ?? capabilityExpiresAt(now),
      createdAt: now,
      ...(userId ? { claimedByUserId: userId, claimedAt: now } : {}),
    });
  });
  return { token, now };
}

describe("preview view action", () => {
  test("a live capability returns a spec that parses back to what was stored", async () => {
    const t = convexTest(schema, modules);
    const { token } = await seedCapability(t);

    const view = await t.action(api.platform.preview.read.view, { token });

    expect(view).not.toBeNull();
    expect(parseSiteRenderSpec(view!.renderSpec)).toEqual(validRenderSpec());
    expect(view!.claimed).toBe(false);
  });

  test("every template id survives the round trip", async () => {
    for (const templateId of PREVIEW_TEMPLATE_VALUES) {
      const t = convexTest(schema, modules);
      const { token } = await seedCapability(t, { templateId });
      const view = await t.action(api.platform.preview.read.view, { token });
      expect(parseSiteRenderSpec(view!.renderSpec).templateId).toBe(templateId);
    }
  });

  test("the plaintext token never appears in the returned view", async () => {
    const t = convexTest(schema, modules);
    const { token } = await seedCapability(t);
    const view = await t.action(api.platform.preview.read.view, { token });
    expect(JSON.stringify(view)).not.toContain(token);
  });

  test("a claimed but unexpired capability still renders and reports the claim", async () => {
    const t = convexTest(schema, modules);
    const { token } = await seedCapability(t, { claimed: true });
    const view = await t.action(api.platform.preview.read.view, { token });
    expect(view).not.toBeNull();
    expect(view!.claimed).toBe(true);
  });

  test("expired, unknown, malformed, and corrupt-spec are indistinguishable", async () => {
    const t = convexTest(schema, modules);
    const expired = await seedCapability(t, { expiresAt: Date.now() - 1 });
    const corrupt = await seedCapability(t, {
      // Parses as JSON and carries a known template, but omits `siteInput`,
      // so WP26-S1's parser rejects it.
      renderSpec: '{"contractVersion":1,"templateId":"editorial"}',
    });

    const results = await Promise.all([
      t.action(api.platform.preview.read.view, { token: expired.token }),
      t.action(api.platform.preview.read.view, {
        token: generateCapabilityToken(),
      }),
      t.action(api.platform.preview.read.view, { token: "not-a-token" }),
      t.action(api.platform.preview.read.view, { token: "" }),
      t.action(api.platform.preview.read.view, { token: corrupt.token }),
    ]);

    // Every failure mode is the same value, not merely falsy. This is the
    // property `/preview/{token}` depends on to render one page for all of
    // them; a distinct shape here would leak that a token once existed.
    for (const result of results) expect(result).toBeNull();
    expect(
      new Set(results.map((result) => JSON.stringify(result))).size,
    ).toBe(1);
  });

  test("a token one character off the real one returns the same null", async () => {
    const t = convexTest(schema, modules);
    const { token } = await seedCapability(t);
    const nearMiss = `${token.slice(0, 63)}${token[63] === "a" ? "b" : "a"}`;
    expect(
      await t.action(api.platform.preview.read.view, { token: nearMiss }),
    ).toBeNull();
  });

  test("the action refuses a caller-supplied clock", async () => {
    const t = convexTest(schema, modules);
    // Long expired: only a caller-chosen `now` could revive it.
    const { token } = await seedCapability(t, { expiresAt: Date.now() - 1 });

    await expect(
      // @ts-expect-error - `now` is not a declared argument. The directive
      // failing to error would itself be the regression: it would mean the
      // action had started accepting a caller-supplied clock.
      t.action(api.platform.preview.read.view, { token, now: 0 }),
    ).rejects.toThrow(/Unexpected field `now`/);

    // And the supported call still refuses the expired capability.
    expect(
      await t.action(api.platform.preview.read.view, { token }),
    ).toBeNull();
  });

  test("the internal query trusts its clock, which is why it is not public", async () => {
    const t = convexTest(schema, modules);
    const { token } = await seedCapability(t, { expiresAt: Date.now() - 1 });

    // Demonstrates the exact escalation the action exists to prevent: given
    // a chosen `now`, an expired capability resolves. Every other test here
    // shows the public surface refusing that argument, so this is what would
    // be reachable if `resolveForView` were ever exported as a `query`.
    const revived = await t.query(
      internal.platform.preview.read.resolveForView,
      { token, now: 0 },
    );
    expect(revived).not.toBeNull();

    // The `internal`-vs-`api` boundary itself is asserted statically in
    // `tests/security/wp27-preview-route.test.mjs`. It cannot be asserted
    // here: `convex-test` resolves a function by module path and ignores
    // visibility, so calling this through `api` also succeeds under test
    // even though the real deployment would refuse it. A runtime assertion
    // would pass whether or not the export was internal.
  });
});
