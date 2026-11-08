/// <reference types="vite/client" />
/**
 * WP92. The unattended seed run: the pure gate (`decideSeedAutoRun`), the
 * read-only `crew/seeds:autoRunState` query in convex-test, and the workflow
 * file's guards. No test reaches the network or spends anything.
 */
import fs from "node:fs";
import path from "node:path";

import { convexTest, type TestConvex } from "convex-test";
import shardedCounterTest from "@convex-dev/sharded-counter/test";
import type { FunctionReference } from "convex/server";
import { afterEach, describe, expect, test, vi } from "vitest";

import { internal } from "@/convex/_generated/api";
import schema from "@/convex/schema";
import { createAnthropicBatchAdapter } from "@/convex/ai/providers/anthropic";
import { pollSeedRun, submitSeedRun, type SeedBatchCtx } from "@/convex/crew/seedsBatch";
import {
  bakeryManifestRow,
  bakeryPageMdx,
  hydrotrailManifestRow,
  hydrotrailPageMdx,
} from "@/lib/workspace/contracts/fixtures/seedSources";
import {
  decideSeedAutoRun,
  usdToMicroUsd,
  type SeedAutoRunLimits,
  type SeedAutoRunState,
  type SeedEstimateRow,
} from "@/lib/workspace/crew/seedAutoRun";
import { seedSourceFromPage, seedSourceToJson } from "@/lib/workspace/crew/seedSource";

const modules = import.meta.glob("/convex/**/*.ts");
const VERSION = "2026-11-08.1";

// ---------------------------------------------------------------------------
// The gate
// ---------------------------------------------------------------------------

const live: SeedAutoRunState = {
  openRun: false,
  providerLive: true,
  freePoolBudgetMicroUsd: 7_000_000,
  freePoolUsedMicroUsd: 1_000_000,
};
const limits: SeedAutoRunLimits = { applyEnabled: true, maxReserveMicroUsd: 2_500_000, keepFreePoolShare: 0.5 };
const fresh = (slug: string, reservedMicroUsd = 230_000): SeedEstimateRow => ({
  ideaSlug: slug, status: "new", reservedMicroUsd, validated: true,
});
const unchanged = (slug: string): SeedEstimateRow => ({ ideaSlug: slug, status: "unchanged" });

