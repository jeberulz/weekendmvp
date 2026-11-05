/// <reference types="vite/client" />

import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import schema from "../../schema";
import { DEFAULT_OPS_SETTINGS } from "../../ops/settings";
import { WORKSPACE_PLAN_REFERENCE } from "../../../lib/workspace/contracts/jobs";
import { WORKSPACE_PLAN_LIMITS } from "../plans";
import { workspaceFeatureAllowed } from "../entitlements";

const modules = import.meta.glob("/convex/**/*.ts");
type Owner = { userId: Id<"users">; sessionId: Id<"authSessions">; projectId: Id<"projects"> };
const starterArgs = (owner: Owner) => ({ ownerId: owner.userId, projectId: owner.projectId });

async function ownerFixture(t: TestConvex<typeof schema>, label: string, workspaceOn = true): Promise<Owner> {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { email: `${label}@example.test` });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: 9_999_999_999_999 });
    const wizardSessionId = await ctx.db.insert("wizard_sessions", {
      ownerId: userId, step: "idea", answers: {}, startedAt: 1, updatedAt: 1,
    });
    const projectId = await ctx.db.insert("projects", {
      ownerId: userId,
      source: "own_idea",
      title: `${label} business`,
      status: "draft",
      idempotencyKey: `${label}-business`,
      workspace: {
        version: 1, name: `${label} business`, slug: label, ownIdeaText: "A useful product",
        platform: "web", commercialModel: "free", goal: "waitlist",
        partner: { personality: "strategist", name: "Wren" }, wizardSessionId, createdVia: "wizard",
      },
      createdAt: 1, updatedAt: 1,
    });
    const ops = await ctx.db.query("ops_settings")
      .withIndex("by_singletonKey", (q) => q.eq("singletonKey", "workspace")).unique();
    if (workspaceOn && !ops) await ctx.db.insert("ops_settings", {
      singletonKey: "workspace", ownerId: userId, ...DEFAULT_OPS_SETTINGS,
      workspaceEnabled: true, cohortMode: "open", updatedAt: 1,
    });
    return { userId, sessionId, projectId };
  });
}

function asOwner(t: TestConvex<typeof schema>, owner: Owner) {
  return t.withIdentity({
    subject: `${owner.userId}|${owner.sessionId}`,
    issuer: "https://local.test",
    tokenIdentifier: `https://local.test|${owner.userId}`,
  });
}

async function taskFixture(t: TestConvex<typeof schema>, owner: Owner, label: string) {
  return await t.run(async (ctx) => await ctx.db.insert("tasks", {
    ownerId: owner.userId, projectId: owner.projectId, type: "crew_brand_kit",
    status: "queued", title: label, idempotencyKey: `task-${label}`, createdAt: 2, updatedAt: 2,
  }));
}

async function accountState(t: TestConvex<typeof schema>, ownerId: Id<"users">) {
  return await t.run(async (ctx) => {
    const account = await ctx.db.query("credit_accounts")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", ownerId)).unique();
    const ledger = account ? await ctx.db.query("credit_ledger")
      .withIndex("by_accountId_and_createdAt", (q) => q.eq("accountId", account._id)).collect() : [];
    return { account, ledger };
  });
}

const period = (n: number) => ({ periodStart: Date.now() + n * 100_000, periodEnd: Date.now() + (n + 1) * 100_000 });

