/**
 * WP93. The meter's charge rule and safe micro-USD arithmetic.
 *
 * What a call costs is what the meter added to the budgets for it:
 * - `settle` adds `costMicroUsd`;
 * - `fail` and the sweep add the charge they wrote to `costMicroUsd`;
 * - a settle after the sweep adds `max(0, late − charged)`
 *   (`lateSettleAdjustment`), so the total is `max(costMicroUsd, late)`.
 * `convex/ops/spend.ts` (`charged`) uses the same rule. A row still
 * `reserved` has no charge yet; its reservation is in flight.
 */

import type { UsageRow } from "./types";

export const MICRO_USD_PER_USD = 1_000_000;

export function chargedMicroUsd(row: Pick<UsageRow, "status" | "costMicroUsd" | "lateCostMicroUsd">): number {
  if (row.status === "reserved") return 0;
  return Math.max(row.costMicroUsd, row.lateCostMicroUsd ?? 0);
}

/** Adds integer micro-USD amounts, refusing to lose precision. */
export function addMicroUsd(a: number, b: number): number {
  const sum = a + b;
  if (!Number.isSafeInteger(sum)) throw new RangeError("micro-USD total exceeds the safe integer range");
  return sum;
}

export function sumMicroUsd<T>(items: readonly T[], amount: (item: T) => number): number {
  let total = 0;
  for (const item of items) total = addMicroUsd(total, amount(item));
  return total;
}

/** A ratio, or null when the denominator is zero (shown as "—"). */
export function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

/** Dollars for display. Small amounts keep more digits so a $0.0004 call is not "$0.00". */
export function formatUsd(microUsd: number | null, options: { readonly precise?: boolean } = {}): string {
  if (microUsd === null || !Number.isFinite(microUsd)) return "—";
  const usd = microUsd / MICRO_USD_PER_USD;
  const abs = Math.abs(usd);
  const digits = options.precise || (abs > 0 && abs < 0.01) ? 4 : 2;
  return `${usd < 0 ? "−" : ""}$${abs.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

export function formatPercent(value: number | null, digits = 0): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${(value * 100).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
}

export function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}

/** Token counts: 1,234 / 12.3K / 1.2M. */
export function formatTokens(value: number): string {
  if (value < 10_000) return value.toLocaleString("en-US");
  if (value < 1_000_000) return `${(value / 1_000).toLocaleString("en-US", { maximumFractionDigits: 1 })}K`;
  return `${(value / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 2 })}M`;
}
