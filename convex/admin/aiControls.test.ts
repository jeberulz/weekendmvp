/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import shardedCounterTest from "@convex-dev/sharded-counter/test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";

const modules = import.meta.glob("/convex/**/*.ts");
const MINUTE = 60_000;
const START = Date.parse("2026-11-20T09:00:00Z");

function setup() {
  const t = convexTest(schema, modules);
  shardedCounterTest.register(t);
  return t;
}

type Mutator = Pick<ReturnType<typeof convexTest>, "mutation" | "query">;

async function seed(t: ReturnType<typeof setup>) {
  const ids = await t.run(async (ctx) => {
    const adminId = await ctx.db.insert("users", { email: "controls-admin@example.test", emailVerificationTime: 1 });
    const testerId = await ctx.db.insert("users", { email: "tester@example.test", emailVerificationTime: 1 });
    const unverifiedId = await ctx.db.insert("users", { email: "unverified@example.test" });
    const adminSessionId = await ctx.db.insert("authSessions", { userId: adminId, expirationTime: START + 30 * 24 * 60 * MINUTE });
    const testerSessionId = await ctx.db.insert("authSessions", { userId: testerId, expirationTime: START + 30 * 24 * 60 * MINUTE });
    await ctx.db.insert("super_admins", { userId: adminId, role: "super_admin", boundAt: 1, boundVia: "deployment_bootstrap" });
    await ctx.db.insert("ops_settings", {
      ownerId: adminId, singletonKey: "workspace", workspaceEnabled: true,
      cohortMode: "allowlist", freeSignupsOpen: false,
      globalDailyBudgetMicroUsd: 7_000_000n, paidGlobalDailyBudgetMicroUsd: 3_000_000n,
      killSwitches: { ai: false, studioVideo: true, publish: true, email: true, social: true, ads: true },
      updatedAt: START,
    });
    return { adminId, testerId, unverifiedId, adminSessionId, testerSessionId };
  });
  return {
    ...ids,
    admin: t.withIdentity({ subject: `${ids.adminId}|${ids.adminSessionId}`, issuer: "https://local.test" }),
    tester: t.withIdentity({ subject: `${ids.testerId}|${ids.testerSessionId}`, issuer: "https://local.test" }),
  };
}

/** A fresh sign-in: Convex Auth creates a new session for it. */
async function signInAgain(t: ReturnType<typeof setup>, userId: Id<"users">) {
  const sessionId = await t.run((ctx) => ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 30 * 24 * 60 * MINUTE }));
  return t.withIdentity({ subject: `${userId}|${sessionId}`, issuer: "https://local.test" });
}

async function version(admin: Mutator): Promise<number | null> {
  return (await admin.query(api.admin.aiControls.controlsState, {})).version;
}

async function auditActions(t: ReturnType<typeof setup>) {
  return await t.run(async (ctx) => (await ctx.db.query("audit_events").collect()).map((row) => ({ action: row.action, metadata: row.metadata })));
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(START);
});
afterEach(() => {
  vi.useRealTimers();
});

