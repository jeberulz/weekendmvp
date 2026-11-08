/// <reference types="vite/client" />

import { register as registerRateLimiter } from "@convex-dev/rate-limiter/test";
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { BAKERY_SLUG, bakerySeedDraft, hydrotrailSeedDraft } from "../../lib/workspace/contracts/fixtures/seeds";
import { seedColumns, seedFromDraft } from "../../lib/workspace/contracts/seeds";

/**
 * WP90-S4: the wizard reads the newest platform seed. With none (or a row it
 * cannot read) it falls back to the fixtures, and `validated` always follows
 * the idea row's research level.
 */

const modules = import.meta.glob("/convex/**/*.ts");

type IdeaSpec = { slug: string; title: string; researchLevel?: string; auditPassed?: boolean };

async function setup(ideas: readonly IdeaSpec[]) {
  const t = convexTest(schema, modules);
  registerRateLimiter(t);
  const ids = await t.run(async (ctx) => {
    const adminId = await ctx.db.insert("users", { email: "admin@example.test" });
    const ownerId = await ctx.db.insert("users", { email: "owner@example.test" });
    const ownerSessionId = await ctx.db.insert("authSessions", { userId: ownerId, expirationTime: 9_999_999_999_999 });
    for (const idea of ideas) {
      await ctx.db.insert("ideas", {
        slug: idea.slug,
        title: idea.title,
        description: "d",
        publishedAt: 1,
        category: "c",
        buildTime: "weekend",
        revenueGoal: "r",
        applicationCategory: "a",
        tools: [],
        audiences: [],
        bodyMode: "mdx",
        ...(idea.researchLevel === undefined ? {} : { researchLevel: idea.researchLevel }),
        ...(idea.auditPassed === undefined ? {} : { provenance: { auditPassed: idea.auditPassed } }),
      });
    }
    await ctx.db.insert("ops_settings", {
      ownerId: adminId,
      singletonKey: "workspace",
      workspaceEnabled: true,
      cohortMode: "allowlist",
      freeSignupsOpen: false,
      globalDailyBudgetMicroUsd: 1_000_000n,
      paidGlobalDailyBudgetMicroUsd: 0n,
      killSwitches: { ai: false, studioVideo: true, publish: true, email: true, social: true, ads: true },
      updatedAt: 1,
    });
    await ctx.db.insert("workspace_cohort", { ownerId, addedBy: adminId, addedAt: 1 });
    return { adminId, ownerId, ownerSessionId };
  });
  const owner = t.withIdentity({ subject: `${ids.ownerId}|${ids.ownerSessionId}`, issuer: "https://local.test" });
  return { t, owner, ids };
}

type Harness = Awaited<ReturnType<typeof setup>>;

async function storeSeed(h: Harness, slug: string, columns: Record<string, unknown>, seedVersion = "2026-11-07.1") {
  await h.t.run(async (ctx) => {
    await ctx.db.insert("idea_crew_seeds", {
      ownerId: h.ids.adminId,
      ideaSlug: slug,
      seedVersion,
      blueprint: columns.blueprint,
      brandSeeds: columns.brandSeeds,
      landingSeeds: columns.landingSeeds,
      emailAngles: columns.emailAngles,
      socialAngles: columns.socialAngles,
      buildPackSeeds: columns.buildPackSeeds,
      ...(columns.wizardHints === undefined ? {} : { wizardHints: columns.wizardHints }),
      ...(columns.roleBriefs === undefined ? {} : { roleBriefs: columns.roleBriefs }),
      ...(typeof columns.validated === "boolean" ? { validated: columns.validated } : {}),
      promptRefs: ["crew-idea-seed@1"],
      createdAt: 1,
    });
  });
}

async function viewFor(h: Harness, slug: string) {
  const sessionId = await h.owner.mutation(api.workspace.wizard.startOrResume, { idea: { source: "library", ideaSlug: slug } });
  return await h.owner.query(api.workspace.wizard.getSession, { sessionId });
}