describe("WP92 decideSeedAutoRun", () => {
  test("sends only the changed pages when every guard passes", () => {
    const decision = decideSeedAutoRun([fresh("a"), unchanged("b"), fresh("c")], live, limits);
    expect(decision).toEqual({ action: "apply", send: ["a", "c"], worstCaseMicroUsd: 460_000 });
  });

  test("skips while a run at this version is open, even with changes", () => {
    expect(decideSeedAutoRun([fresh("a")], { ...live, openRun: true }, limits)).toEqual({ action: "skip_open_run" });
  });

  test("sends nothing when every seed is current or the source is invalid", () => {
    const rows: SeedEstimateRow[] = [unchanged("a"), { ideaSlug: "b", status: "invalid", reason: "bad" }];
    expect(decideSeedAutoRun(rows, live, limits)).toEqual({ action: "nothing_to_send" });
  });

  test("never sends outside live provider mode, so no fixture seed lands at the version", () => {
    expect(decideSeedAutoRun([fresh("a")], { ...live, providerLive: false }, limits)).toMatchObject({ action: "dry_run_not_live", wouldSend: 1 });
  });

  test("is a dry run while the owner's live-spend switch is off", () => {
    expect(decideSeedAutoRun([fresh("a")], live, { ...limits, applyEnabled: false })).toMatchObject({ action: "dry_run_apply_off", wouldSend: 1 });
  });

  test("refuses a run over the cap (a version bump or mass edit stays an operator run)", () => {
    const library = Array.from({ length: 231 }, (_, i) => fresh(`idea-${i}`));
    expect(decideSeedAutoRun(library, live, limits)).toMatchObject({ action: "refuse_over_cap", wouldSend: 231 });
    // Exactly at the cap is allowed.
    expect(decideSeedAutoRun([fresh("a", 2_500_000)], { ...live, freePoolUsedMicroUsd: 0, freePoolBudgetMicroUsd: 10_000_000 }, limits))
      .toMatchObject({ action: "apply" });
  });

  test("waits when the reservation would eat into the share of the free pool kept for founders", () => {
    // $7 pool, $3 used: $4 left, $3.50 must stay free, so at most $0.50 may be reserved.
    const busy = { ...live, freePoolUsedMicroUsd: 3_000_000 };
    expect(decideSeedAutoRun([fresh("a", 500_000)], busy, limits)).toMatchObject({ action: "apply" });
    expect(decideSeedAutoRun([fresh("a", 500_001)], busy, limits)).toMatchObject({ action: "wait_for_pool", headroomMicroUsd: 4_000_000 });
    // An overspent pool never reads as negative headroom.
    expect(decideSeedAutoRun([fresh("a")], { ...live, freePoolUsedMicroUsd: 9_000_000 }, limits)).toMatchObject({ action: "wait_for_pool", headroomMicroUsd: 0 });
    // A zero free pool (kill switch by budget) never sends.
    expect(decideSeedAutoRun([fresh("a")], { ...live, freePoolBudgetMicroUsd: 0, freePoolUsedMicroUsd: 0 }, { ...limits, keepFreePoolShare: 0 }))
      .toMatchObject({ action: "wait_for_pool" });
  });

  test("rejects limits that would disable the guard", () => {
    expect(() => decideSeedAutoRun([], live, { ...limits, maxReserveMicroUsd: 0 })).toThrow(RangeError);
    expect(() => decideSeedAutoRun([], live, { ...limits, keepFreePoolShare: 1.5 })).toThrow(RangeError);
    expect(() => decideSeedAutoRun([], live, { ...limits, keepFreePoolShare: Number.NaN })).toThrow(RangeError);
  });

  test("usdToMicroUsd reads dollar amounts exactly and refuses anything else", () => {
    expect(usdToMicroUsd("2.50")).toBe(2_500_000);
    expect(usdToMicroUsd("3")).toBe(3_000_000);
    expect(usdToMicroUsd("0.000001")).toBe(1);
    for (const bad of ["", "-1", "1e3", "2.5000001", "$2", "abc"]) expect(() => usdToMicroUsd(bad)).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// autoRunState in convex-test
// ---------------------------------------------------------------------------

type T = TestConvex<typeof schema>;

const hydrotrail = seedSourceFromPage({ mdx: hydrotrailPageMdx, manifest: hydrotrailManifestRow });
const bakery = seedSourceFromPage({ mdx: bakeryPageMdx, manifest: bakeryManifestRow });
const items = [
  { ideaSlug: hydrotrail.slug, sourceJson: seedSourceToJson(hydrotrail) },
  { ideaSlug: bakery.slug, sourceJson: seedSourceToJson(bakery) },
];

async function setup(globalBudgetMicroUsd = 7_000_000n): Promise<T> {
  const t = convexTest(schema, modules);
  shardedCounterTest.register(t);
  await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { email: "admin@example.test" });
    await ctx.db.insert("super_admins", { userId, role: "super_admin", boundAt: 1, boundVia: "deployment_bootstrap" });
    await ctx.db.insert("ops_settings", {
      ownerId: userId,
      singletonKey: "workspace",
      workspaceEnabled: true,
      cohortMode: "allowlist",
      freeSignupsOpen: false,
      globalDailyBudgetMicroUsd: globalBudgetMicroUsd,
      paidGlobalDailyBudgetMicroUsd: 3_000_000n,
      killSwitches: { ai: false, studioVideo: true, publish: true, email: true, social: true, ads: true },
      updatedAt: 1,
    });
  });
  return t;
}

function actionCtx(t: T): SeedBatchCtx {
  return {
    runQuery: (async (ref: FunctionReference<"query", "internal">, args: Record<string, unknown>) =>
      await t.query(ref, args)) as SeedBatchCtx["runQuery"],
    runMutation: (async (ref: FunctionReference<"mutation", "internal">, args: Record<string, unknown>) =>
      await t.mutation(ref, args)) as SeedBatchCtx["runMutation"],
    scheduler: { runAfter: async () => "scheduled" as never } as unknown as SeedBatchCtx["scheduler"],
  };
}

describe("WP92 crew/seeds:autoRunState", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("reports fixture mode, no open run and an untouched free pool on a fresh deployment", async () => {
    vi.stubEnv("AI_PROVIDER_MODE", "fixture");
    const t = await setup();
    expect(await t.query(internal.crew.seeds.autoRunState, { seedVersion: VERSION })).toEqual({
      openRun: false,
      providerLive: false,
      freePoolBudgetMicroUsd: 7_000_000,
      freePoolUsedMicroUsd: 0,
    });
  });

  test("live needs both the mode and a key; the key itself is never returned", async () => {
    vi.stubEnv("AI_PROVIDER_MODE", "live");
    vi.stubEnv("ANTHROPIC_API_KEY", "  ");
    const t = await setup();
    expect((await t.query(internal.crew.seeds.autoRunState, { seedVersion: VERSION })).providerLive).toBe(false);
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test-not-real");
    const state = await t.query(internal.crew.seeds.autoRunState, { seedVersion: VERSION });
    expect(state.providerLive).toBe(true);
    expect(JSON.stringify(state)).not.toContain("sk-test");
  });

  test("an open run at the version is reported, and its reservations count as used pool", async () => {
    vi.stubEnv("AI_PROVIDER_MODE", "fixture");
    const t = await setup();
    const runId = await t.mutation(internal.crew.seeds.createRun, { seedVersion: VERSION });
    expect((await t.query(internal.crew.seeds.autoRunState, { seedVersion: VERSION })).openRun).toBe(true);
    // Another version is not blocked by it.
    expect((await t.query(internal.crew.seeds.autoRunState, { seedVersion: "2026-11-09.1" })).openRun).toBe(false);

    await t.mutation(internal.crew.seeds.addItems, { runId, items });
    const ctx = actionCtx(t);
    const adapter = createAnthropicBatchAdapter({ env: { AI_PROVIDER_MODE: "fixture" } });
    await submitSeedRun(ctx, { runId }, { adapter });
    const inFlight = await t.query(internal.crew.seeds.autoRunState, { seedVersion: VERSION });
    expect(inFlight.openRun).toBe(true);
    expect(inFlight.freePoolUsedMicroUsd).toBeGreaterThan(0);

    await pollSeedRun(ctx, { runId }, { adapter });
    const done = await t.query(internal.crew.seeds.autoRunState, { seedVersion: VERSION });
    expect(done.openRun).toBe(false);

    // With the run closed, a re-run's estimate sees both pages as unchanged, so the gate sends nothing.
    const estimate = await t.query(internal.crew.seeds.estimateItems, { seedVersion: VERSION, items });
    expect(decideSeedAutoRun(estimate, { ...done, providerLive: true }, limits)).toEqual({ action: "nothing_to_send" });
  });

  test("an open run is still seen after many finished runs at the same long-lived version", async () => {
    vi.stubEnv("AI_PROVIDER_MODE", "fixture");
    const t = await setup();
    await t.run(async (ctx) => {
      const ownerId = (await ctx.db.query("users").first())!._id;
      for (let i = 0; i < 25; i += 1) {
        await ctx.db.insert("idea_seed_runs", {
          ownerId, seedVersion: VERSION, promptRef: "crew-idea-seed@1", status: i % 2 === 0 ? "collected" : "failed",
          itemCount: 1, submittedCount: 1, reservedMicroUsd: 0, polls: 1, createdAt: i,
        });
      }
    });
    expect((await t.query(internal.crew.seeds.autoRunState, { seedVersion: VERSION })).openRun).toBe(false);
    await t.mutation(internal.crew.seeds.createRun, { seedVersion: VERSION });
    expect((await t.query(internal.crew.seeds.autoRunState, { seedVersion: VERSION })).openRun).toBe(true);
    await expect(t.mutation(internal.crew.seeds.createRun, { seedVersion: VERSION })).rejects.toThrow(/still open/);
  });

  test("refuses a malformed seed version", async () => {
    const t = await setup();
    await expect(t.query(internal.crew.seeds.autoRunState, { seedVersion: "bad version!" })).rejects.toThrow(/seedVersion/);
  });
});