describe("WP93 Phase 2 ops controls", () => {
  test("every function refuses customers and anonymous callers", async () => {
    const t = setup();
    const { tester, testerId } = await seed(t);
    const calls = [
      (c: Mutator) => c.query(api.admin.aiControls.controlsState, {}),
      (c: Mutator) => c.query(api.admin.aiControls.findAccount, { email: "tester@example.test" }),
      (c: Mutator) => c.mutation(api.admin.aiControls.setCohort, { ownerId: testerId, allowed: true }),
      (c: Mutator) => c.mutation(api.admin.aiControls.updateSpendControls, { expectedVersion: START, freeBudgetMicroUsd: 1n }),
    ];
    for (const call of calls) {
      await expect(call(tester)).rejects.toThrow("FORBIDDEN");
      await expect(call(t)).rejects.toThrow("FORBIDDEN");
    }
    expect(await auditActions(t)).toEqual([]);
  });

  test("lowering a budget and turning AI off are one click, and audited", async () => {
    const t = setup();
    const { adminId } = await seed(t);
    vi.setSystemTime(START + 60 * MINUTE); // the sign-in is an hour old: no step-up needed for these
    const admin = t.withIdentity({ subject: `${adminId}|${(await t.run(async (ctx) => (await ctx.db.query("authSessions").first())!._id))}`, issuer: "https://local.test" });
    const result = await admin.mutation(api.admin.aiControls.updateSpendControls, {
      expectedVersion: START, freeBudgetMicroUsd: 5_000_000n, killSwitches: { ai: true },
    });
    expect(result.risky).toBe(false);
    const settings = await t.run(async (ctx) => (await ctx.db.query("ops_settings").unique())!);
    expect(settings.globalDailyBudgetMicroUsd).toBe(5_000_000n);
    expect(settings.paidGlobalDailyBudgetMicroUsd).toBe(3_000_000n);
    expect(settings.killSwitches.ai).toBe(true);
    const audit = await auditActions(t);
    expect(audit).toHaveLength(1);
    expect(audit[0].action).toBe("ops.settings.changed");
    expect(JSON.parse(audit[0].metadata ?? "{}")).toMatchObject({ via: "ai-console", risky: false, globalDailyBudgetMicroUsd: "5000000" });
  });

  test("a risky change needs a recent sign-in and the typed confirm", async () => {
    const t = setup();
    const { admin, adminId } = await seed(t);
    vi.setSystemTime(START + 11 * MINUTE);
    const turnOn = { expectedVersion: START, killSwitches: { publish: false } };
    await expect(admin.mutation(api.admin.aiControls.updateSpendControls, { ...turnOn, confirm: "confirm" })).rejects.toThrow("REAUTH_REQUIRED");
    const fresh = await signInAgain(t, adminId);
    await expect(fresh.mutation(api.admin.aiControls.updateSpendControls, turnOn)).rejects.toThrow("CONFIRM_REQUIRED");
    await expect(fresh.mutation(api.admin.aiControls.updateSpendControls, { ...turnOn, confirm: "yes" })).rejects.toThrow("CONFIRM_REQUIRED");
    expect(await auditActions(t)).toEqual([]);
    const done = await fresh.mutation(api.admin.aiControls.updateSpendControls, { ...turnOn, confirm: " Confirm " });
    expect(done.risky).toBe(true);
    const audit = await auditActions(t);
    expect(JSON.parse(audit[0].metadata ?? "{}")).toMatchObject({ risky: true, risks: "switch_on" });
  });

  test("a budget raise is risky above twice today's spend, not below it", async () => {
    const t = setup();
    const { adminId, admin } = await seed(t);
    // $1.90 of free-pool spend today, through the real meter.
    const reserved = await t.mutation(internal.ai.metering.reserve, {
      ownerId: undefined, attemptKey: "controls-spend", promptRef: "cost-test@1", provider: "anthropic",
      model: "claude-haiku-4-5", tier: "fast", feature: "ai", reservedMicroUsd: 2_000_000,
    });
    const usageId = reserved.usageId as Id<"ai_usage">;
    await t.mutation(internal.ai.metering.markSent, { usageId });
    await t.mutation(internal.ai.metering.settle, {
      usageId, inputTokens: 10, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: 10,
      costMicroUsd: 1_900_000, estimated: false, latencyMs: 1,
    });
    vi.setSystemTime(START + 30 * MINUTE);
    // A cut to $3, then a raise to $3.50 (under 2 × $1.90): both one click.
    let v = await version(admin);
    await admin.mutation(api.admin.aiControls.updateSpendControls, { expectedVersion: v, freeBudgetMicroUsd: 3_000_000n });
    v = await version(admin);
    const small = await admin.mutation(api.admin.aiControls.updateSpendControls, { expectedVersion: v, freeBudgetMicroUsd: 3_500_000n });
    expect(small.risky).toBe(false);
    v = await version(admin);
    await expect(admin.mutation(api.admin.aiControls.updateSpendControls, {
      expectedVersion: v, freeBudgetMicroUsd: 4_000_000n, confirm: "confirm",
    })).rejects.toThrow("REAUTH_REQUIRED");
    const fresh = await signInAgain(t, adminId);
    const big = await fresh.mutation(api.admin.aiControls.updateSpendControls, { expectedVersion: v, freeBudgetMicroUsd: 4_000_000n, confirm: "confirm" });
    expect(big.risky).toBe(true);
  });

  test("raising a budget from $0 is risky; the ceiling, stale forms and no-ops are refused", async () => {
    const t = setup();
    const { adminId, admin } = await seed(t);
    vi.setSystemTime(START + 30 * MINUTE);
    await admin.mutation(api.admin.aiControls.updateSpendControls, { expectedVersion: START, paidBudgetMicroUsd: 0n });
    const v = await version(admin);
    await expect(admin.mutation(api.admin.aiControls.updateSpendControls, { expectedVersion: v, paidBudgetMicroUsd: 1_000_000n, confirm: "confirm" }))
      .rejects.toThrow("REAUTH_REQUIRED");
    await expect(admin.mutation(api.admin.aiControls.updateSpendControls, { expectedVersion: START, paidBudgetMicroUsd: 1n }))
      .rejects.toThrow("STALE");
    await expect(admin.mutation(api.admin.aiControls.updateSpendControls, { expectedVersion: v, paidBudgetMicroUsd: 0n }))
      .rejects.toThrow("NO_CHANGE");
    const fresh = await signInAgain(t, adminId);
    await expect(fresh.mutation(api.admin.aiControls.updateSpendControls, { expectedVersion: v, freeBudgetMicroUsd: 100_000_001n, confirm: "confirm" }))
      .rejects.toThrow("BUDGET_TOO_HIGH");
    await expect(fresh.mutation(api.admin.aiControls.updateSpendControls, { expectedVersion: v, freeBudgetMicroUsd: -1n }))
      .rejects.toThrow("INVALID_BUDGET");
  });

  test("cohort: find by email, add verified accounts only, remove with a reason", async () => {
    const t = setup();
    const { admin, testerId, unverifiedId } = await seed(t);
    expect(await admin.query(api.admin.aiControls.findAccount, { email: "nope" })).toEqual({ status: "invalid" });
    expect(await admin.query(api.admin.aiControls.findAccount, { email: "nobody@example.test" })).toEqual({ status: "none" });
    const found = await admin.query(api.admin.aiControls.findAccount, { email: "  Tester@Example.test " });
    expect(found).toMatchObject({ status: "one", account: { ownerId: testerId, email: "tester@example.test", verified: true, inCohort: false } });

    await expect(admin.mutation(api.admin.aiControls.setCohort, { ownerId: unverifiedId, allowed: true })).rejects.toThrow("NOT_VERIFIED");
    expect(await admin.mutation(api.admin.aiControls.setCohort, { ownerId: testerId, allowed: true })).toEqual({ allowed: true, changed: true });
    expect(await admin.mutation(api.admin.aiControls.setCohort, { ownerId: testerId, allowed: true })).toEqual({ allowed: true, changed: false });
    const state = await admin.query(api.admin.aiControls.controlsState, {});
    expect(state.cohort).toEqual([expect.objectContaining({ ownerId: testerId, email: "tester@example.test", verified: true })]);

    await expect(admin.mutation(api.admin.aiControls.setCohort, { ownerId: testerId, allowed: false })).rejects.toThrow("REASON_REQUIRED");
    await expect(admin.mutation(api.admin.aiControls.setCohort, { ownerId: testerId, allowed: false, reason: "   " })).rejects.toThrow("REASON_REQUIRED");
    await admin.mutation(api.admin.aiControls.setCohort, { ownerId: testerId, allowed: false, reason: "Beta ended" });
    const audit = await auditActions(t);
    expect(audit.map((row) => row.action)).toEqual(["ops.cohort.added", "ops.cohort.removed"]);
    expect(JSON.parse(audit[1].metadata ?? "{}")).toEqual({ allowed: false, reason: "Beta ended" });
    const recent = (await admin.query(api.admin.aiControls.controlsState, {})).recent;
    expect(recent.map((row) => row.action)).toEqual(["ops.cohort.removed", "ops.cohort.added"]);
    // A removed member is still named on its audit row.
    expect(recent.map((row) => row.subjectEmail)).toEqual(["tester@example.test", "tester@example.test"]);
  });

  test("the old mutations keep their behaviour on the shared write paths", async () => {
    const t = setup();
    const { admin, testerId } = await seed(t);
    await admin.mutation(api.ops.settings.setCohortMember, { ownerId: testerId, allowed: true });
    const next = await admin.mutation(api.ops.settings.updateForAdmin, { globalDailyBudgetMicroUsd: 9_000_000n });
    expect(next.globalDailyBudgetMicroUsd).toBe(9_000_000n);
    expect(next.killSwitches.ai).toBe(false);
    const audit = await auditActions(t);
    expect(audit.map((row) => row.action)).toEqual(["ops.cohort.added", "ops.settings.changed"]);
    expect(JSON.parse(audit[0].metadata ?? "{}")).toEqual({ allowed: true });
  });
});
