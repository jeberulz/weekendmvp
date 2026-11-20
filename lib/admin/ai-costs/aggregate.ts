/**
 * WP93. Pure aggregation over `ai_usage` rows for the AI cost console.
 *
 * Every money figure is an integer micro-USD sum of `chargedMicroUsd` (the
 * meter's own rule), so a total here equals what the meter added to its
 * counters for the same rows. Only display code rounds.
 */

import { addMicroUsd, chargedMicroUsd, ratio, sumMicroUsd } from "./money";
import type { OwnerSummary, ProjectCost, UsageErrorClass, UsagePlan, UsagePool, UsageRow } from "./types";

// ---------------------------------------------------------------------------
// Prompt families
// ---------------------------------------------------------------------------

export type PromptCategory = "wren" | "seed" | "crew" | "other";

/** `wren-chat@1` → `wren-chat`. A ref without a version is its own id. */
export function promptIdOf(ref: string): string {
  const at = ref.lastIndexOf("@");
  return at > 0 ? ref.slice(0, at) : ref;
}

export function categoryOf(ref: string): PromptCategory {
  const id = promptIdOf(ref);
  if (id.startsWith("wren-")) return "wren";
  if (id === "crew-idea-seed") return "seed";
  if (id.startsWith("crew-")) return "crew";
  return "other";
}

export const LAUNCH_TARGET_MICRO_USD = 750_000;
/** `METER_ALARMS.minCacheHitPercent` / `cacheHitMinCallsPerDay`. */
export const CACHE_HIT_ALARM = { minRate: 0.5, minCallsPerDay: 100 } as const;
/** `METER_ALARMS.maxRefusalOrSchemaFailurePercent`. */
export const REFUSAL_OR_SCHEMA_ALARM_RATE = 0.05;

// ---------------------------------------------------------------------------
// Range filter
// ---------------------------------------------------------------------------

/** Keeps the rows booked to these UTC days (the meter's own day). */
export function rowsInDays(rows: readonly UsageRow[], dayKeys: readonly string[]): UsageRow[] {
  const days = new Set(dayKeys);
  return rows.filter((row) => days.has(row.dayKey));
}

// ---------------------------------------------------------------------------
// Totals
// ---------------------------------------------------------------------------

export type Totals = {
  calls: number;
  settled: number;
  failed: number;
  reserved: number;
  chargedMicroUsd: number;
  failedMicroUsd: number;
  /** Reservations of rows still `reserved`. */
  inFlightMicroUsd: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
};

export function emptyTotals(): Totals {
  return {
    calls: 0, settled: 0, failed: 0, reserved: 0,
    chargedMicroUsd: 0, failedMicroUsd: 0, inFlightMicroUsd: 0,
    inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0,
  };
}

export function addToTotals(totals: Totals, row: UsageRow): void {
  const charged = chargedMicroUsd(row);
  totals.calls += 1;
  totals.chargedMicroUsd = addMicroUsd(totals.chargedMicroUsd, charged);
  if (row.status === "settled") totals.settled += 1;
  if (row.status === "failed") {
    totals.failed += 1;
    totals.failedMicroUsd = addMicroUsd(totals.failedMicroUsd, charged);
  }
  if (row.status === "reserved") {
    totals.reserved += 1;
    totals.inFlightMicroUsd = addMicroUsd(totals.inFlightMicroUsd, row.reservedMicroUsd);
  }
  totals.inputTokens = addMicroUsd(totals.inputTokens, row.inputTokens);
  totals.outputTokens = addMicroUsd(totals.outputTokens, row.outputTokens);
  totals.cacheReadTokens = addMicroUsd(totals.cacheReadTokens, row.cacheReadTokens);
  totals.cacheWriteTokens = addMicroUsd(totals.cacheWriteTokens, row.cacheWriteTokens);
}

