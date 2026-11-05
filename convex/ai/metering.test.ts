/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import shardedCounterTest from "@convex-dev/sharded-counter/test";
import { describe, expect, test, vi } from "vitest";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";
import { readGlobalBudget } from "./budgets";

const modules = import.meta.glob("/convex/**/*.ts");

function meterTest() {
  const t = convexTest(schema, modules);
  shardedCounterTest.register(t);
  return t;
}

async function seedMeter(t: ReturnType<typeof convexTest>, options?: { freeBudget?: bigint; paidBudget?: bigint }) {
  return await t.run(async (ctx) => {
    const adminId = await ctx.db.insert("users", { email: "meter-admin@example.test" });
    const ownerId = await ctx.db.insert("users", { email: "meter-owner@example.test" });
    const opsId = await ctx.db.insert("ops_settings", {
      ownerId: adminId,
      singletonKey: "workspace",
      workspaceEnabled: true,
      cohortMode: "open",
      freeSignupsOpen: false,
      globalDailyBudgetMicroUsd: options?.freeBudget ?? 50_000_000n,
      paidGlobalDailyBudgetMicroUsd: options?.paidBudget ?? 50_000_000n,
      killSwitches: { ai: false, studioVideo: true, publish: true, email: true, social: true, ads: true },
      updatedAt: Date.now(),
    });
    return { adminId, ownerId, opsId };
  });
}

function reservation(ownerId: Id<"users">, attemptKey: string, reservedMicroUsd = 700_000) {
  return {
    ownerId,
    attemptKey,
    promptRef: "test@1",
    provider: "anthropic" as const,
    model: "fixture-haiku",
    tier: "fast" as const,
    feature: "ai" as const,
    reservedMicroUsd,
  };
}

function settlement(usageId: Id<"ai_usage">, costMicroUsd: number) {
  return {
    usageId, inputTokens: 100, cacheReadTokens: 0, cacheWriteTokens: 0,
    outputTokens: 50, costMicroUsd, estimated: false, latencyMs: 5,
  };
}