describe("WP73 ledger v2", () => {
  test("debits allowance first and refunds exactly the original bucket split", async () => {
    const t = convexTest(schema, modules);
    const owner = await ownerFixture(t, "split");
    await t.mutation(internal.platform.billing.grants.grantStarter, starterArgs(owner));
    await t.mutation(internal.platform.billing.grants.grantPaidInvoice, {
      ownerId: owner.userId, invoiceId: "in_split_1", plan: "builders_hub", ...period(1),
    });
    const taskId = await taskFixture(t, owner, "split");
    await t.mutation(internal.platform.billing.ledger.debitTask, { taskId, projectId: owner.projectId, credits: 510n });
    let state = await accountState(t, owner.userId);
    expect(state.account).toMatchObject({ balance: 40n, allowanceRemaining: 0n });
    expect(state.ledger.find((row) => row.reason === "task_debit")?.bucketSplit).toEqual({ allowance: 500n, bonus: 10n });
    await t.run(async (ctx) => await ctx.db.patch("tasks", taskId, { status: "failed" }));
    const args = { taskId, projectId: owner.projectId };
    const [first, replay] = await Promise.all([
      t.mutation(internal.platform.billing.ledger.refundFailedTask, args),
      t.mutation(internal.platform.billing.ledger.refundFailedTask, args),
    ]);
    expect([first.duplicate, replay.duplicate].sort()).toEqual([false, true]);
    state = await accountState(t, owner.userId);
    expect(state.account).toMatchObject({ balance: 550n, allowanceRemaining: 500n });
    expect(state.ledger.filter((row) => row.reason === "task_refund")).toHaveLength(1);
    expect(state.ledger.find((row) => row.reason === "task_refund")?.bucketSplit).toEqual({ allowance: 500n, bonus: 10n });
  });

  test("renewal and refund re-expire an old allowance atomically", async () => {
    const t = convexTest(schema, modules);
    const owner = await ownerFixture(t, "rollover");
    await t.mutation(internal.platform.billing.grants.grantPaidInvoice, {
      ownerId: owner.userId, invoiceId: "in_rollover_1", plan: "builders_hub", ...period(1),
    });
    const taskId = await taskFixture(t, owner, "old-period");
    await t.mutation(internal.platform.billing.ledger.debitTask, { taskId, projectId: owner.projectId, credits: 40n });
    await t.mutation(internal.platform.billing.grants.grantPaidInvoice, {
      ownerId: owner.userId, invoiceId: "in_rollover_2", plan: "builders_hub", ...period(2),
    });
    await t.run(async (ctx) => await ctx.db.patch("tasks", taskId, { status: "cancelled" }));
    const args = { taskId, projectId: owner.projectId };
    const first = await t.mutation(internal.platform.billing.ledger.refundFailedTask, args);
    const replay = await t.mutation(internal.platform.billing.ledger.refundFailedTask, args);
    expect(first.balance).toBe(500n);
    expect(replay.balance).toBe(first.balance);
    const { account, ledger } = await accountState(t, owner.userId);
    expect(account).toMatchObject({ balance: 500n, allowanceRemaining: 500n });
    expect(ledger.filter((row) => row.reason === "task_refund")).toHaveLength(1);
    expect(ledger.filter((row) => row.reason === "allowance_expiry")).toHaveLength(2);
    expect(ledger.find((row) => row.reason === "task_refund")?.bucketSplit).toEqual({ allowance: 40n, bonus: 0n });
    expect(ledger.reduce((sum, row) => sum + row.delta, 0n)).toBe(account?.balance);
  });

  test("a debit cannot consume allowance after its period ends before renewal", async () => {
    const t = convexTest(schema, modules);
    const owner = await ownerFixture(t, "expired-before-renewal");
    await t.mutation(internal.platform.billing.grants.grantStarter, starterArgs(owner));
    await t.mutation(internal.platform.billing.grants.grantPaidInvoice, {
      ownerId: owner.userId, invoiceId: "in_expired_1", plan: "builders_hub", ...period(1),
    });
    await t.run(async (ctx) => {
      const account = await ctx.db.query("credit_accounts")
        .withIndex("by_ownerId", (q) => q.eq("ownerId", owner.userId)).unique();
      if (!account) throw new Error("missing account fixture");
      await ctx.db.patch("credit_accounts", account._id, { allowancePeriodEnd: Date.now() - 1 });
    });
    const taskId = await taskFixture(t, owner, "expired-debit");
    await t.mutation(internal.platform.billing.ledger.debitTask, { taskId, projectId: owner.projectId, credits: 10n });
    const { account, ledger } = await accountState(t, owner.userId);
    expect(account).toMatchObject({ balance: 40n, allowanceRemaining: 0n });
    expect(ledger.find((row) => row.reason === "task_debit")?.bucketSplit).toEqual({ allowance: 0n, bonus: 10n });
    expect(ledger.filter((row) => row.reason === "allowance_expiry")).toHaveLength(1);
  });

  test("grant replays cannot expire the new allowance and conflicting prices fail", async () => {
    const t = convexTest(schema, modules);
    const owner = await ownerFixture(t, "grant-replay");
    expect((await t.mutation(internal.platform.billing.grants.grantStarter, starterArgs(owner))).duplicate).toBe(false);
    expect((await t.mutation(internal.platform.billing.grants.grantStarter, starterArgs(owner))).duplicate).toBe(true);
    const invoice = { ownerId: owner.userId, invoiceId: "in_replay_1", plan: "builders_hub" as const, ...period(1) };
    expect((await t.mutation(internal.platform.billing.grants.grantPaidInvoice, invoice)).duplicate).toBe(false);
    expect((await t.mutation(internal.platform.billing.grants.grantPaidInvoice, invoice)).duplicate).toBe(true);
    await expect(t.mutation(internal.platform.billing.grants.grantPaidInvoice, { ...invoice, plan: "growth" }))
      .rejects.toThrow("LEDGER_IDEMPOTENCY_CONFLICT");
    let state = await accountState(t, owner.userId);
    expect(state.account).toMatchObject({ balance: 550n, allowanceRemaining: 500n });
    expect(state.ledger).toHaveLength(2);
    await t.mutation(internal.platform.billing.grants.grantPaidInvoice, {
      ownerId: owner.userId, invoiceId: "in_replay_2", plan: "growth", ...period(2),
    });
    state = await accountState(t, owner.userId);
    expect(state.account).toMatchObject({ balance: 2050n, allowanceRemaining: 2000n });
    expect(state.ledger.map((row) => row.reason).sort()).toEqual([
      "allowance_expiry", "plan_grant", "plan_grant", "starter_grant",
    ]);
    // A delayed starter-grant retry remains idempotent after the member upgrades.
    await t.run(async (ctx) => await ctx.db.insert("plan_grants", {
      ownerId: owner.userId, kind: "comp", grantedAt: Date.now(),
    }));
    expect((await t.mutation(internal.platform.billing.grants.grantStarter, starterArgs(owner))).duplicate).toBe(true);
  });

  test("an invoice reference cannot grant credits to two owners", async () => {
    const t = convexTest(schema, modules);
    const first = await ownerFixture(t, "invoice-first");
    const second = await ownerFixture(t, "invoice-second");
    const invoice = { invoiceId: "in_shared_1", plan: "builders_hub" as const, ...period(1) };
    await t.mutation(internal.platform.billing.grants.grantPaidInvoice, { ownerId: first.userId, ...invoice });
    await expect(t.mutation(internal.platform.billing.grants.grantPaidInvoice, { ownerId: second.userId, ...invoice }))
      .rejects.toThrow("PROVIDER_EVENT_CONFLICT");
    expect((await accountState(t, second.userId)).account).toBeNull();
  });

  test("out-of-order or changed-period invoices never replace a newer allowance", async () => {
    const t = convexTest(schema, modules);
    const owner = await ownerFixture(t, "late-invoice");
    const newer = { ownerId: owner.userId, invoiceId: "in_newer_1", plan: "builders_hub" as const, ...period(2) };
    await t.mutation(internal.platform.billing.grants.grantPaidInvoice, newer);
    const before = await accountState(t, owner.userId);
    await expect(t.mutation(internal.platform.billing.grants.grantPaidInvoice, {
      ownerId: owner.userId, invoiceId: "in_older_1", plan: "builders_hub", ...period(1),
    })).rejects.toThrow("STALE_ALLOWANCE_PERIOD");
    await expect(t.mutation(internal.platform.billing.grants.grantPaidInvoice, {
      ...newer, invoiceId: "in_duplicate_period",
    })).rejects.toThrow("DUPLICATE_ALLOWANCE_PERIOD");
    await expect(t.mutation(internal.platform.billing.grants.grantPaidInvoice, {
      ...newer, invoiceId: "in_overlapping_upgrade", plan: "growth",
      periodStart: newer.periodStart + 1, periodEnd: newer.periodEnd + 100_000,
    })).rejects.toThrow("OVERLAPPING_ALLOWANCE_PERIOD");
    await expect(t.mutation(internal.platform.billing.grants.grantPaidInvoice, {
      ...newer, periodEnd: newer.periodEnd + 1,
    })).rejects.toThrow("LEDGER_IDEMPOTENCY_CONFLICT");
    expect((await t.mutation(internal.platform.billing.grants.grantPaidInvoice, newer)).duplicate).toBe(true);
    const after = await accountState(t, owner.userId);
    expect(after.account).toMatchObject({ balance: 500n, allowanceRemaining: 500n, allowancePeriodEnd: newer.periodEnd });
    expect(after.ledger).toHaveLength(before.ledger.length);
  });

  test("a disputed negative bonus does not block a real allowance grant", async () => {
    const t = convexTest(schema, modules);
    const owner = await ownerFixture(t, "disputed-grant");
    await t.run(async (ctx) => {
      const accountId = await ctx.db.insert("credit_accounts", {
        ownerId: owner.userId, balance: -600n, allowanceRemaining: 0n, createdAt: 1, updatedAt: 1,
      });
      await ctx.db.insert("credit_ledger", {
        ownerId: owner.userId, accountId, reason: "dispute", delta: -600n,
        balanceAfter: -600n, idempotencyKey: "fixture-dispute", createdAt: 1,
      });
    });
    await t.mutation(internal.platform.billing.grants.grantPaidInvoice, {
      ownerId: owner.userId, invoiceId: "in_disputed_1", plan: "builders_hub", ...period(1),
    });
    const first = await accountState(t, owner.userId);
    expect(first.account).toMatchObject({ balance: -100n, allowanceRemaining: 500n });
    await t.mutation(internal.platform.billing.grants.grantPaidInvoice, {
      ownerId: owner.userId, invoiceId: "in_disputed_2", plan: "builders_hub", ...period(2),
    });
    const second = await accountState(t, owner.userId);
    expect(second.account).toMatchObject({ balance: -100n, allowanceRemaining: 500n });
    expect(second.ledger.reduce((sum, row) => sum + row.delta, 0n)).toBe(second.account?.balance);
  });

  test("a verified recurring grant key renews once per period", async () => {
    const t = convexTest(schema, modules);
    const owner = await ownerFixture(t, "recurring");
    const grantId = "grant_comp_opaque_1";
    const args = { ownerId: owner.userId, grantId, plan: "builders_hub" as const, ...period(1) };
    expect((await t.mutation(internal.platform.billing.grants.grantRecurring, args)).duplicate).toBe(false);
    expect((await t.mutation(internal.platform.billing.grants.grantRecurring, args)).duplicate).toBe(true);
    expect((await accountState(t, owner.userId)).account).toMatchObject({ balance: 500n, allowanceRemaining: 500n });
    await expect(t.mutation(internal.platform.billing.grants.grantRecurring, { ...args, grantId: "bad key", ...period(2) }))
      .rejects.toThrow("INVALID_GRANT_ID");
    const stranger = await ownerFixture(t, "recurring-stranger");
    await expect(t.mutation(internal.platform.billing.grants.grantRecurring, { ...args, ownerId: stranger.userId }))
      .rejects.toThrow("PROVIDER_EVENT_CONFLICT");
  });

  test("cancelled tasks refund once; queued and successful tasks cannot refund", async () => {
    const t = convexTest(schema, modules);
    const owner = await ownerFixture(t, "cancel");
    await t.mutation(internal.platform.billing.grants.grantStarter, starterArgs(owner));
    const taskId = await taskFixture(t, owner, "cancelled");
    await t.mutation(internal.platform.billing.ledger.debitTask, { taskId, projectId: owner.projectId, credits: 11n });
    await expect(t.mutation(internal.platform.billing.ledger.refundFailedTask, { taskId, projectId: owner.projectId }))
      .rejects.toThrow("TASK_REFUND_NOT_ALLOWED");
    await t.run(async (ctx) => await ctx.db.patch("tasks", taskId, { status: "cancelled" }));
    await t.mutation(internal.platform.billing.ledger.refundFailedTask, { taskId, projectId: owner.projectId });
    await t.mutation(internal.platform.billing.ledger.refundFailedTask, { taskId, projectId: owner.projectId });
    const state = await accountState(t, owner.userId);
    expect(state.account?.balance).toBe(50n);
    expect(state.ledger.filter((row) => row.reason === "task_refund")).toHaveLength(1);
  });

  test("a cancelled task sent to the provider cannot refund, while a failed task can", async () => {
    const t = convexTest(schema, modules);
    const owner = await ownerFixture(t, "sent-cancel");
    await t.mutation(internal.platform.billing.grants.grantStarter, starterArgs(owner));
    const cancelledId = await taskFixture(t, owner, "sent-cancelled");
    const failedId = await taskFixture(t, owner, "sent-failed");
    for (const taskId of [cancelledId, failedId]) {
      await t.mutation(internal.platform.billing.ledger.debitTask, { taskId, projectId: owner.projectId, credits: 10n });
      await t.run(async (ctx) => await ctx.db.insert("ai_usage", {
        ownerId: owner.userId, projectId: owner.projectId, taskId,
        attemptKey: `sent-${taskId}`, promptRef: "fixture@1", provider: "fixture", model: "fixture",
        tier: "draft", feature: "ai", plan: "free", globalPool: "free", creditFunded: true,
        status: "reserved", reservedMicroUsd: 100n, costMicroUsd: 0n,
        inputTokens: 0n, cacheReadTokens: 0n, cacheWriteTokens: 0n, outputTokens: 0n,
        estimated: false, latencyMs: 0, createdAt: 1, dayKey: "2026-11-05",
        expiresAt: 9_999_999_999_999, sentAt: 2,
      }));
    }
    await t.run(async (ctx) => {
      await ctx.db.patch("tasks", cancelledId, { status: "cancelled" });
      await ctx.db.patch("tasks", failedId, { status: "failed" });
    });
    await expect(t.mutation(internal.platform.billing.ledger.refundFailedTask, {
      taskId: cancelledId, projectId: owner.projectId,
    })).rejects.toThrow("TASK_REFUND_NOT_ALLOWED");
    await t.mutation(internal.platform.billing.ledger.refundFailedTask, { taskId: failedId, projectId: owner.projectId });
    const state = await accountState(t, owner.userId);
    expect(state.account?.balance).toBe(40n);
    expect(state.ledger.filter((row) => row.reason === "task_refund")).toHaveLength(1);
  });

  test("workspace plan reference and features include dormant Growth without a checkout price", () => {
    expect(WORKSPACE_PLAN_LIMITS).toEqual(WORKSPACE_PLAN_REFERENCE);
    expect(WORKSPACE_PLAN_LIMITS.free.limits.monthlyCredits).toBe(0);
    expect(WORKSPACE_PLAN_LIMITS.builders_hub.limits.monthlyCredits).toBe(500);
    expect(WORKSPACE_PLAN_LIMITS.growth.limits.monthlyCredits).toBe(2000);
    expect(workspaceFeatureAllowed("free", "autopilot")).toBe(false);
    expect(workspaceFeatureAllowed("builders_hub", "autopilot")).toBe(true);
    expect(workspaceFeatureAllowed("growth", "hireSkippedRoles")).toBe(true);
  });

  test("all new grant entry points fail closed with the workspace switch off", async () => {
    const t = convexTest(schema, modules);
    const owner = await ownerFixture(t, "grant-disabled", false);
    await expect(t.mutation(internal.platform.billing.grants.grantStarter, starterArgs(owner)))
      .rejects.toThrow("WORKSPACE_DISABLED");
    await expect(t.mutation(internal.platform.billing.grants.grantPaidInvoice, {
      ownerId: owner.userId, invoiceId: "in_disabled_1", plan: "builders_hub", ...period(1),
    })).rejects.toThrow("WORKSPACE_DISABLED");
    await expect(t.mutation(internal.platform.billing.grants.grantRecurring, {
      ownerId: owner.userId, grantId: "grant_disabled_1", plan: "builders_hub", ...period(1),
    })).rejects.toThrow("WORKSPACE_DISABLED");
    expect((await accountState(t, owner.userId)).account).toBeNull();
  });

  test("creditsSummary fails closed and isolates owner balances", async () => {
    const t = convexTest(schema, modules);
    const owner = await ownerFixture(t, "summary-owner");
    const stranger = await ownerFixture(t, "summary-stranger");
    await t.mutation(internal.platform.billing.grants.grantStarter, starterArgs(owner));
    await t.run(async (ctx) => {
      const ops = await ctx.db.query("ops_settings")
        .withIndex("by_singletonKey", (q) => q.eq("singletonKey", "workspace")).unique();
      if (!ops) throw new Error("missing ops fixture");
      await ctx.db.patch("ops_settings", ops._id, { workspaceEnabled: false });
    });
    await expect(asOwner(t, owner).query(api.platform.billing.queries.creditsSummary, {}))
      .rejects.toThrow("WORKSPACE_DISABLED");
    await t.run(async (ctx) => {
      const ops = await ctx.db.query("ops_settings")
        .withIndex("by_singletonKey", (q) => q.eq("singletonKey", "workspace")).unique();
      if (!ops) throw new Error("missing ops fixture");
      await ctx.db.patch("ops_settings", ops._id, { workspaceEnabled: true });
    });
    const mine = await asOwner(t, owner).query(api.platform.billing.queries.creditsSummary, {});
    const theirs = await asOwner(t, stranger).query(api.platform.billing.queries.creditsSummary, {});
    expect(mine).toMatchObject({ balance: 50n, allowanceRemaining: 0n, bonusRemaining: 50n });
    expect(mine).toMatchObject({ spendableBalance: 50n, spendableAllowance: 0n });
    expect(theirs).toMatchObject({ balance: 0n, allowanceRemaining: 0n, bonusRemaining: 0n, spendableBalance: 0n });
  });

  test("creditsSummary distinguishes raw reconciliation balance from expired spendable credits", async () => {
    const t = convexTest(schema, modules);
    const owner = await ownerFixture(t, "summary-expiry");
    await t.mutation(internal.platform.billing.grants.grantStarter, starterArgs(owner));
    await t.mutation(internal.platform.billing.grants.grantPaidInvoice, {
      ownerId: owner.userId, invoiceId: "in_summary_expiry", plan: "builders_hub", ...period(1),
    });
    const before = await asOwner(t, owner).query(api.platform.billing.queries.creditsSummary, {});
    expect(before).toMatchObject({ balance: 550n, allowanceRemaining: 500n, spendableBalance: 550n, spendableAllowance: 500n });
    await t.run(async (ctx) => {
      const account = await ctx.db.query("credit_accounts")
        .withIndex("by_ownerId", (q) => q.eq("ownerId", owner.userId)).unique();
      if (!account) throw new Error("missing account fixture");
      await ctx.db.patch("credit_accounts", account._id, { allowancePeriodEnd: Date.now() - 1 });
    });
    const after = await asOwner(t, owner).query(api.platform.billing.queries.creditsSummary, {});
    expect(after).toMatchObject({ balance: 550n, allowanceRemaining: 500n, spendableBalance: 50n, spendableAllowance: 0n });
  });

  test("varied grant, debit, refund and expiry sequences preserve ledger and bucket conservation", async () => {
    const t = convexTest(schema, modules);
    const owner = await ownerFixture(t, "property");
    await t.mutation(internal.platform.billing.grants.grantStarter, starterArgs(owner));
    let seed = 0x73_2026;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; };
    for (let i = 0; i < 35; i += 1) {
      if (i % 7 === 0) {
        const invoice = { ownerId: owner.userId, invoiceId: `in_property_${i}`, plan: i % 14 === 0 ? "growth" as const : "builders_hub" as const, ...period(i + 1) };
        await t.mutation(internal.platform.billing.grants.grantPaidInvoice, invoice);
        await t.mutation(internal.platform.billing.grants.grantPaidInvoice, invoice);
      }
      const before = await accountState(t, owner.userId);
      const amount = BigInt(1 + random() % 80);
      if ((before.account?.balance ?? 0n) >= amount) {
        const taskId = await taskFixture(t, owner, `property-${i}`);
        const debitArgs = { taskId, projectId: owner.projectId, credits: amount };
        await t.mutation(internal.platform.billing.ledger.debitTask, debitArgs);
        await t.mutation(internal.platform.billing.ledger.debitTask, debitArgs);
        if (random() % 3 !== 0) {
          await t.run(async (ctx) => await ctx.db.patch("tasks", taskId, { status: i % 2 === 0 ? "failed" : "cancelled" }));
          const refundArgs = { taskId, projectId: owner.projectId };
          await t.mutation(internal.platform.billing.ledger.refundFailedTask, refundArgs);
          await t.mutation(internal.platform.billing.ledger.refundFailedTask, refundArgs);
        }
      }
      const { account, ledger } = await accountState(t, owner.userId);
      expect(account).not.toBeNull();
      expect(ledger.reduce((sum, row) => sum + row.delta, 0n)).toBe(account?.balance);
      expect(account?.allowanceRemaining ?? 0n).toBeGreaterThanOrEqual(0n);
      expect((account?.balance ?? 0n) - (account?.allowanceRemaining ?? 0n)).toBeGreaterThanOrEqual(0n);
      for (const row of ledger) {
        if (row.bucketSplit) {
          expect(row.bucketSplit.allowance + row.bucketSplit.bonus).toBe(row.delta < 0n ? -row.delta : row.delta);
        }
      }
    }
  });
});
