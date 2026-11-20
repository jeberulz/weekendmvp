/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import shardedCounterTest from "@convex-dev/sharded-counter/test";
import { describe, expect, test } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { readGlobalBudget } from "../ai/budgets";
import schema from "../schema";
import { overview } from "../../lib/admin/ai-costs/aggregate";
import { chargedMicroUsd, sumMicroUsd } from "../../lib/admin/ai-costs/money";
import type { UsageRow } from "../../lib/admin/ai-costs/types";

const modules = import.meta.glob("/convex/**/*.ts");
const DAY_MS = 24 * 60 * 60 * 1000;

/** Anything that can run a query: the anonymous test client or one with an identity. */
type Caller = Pick<ReturnType<typeof convexTest>, "query">;

function setup() {
  const t = convexTest(schema, modules);
  shardedCounterTest.register(t);
  return t;
}

async function seed(t: ReturnType<typeof setup>) {
  const ids = await t.run(async (ctx) => {
    const adminId = await ctx.db.insert("users", { email: "cost-admin@example.test" });
    const customerId = await ctx.db.insert("users", { email: "cost-customer@example.test" });
    const adminSessionId = await ctx.db.insert("authSessions", { userId: adminId, expirationTime: 9_999_999_999_999 });
    const customerSessionId = await ctx.db.insert("authSessions", { userId: customerId, expirationTime: 9_999_999_999_999 });
    await ctx.db.insert("super_admins", { userId: adminId, role: "super_admin", boundAt: 1, boundVia: "deployment_bootstrap" });
    await ctx.db.insert("ops_settings", {
      ownerId: adminId, singletonKey: "workspace", workspaceEnabled: true,
      cohortMode: "open", freeSignupsOpen: false,
      globalDailyBudgetMicroUsd: 7_000_000n, paidGlobalDailyBudgetMicroUsd: 3_000_000n,
      killSwitches: { ai: false, studioVideo: true, publish: true, email: true, social: true, ads: true },
      updatedAt: Date.now(),
    });
    return { adminId, customerId, adminSessionId, customerSessionId };
  });
  return {
    ...ids,
    admin: t.withIdentity({ subject: `${ids.adminId}|${ids.adminSessionId}`, issuer: "https://local.test" }),
    customer: t.withIdentity({ subject: `${ids.customerId}|${ids.customerSessionId}`, issuer: "https://local.test" }),
  };
}

function reserveArgs(attemptKey: string, reservedMicroUsd: number, ownerId?: Id<"users">) {
  return {
    ownerId, attemptKey, promptRef: "cost-test@1", provider: "anthropic" as const,
    model: "claude-haiku-4-5", tier: "fast" as const, feature: "ai" as const, reservedMicroUsd,
  };
}

function settleArgs(usageId: Id<"ai_usage">, costMicroUsd: number) {
  return {
    usageId, inputTokens: 1_200, cacheReadTokens: 800, cacheWriteTokens: 0,
    outputTokens: 300, costMicroUsd, estimated: false, latencyMs: 12,
  };
}

/** Reads every row for today the way the console does: bounded pages over the creation-time index. */
async function readToday(admin: Caller, startMs: number, endMs: number): Promise<UsageRow[]> {
  const rows: UsageRow[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 10; page += 1) {
    const result: { page: UsageRow[]; isDone: boolean; continueCursor: string } = await admin.query(api.admin.aiCosts.usagePage, {
      startMs, endMs, paginationOpts: { numItems: 2, cursor },
    });
    rows.push(...result.page);
    if (result.isDone) break;
    cursor = result.continueCursor;
  }
  return rows;
}