const bakeryColumns = () => seedColumns(seedFromDraft(bakerySeedDraft, { ideaSlug: BAKERY_SLUG, researchLevel: "deep" }));

describe("WP90-S4 wizard reads the seed", () => {
  test("a seeded idea takes its blueprint, defaults, reasons and crew from the stored seed", async () => {
    const h = await setup([{ slug: BAKERY_SLUG, title: "Neighbourhood bakery pre-orders", researchLevel: "deep" }]);
    await storeSeed(h, BAKERY_SLUG, bakeryColumns());
    const view = await viewFor(h, BAKERY_SLUG);

    expect(view.seedSource).toBe("idea_crew_seeds");
    expect(view.blueprint.pitch).toBe(bakerySeedDraft.blueprint.pitch);
    expect(view.blueprint.features).toEqual(bakerySeedDraft.blueprint.features);
    expect(view.blueprint.validated).toBe(true);
    // No device needs → a website, decided by the platform rule, not the model.
    expect(view.defaults.platform).toEqual({ kind: "web" });
    expect(view.defaults.commercialModel).toBe("one_time");
    expect(view.defaults.goal).toEqual({ kind: "first_sale", timeframe: "2w" });
    expect(view.defaults.name).toEqual({ chosen: "Loaf Ahead", alternatives: ["Counter Ready"] });
    expect(view.suggestedNames).toEqual(["Loaf Ahead", "Counter Ready"]);

    expect(view.hints.platform?.confident).toBe(true);
    expect(view.hints.platform?.reason).toMatch(/browser/);
    expect(view.hints.commercial_model).toEqual({ reason: bakerySeedDraft.wizardHints.commercialModel.reason, confident: true });
    expect(view.hints.goal?.reason).toBe(bakerySeedDraft.wizardHints.goal.reason);
    expect(view.hints.name?.confident).toBe(false);

    // A local business that sells goods hires Merch; a consumer buyer skips Outbound.
    expect(view.crew).not.toBeNull();
    expect(view.crew?.hired.map((entry) => entry.roleKey)).toContain("merch");
    expect(view.crew?.hired.find((entry) => entry.roleKey === "merch")?.reason).toBe("Sells goods in store");
    expect(view.crew?.skipped.map((entry) => entry.roleKey)).toContain("outbound");
    expect(view.crew?.hired.find((entry) => entry.roleKey === "lead")?.employeeName).toBe("Wren");
  });

  test("the crew preview follows the founder's answers (a paid push hires Ads)", async () => {
    const h = await setup([{ slug: BAKERY_SLUG, title: "Bakery", researchLevel: "deep" }]);
    await storeSeed(h, BAKERY_SLUG, bakeryColumns());
    const first = await viewFor(h, BAKERY_SLUG);
    expect(first.crew?.skipped.map((entry) => entry.roleKey)).toContain("ads");
    const sessionId = first.sessionId;
    const accept = async (step: "idea" | "blueprint" | "platform" | "commercial_model") => {
      const view = await h.owner.query(api.workspace.wizard.getSession, { sessionId });
      const key = { idea: "idea", blueprint: "blueprintDecision", platform: "platform", commercial_model: "commercialModel" }[step];
      const answer = (view.defaults as Record<string, unknown>)[key];
      await h.owner.mutation(api.workspace.wizard.saveStep, { sessionId, step, answer: answer as never });
    };
    await accept("idea");
    await accept("blueprint");
    await accept("platform");
    await accept("commercial_model");
    await h.owner.mutation(api.workspace.wizard.saveStep, {
      sessionId,
      step: "goal",
      answer: { kind: "first_sale", timeframe: "2w", paidPush: { dailyBudgetUsd: 10 } },
    });
    const after = await h.owner.query(api.workspace.wizard.getSession, { sessionId });
    expect(after.crew?.hired.map((entry) => entry.roleKey)).toContain("ads");
  });

  test("the newest seed version wins", async () => {
    const h = await setup([{ slug: BAKERY_SLUG, title: "Bakery", researchLevel: "deep" }]);
    await storeSeed(h, BAKERY_SLUG, bakeryColumns(), "2026-11-07.1");
    const newer = bakeryColumns();
    await storeSeed(h, BAKERY_SLUG, { ...newer, wizardHints: { ...newer.wizardHints, names: ["Warm Counter"] } }, "2026-11-07.10");
    const view = await viewFor(h, BAKERY_SLUG);
    expect(view.suggestedNames).toEqual(["Warm Counter"]);
  });

  test("a concept idea is not validated, with a seed or without one", async () => {
    const h = await setup([
      { slug: BAKERY_SLUG, title: "Bakery", researchLevel: "concept" },
      { slug: "plain-concept", title: "Plain concept", researchLevel: "concept" },
      { slug: "failed-audit", title: "Failed audit", researchLevel: "deep", auditPassed: false },
    ]);
    // A seed written while the idea was researched; the idea row now says concept.
    await storeSeed(h, BAKERY_SLUG, bakeryColumns());
    expect((await viewFor(h, BAKERY_SLUG)).blueprint.validated).toBe(false);

    const plain = await viewFor(h, "plain-concept");
    expect(plain.seedSource).toBe("fixture_generic");
    expect(plain.blueprint.validated).toBe(false);
    expect(plain.hints).toEqual({});
    expect(plain.crew).toBeNull();

    expect((await viewFor(h, "failed-audit")).blueprint.validated).toBe(false);

    // Three new starts a day per founder: a fresh harness for the legacy row.
    const legacy = await setup([{ slug: "legacy-researched", title: "Legacy researched" }]);
    expect((await viewFor(legacy, "legacy-researched")).blueprint.validated).toBe(true);
  });

  test("a pre-WP90 row, a malformed row or another idea's seed falls back to the fixtures", async () => {
    const h = await setup([
      { slug: BAKERY_SLUG, title: "Bakery", researchLevel: "deep" },
      { slug: "malformed", title: "Malformed", researchLevel: "deep" },
      { slug: "borrowed", title: "Borrowed", researchLevel: "deep" },
    ]);
    const legacy: Record<string, unknown> = { ...bakeryColumns() };
    delete legacy.wizardHints;
    delete legacy.roleBriefs;
    delete legacy.validated;
    await storeSeed(h, BAKERY_SLUG, legacy);
    await storeSeed(h, "malformed", { ...bakeryColumns(), wizardHints: { platform: "native" } });
    // The bakery's seed stored under another slug: its blueprint names the bakery.
    await storeSeed(h, "borrowed", bakeryColumns());

    for (const slug of [BAKERY_SLUG, "malformed", "borrowed"]) {
      const view = await viewFor(h, slug);
      expect(view.seedSource).toBe("fixture_generic");
      expect(view.defaults.platform).toEqual({ kind: "web" });
      expect(view.hints).toEqual({});
    }
  });

  test("a device need suggests a native app, with the need named", async () => {
    const h = await setup([{ slug: "hydrotrail", title: "HydroTrail", researchLevel: "deep" }]);
    await storeSeed(h, "hydrotrail", seedColumns(seedFromDraft(hydrotrailSeedDraft, { ideaSlug: "hydrotrail", researchLevel: "deep" })));
    const view = await viewFor(h, "hydrotrail");
    expect(view.seedSource).toBe("idea_crew_seeds");
    expect(view.defaults.platform).toEqual({ kind: "native" });
    expect(view.hints.platform?.reason).toMatch(/offline/i);
    // HydroTrail's commercial-model hint is low confidence: no quick confirm.
    expect(view.hints.commercial_model?.confident).toBe(false);
  });
});
