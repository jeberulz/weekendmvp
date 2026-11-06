/**
 * WP71-S2. An in-memory C-METER, behind the contract's exact signatures.
 *
 * Until Codex's `convex/ai/metering.ts` (WP70) merges, the gateway's tests and
 * fixture runs use this stub. It implements `reserve`, `markSent`, `settle`,
 * `fail` and the sweep with the pure helpers in
 * `lib/workspace/contracts/metering.ts` (`assertReserveArgs`,
 * `firstReserveFailure`, `reserveDeltas`, `spendDeltas`, `chargeOnFail`,
 * `sweepOutcome`, `lateSettleAdjustment`), so its arithmetic is the
 * contract's, not a copy.
 *
 * It lives under `tests/` so no Convex bundle can include it: its state is one
 * JS object, so a deployed action would start every run from zero budgets and
 * enforce nothing. It registers no Convex function and reads no env.
 *
 * It is no more permissive than the real meter: `reserve` runs
 * `assertReserveArgs`, and `settle` / `fail` reject a non-integer or negative
 * amount, token count or latency, an unknown `billed` state and an unknown
 * `errorClass` with a `RangeError`.
 *
 * Stand-ins for what the real meter derives itself:
 * - the owner's plan comes from `owners` (an unknown owner counts as `free`,
 *   failing closed), never from the caller;
 * - `creditDebitId` is credit-funding only when `creditDebits` lists it for
 *   the same owner and task.
 *
 * Refusals throw `ConvexError<MeterErrorData>`, as the real mutation will.
 */

import { ConvexError } from "convex/values";

import {
  assertReserveArgs,
  BILLED_STATES,
  isMicroUsd,
  METER_ERROR_CLASSES,
  chargeOnFail,
  FREE_GLOBAL_DAILY_BUDGET_DEFAULT_MICRO_USD,
  firstReserveFailure,
  globalPoolFor,
  lateSettleAdjustment,
  PAID_GLOBAL_DAILY_BUDGET_DEFAULT_MICRO_USD,
  reservationExpiresAt,
  reserveDeltas,
  rollBudgetsToDay,
  spendDeltas,
  sweepOutcome,
  utcDayKey,
  zeroAiBudgets,
  type AiBudgetsRow,
  type AiUsageRow,
  type FailArgs,
  type FinalizeResult,
  type GlobalPool,
  type MeterPlan,
  type SettleArgs,
  type SpendDeltas,
} from "@/lib/workspace/contracts/metering";
import type { MeterPort } from "@/convex/ai/gateway";

export type { MeterPort };

export type MeterStubOwner = {
  readonly plan: MeterPlan;
  readonly budgets?: AiBudgetsRow;
  readonly dailyCapOverrideMicroUsd?: number;
};

export type MeterStubOptions = {
  readonly now?: () => number;
  readonly killSwitches?: { readonly ai?: boolean; readonly studioVideo?: boolean };
  readonly globalBudgetsMicroUsd?: Partial<Record<GlobalPool, number>>;
  readonly owners?: Readonly<Record<string, MeterStubOwner>>;
  /** Ledger debits the stub accepts as credit funding: `debitId → { ownerId, taskId }`. */
  readonly creditDebits?: Readonly<Record<string, { readonly ownerId: string; readonly taskId: string }>>;
};

type GlobalCounter = { spentMicroUsd: number; inFlightMicroUsd: number };

export type MeterStub = MeterPort & {
  /** Every row, in insertion order. */
  rows(): readonly AiUsageRow[];
  row(usageId: string): AiUsageRow | undefined;
  /** How many times `settle` or `fail` reached this row (the gateway should make it 1). */
  finalizeCalls(usageId: string): number;
  budgets(ownerId: string): AiBudgetsRow | undefined;
  global(pool: GlobalPool, dayKey: string): GlobalCounter;
  /** The WP70 sweep: finalises expired `reserved` rows. Returns the ids it swept. */
  sweep(nowMs: number): readonly string[];
  setKillSwitch(name: "ai" | "studioVideo", on: boolean): void;
};