export function totalsOf(rows: readonly UsageRow[]): Totals {
  const totals = emptyTotals();
  for (const row of rows) addToTotals(totals, row);
  return totals;
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

export type PoolDay = { readonly dayKey: string; readonly free: number; readonly paid: number };

export type Overview = {
  readonly totals: Totals;
  readonly pools: Readonly<Record<UsagePool, { chargedMicroUsd: number; inFlightMicroUsd: number; calls: number }>>;
  /** Charged per UTC day and pool, oldest first, one entry per day of the range. */
  readonly byDay: readonly PoolDay[];
};

export function overview(rows: readonly UsageRow[], dayKeys: readonly string[]): Overview {
  const totals = totalsOf(rows);
  const pools = {
    free: { chargedMicroUsd: 0, inFlightMicroUsd: 0, calls: 0 },
    paid: { chargedMicroUsd: 0, inFlightMicroUsd: 0, calls: 0 },
  };
  const days = new Map<string, { free: number; paid: number }>(dayKeys.map((key) => [key, { free: 0, paid: 0 }]));
  for (const row of rows) {
    const pool = pools[row.globalPool];
    const charged = chargedMicroUsd(row);
    pool.calls += 1;
    pool.chargedMicroUsd = addMicroUsd(pool.chargedMicroUsd, charged);
    if (row.status === "reserved") pool.inFlightMicroUsd = addMicroUsd(pool.inFlightMicroUsd, row.reservedMicroUsd);
    const day = days.get(row.dayKey);
    if (day) day[row.globalPool] = addMicroUsd(day[row.globalPool], charged);
  }
  return { totals, pools, byDay: [...days].map(([dayKey, value]) => ({ dayKey, ...value })) };
}

// ---------------------------------------------------------------------------
// Unit economics
// ---------------------------------------------------------------------------

/** Nearest-rank percentile of integer amounts (always one of the values). */
export function percentile(values: readonly number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
  return sorted[rank - 1];
}

export type LaunchStats = {
  readonly count: number;
  readonly medianMicroUsd: number | null;
  readonly p90MicroUsd: number | null;
  readonly meanMicroUsd: number | null;
  readonly overTarget: number;
  readonly targetMicroUsd: number;
  /** Launches whose cost is a floor because the business had more calls than one read takes. */
  readonly truncated: number;
  /** Sorted ascending, for the distribution chart. */
  readonly costs: readonly number[];
};

/** Launches that started in the range (first call inside it), at their full cost. */
export function launchStats(projects: readonly ProjectCost[], startMs: number, endMs: number): LaunchStats {
  const launches = projects.filter((project) =>
    project.hasLaunch && project.firstCallAt !== null && project.firstCallAt >= startMs && project.firstCallAt < endMs);
  const costs = launches.map((project) => project.launchMicroUsd).sort((a, b) => a - b);
  const total = sumMicroUsd(costs, (cost) => cost);
  return {
    count: costs.length,
    medianMicroUsd: percentile(costs, 50),
    p90MicroUsd: percentile(costs, 90),
    meanMicroUsd: costs.length === 0 ? null : Math.ceil(total / costs.length),
    overTarget: costs.filter((cost) => cost > LAUNCH_TARGET_MICRO_USD).length,
    targetMicroUsd: LAUNCH_TARGET_MICRO_USD,
    truncated: launches.filter((project) => project.truncated).length,
    costs,
  };
}

export type UnitEconomics = {
  readonly launches: LaunchStats;
  readonly wren: { readonly messages: number; readonly chargedMicroUsd: number; readonly perMessageMicroUsd: number | null };
  readonly seeds: { readonly seeds: number; readonly chargedMicroUsd: number; readonly perSeedMicroUsd: number | null };
  readonly founders: {
    readonly activeFounders: number;
    readonly founderDays: number;
    readonly chargedMicroUsd: number;
    readonly perFounderDayMicroUsd: number | null;
  };
  /** Ownerless work (seeds, evals): counts against the free pool (D22). */
  readonly platformMicroUsd: number;
};

function perUnit(total: number, units: number): number | null {
  return units > 0 ? Math.ceil(total / units) : null;
}

export function unitEconomics(
  rows: readonly UsageRow[],
  projects: readonly ProjectCost[],
  startMs: number,
  endMs: number,
): UnitEconomics {
  const wrenRows = rows.filter((row) => categoryOf(row.promptRef) === "wren");
  const seedRows = rows.filter((row) => categoryOf(row.promptRef) === "seed");
  const wrenMessages = wrenRows.filter((row) => row.status === "settled").length;
  const seeds = seedRows.filter((row) => row.status === "settled").length;
  const wrenCharged = sumMicroUsd(wrenRows, chargedMicroUsd);
  const seedCharged = sumMicroUsd(seedRows, chargedMicroUsd);
  const founderRows = rows.filter((row) => row.ownerId !== null);
  const founderDays = new Set(founderRows.map((row) => `${row.ownerId}|${row.dayKey}`)).size;
  const activeFounders = new Set(founderRows.map((row) => row.ownerId)).size;
  const founderCharged = sumMicroUsd(founderRows, chargedMicroUsd);
  return {
    launches: launchStats(projects, startMs, endMs),
    wren: { messages: wrenMessages, chargedMicroUsd: wrenCharged, perMessageMicroUsd: perUnit(wrenCharged, wrenMessages) },
    seeds: { seeds, chargedMicroUsd: seedCharged, perSeedMicroUsd: perUnit(seedCharged, seeds) },
    founders: {
      activeFounders,
      founderDays,
      chargedMicroUsd: founderCharged,
      perFounderDayMicroUsd: perUnit(founderCharged, founderDays),
    },
    platformMicroUsd: sumMicroUsd(rows.filter((row) => row.ownerId === null), chargedMicroUsd),
  };
}

// ---------------------------------------------------------------------------
// Breakdowns (by prompt, by model and tier)
// ---------------------------------------------------------------------------

export type Breakdown = Totals & {
  readonly key: string;
  readonly label: string;
  readonly models: readonly string[];
  readonly tiers: readonly string[];
  reasks: number;
  /** Share of all charged spend in the set. */
  share: number | null;
  /** Failed ÷ final calls. */
  failureRate: number | null;
  /** Charged ÷ final calls. */
  avgCostMicroUsd: number | null;
  cacheHitRate: number | null;
};

export function cacheHitRate(t: Pick<Totals, "inputTokens" | "cacheReadTokens" | "cacheWriteTokens">): number | null {
  return ratio(t.cacheReadTokens, t.inputTokens + t.cacheReadTokens + t.cacheWriteTokens);
}

export function breakdown(
  rows: readonly UsageRow[],
  keyOf: (row: UsageRow) => string,
  labelOf: (key: string) => string = (key) => key,
): Breakdown[] {
  const groups = new Map<string, { totals: Totals; models: Set<string>; tiers: Set<string>; reasks: number }>();
  for (const row of rows) {
    const key = keyOf(row);
    let group = groups.get(key);
    if (!group) {
      group = { totals: emptyTotals(), models: new Set(), tiers: new Set(), reasks: 0 };
      groups.set(key, group);
    }
    addToTotals(group.totals, row);
    group.models.add(row.model);
    group.tiers.add(row.tier);
    if (row.reask) group.reasks += 1;
  }
  const all = sumMicroUsd([...groups.values()], (group) => group.totals.chargedMicroUsd);
  return [...groups].map(([key, group]) => {
    const final = group.totals.settled + group.totals.failed;
    return {
      ...group.totals,
      key,
      label: labelOf(key),
      models: [...group.models].sort(),
      tiers: [...group.tiers].sort(),
      reasks: group.reasks,
      share: ratio(group.totals.chargedMicroUsd, all),
      failureRate: ratio(group.totals.failed, final),
      avgCostMicroUsd: perUnit(group.totals.chargedMicroUsd, final),
      cacheHitRate: cacheHitRate(group.totals),
    };
  }).sort((a, b) => b.chargedMicroUsd - a.chargedMicroUsd || a.key.localeCompare(b.key));
}

export const byPrompt = (rows: readonly UsageRow[]) => breakdown(rows, (row) => row.promptRef);
export const byModelTier = (rows: readonly UsageRow[]) =>
  breakdown(rows, (row) => `${row.tier}|${row.model}`, (key) => key.replace("|", " · "));

// ---------------------------------------------------------------------------
// Per founder
// ---------------------------------------------------------------------------

export type FounderRow = {
  readonly ownerId: string | null;
  readonly summary: OwnerSummary | null;
  readonly plan: UsagePlan | "platform";
  readonly calls: number;
  readonly failed: number;
  readonly wrenMessages: number;
  readonly chargedMicroUsd: number;
  readonly lastCallAt: number | null;
};

/** One row per owner seen in the range, plus one "platform" row for ownerless work. Biggest spender first. */
export function founderRows(rows: readonly UsageRow[], summaries: readonly OwnerSummary[]): FounderRow[] {
  const byId = new Map(summaries.map((summary) => [summary.ownerId, summary]));
  const groups = new Map<string | null, { calls: number; failed: number; wren: number; charged: number; last: number | null; plan: UsagePlan | null }>();
  for (const row of rows) {
    const group = groups.get(row.ownerId) ?? { calls: 0, failed: 0, wren: 0, charged: 0, last: null, plan: null };
    group.calls += 1;
    if (row.status === "failed") group.failed += 1;
    if (row.status === "settled" && categoryOf(row.promptRef) === "wren") group.wren += 1;
    group.charged = addMicroUsd(group.charged, chargedMicroUsd(row));
    group.last = Math.max(group.last ?? 0, row.createdAt);
    group.plan = row.plan ?? group.plan;
    groups.set(row.ownerId, group);
  }
  return [...groups].map(([ownerId, group]): FounderRow => {
    const summary = ownerId === null ? null : byId.get(ownerId) ?? null;
    return {
      ownerId,
      summary,
      plan: ownerId === null ? "platform" : summary?.plan ?? group.plan ?? "free",
      calls: group.calls,
      failed: group.failed,
      wrenMessages: group.wren,
      chargedMicroUsd: group.charged,
      lastCallAt: group.last,
    };
  }).sort((a, b) => b.chargedMicroUsd - a.chargedMicroUsd || String(a.ownerId).localeCompare(String(b.ownerId)));
}

// ---------------------------------------------------------------------------
// Efficiency signals
// ---------------------------------------------------------------------------

export type CountAndCost = { readonly calls: number; readonly chargedMicroUsd: number };

function countAndCost(rows: readonly UsageRow[]): CountAndCost {
  return { calls: rows.length, chargedMicroUsd: sumMicroUsd(rows, chargedMicroUsd) };
}

export type CachePromptSignal = {
  readonly promptRef: string;
  readonly calls: number;
  readonly callsPerDay: number;
  readonly hitRate: number | null;
  /** Under 50% on a prompt with more than 100 calls a day (`METER_ALARMS`). */
  readonly alarm: boolean;
};

export type Efficiency = {
  readonly cache: {
    readonly hitRate: number | null;
    readonly cacheReadTokens: number;
    readonly promptTokens: number;
    readonly prompts: readonly CachePromptSignal[];
  };
  readonly batch: {
    readonly calls: number;
    readonly share: number | null;
    readonly chargedMicroUsd: number;
    /** Standard-rate price of the same tokens minus the charge. Null when no batch row could be re-priced. */
    readonly savedMicroUsd: number | null;
  };
  readonly reasks: CountAndCost;
  readonly escalations: CountAndCost;
  readonly schemaInvalid: CountAndCost;
  readonly refusals: CountAndCost;
  readonly refusalOrSchemaRate: number | null;
  readonly refusalOrSchemaAlarm: boolean;
  readonly maxTokens: CountAndCost;
  readonly reservation: {
    /** Final rows only. */
    readonly reservedMicroUsd: number;
    readonly chargedMicroUsd: number;
    readonly gapMicroUsd: number;
    /** Charged ÷ reserved: how much of what was locked was used. */
    readonly usedRate: number | null;
    readonly inFlightMicroUsd: number;
    readonly inFlightCalls: number;
  };
  readonly failed: CountAndCost & {
    readonly possiblyBilled: number;
    readonly swept: number;
    readonly byClass: ReadonlyArray<{ readonly errorClass: UsageErrorClass | "unknown"; readonly calls: number; readonly chargedMicroUsd: number }>;
  };
};

/**
 * `reprice(row, false)` returns the standard-rate price of a settled row's
 * tokens, or null when its model has no rate card. Injected so this module
 * stays free of the pricing module (see `whatif.ts`).
 */
export function efficiency(
  rows: readonly UsageRow[],
  days: number,
  standardPrice: (row: UsageRow) => number | null,
): Efficiency {
  const anthropic = rows.filter((row) => row.provider === "anthropic" && row.status !== "reserved");
  const cacheTotals = totalsOf(anthropic);
  const prompts = breakdown(anthropic, (row) => row.promptRef).map((group): CachePromptSignal => {
    const callsPerDay = group.calls / Math.max(1, days);
    return {
      promptRef: group.key,
      calls: group.calls,
      callsPerDay,
      hitRate: group.cacheHitRate,
      alarm: callsPerDay > CACHE_HIT_ALARM.minCallsPerDay && (group.cacheHitRate ?? 0) < CACHE_HIT_ALARM.minRate,
    };
  });

  const batchRows = rows.filter((row) => row.batch);
  let saved: number | null = null;
  for (const row of batchRows) {
    if (row.status !== "settled") continue;
    const standard = standardPrice(row);
    if (standard === null) continue;
    saved = addMicroUsd(saved ?? 0, Math.max(0, standard - chargedMicroUsd(row)));
  }

  const final = rows.filter((row) => row.status !== "reserved");
  const failedRows = rows.filter((row) => row.status === "failed");
  const schemaInvalid = failedRows.filter((row) => row.errorClass === "schema_invalid");
  const refusals = failedRows.filter((row) => row.errorClass === "refusal");
  const modelFinal = final.filter((row) => row.provider === "anthropic");
  const refusalOrSchemaRate = ratio(
    modelFinal.filter((row) => row.errorClass === "schema_invalid" || row.errorClass === "refusal").length,
    modelFinal.length,
  );
  const reservedFinal = sumMicroUsd(final, (row) => row.reservedMicroUsd);
  const chargedFinal = sumMicroUsd(final, chargedMicroUsd);
  const inFlight = rows.filter((row) => row.status === "reserved");

  const classes = new Map<UsageErrorClass | "unknown", { calls: number; chargedMicroUsd: number }>();
  for (const row of failedRows) {
    const key = row.errorClass ?? "unknown";
    const prior = classes.get(key) ?? { calls: 0, chargedMicroUsd: 0 };
    classes.set(key, { calls: prior.calls + 1, chargedMicroUsd: addMicroUsd(prior.chargedMicroUsd, chargedMicroUsd(row)) });
  }

  return {
    cache: {
      hitRate: cacheHitRate(cacheTotals),
      cacheReadTokens: cacheTotals.cacheReadTokens,
      promptTokens: cacheTotals.inputTokens + cacheTotals.cacheReadTokens + cacheTotals.cacheWriteTokens,
      prompts,
    },
    batch: {
      calls: batchRows.length,
      share: ratio(batchRows.length, rows.length),
      chargedMicroUsd: sumMicroUsd(batchRows, chargedMicroUsd),
      savedMicroUsd: saved,
    },
    reasks: countAndCost(rows.filter((row) => row.reask)),
    escalations: countAndCost(rows.filter((row) => row.escalation)),
    schemaInvalid: countAndCost(schemaInvalid),
    refusals: countAndCost(refusals),
    refusalOrSchemaRate,
    refusalOrSchemaAlarm: (refusalOrSchemaRate ?? 0) > REFUSAL_OR_SCHEMA_ALARM_RATE,
    maxTokens: countAndCost(rows.filter((row) => row.stopReason === "max_tokens")),
    reservation: {
      reservedMicroUsd: reservedFinal,
      chargedMicroUsd: chargedFinal,
      gapMicroUsd: Math.max(0, reservedFinal - chargedFinal),
      usedRate: ratio(chargedFinal, reservedFinal),
      inFlightMicroUsd: sumMicroUsd(inFlight, (row) => row.reservedMicroUsd),
      inFlightCalls: inFlight.length,
    },
    failed: {
      ...countAndCost(failedRows),
      possiblyBilled: failedRows.filter((row) => row.billed === "possible").length,
      swept: failedRows.filter((row) => row.swept).length,
      byClass: [...classes].map(([errorClass, value]) => ({ errorClass, ...value }))
        .sort((a, b) => b.chargedMicroUsd - a.chargedMicroUsd || b.calls - a.calls),
    },
  };
}
