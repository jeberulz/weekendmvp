import { ShardedCounter } from "@convex-dev/sharded-counter";
import { components } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  int64ToMicroUsd,
  microUsdToInt64,
  reserveDeltas,
  rollBudgetsToDay,
  spendDeltas,
  zeroAiBudgets,
  type AiBudgetsRow,
  type AiUsageRow,
  type GlobalPool,
} from "../../lib/workspace/contracts/metering";

// A separate key for each UTC day, pool and state keeps in-flight reservations
// visible to the global gate without turning one Convex document into a hot row.
const globalCounter = new ShardedCounter(components.shardedCounter);
type GlobalCounterKind = "spent" | "inFlight";

function counterKey(pool: GlobalPool, dayKey: string, kind: GlobalCounterKind): string {
  return `workspace-ai:${dayKey}:${pool}:${kind}`;
}

export async function readGlobalBudget(
  ctx: MutationCtx | QueryCtx,
  pool: GlobalPool,
  dayKey: string,
): Promise<{ spentTodayMicroUsd: number; inFlightMicroUsd: number }> {
  const [spentTodayMicroUsd, inFlightMicroUsd] = await Promise.all([
    globalCounter.count(ctx, counterKey(pool, dayKey, "spent")),
    globalCounter.count(ctx, counterKey(pool, dayKey, "inFlight")),
  ]);
  return { spentTodayMicroUsd, inFlightMicroUsd };
}

export async function addGlobalReservation(
  ctx: MutationCtx,
  pool: GlobalPool,
  dayKey: string,
  amount: number,
): Promise<void> {
  await globalCounter.add(ctx, counterKey(pool, dayKey, "inFlight"), amount);
}

export async function addGlobalSpend(
  ctx: MutationCtx,
  pool: GlobalPool,
  dayKey: string,
  spentMicroUsd: number,
  releaseMicroUsd: number,
): Promise<void> {
  if (releaseMicroUsd > 0) {
    await globalCounter.subtract(ctx, counterKey(pool, dayKey, "inFlight"), releaseMicroUsd);
  }
  if (spentMicroUsd > 0) {
    await globalCounter.add(ctx, counterKey(pool, dayKey, "spent"), spentMicroUsd);
  }
}

function fromStored(row: Doc<"ai_budgets">): AiBudgetsRow {
  return {
    ownerId: row.ownerId,
    freeLifetimeSpentMicroUsd: int64ToMicroUsd(row.freeLifetimeSpentMicroUsd),
    reservedMicroUsd: int64ToMicroUsd(row.reservedMicroUsd),
    freeReservedMicroUsd: int64ToMicroUsd(row.freeReservedMicroUsd),
    dayKey: row.dayKey,
    daySpentMicroUsd: int64ToMicroUsd(row.daySpentMicroUsd),
    dayEscalations: int64ToMicroUsd(row.dayEscalations),
  };
}

export async function readOwnerBudget(
  ctx: MutationCtx,
  ownerId: Id<"users">,
): Promise<{ stored: Doc<"ai_budgets"> | null; budget: AiBudgetsRow | null }> {
  const stored = await ctx.db.query("ai_budgets")
    .withIndex("by_ownerId", (q) => q.eq("ownerId", ownerId))
    .unique();
  return { stored, budget: stored === null ? null : fromStored(stored) };
}

export async function reserveOwnerBudget(
  ctx: MutationCtx,
  ownerId: Id<"users">,
  row: Pick<AiUsageRow, "ownerId" | "plan" | "creditFunded" | "reservedMicroUsd" | "escalation" | "globalPool" | "dayKey">,
  current: { stored: Doc<"ai_budgets"> | null; budget: AiBudgetsRow | null },
  now: number,
): Promise<void> {
  const budget = rollBudgetsToDay(current.budget ?? zeroAiBudgets(ownerId, row.dayKey), row.dayKey);
  const delta = reserveDeltas(row).owner;
  if (delta === null) throw new Error("owner reservation has no owner budget delta");
  const next = {
    freeLifetimeSpentMicroUsd: microUsdToInt64(budget.freeLifetimeSpentMicroUsd),
    reservedMicroUsd: microUsdToInt64(budget.reservedMicroUsd + delta.reservedMicroUsd),
    freeReservedMicroUsd: microUsdToInt64(budget.freeReservedMicroUsd + delta.freeReservedMicroUsd),
    dayKey: budget.dayKey,
    daySpentMicroUsd: microUsdToInt64(budget.daySpentMicroUsd),
    dayEscalations: microUsdToInt64(budget.dayEscalations + delta.dayEscalations),
    updatedAt: now,
  };
  if (current.stored === null) await ctx.db.insert("ai_budgets", { ownerId, ...next });
  else await ctx.db.patch("ai_budgets", current.stored._id, next);
}

export async function spendOwnerBudget(
  ctx: MutationCtx,
  row: Pick<AiUsageRow, "ownerId" | "plan" | "creditFunded" | "reservedMicroUsd" | "globalPool" | "dayKey">,
  spendMicroUsd: number,
  releaseReservation: boolean,
  now: number,
): Promise<void> {
  if (row.ownerId === undefined) return;
  const ownerId = row.ownerId as Id<"users">;
  const { stored, budget } = await readOwnerBudget(ctx, ownerId);
  if (stored === null || budget === null) throw new Error("AI budget row missing for owner reservation");
  const delta = spendDeltas({ row, spendMicroUsd, releaseReservation, budgetsDayKey: budget.dayKey }).owner;
  if (delta === null) throw new Error("owner spend has no owner budget delta");
  await ctx.db.patch("ai_budgets", stored._id, {
    freeLifetimeSpentMicroUsd: microUsdToInt64(budget.freeLifetimeSpentMicroUsd + delta.freeLifetimeSpentMicroUsd),
    reservedMicroUsd: microUsdToInt64(budget.reservedMicroUsd + delta.reservedMicroUsd),
    freeReservedMicroUsd: microUsdToInt64(budget.freeReservedMicroUsd + delta.freeReservedMicroUsd),
    daySpentMicroUsd: microUsdToInt64(budget.daySpentMicroUsd + delta.daySpentMicroUsd),
    updatedAt: now,
  });
}
