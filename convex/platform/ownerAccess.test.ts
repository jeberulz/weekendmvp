import { register as registerRateLimiter } from "@convex-dev/rate-limiter/test";
import shardedCounterTest from "@convex-dev/sharded-counter/test";
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { describe, expect, test } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";
import { readGlobalBudget } from "../ai/budgets";
import { businessLimitFor } from "../workspace/business";
import { checkLimit } from "./limits";
import { readMembershipState } from "./membership/state";
import { requireWorkspaceFeature } from "./entitlements";
import { ownerAccess } from "./ownerAccess";
import { hydrotrailWizardAnswers } from "../../lib/workspace/contracts/fixtures/hydrotrail";

const modules = import.meta.glob("/convex/**/*.ts");
const setAccess = makeFunctionReference<"mutation", { email: string; enabled: boolean; bypassAiBudget: boolean }>(
  "platform/ownerAccess:set",
);

async function setup() {
  const t = convexTest(schema, modules);
  registerRateLimiter(t);
  shardedCounterTest.register(t);
  const ids = await t.run(async ctx => {
    const ownerId = await ctx.db.insert("users", { email: "owner@example.test", emailVerificationTime: 1 });
    const otherId = await ctx.db.insert("users", { email: "tester@example.test", emailVerificationTime: 1 });
    const sessionId = await ctx.db.insert("authSessions", { userId: ownerId, expirationTime: 9_999_999_999_999 });
    const bindingId = await ctx.db.insert("super_admins", {
      userId: ownerId, role: "super_admin", boundAt: 1, boundVia: "deployment_bootstrap",
    });
    const opsId = await ctx.db.insert("ops_settings", {
      ownerId, singletonKey: "workspace", workspaceEnabled: true, cohortMode: "open", freeSignupsOpen: false,
      globalDailyBudgetMicroUsd: 7_000_000n, paidGlobalDailyBudgetMicroUsd: 3_000_000n,
      killSwitches: { ai: false, studioVideo: true, publish: true, email: true, social: true, ads: true },
      updatedAt: 1,
    });
    return { ownerId, otherId, sessionId, bindingId, opsId };
  });
  const owner = t.withIdentity({ subject: `${ids.ownerId}|${ids.sessionId}`, issuer: "https://local.test" });
  const grant = () => t.mutation(setAccess, { email: "owner@example.test", enabled: true, bypassAiBudget: true });
  return { t, ids, owner, grant };
}