describe("WP93 AI cost console reads", () => {
  test("every query refuses customers and anonymous callers", async () => {
    const t = setup();
    const { customer, customerId } = await seed(t);
    const dayKey = new Date().toISOString().slice(0, 10);
    const now = Date.now();
    const calls = [
      (c: Caller) => c.query(api.admin.aiCosts.usagePage, { startMs: now - DAY_MS, endMs: now, paginationOpts: { numItems: 10, cursor: null } }),
      (c: Caller) => c.query(api.admin.aiCosts.ownerSummaries, { ownerIds: [customerId], dayKey }),
      (c: Caller) => c.query(api.admin.aiCosts.launchCosts, { projectIds: [] }),
      (c: Caller) => c.query(api.admin.aiCosts.ownerTimeline, { ownerId: customerId, paginationOpts: { numItems: 10, cursor: null } }),
      (c: Caller) => c.query(api.admin.aiCosts.controlRoom, { dayKey }),
    ];
    for (const call of calls) {
      await expect(call(customer)).rejects.toThrow("FORBIDDEN");
      await expect(call(t)).rejects.toThrow("FORBIDDEN");
    }
  });

  test("reads are bounded: window, page size and id lists", async () => {
    const t = setup();
    const { admin, customerId } = await seed(t);
    const now = Date.now();
    const dayKey = new Date(now).toISOString().slice(0, 10);
    await expect(admin.query(api.admin.aiCosts.usagePage, {
      startMs: now - 40 * DAY_MS, endMs: now, paginationOpts: { numItems: 10, cursor: null },
    })).rejects.toThrow("INVALID_WINDOW");
    await expect(admin.query(api.admin.aiCosts.usagePage, {
      startMs: now, endMs: now - 1, paginationOpts: { numItems: 10, cursor: null },
    })).rejects.toThrow("INVALID_WINDOW");
    await expect(admin.query(api.admin.aiCosts.usagePage, {
      startMs: now - DAY_MS, endMs: now, paginationOpts: { numItems: 1_001, cursor: null },
    })).rejects.toThrow();
    await expect(admin.query(api.admin.aiCosts.ownerSummaries, {
      ownerIds: Array(26).fill(customerId), dayKey,
    })).rejects.toThrow("TOO_MANY_IDS");
    await expect(admin.query(api.admin.aiCosts.ownerTimeline, {
      ownerId: null, paginationOpts: { numItems: 201, cursor: null },
    })).rejects.toThrow();
    await expect(admin.query(api.admin.aiCosts.controlRoom, { dayKey: "yesterday" })).rejects.toThrow();
  });

  test("console totals match the meter's own counters to the micro-dollar", async () => {
    const t = setup();
    const { admin, customerId } = await seed(t);
    const startMs = Date.now() - 1_000;
    const dayKey = new Date().toISOString().slice(0, 10);
    const reserve = (args: ReturnType<typeof reserveArgs>) => t.mutation(internal.ai.metering.reserve, args)
      .then((result) => result.usageId as Id<"ai_usage">);

    // 1. Ownerless call, settled at an odd amount.
    const settled = await reserve(reserveArgs("cost:settled", 400_000));
    await t.mutation(internal.ai.metering.markSent, { usageId: settled });
    await t.mutation(internal.ai.metering.settle, settleArgs(settled, 123_457));

    // 2. Founder call, settled.
    const owned = await reserve(reserveArgs("cost:owned", 300_000, customerId));
    await t.mutation(internal.ai.metering.markSent, { usageId: owned });
    await t.mutation(internal.ai.metering.settle, settleArgs(owned, 77_777));

    // 3. Founder call that failed with a provider-reported cost.
    const failed = await reserve(reserveArgs("cost:failed", 250_000, customerId));
    await t.mutation(internal.ai.metering.markSent, { usageId: failed });
    await t.mutation(internal.ai.metering.fail, {
      usageId: failed, billed: "actual", costMicroUsd: 31_001, errorClass: "schema_invalid", latencyMs: 9,
    });

    // 4. Sent, then swept as stale, then settled late at more than the sweep charged.
    const swept = await reserve(reserveArgs("cost:swept", 500_000));
    await t.mutation(internal.ai.metering.markSent, { usageId: swept });
    await t.run((ctx) => ctx.db.patch("ai_usage", swept, { expiresAt: Date.now() - 1 }));
    await t.mutation(internal.ai.metering.sweepStale, { limit: 10 });
    await t.mutation(internal.ai.metering.settle, settleArgs(swept, 650_003));

    // 5. Still in flight.
    await reserve(reserveArgs("cost:in-flight", 222_222, customerId));

    const rows = await readToday(admin, startMs, Date.now() + 1_000);
    expect(rows).toHaveLength(5);
    const [meter, control, owners] = await Promise.all([
      t.run(async (ctx) => ({
        free: await readGlobalBudget(ctx, "free", dayKey),
        paid: await readGlobalBudget(ctx, "paid", dayKey),
        ownerBudget: await ctx.db.query("ai_budgets").withIndex("by_ownerId", (q) => q.eq("ownerId", customerId)).unique(),
      })),
      admin.query(api.admin.aiCosts.controlRoom, { dayKey }),
      admin.query(api.admin.aiCosts.ownerSummaries, { ownerIds: [customerId], dayKey }),
    ]);

    // The console's own aggregation, the same code the pages run.
    const view = overview(rows, [dayKey]);
    expect(view.pools.free.chargedMicroUsd).toBe(meter.free.spentTodayMicroUsd);
    expect(view.pools.free.inFlightMicroUsd).toBe(meter.free.inFlightMicroUsd);
    expect(view.pools.paid.chargedMicroUsd).toBe(meter.paid.spentTodayMicroUsd);
    expect(view.pools.paid.inFlightMicroUsd).toBe(meter.paid.inFlightMicroUsd);
    expect(view.byDay).toEqual([{ dayKey, free: meter.free.spentTodayMicroUsd, paid: meter.paid.spentTodayMicroUsd }]);
    expect(control.free).toEqual({ spentMicroUsd: meter.free.spentTodayMicroUsd, inFlightMicroUsd: meter.free.inFlightMicroUsd });

    // Hand-computed: 123_457 + 77_777 + 31_001 + max(sweep charge, 650_003).
    expect(meter.free.spentTodayMicroUsd).toBe(123_457 + 77_777 + 31_001 + 650_003);
    expect(meter.free.inFlightMicroUsd).toBe(222_222);

    // The founder's own budget row agrees with the founder's rows.
    const founderCharged = sumMicroUsd(rows.filter((row) => row.ownerId === customerId), chargedMicroUsd);
    expect(founderCharged).toBe(Number(meter.ownerBudget?.daySpentMicroUsd ?? -1n));
    expect(owners).toHaveLength(1);
    expect(owners[0]).toMatchObject({ daySpentMicroUsd: founderCharged, reservedMicroUsd: 222_222 });

    // The swept row keeps both the sweep charge and the late cost; the console charges the larger.
    const sweptRow = rows.find((row) => row.id === swept);
    expect(sweptRow).toMatchObject({ status: "failed", swept: true, lateCostMicroUsd: 650_003 });
  });

  test("timeline is newest first and carries metadata only", async () => {
    const t = setup();
    const { admin, customerId } = await seed(t);
    for (const key of ["a", "b", "c"]) {
      const { usageId } = await t.mutation(internal.ai.metering.reserve, reserveArgs(`timeline:${key}`, 10_000, customerId));
      await t.mutation(internal.ai.metering.markSent, { usageId: usageId as Id<"ai_usage"> });
      await t.mutation(internal.ai.metering.settle, settleArgs(usageId as Id<"ai_usage">, 1_000));
    }
    const first = await admin.query(api.admin.aiCosts.ownerTimeline, { ownerId: customerId, paginationOpts: { numItems: 2, cursor: null } });
    expect(first.page).toHaveLength(2);
    expect(first.isDone).toBe(false);
    expect(first.page[0].createdAt).toBeGreaterThanOrEqual(first.page[1].createdAt);
    const second = await admin.query(api.admin.aiCosts.ownerTimeline, {
      ownerId: customerId, paginationOpts: { numItems: 2, cursor: first.continueCursor },
    });
    expect(second.page).toHaveLength(1);
    const keys = Object.keys(first.page[0]);
    for (const forbidden of ["prompt", "reply", "messages", "content", "attemptKey", "taskId"]) {
      expect(keys).not.toContain(forbidden);
    }
    expect(first.page.every((row) => row.ownerId === customerId)).toBe(true);
  });
});
