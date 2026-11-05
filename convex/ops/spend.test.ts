/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import shardedCounterTest from "@convex-dev/sharded-counter/test";
import { describe, expect, test } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { addGlobalReservation } from "../ai/budgets";
import schema from "../schema";

const modules = import.meta.glob("/convex/**/*.ts");

function setup() {
  const t = convexTest(schema, modules);
  shardedCounterTest.register(t);
  return t;
}

describe("WP70 spend alarms and console", () => {
  test("spend after shutdown raises the remaining alarms once", async () => {
    const t = setup();
    const adminId = await t.run(async (ctx) => {
      const adminId = await ctx.db.insert("users", { email: "admin@example.test" });
      await ctx.db.insert("ops_settings", {
        ownerId: adminId, singletonKey: "workspace", workspaceEnabled: true,
        cohortMode: "open", freeSignupsOpen: false,
        globalDailyBudgetMicroUsd: 1_000_000n, paidGlobalDailyBudgetMicroUsd: 0n,
        killSwitches: { ai: false, studioVideo: true, publish: true, email: true, social: true, ads: true },
        updatedAt: Date.now(),
      });
      return adminId;
    });
    const sent = await t.mutation(internal.ai.metering.reserve, {
      attemptKey: "alarm:one", promptRef: "alarm@1", provider: "anthropic", model: "fixture",
      tier: "fast", feature: "ai", reservedMicroUsd: 800_000,
    });
    await t.mutation(internal.ai.metering.markSent, { usageId: sent.usageId as Id<"ai_usage"> });
    expect((await t.mutation(internal.ops.spend.checkDailyAlarms, {})).raised).toEqual(["free80"]);
    expect((await t.mutation(internal.ops.spend.checkDailyAlarms, {})).raised).toEqual([]);
    const unsent = await t.mutation(internal.ai.metering.reserve, {
      attemptKey: "alarm:two", promptRef: "alarm@1", provider: "anthropic", model: "fixture",
      tier: "fast", feature: "ai", reservedMicroUsd: 100_000,
    });
    await t.run(async (ctx) => {
      const row = await ctx.db.query("ops_settings").unique();
      if (row) await ctx.db.patch("ops_settings", row._id, { workspaceEnabled: false });
    });
    await expect(t.mutation(internal.ai.metering.markSent, { usageId: unsent.usageId as Id<"ai_usage"> }))
      .rejects.toThrow("WORKSPACE_DISABLED");
    await expect(t.mutation(internal.ai.metering.reserve, {
      attemptKey: "alarm:third", promptRef: "alarm@1", provider: "anthropic", model: "fixture",
      tier: "fast", feature: "ai", reservedMicroUsd: 1,
    })).rejects.toThrow("WORKSPACE_DISABLED");
    await t.mutation(internal.ai.metering.settle, {
      usageId: sent.usageId as Id<"ai_usage">, inputTokens: 10, cacheReadTokens: 0,
      cacheWriteTokens: 0, outputTokens: 10, costMicroUsd: 1_000_000,
      estimated: false, latencyMs: 5,
    });
    expect((await t.mutation(internal.ops.spend.checkDailyAlarms, {})).raised).toEqual(["free100"]);
    await t.mutation(internal.ai.metering.fail, {
      usageId: unsent.usageId as Id<"ai_usage">, billed: "none", errorClass: "permanent", latencyMs: 1,
    });
    expect((await t.mutation(internal.ops.spend.checkDailyAlarms, {})).raised).toEqual([]);
    const dayKey = new Date().toISOString().slice(0, 10);
    await t.run(async (ctx) => {
      const row = await ctx.db.query("ops_settings").unique();
      if (row) await ctx.db.patch("ops_settings", row._id, { paidGlobalDailyBudgetMicroUsd: 1_000_000n });
      await addGlobalReservation(ctx, "paid", dayKey, 800_000);
    });
    expect((await t.mutation(internal.ops.spend.checkDailyAlarms, {})).raised).toEqual(["paid80"]);
    await t.run((ctx) => addGlobalReservation(ctx, "paid", dayKey, 200_000));
    expect((await t.mutation(internal.ops.spend.checkDailyAlarms, {})).raised).toEqual(["paid100"]);
    const { markers, events } = await t.run(async (ctx) => ({
      markers: (await ctx.db.query("ops_settings").unique())?.spendAlarmState,
      events: await ctx.db.query("audit_events").withIndex("by_ownerId_and_createdAt", (q) => q.eq("ownerId", adminId)).collect(),
    }));
    expect(markers).toMatchObject({ free80: true, free100: true, paid80: true, paid100: true });
    expect(events.map((event) => event.action)).toEqual(Array(4).fill("ops.spend.threshold"));
  });

  test("super-admin reads bypass cohort and shutdown; others cannot see bounded summaries", async () => {
    const t = setup();
    const { adminId, adminSessionId, customerId, customerSessionId } = await t.run(async (ctx) => {
      const adminId = await ctx.db.insert("users", { email: "admin@example.test" });
      const customerId = await ctx.db.insert("users", { email: "customer@example.test" });
      const adminSessionId = await ctx.db.insert("authSessions", { userId: adminId, expirationTime: 9_999_999_999_999 });
      const customerSessionId = await ctx.db.insert("authSessions", { userId: customerId, expirationTime: 9_999_999_999_999 });
      await ctx.db.insert("super_admins", { userId: adminId, role: "super_admin", boundAt: 1, boundVia: "deployment_bootstrap" });
      await ctx.db.insert("ops_settings", {
        ownerId: adminId, singletonKey: "workspace", workspaceEnabled: true,
        cohortMode: "allowlist", freeSignupsOpen: false,
        globalDailyBudgetMicroUsd: 1_000_000n, paidGlobalDailyBudgetMicroUsd: 0n,
        killSwitches: { ai: false, studioVideo: true, publish: true, email: true, social: true, ads: true },
        updatedAt: Date.now(),
      });
      return { adminId, adminSessionId, customerId, customerSessionId };
    });
    const dayKey = new Date().toISOString().slice(0, 10);
    const admin = t.withIdentity({ subject: `${adminId}|${adminSessionId}`, issuer: "https://local.test" });
    const customer = t.withIdentity({ subject: `${customerId}|${customerSessionId}`, issuer: "https://local.test" });
    await expect(customer.query(api.ops.spend.readDaily, { dayKey })).rejects.toThrow("FORBIDDEN");
    await expect(t.query(api.ops.spend.readDaily, { dayKey })).rejects.toThrow("FORBIDDEN");
    const reservation = await t.mutation(internal.ai.metering.reserve, {
      attemptKey: "summary:one", promptRef: "summary@1", provider: "anthropic", model: "fixture",
      tier: "fast", feature: "ai", reservedMicroUsd: 300_000,
    });
    const usageId = reservation.usageId as Id<"ai_usage">;
    await t.mutation(internal.ai.metering.markSent, { usageId });
    await t.mutation(internal.ai.metering.settle, {
      usageId, inputTokens: 10, cacheReadTokens: 0,
      cacheWriteTokens: 0, outputTokens: 10, costMicroUsd: 200_000,
      estimated: false, latencyMs: 5,
    });
    const summary = await admin.query(api.ops.spend.readDaily, { dayKey });
    expect(summary).toMatchObject({
      truncated: false, sampledCalls: 1,
      byModel: [{ key: "fixture", costMicroUsd: 200_000, calls: 1 }],
      byPrompt: [{ key: "summary@1", costMicroUsd: 200_000, calls: 1 }],
      byPlan: [{ key: "platform", costMicroUsd: 200_000, calls: 1 }],
      topSpenders: [],
    });
    await t.run(async (ctx) => {
      for (let index = 0; index < 500; index += 1) {
        await ctx.db.insert("ai_usage", {
          attemptKey: `summary:extra:${index}`, promptRef: "other@1", provider: "anthropic",
          model: "fixture", tier: "fast", feature: "ai", globalPool: "free",
          creditFunded: false, status: "settled", reservedMicroUsd: 1n,
          costMicroUsd: 1n, inputTokens: 1n, cacheReadTokens: 0n,
          cacheWriteTokens: 0n, outputTokens: 1n, estimated: false, latencyMs: 1,
          createdAt: Date.now(), dayKey, expiresAt: Date.now() + 1_000,
        });
      }
    });
    const bounded = await admin.query(api.ops.spend.readDaily, { dayKey });
    expect(bounded.truncated).toBe(true);
    expect(bounded.sampledCalls).toBe(500);
    await t.run(async (ctx) => {
      const row = await ctx.db.query("ops_settings").unique();
      if (row) await ctx.db.patch("ops_settings", row._id, { workspaceEnabled: false });
    });
    expect(await admin.query(api.ops.spend.readDaily, { dayKey })).toMatchObject({
      truncated: true, sampledCalls: 500,
    });
    await expect(admin.query(api.ops.spend.readDaily, { dayKey: "not-a-day" })).rejects.toThrow("INVALID_DAY");
    await expect(customer.query(api.ops.spend.readDaily, { dayKey })).rejects.toThrow("FORBIDDEN");
  });
});