export function createMeterStub(options: MeterStubOptions = {}): MeterStub {
  const now = options.now ?? (() => Date.now());
  const killSwitches = { ai: options.killSwitches?.ai ?? false, studioVideo: options.killSwitches?.studioVideo ?? false };
  const globalBudgets: Record<GlobalPool, number> = {
    free: options.globalBudgetsMicroUsd?.free ?? FREE_GLOBAL_DAILY_BUDGET_DEFAULT_MICRO_USD,
    paid: options.globalBudgetsMicroUsd?.paid ?? PAID_GLOBAL_DAILY_BUDGET_DEFAULT_MICRO_USD,
  };
  const owners = options.owners ?? {};
  const creditDebits = options.creditDebits ?? {};

  const rows = new Map<string, AiUsageRow>();
  const byAttemptKey = new Map<string, string>();
  const finalizeCount = new Map<string, number>();
  const budgets = new Map<string, AiBudgetsRow>();
  for (const [ownerId, owner] of Object.entries(owners)) {
    if (owner.budgets) budgets.set(ownerId, owner.budgets);
  }
  const counters = new Map<string, GlobalCounter>();
  let nextId = 1;

  const counter = (pool: GlobalPool, dayKey: string): GlobalCounter => {
    const key = `${pool}:${dayKey}`;
    let entry = counters.get(key);
    if (!entry) {
      entry = { spentMicroUsd: 0, inFlightMicroUsd: 0 };
      counters.set(key, entry);
    }
    return entry;
  };

  const requireRow = (usageId: string): AiUsageRow => {
    const row = rows.get(usageId);
    if (!row) throw new Error(`unknown usageId ${usageId}`);
    return row;
  };

  const applySpend = (row: AiUsageRow, deltas: SpendDeltas): void => {
    const shard = counter(deltas.global.pool, deltas.global.dayKey);
    shard.spentMicroUsd += deltas.global.spentMicroUsd;
    shard.inFlightMicroUsd += deltas.global.inFlightMicroUsd;
    if (deltas.owner && row.ownerId !== undefined) {
      const current = budgets.get(row.ownerId) ?? zeroAiBudgets(row.ownerId, row.dayKey);
      budgets.set(row.ownerId, {
        ...current,
        reservedMicroUsd: current.reservedMicroUsd + deltas.owner.reservedMicroUsd,
        freeReservedMicroUsd: current.freeReservedMicroUsd + deltas.owner.freeReservedMicroUsd,
        daySpentMicroUsd: current.daySpentMicroUsd + deltas.owner.daySpentMicroUsd,
        freeLifetimeSpentMicroUsd: current.freeLifetimeSpentMicroUsd + deltas.owner.freeLifetimeSpentMicroUsd,
      });
    }
  };

  const finalizeRow = (
    usageId: string,
    row: AiUsageRow,
    patch: Partial<AiUsageRow> & Pick<AiUsageRow, "status" | "costMicroUsd">,
  ): AiUsageRow => {
    const ownerBudgets = row.ownerId === undefined ? undefined : budgets.get(row.ownerId);
    applySpend(
      row,
      spendDeltas({
        row,
        spendMicroUsd: patch.costMicroUsd,
        releaseReservation: true,
        budgetsDayKey: ownerBudgets?.dayKey ?? null,
      }),
    );
    const next: AiUsageRow = { ...row, ...patch, finalizedAt: now() };
    rows.set(usageId, next);
    return next;
  };

  const countFinalize = (usageId: string): void => {
    finalizeCount.set(usageId, (finalizeCount.get(usageId) ?? 0) + 1);
  };

  const alreadyFinal = (usageId: string, row: AiUsageRow, lateAdjustmentMicroUsd: number): FinalizeResult => ({
    usageId,
    alreadyFinal: true,
    status: row.status === "settled" ? "settled" : "failed",
    costMicroUsd: row.costMicroUsd,
    lateAdjustmentMicroUsd,
  });

  return {
    async reserve(args) {
      assertReserveArgs(args);
      const existing = byAttemptKey.get(args.attemptKey);
      if (existing !== undefined) return { usageId: existing, existing: true };

      const createdAt = now();
      const dayKey = utcDayKey(createdAt);
      const owner = args.ownerId === undefined ? undefined : (owners[args.ownerId] ?? { plan: "free" as const });
      const debit = args.creditDebitId === undefined ? undefined : creditDebits[args.creditDebitId];
      const creditFunded = debit !== undefined && debit.ownerId === args.ownerId && debit.taskId === args.taskId;

      const failure = firstReserveFailure(
        {
          dayKey,
          killSwitches,
          global: {
            free: { budgetMicroUsd: globalBudgets.free, ...todayTotals(counter("free", dayKey)) },
            paid: { budgetMicroUsd: globalBudgets.paid, ...todayTotals(counter("paid", dayKey)) },
          },
          owner:
            owner === undefined || args.ownerId === undefined
              ? undefined
              : {
                  plan: owner.plan,
                  budgets: budgets.get(args.ownerId) ?? null,
                  dailyCapOverrideMicroUsd: owner.dailyCapOverrideMicroUsd,
                },
        },
        {
          ownerId: args.ownerId,
          feature: args.feature,
          reservedMicroUsd: args.reservedMicroUsd,
          escalation: args.escalation,
          creditFunded,
        },
      );
      if (failure) throw new ConvexError(failure);

      const usageId = `usage_stub_${nextId++}`;
      const row: AiUsageRow = {
        ownerId: args.ownerId,
        projectId: args.projectId,
        taskId: args.taskId,
        promptRef: args.promptRef,
        provider: args.provider,
        model: args.model,
        tier: args.tier,
        status: "reserved",
        reservedMicroUsd: args.reservedMicroUsd,
        costMicroUsd: 0,
        inputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        outputTokens: 0,
        estimated: false,
        latencyMs: 0,
        attemptKey: args.attemptKey,
        createdAt,
        dayKey,
        expiresAt: reservationExpiresAt(createdAt, args.batch === true),
        feature: args.feature,
        plan: owner?.plan,
        globalPool: globalPoolFor({ plan: owner?.plan, creditFunded }),
        creditFunded,
        ...(creditFunded ? { creditDebitId: args.creditDebitId } : {}),
        ...(args.batch ? { batch: true as const } : {}),
        ...(args.escalation ? { escalation: true as const } : {}),
        ...(args.reask ? { reask: true as const } : {}),
      };
      rows.set(usageId, row);
      byAttemptKey.set(args.attemptKey, usageId);

      const deltas = reserveDeltas(row);
      const shard = counter(deltas.global.pool, deltas.global.dayKey);
      shard.inFlightMicroUsd += deltas.global.inFlightMicroUsd;
      if (deltas.owner && args.ownerId !== undefined) {
        const current = rollBudgetsToDay(budgets.get(args.ownerId) ?? zeroAiBudgets(args.ownerId, dayKey), dayKey);
        budgets.set(args.ownerId, {
          ...current,
          reservedMicroUsd: current.reservedMicroUsd + deltas.owner.reservedMicroUsd,
          freeReservedMicroUsd: current.freeReservedMicroUsd + deltas.owner.freeReservedMicroUsd,
          dayEscalations: current.dayEscalations + deltas.owner.dayEscalations,
        });
      }
      return { usageId, existing: false };
    },

    async markSent({ usageId }) {
      const row = requireRow(usageId);
      if (row.status !== "reserved" || row.sentAt !== undefined) {
        return { usageId, changed: false, ...(row.sentAt === undefined ? {} : { sentAt: row.sentAt }) };
      }
      const sentAt = now();
      rows.set(usageId, { ...row, sentAt });
      return { usageId, changed: true, sentAt };
    },

    async settle(args) {
      assertSettleArgs(args);
      const row = requireRow(args.usageId);
      countFinalize(args.usageId);
      if (row.status !== "reserved") {
        if (row.sweptAt !== undefined && row.lateCostMicroUsd === undefined) {
          const adjustment = lateSettleAdjustment({ chargedMicroUsd: row.costMicroUsd, actualMicroUsd: args.costMicroUsd });
          const ownerBudgets = row.ownerId === undefined ? undefined : budgets.get(row.ownerId);
          applySpend(
            row,
            spendDeltas({
              row,
              spendMicroUsd: adjustment,
              releaseReservation: false,
              budgetsDayKey: ownerBudgets?.dayKey ?? null,
            }),
          );
          const next = { ...row, lateCostMicroUsd: args.costMicroUsd };
          rows.set(args.usageId, next);
          return alreadyFinal(args.usageId, next, adjustment);
        }
        return alreadyFinal(args.usageId, row, 0);
      }
      const next = finalizeRow(args.usageId, row, {
        status: "settled",
        costMicroUsd: args.costMicroUsd,
        inputTokens: args.inputTokens,
        cacheReadTokens: args.cacheReadTokens,
        cacheWriteTokens: args.cacheWriteTokens,
        outputTokens: args.outputTokens,
        ...(args.images === undefined ? {} : { images: args.images }),
        ...(args.videoSeconds === undefined ? {} : { videoSeconds: args.videoSeconds }),
        estimated: args.estimated,
        latencyMs: args.latencyMs,
        ...(args.stopReason === undefined ? {} : { stopReason: args.stopReason }),
      });
      return { usageId: args.usageId, alreadyFinal: false, status: "settled", costMicroUsd: next.costMicroUsd };
    },

    async fail(args) {
      assertFailArgs(args);
      const row = requireRow(args.usageId);
      countFinalize(args.usageId);
      if (row.status !== "reserved") return alreadyFinal(args.usageId, row, 0);
      const charge = chargeOnFail({
        reservedMicroUsd: row.reservedMicroUsd,
        billed: args.billed,
        costMicroUsd: args.costMicroUsd,
      });
      const next = finalizeRow(args.usageId, row, {
        status: "failed",
        costMicroUsd: charge,
        billed: args.billed,
        errorClass: args.errorClass,
        latencyMs: args.latencyMs,
      });
      return { usageId: args.usageId, alreadyFinal: false, status: "failed", costMicroUsd: next.costMicroUsd };
    },

    rows: () => [...rows.values()],
    row: (usageId) => rows.get(usageId),
    finalizeCalls: (usageId) => finalizeCount.get(usageId) ?? 0,
    budgets: (ownerId) => budgets.get(ownerId),
    global: (pool, dayKey) => ({ ...counter(pool, dayKey) }),

    sweep(nowMs) {
      const swept: string[] = [];
      for (const [usageId, row] of rows) {
        const outcome = sweepOutcome(row, nowMs);
        if (!outcome) continue;
        finalizeRow(usageId, row, {
          status: "failed",
          costMicroUsd: outcome.chargeMicroUsd,
          billed: outcome.billed,
          errorClass: outcome.errorClass,
          sweptAt: nowMs,
        });
        swept.push(usageId);
      }
      return swept;
    },

    setKillSwitch(name, on) {
      killSwitches[name] = on;
    },
  };
}