// ---------------------------------------------------------------------------
// The workflow's guards
// ---------------------------------------------------------------------------

describe("WP92 crew-seeds workflow", () => {
  const workflow = fs.readFileSync(path.join(process.cwd(), ".github/workflows/crew-seeds.yml"), "utf8");
  const script = fs.readFileSync(path.join(process.cwd(), "scripts/crew-seeds.mjs"), "utf8");

  test("passes --apply only when the owner's switch is exactly true", () => {
    expect(workflow).toMatch(/if \[ "\$AUTO_APPLY" = "true" \]; then APPLY_FLAG="--apply"; fi/);
    expect(workflow.match(/--apply/g)).toHaveLength(1);
    expect(workflow).toContain("--auto");
  });

  test("runs only after a successful Production deployment, daily, or by hand, one at a time", () => {
    expect(workflow).toContain("deployment_status:");
    expect(workflow).toContain("github.event.deployment_status.state == 'success'");
    expect(workflow).toContain("github.event.deployment.environment == 'Production'");
    expect(workflow).toMatch(/concurrency:\s*\n\s*group: crew-seeds\s*\n\s*cancel-in-progress: false/);
    expect(workflow).toContain("permissions:\n  contents: read");
  });

  test("skips cleanly until the deploy key and seed version are configured", () => {
    expect(workflow).toContain('if [ -z "$CONVEX_DEPLOY_KEY" ] || [ -z "$SEED_VERSION" ]');
    expect(workflow).toContain("secrets.CONVEX_PROD_DEPLOY_KEY");
  });

  test("the script never targets the retired deployment and prints only the key's deployment name", () => {
    expect(script).toContain('FORBIDDEN_DEPLOYMENT = "vibrant-jackal-308"');
    expect(script).toContain('.split("|")[0]');
  });
});