describe("WP70 C-METER", () => {
  test("reserve, markSent and settle account exactly once; attempt key dedupes", async () => {
    const t = meterTest();
    const { ownerId } = await seedMeter(t);
    const args = reservation(ownerId, "chat:one:1");
    const first = await t.mutation(internal.ai.metering.reserve, args);
    const repeat = await t.mutation(internal.ai.metering.reserve, args);
    expect(first.existing).toBe(false);
    expect(repeat).toEqual({ usageId: first.usageId, existing: true });
    const usageId = first.usageId as Id<"ai_usage">;
    expect((await t.mutation(internal.ai.metering.markSent, { usageId })).changed).toBe(true);
    expect((await t.mutation(internal.ai.metering.markSent, { usageId })).changed).toBe(false);
    expect(await t.mutation(internal.ai.metering.settle, settlement(usageId, 300_000)))
      .toMatchObject({ alreadyFinal: false, costMicroUsd: 300_000 });
    expect(await t.mutation(internal.ai.metering.settle, settlement(usageId, 300_000)))
      .toMatchObject({ alreadyFinal: true, lateAdjustmentMicroUsd: 0 });
    const dayKey = new Date().toISOString().slice(0, 10);
    expect(await t.run((ctx) => readGlobalBudget(ctx, "free", dayKey)))
      .toEqual({ spentTodayMicroUsd: 300_000, inFlightMicroUsd: 0 });
    const budget = await t.run(async (ctx) => await ctx.db.query("ai_budgets").unique());
    expect(budget).toMatchObject({ ownerId, reservedMicroUsd: 0n, daySpentMicroUsd: 300_000n });
  });

  test("parallel owner reservations cannot exceed the exact daily cap", async () => {
    const t = meterTest();
    const { ownerId } = await seedMeter(t);
    const results = await Promise.allSettled([
      t.mutation(internal.ai.metering.reserve, reservation(ownerId, "chat:parallel:1")),
      t.mutation(internal.ai.metering.reserve, reservation(ownerId, "chat:parallel:2")),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    const rows = await t.run(async (ctx) => await ctx.db.query("ai_usage").collect());
    expect(rows).toHaveLength(1);
  });

  test("parallel repeats of one attempt create one usage row", async () => {
    const t = meterTest();
    const { ownerId } = await seedMeter(t);
    const args = reservation(ownerId, "chat:dedupe:1", 100_000);
    const results = await Promise.all([
      t.mutation(internal.ai.metering.reserve, args),
      t.mutation(internal.ai.metering.reserve, args),
    ]);
    expect(results[0].usageId).toBe(results[1].usageId);
    expect(results.filter((result) => !result.existing)).toHaveLength(1);
    expect(await t.run(async (ctx) => await ctx.db.query("ai_usage").collect())).toHaveLength(1);
  });

  test("one attempt key cannot be reused by another owner or task", async () => {
    const t = meterTest();
    const { ownerId } = await seedMeter(t);
    const otherOwnerId = await t.run(async (ctx) => await ctx.db.insert("users", { email: "other-owner@example.test" }));
    const base = reservation(ownerId, "crew:collision:1", 100_000);
    await t.mutation(internal.ai.metering.reserve, base);
    await expect(t.mutation(internal.ai.metering.reserve, { ...base, ownerId: otherOwnerId }))
      .rejects.toThrow("attemptKey reused for a different call");

    const { projectId, taskAId, taskBId } = await t.run(async (ctx) => {
      const projectId = await ctx.db.insert("projects", {
        ownerId, source: "own_idea", title: "Collision project", status: "draft",
        idempotencyKey: "collision-project", createdAt: 1, updatedAt: 1,
      });
      const taskAId = await ctx.db.insert("tasks", {
        ownerId, projectId, type: "research", status: "queued", title: "A",
        idempotencyKey: "collision-a", createdAt: 1, updatedAt: 1,
      });
      const taskBId = await ctx.db.insert("tasks", {
        ownerId, projectId, type: "research", status: "queued", title: "B",
        idempotencyKey: "collision-b", createdAt: 1, updatedAt: 1,
      });
      return { projectId, taskAId, taskBId };
    });
    const taskArgs = { ...reservation(ownerId, "crew:task-collision:1", 100_000), projectId, taskId: taskAId };
    await t.mutation(internal.ai.metering.reserve, taskArgs);
    await expect(t.mutation(internal.ai.metering.reserve, { ...taskArgs, taskId: taskBId }))
      .rejects.toThrow("attemptKey reused for a different call");
    expect(await t.run(async (ctx) => await ctx.db.query("ai_usage").collect())).toHaveLength(2);
  });

  test("ownerless platform work uses the free pool and no owner budget", async () => {
    const t = meterTest();
    await seedMeter(t);
    const row = await t.mutation(internal.ai.metering.reserve, {
      attemptKey: "precompute:idea:1:prompt@1:1", promptRef: "prompt@1",
      provider: "anthropic", model: "fixture-opus", tier: "deep", feature: "ai",
      reservedMicroUsd: 100_000, batch: true,
    });
    expect(row.existing).toBe(false);
    expect(await t.run(async (ctx) => await ctx.db.query("ai_budgets").collect())).toHaveLength(0);
    expect(await t.run((ctx) => readGlobalBudget(ctx, "free", new Date().toISOString().slice(0, 10))))
      .toEqual({ spentTodayMicroUsd: 0, inFlightMicroUsd: 100_000 });
  });

  test("credit-funded work verifies its task debit and uses the paid pool", async () => {
    const t = meterTest();
    const { ownerId } = await seedMeter(t);
    const { projectId, taskId, debitId } = await t.run(async (ctx) => {
      const projectId = await ctx.db.insert("projects", {
        ownerId, source: "own_idea", title: "Meter project", status: "draft",
        idempotencyKey: "meter-project", createdAt: 1, updatedAt: 1,
      });
      const taskId = await ctx.db.insert("tasks", {
        ownerId, projectId, type: "research", status: "queued", title: "Meter task",
        idempotencyKey: "meter-task", createdAt: 1, updatedAt: 1,
      });
      const accountId = await ctx.db.insert("credit_accounts", {
        ownerId, balance: 0n, createdAt: 1, updatedAt: 1,
      });
      const debitId = await ctx.db.insert("credit_ledger", {
        ownerId, accountId, projectId, taskId, reason: "task_debit", delta: -1n,
        balanceAfter: 0n, idempotencyKey: `task-debit:${taskId}`, createdAt: 1,
      });
      return { projectId, taskId, debitId };
    });
    const row = await t.mutation(internal.ai.metering.reserve, {
      ...reservation(ownerId, "crew:meter:1", 100_000), projectId, taskId, creditDebitId: debitId,
    });
    const usage = await t.run(async (ctx) => await ctx.db.get("ai_usage", row.usageId as Id<"ai_usage">));
    expect(usage).toMatchObject({ creditFunded: true, globalPool: "paid", projectId, taskId });
    expect(await t.run((ctx) => readGlobalBudget(ctx, "paid", new Date().toISOString().slice(0, 10))))
      .toEqual({ spentTodayMicroUsd: 0, inFlightMicroUsd: 100_000 });
    await t.run(async (ctx) => await ctx.db.insert("credit_ledger", {
      ownerId, accountId: (await ctx.db.get("credit_ledger", debitId))!.accountId,
      projectId, taskId, reason: "task_refund", delta: 1n, balanceAfter: 1n,
      idempotencyKey: `task-refund:${debitId}`, createdAt: 2,
    }));
    await expect(t.mutation(internal.ai.metering.reserve, {
      ...reservation(ownerId, "crew:meter:2", 100_000), projectId, taskId, creditDebitId: debitId,
    })).rejects.toThrow("RESOURCE_NOT_FOUND");
    await t.run(async (ctx) => await ctx.db.patch("tasks", taskId, { status: "failed" }));
    await expect(t.mutation(internal.ai.metering.reserve, {
      ...reservation(ownerId, "crew:meter:3", 100_000), projectId, taskId,
    })).rejects.toThrow("RESOURCE_NOT_FOUND");
    await t.run(async (ctx) => await ctx.db.patch("credit_ledger", debitId, { reason: "plan_grant" }));
    await expect(t.mutation(internal.ai.metering.reserve, {
      ...reservation(ownerId, "crew:meter:2", 100_000), projectId, taskId, creditDebitId: debitId,
    })).rejects.toThrow("RESOURCE_NOT_FOUND");
  });

  test("day rollover releases the original global pool while owner day spend follows the budget row", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-05T23:59:00.000Z"));
    try {
      const t = meterTest();
      const { ownerId } = await seedMeter(t);
      const old = await t.mutation(internal.ai.metering.reserve, reservation(ownerId, "chat:old:1", 200_000));
      vi.setSystemTime(new Date("2026-11-06T00:01:00.000Z"));
      await t.mutation(internal.ai.metering.reserve, reservation(ownerId, "chat:new:1", 100_000));
      await t.mutation(internal.ai.metering.settle, settlement(old.usageId as Id<"ai_usage">, 150_000));
      expect(await t.run((ctx) => readGlobalBudget(ctx, "free", "2026-11-05")))
        .toEqual({ spentTodayMicroUsd: 150_000, inFlightMicroUsd: 0 });
      expect(await t.run((ctx) => readGlobalBudget(ctx, "free", "2026-11-06")))
        .toEqual({ spentTodayMicroUsd: 0, inFlightMicroUsd: 100_000 });
      const budget = await t.run(async (ctx) => await ctx.db.query("ai_budgets").unique());
      expect(budget).toMatchObject({ dayKey: "2026-11-06", daySpentMicroUsd: 0n, reservedMicroUsd: 100_000n });
      expect(budget?.freeLifetimeSpentMicroUsd).toBe(150_000n);
    } finally {
      vi.useRealTimers();
    }
  });

  test("possible billing charges the reservation; unsent failure charges zero", async () => {
    const t = meterTest();
    const { ownerId } = await seedMeter(t);
    const sent = await t.mutation(internal.ai.metering.reserve, reservation(ownerId, "chat:fail:1"));
    const sentId = sent.usageId as Id<"ai_usage">;
    await t.mutation(internal.ai.metering.markSent, { usageId: sentId });
    expect(await t.mutation(internal.ai.metering.fail, {
      usageId: sentId, billed: "possible", errorClass: "timeout", latencyMs: 10,
    })).toMatchObject({ costMicroUsd: 700_000, status: "failed" });
    const unsent = await t.mutation(internal.ai.metering.reserve, reservation(ownerId, "chat:fail:2", 200_000));
    expect(await t.mutation(internal.ai.metering.fail, {
      usageId: unsent.usageId as Id<"ai_usage">, billed: "none", errorClass: "permanent", latencyMs: 1,
    })).toMatchObject({ costMicroUsd: 0, status: "failed" });
    const budget = await t.run(async (ctx) => await ctx.db.query("ai_budgets").unique());
    expect(budget?.daySpentMicroUsd).toBe(700_000n);
  });

  test("shutdown stops new sends but cleanup sweeps and late-settles once", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-05T12:00:00.000Z"));
    try {
      const t = meterTest();
      const { ownerId, opsId } = await seedMeter(t);
      const sent = await t.mutation(internal.ai.metering.reserve, reservation(ownerId, "chat:sweep:1", 200_000));
      const unsent = await t.mutation(internal.ai.metering.reserve, reservation(ownerId, "chat:sweep:2", 100_000));
      const sentId = sent.usageId as Id<"ai_usage">;
      await t.mutation(internal.ai.metering.markSent, { usageId: sentId });
      await t.run(async (ctx) => await ctx.db.patch("ops_settings", opsId, { workspaceEnabled: false }));
      expect((await t.mutation(internal.ai.metering.markSent, { usageId: sentId })).changed).toBe(false);
      await expect(t.mutation(internal.ai.metering.markSent, { usageId: unsent.usageId as Id<"ai_usage"> }))
        .rejects.toThrow("AI_DISABLED");
      await expect(t.mutation(internal.ai.metering.reserve, reservation(ownerId, "chat:sweep:3")))
        .rejects.toThrow("AI_DISABLED");
      await expect(t.mutation(internal.ai.metering.reserve, reservation(ownerId, "chat:sweep:1", 200_000)))
        .rejects.toThrow("AI_DISABLED");
      vi.setSystemTime(new Date("2026-11-05T12:16:00.000Z"));
      expect(await t.mutation(internal.ai.metering.sweepStale, { limit: 1 })).toEqual({ swept: 1, hasMore: true });
      expect(await t.mutation(internal.ai.metering.sweepStale, { limit: 1 })).toEqual({ swept: 1, hasMore: false });
      const rows = await t.run(async (ctx) => await ctx.db.query("ai_usage").collect());
      expect(rows.find((row) => row._id === sentId)?.costMicroUsd).toBe(200_000n);
      expect(rows.find((row) => row._id === unsent.usageId)?.costMicroUsd).toBe(0n);
      expect(await t.mutation(internal.ai.metering.settle, settlement(sentId, 350_000)))
        .toMatchObject({ alreadyFinal: true, lateAdjustmentMicroUsd: 150_000 });
      expect(await t.mutation(internal.ai.metering.settle, settlement(sentId, 350_000)))
        .toMatchObject({ alreadyFinal: true, lateAdjustmentMicroUsd: 0 });
      expect(await t.run((ctx) => readGlobalBudget(ctx, "free", "2026-11-05")))
        .toEqual({ spentTodayMicroUsd: 350_000, inFlightMicroUsd: 0 });
    } finally {
      vi.useRealTimers();
    }
  });
});