function assertInteger(name: string, value: unknown): void {
  if (!isMicroUsd(value)) throw new RangeError(`${name} must be a safe non-negative integer, got ${String(value)}`);
}

function assertUsageId(value: unknown): void {
  if (typeof value !== "string" || value.length === 0) throw new RangeError("usageId is required");
}

/** What the real `settle` validator (`v.int64()` fields, `v.boolean()`) would reject. */
export function assertSettleArgs(args: SettleArgs): void {
  assertUsageId(args.usageId);
  for (const key of ["inputTokens", "cacheReadTokens", "cacheWriteTokens", "outputTokens", "costMicroUsd", "latencyMs"] as const) {
    assertInteger(key, args[key]);
  }
  if (args.images !== undefined) assertInteger("images", args.images);
  if (args.videoSeconds !== undefined) assertInteger("videoSeconds", args.videoSeconds);
  if (typeof args.estimated !== "boolean") throw new RangeError("estimated must be a boolean");
  if (args.stopReason !== undefined && typeof args.stopReason !== "string") throw new RangeError("stopReason must be a string");
}

/** What the real `fail` validator would reject. */
export function assertFailArgs(args: FailArgs): void {
  assertUsageId(args.usageId);
  if (!(BILLED_STATES as readonly string[]).includes(args.billed)) throw new RangeError(`unknown billed state ${String(args.billed)}`);
  if (!(METER_ERROR_CLASSES as readonly string[]).includes(args.errorClass)) {
    throw new RangeError(`unknown errorClass ${String(args.errorClass)}`);
  }
  if (args.costMicroUsd !== undefined) assertInteger("costMicroUsd", args.costMicroUsd);
  assertInteger("latencyMs", args.latencyMs);
}

function todayTotals(entry: GlobalCounter): { spentTodayMicroUsd: number; inFlightMicroUsd: number } {
  return { spentTodayMicroUsd: entry.spentMicroUsd, inFlightMicroUsd: entry.inFlightMicroUsd };
}
