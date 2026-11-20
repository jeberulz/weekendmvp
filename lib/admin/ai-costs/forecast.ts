/**
 * WP93. "What would the full product cost to run?" A monthly AI cost from the
 * measured unit costs, next to Builder's Hub revenue (`PRICING` in
 * `convex/platform/plans.ts`, the one place the price lives). Workspace
 * Growth has no price in code yet, so it is not counted.
 *
 * An estimate: unit costs are this range's averages and the inputs are the
 * owner's assumptions.
 */

import { PRICING } from "@/convex/platform/plans";
import { MICRO_USD_PER_USD } from "./money";

export const FORECAST_DAYS_PER_MONTH = 30;

/** Builder's Hub monthly price in micro-USD ($29). */
export const BUILDERS_HUB_MONTHLY_MICRO_USD = (PRICING.monthly.amountMinor / 100) * MICRO_USD_PER_USD;

export type ForecastUnits = {
  /** Mean full cost of a launch. */
  readonly launchMicroUsd: number | null;
  readonly wrenMessageMicroUsd: number | null;
  /** Measured ownerless spend per day (seeds, evals). */
  readonly platformPerDayMicroUsd: number;
};

export type ForecastInputs = {
  /** New founders who start a business each day. */
  readonly foundersPerDay: number;
  readonly launchesPerFounder: number;
  /** Wren messages per founder over their first month. */
  readonly messagesPerFounder: number;
  /** Share of those founders who pay for Builder's Hub (0–1). */
  readonly paidShare: number;
};

export type ForecastResult = {
  readonly foundersPerMonth: number;
  readonly launchMicroUsd: number;
  readonly wrenMicroUsd: number;
  readonly platformMicroUsd: number;
  readonly monthlyCostMicroUsd: number;
  readonly dailyCostMicroUsd: number;
  readonly perFounderMicroUsd: number | null;
  readonly payingFounders: number;
  readonly monthlyRevenueMicroUsd: number;
  /** AI cost ÷ revenue. Null without revenue. */
  readonly costShareOfRevenue: number | null;
  /** Unit costs that were missing (no data in the range) and counted as zero. */
  readonly missing: readonly ("launch" | "wren")[];
};

function clampNonNegative(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function forecast(units: ForecastUnits, raw: ForecastInputs): ForecastResult {
  const inputs = {
    foundersPerDay: clampNonNegative(raw.foundersPerDay),
    launchesPerFounder: clampNonNegative(raw.launchesPerFounder),
    messagesPerFounder: clampNonNegative(raw.messagesPerFounder),
    paidShare: Math.min(1, clampNonNegative(raw.paidShare)),
  };
  const foundersPerMonth = inputs.foundersPerDay * FORECAST_DAYS_PER_MONTH;
  const launchMicroUsd = Math.ceil(foundersPerMonth * inputs.launchesPerFounder * (units.launchMicroUsd ?? 0));
  const wrenMicroUsd = Math.ceil(foundersPerMonth * inputs.messagesPerFounder * (units.wrenMessageMicroUsd ?? 0));
  const platformMicroUsd = Math.ceil(units.platformPerDayMicroUsd * FORECAST_DAYS_PER_MONTH);
  const monthlyCostMicroUsd = launchMicroUsd + wrenMicroUsd + platformMicroUsd;
  const payingFounders = foundersPerMonth * inputs.paidShare;
  const monthlyRevenueMicroUsd = Math.round(payingFounders * BUILDERS_HUB_MONTHLY_MICRO_USD);
  const missing: ("launch" | "wren")[] = [];
  if (units.launchMicroUsd === null && inputs.launchesPerFounder > 0) missing.push("launch");
  if (units.wrenMessageMicroUsd === null && inputs.messagesPerFounder > 0) missing.push("wren");
  return {
    foundersPerMonth,
    launchMicroUsd,
    wrenMicroUsd,
    platformMicroUsd,
    monthlyCostMicroUsd,
    dailyCostMicroUsd: Math.ceil(monthlyCostMicroUsd / FORECAST_DAYS_PER_MONTH),
    perFounderMicroUsd: foundersPerMonth > 0 ? Math.ceil((launchMicroUsd + wrenMicroUsd) / foundersPerMonth) : null,
    payingFounders,
    monthlyRevenueMicroUsd,
    costShareOfRevenue: monthlyRevenueMicroUsd > 0 ? monthlyCostMicroUsd / monthlyRevenueMicroUsd : null,
    missing,
  };
}