describe("platform owner commercial access", () => {
  test("requires an explicit grant as well as a verified active admin binding", async () => {
    const { t, ids, grant } = await setup();
    expect(await t.run(ctx => ownerAccess(ctx, ids.ownerId))).toEqual({ unlimited: false, bypassAiBudget: false });
    await expect(t.mutation(setAccess, { email: "tester@example.test", enabled: true, bypassAiBudget: true }))
      .rejects.toThrow("FORBIDDEN");
    await grant();
    expect(await t.run(ctx => ownerAccess(ctx, ids.ownerId))).toEqual({ unlimited: true, bypassAiBudget: true });
    await t.run(ctx => ctx.db.patch("users", ids.otherId, {
      platformOwnerAccess: { enabled: true, bypassAiBudget: true, updatedAt: 1 },
    }));
    expect(await t.run(ctx => ownerAccess(ctx, ids.otherId))).toEqual({ unlimited: false, bypassAiBudget: false });
    expect((await t.run(ctx => readMembershipState(ctx, ids.ownerId))).plan).toBe("builders_hub");
    expect((await t.run(ctx => readMembershipState(ctx, ids.otherId))).plan).toBe("free");
    await t.run(ctx => ctx.db.patch("super_admins", ids.bindingId, { revokedAt: 2 }));
    expect(await t.run(ctx => ownerAccess(ctx, ids.ownerId))).toEqual({ unlimited: false, bypassAiBudget: false });
  });

  test("grant and revoke replay once and keep audit history", async () => {
    const { t, ids, grant } = await setup();
    expect(await grant()).toMatchObject({ changed: true, enabled: true });
    expect(await grant()).toMatchObject({ changed: false });
    const revoke = { email: "owner@example.test", enabled: false, bypassAiBudget: false };
    expect(await t.mutation(setAccess, revoke)).toMatchObject({ changed: true, enabled: false });
    expect(await t.mutation(setAccess, revoke)).toMatchObject({ changed: false });
    expect(await t.run(ctx => ownerAccess(ctx, ids.ownerId))).toEqual({ unlimited: false, bypassAiBudget: false });
    const actions = await t.run(async ctx => (await ctx.db.query("audit_events").take(10)).map(r => r.action));
    expect(actions).toEqual(["owner_access.granted", "owner_access.revoked"]);
  });

  test("an owner grant without spending bypass still enforces the global daily budget", async () => {
    const { t, ids } = await setup();
    await t.mutation(setAccess, { email: "owner@example.test", enabled: true, bypassAiBudget: false });
    await t.run(ctx => ctx.db.patch("ops_settings", ids.opsId, { paidGlobalDailyBudgetMicroUsd: 1n }));
    await expect(t.mutation(internal.ai.metering.reserve, {
      ownerId: ids.ownerId, attemptKey: "chat:owner:limited:1", promptRef: "test@1",
      provider: "anthropic", model: "fixture", tier: "fast", feature: "ai", reservedMicroUsd: 10,
    })).rejects.toThrow("BUDGET_EXHAUSTED");
  });

  test("an exempt reservation settles to the original owner counter after revocation", async () => {
    const { t, ids, grant } = await setup();
    await grant();
    const reserved = await t.mutation(internal.ai.metering.reserve, {
      ownerId: ids.ownerId, attemptKey: "chat:owner:revoke:1", promptRef: "test@1",
      provider: "anthropic", model: "fixture", tier: "fast", feature: "ai", reservedMicroUsd: 100_000,
    });
    const usageId = reserved.usageId as Id<"ai_usage">;
    await t.mutation(internal.ai.metering.markSent, { usageId });
    await t.mutation(setAccess, { email: "owner@example.test", enabled: false, bypassAiBudget: false });
    await t.run(ctx => ctx.db.patch("ops_settings", ids.opsId, { workspaceEnabled: false }));
    await t.mutation(internal.ai.metering.settle, {
      usageId, inputTokens: 100, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: 50,
      costMicroUsd: 70_000, estimated: false, latencyMs: 1,
    });
    const day = new Date().toISOString().slice(0, 10);
    expect(await t.run(ctx => readGlobalBudget(ctx, "paid", day, true)))
      .toEqual({ spentTodayMicroUsd: 70_000, inFlightMicroUsd: 0 });
    expect(await t.run(ctx => readGlobalBudget(ctx, "paid", day)))
      .toEqual({ spentTodayMicroUsd: 0, inFlightMicroUsd: 0 });
  });

  test("creates five businesses through the normal entry point and revocation restores the cap", async () => {
    const { t, ids, owner, grant } = await setup();
    await grant();
    const first = await t.run(ctx => ctx.db.insert("ideas", {
      slug: "hydrotrail", title: "HydroTrail", description: "d", publishedAt: 1, category: "c",
      buildTime: "weekend", revenueGoal: "r", applicationCategory: "a", tools: [], audiences: [], bodyMode: "mdx",
    }));
    expect(first).toBeTruthy();
    const createdIds: Id<"projects">[] = [];
    for (let i = 0; i < 5; i++) {
      const sessionId = await t.run(ctx => ctx.db.insert("wizard_sessions", {
        ownerId: ids.ownerId, ideaSlug: "hydrotrail", step: "partner_name",
        answers: { ...hydrotrailWizardAnswers, name: { ...hydrotrailWizardAnswers.name, chosen: `Owner test ${i}` } },
        startedAt: 1, updatedAt: 1, completedAt: 2,
      }));
      const args = { sessionId };
      const created = await owner.mutation(api.workspace.business.createBusiness, args);
      createdIds.push(created.projectId);
      expect(created.created).toBe(true);
      expect((await owner.mutation(api.workspace.business.createBusiness, args)).projectId).toBe(created.projectId);
    }
    expect(await owner.query(api.workspace.access.myBusinesses, {})).toHaveLength(5);
    expect(await owner.query(api.workspace.access.getWorkspaceAccess, { projectId: createdIds[0] }))
      .toMatchObject({ allowed: true, project: { unlimited: true } });
    expect(await t.run(ctx => businessLimitFor(ctx, ids.ownerId))).toBeNull();
    await t.mutation(setAccess, { email: "owner@example.test", enabled: false, bypassAiBudget: false });
    expect(await t.run(ctx => businessLimitFor(ctx, ids.ownerId))).toMatchObject({ limit: 1 });
  });

  test("exempts owner product allowances while a tester remains rate and plan gated", async () => {
    const { t, ids, grant } = await setup();
    await grant();
    await t.run(async ctx => {
      for (let i = 0; i < 12; i++) await checkLimit(ctx, "wizardStart", ids.ownerId);
      await requireWorkspaceFeature(ctx, ids.ownerId, "studioLongVideo");
    });
    await expect(t.run(ctx => requireWorkspaceFeature(ctx, ids.otherId, "studioLongVideo"))).rejects.toThrow("UPGRADE_REQUIRED");
    await t.run(async ctx => {
      for (let i = 0; i < 3; i++) await checkLimit(ctx, "wizardStart", ids.otherId);
    });
    await expect(t.run(ctx => checkLimit(ctx, "wizardStart", ids.otherId))).rejects.toThrow();
  });

  test("reserves beyond zero global and owner budgets, accounts costs once, and honors the AI switch", async () => {
    const { t, ids, owner, grant } = await setup();
    await grant();
    await t.run(ctx => ctx.db.patch("ops_settings", ids.opsId, {
      globalDailyBudgetMicroUsd: 0n, paidGlobalDailyBudgetMicroUsd: 0n,
    }));
    const args = {
      ownerId: ids.ownerId, attemptKey: "chat:owner:budget:1", promptRef: "test@1",
      provider: "anthropic" as const, model: "fixture", tier: "fast" as const, feature: "ai" as const,
      reservedMicroUsd: 1_700_000,
    };
    const reserved = await t.mutation(internal.ai.metering.reserve, args);
    expect((await t.mutation(internal.ai.metering.reserve, args)).usageId).toBe(reserved.usageId);
    const usageId = reserved.usageId as Id<"ai_usage">;
    await t.mutation(internal.ai.metering.markSent, { usageId });
    const settlement = {
      usageId, inputTokens: 100, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: 50,
      costMicroUsd: 1_600_000, estimated: false, latencyMs: 1,
    };
    await t.mutation(internal.ai.metering.settle, settlement);
    await t.mutation(internal.ai.metering.settle, settlement);
    for (let i = 2; i <= 7; i++) {
      const next = await t.mutation(internal.ai.metering.reserve, { ...args, attemptKey: `chat:owner:budget:${i}` });
      const usageId = next.usageId as Id<"ai_usage">;
      await t.mutation(internal.ai.metering.markSent, { usageId });
      await t.mutation(internal.ai.metering.settle, { ...settlement, usageId });
    }
    const day = new Date().toISOString().slice(0, 10);
    expect(await t.run(ctx => readGlobalBudget(ctx, "paid", day)))
      .toEqual({ spentTodayMicroUsd: 0, inFlightMicroUsd: 0 });
    expect(await t.run(ctx => readGlobalBudget(ctx, "paid", day, true)))
      .toEqual({ spentTodayMicroUsd: 11_200_000, inFlightMicroUsd: 0 });
    expect(await owner.query(api.ops.spend.readDaily, { dayKey: day }))
      .toMatchObject({ uncappedOwner: { spentTodayMicroUsd: 11_200_000, inFlightMicroUsd: 0 } });
    await expect(t.mutation(internal.ai.metering.reserve, {
      ...args, ownerId: ids.otherId, attemptKey: "chat:tester:budget:1",
    })).rejects.toThrow("AI_DISABLED");
    await t.run(async ctx => {
      const ops = await ctx.db.get("ops_settings", ids.opsId);
      if (!ops) throw new Error("missing ops fixture");
      await ctx.db.patch("ops_settings", ids.opsId, { killSwitches: { ...ops.killSwitches, ai: true } });
    });
    await expect(t.mutation(internal.ai.metering.reserve, { ...args, attemptKey: "chat:owner:budget:8" }))
      .rejects.toThrow("AI_DISABLED");
  });

  test("task credit debits work at zero balance and replay once, but the tester must have credits", async () => {
    const { t, ids, owner, grant } = await setup();
    await grant();
    const makeTask = (ownerId: Id<"users">) => t.run(async ctx => {
      const projectId = await ctx.db.insert("projects", {
        ownerId, source: "own_idea", title: "Debit test", status: "draft",
        idempotencyKey: `owner-debit:${ownerId}`, createdAt: 1, updatedAt: 1,
      });
      const taskId = await ctx.db.insert("tasks", {
        ownerId, projectId, type: "research", title: "Debit", status: "queued",
        idempotencyKey: "debit", createdAt: 1, updatedAt: 1,
      });
      return { projectId, taskId, credits: 20n };
    });
    const own = await makeTask(ids.ownerId);
    const debit = await t.mutation(internal.platform.billing.ledger.debitTask, own);
    expect(debit.balance).toBe(0n);
    expect(await t.mutation(internal.platform.billing.ledger.debitTask, own)).toMatchObject({ duplicate: true, ledgerId: debit.ledgerId });
    const history = await t.run(ctx => ctx.db.query("credit_ledger").withIndex("by_ownerId_and_idempotencyKey",
      q => q.eq("ownerId", ids.ownerId)).take(10));
    expect(history.map(row => row.delta)).toEqual([20n, -20n]);
    const summary = await owner.query(api.platform.billing.queries.creditsSummary, { minuteTick: Math.floor(Date.now() / 60_000) });
    expect(summary).toMatchObject({ unlimited: true, paidActionsSuspended: false });
    expect(await owner.query(api.platform.billing.queries.summary, {}))
      .toMatchObject({ unlimited: true, paidActionsSuspended: false, balance: 0n });
    await expect(t.mutation(internal.platform.billing.ledger.debitTask, await makeTask(ids.otherId)))
      .rejects.toThrow("INSUFFICIENT_CREDITS");
    await t.run(ctx => ctx.db.patch("tasks", own.taskId, { status: "failed" }));
    const refundArgs = { taskId: own.taskId, projectId: own.projectId };
    expect(await t.mutation(internal.platform.billing.ledger.refundFailedTask, refundArgs)).toMatchObject({ balance: 0n });
    expect(await t.mutation(internal.platform.billing.ledger.refundFailedTask, refundArgs)).toMatchObject({ duplicate: true, balance: 0n });
  });
});
