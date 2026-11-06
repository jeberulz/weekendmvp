import { ConvexError, v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, query } from "../_generated/server";
import { int64ToMicroUsd, utcDayKey } from "../../lib/workspace/contracts/metering";
import { readGlobalBudget } from "../ai/budgets";
import { requireSuperAdmin } from "../admin/superAdmin";

const MAX_DAILY_ROWS_PER_STATUS = 500;
const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;
type AlarmKey = "free80" | "free100" | "paid80" | "paid100";
type AlarmState = NonNullable<Doc<"ops_settings">["spendAlarmState"]>;

function emptyAlarmState(dayKey: string): AlarmState {
  return { dayKey, free80: false, free100: false, paid80: false, paid100: false };
}

function dateRange(dayKey: string): { start: number; end: number } {
  if (!DAY_KEY.test(dayKey)) throw new ConvexError({ code: "INVALID_DAY" });
  const start = Date.parse(`${dayKey}T00:00:00.000Z`);
  if (!Number.isFinite(start) || utcDayKey(start) !== dayKey) {
    throw new ConvexError({ code: "INVALID_DAY" });
  }
  return { start, end: start + DAY_MS };
}

function charged(row: Doc<"ai_usage">): number {
  const base = int64ToMicroUsd(row.costMicroUsd);
  const actual = row.lateCostMicroUsd === undefined ? base : int64ToMicroUsd(row.lateCostMicroUsd);
  return Math.max(base, actual);
}

function groups(rows: Doc<"ai_usage">[], key: (row: Doc<"ai_usage">) => string, top = MAX_DAILY_ROWS_PER_STATUS * 2) {
  const totals = new Map<string, { costMicroUsd: number; calls: number }>();
  for (const row of rows) {
    const group = key(row);
    const prior = totals.get(group) ?? { costMicroUsd: 0, calls: 0 };
    const costMicroUsd = prior.costMicroUsd + charged(row);
    if (!Number.isSafeInteger(costMicroUsd)) throw new Error("Spend summary exceeds safe integer range");
    totals.set(group, { costMicroUsd, calls: prior.calls + 1 });
  }
  return [...totals].map(([key, value]) => ({ key, ...value }))
    .sort((a, b) => b.costMicroUsd - a.costMicroUsd || a.key.localeCompare(b.key))
    .slice(0, top);
}

/** Bounded super-admin control-plane read, including during workspace shutdown. */
export const readDaily = query({
  args: { dayKey: v.string() },
  handler: async (ctx, { dayKey }) => {
    await requireSuperAdmin(ctx);
    const { start, end } = dateRange(dayKey);
    const [settled, failed, settings, free, paid] = await Promise.all([
      ctx.db.query("ai_usage").withIndex("by_status_and_createdAt", (q) =>
        q.eq("status", "settled").gte("createdAt", start).lt("createdAt", end))
        .take(MAX_DAILY_ROWS_PER_STATUS + 1),
      ctx.db.query("ai_usage").withIndex("by_status_and_createdAt", (q) =>
        q.eq("status", "failed").gte("createdAt", start).lt("createdAt", end))
        .take(MAX_DAILY_ROWS_PER_STATUS + 1),
      ctx.db.query("ops_settings").withIndex("by_singletonKey", (q) => q.eq("singletonKey", "workspace")).unique(),
      readGlobalBudget(ctx, "free", dayKey),
      readGlobalBudget(ctx, "paid", dayKey),
    ]);
    const truncated = settled.length > MAX_DAILY_ROWS_PER_STATUS || failed.length > MAX_DAILY_ROWS_PER_STATUS;
    const rows = [...settled.slice(0, MAX_DAILY_ROWS_PER_STATUS), ...failed.slice(0, MAX_DAILY_ROWS_PER_STATUS)];
    return {
      dayKey, truncated, sampledCalls: rows.length,
      free: { budgetMicroUsd: settings?.globalDailyBudgetMicroUsd ?? 0n, ...free },
      paid: { budgetMicroUsd: settings?.paidGlobalDailyBudgetMicroUsd ?? 0n, ...paid },
      byModel: groups(rows, (row) => row.model),
      byPrompt: groups(rows, (row) => row.promptRef),
      byPlan: groups(rows, (row) => row.plan ?? "platform"),
      topSpenders: groups(rows.filter((row) => row.ownerId !== undefined), (row) => row.ownerId!, 10),
    };
  },
});

function crossed(used: number, budget: bigint, threshold: 80 | 100): boolean {
  return budget > 0n && BigInt(used) * 100n >= budget * BigInt(threshold);
}

/** Durable alarm dedupe on the admin-owned ops singleton; no external send. */
export const checkDailyAlarms = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const dayKey = utcDayKey(now);
    const priorDayKey = utcDayKey(now - DAY_MS);
    const settings = await ctx.db.query("ops_settings")
      .withIndex("by_singletonKey", (q) => q.eq("singletonKey", "workspace"))
      .unique();
    // Cleanup can charge spend after shutdown, so monitoring remains active.
    if (settings === null) return { dayKey, raised: [] as AlarmKey[], priorDayRaised: [] as AlarmKey[] };
    const states = [settings.spendAlarmState, settings.spendAlarmPreviousDayState];
    const results = await Promise.all([dayKey, priorDayKey].map(async (checkedDayKey) => {
      const [free, paid] = await Promise.all([
        readGlobalBudget(ctx, "free", checkedDayKey), readGlobalBudget(ctx, "paid", checkedDayKey),
      ]);
      const previous = states.find((state) => state?.dayKey === checkedDayKey) ?? emptyAlarmState(checkedDayKey);
      const usage = {
        free: free.spentTodayMicroUsd + free.inFlightMicroUsd,
        paid: paid.spentTodayMicroUsd + paid.inFlightMicroUsd,
      };
      const due: AlarmKey[] = [];
      for (const pool of ["free", "paid"] as const) {
        const budget = pool === "free" ? settings.globalDailyBudgetMicroUsd : settings.paidGlobalDailyBudgetMicroUsd;
        for (const threshold of [80, 100] as const) {
          const key: AlarmKey = `${pool}${threshold}`;
          if (!previous[key] && crossed(usage[pool], budget, threshold)) due.push(key);
        }
      }
      const next = { ...previous };
      for (const key of due) next[key] = true;
      return { dayKey: checkedDayKey, state: next, due, usage };
    }));
    const [today, yesterday] = results;
    if (settings.spendAlarmState?.dayKey !== dayKey ||
        settings.spendAlarmPreviousDayState?.dayKey !== priorDayKey ||
        today.due.length > 0 || yesterday.due.length > 0) {
      await ctx.db.patch("ops_settings", settings._id, {
        spendAlarmState: today.state,
        spendAlarmPreviousDayState: yesterday.state,
      });
    }
    for (const result of results) {
      for (const key of result.due) {
        await ctx.db.insert("audit_events", {
          ownerId: settings.ownerId,
          actorType: "system",
          action: "ops.spend.threshold",
          subjectType: "ops_settings",
          subjectId: settings._id,
          metadata: JSON.stringify({ dayKey: result.dayKey, threshold: key, usedMicroUsd: result.usage[key.startsWith("free") ? "free" : "paid"] }),
          createdAt: now,
        });
      }
    }
    return { dayKey, raised: today.due, priorDayRaised: yesterday.due };
  },
});
