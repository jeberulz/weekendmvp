/**
 * Year-one revenue math (WP46, plan §9, contract §5 "Finance").
 *
 * One pure calculation shared by the record parser, the compiler and the
 * auditor. Money is exact integer cents (BigInt internally); account and
 * seat counts are validated whole numbers and are never rounded.
 *
 *   per-account amount = tier unit price × seatsPerAccount
 *   ARR                = paying accounts × per-account amount × (12 for a
 *                        monthly price, 1 for an annual price — no monthly
 *                        conversion of annual prices)
 *   downside accounts  = floor(paying accounts / 2), which may be 0 (an odd
 *                        count rounds down: 45 → 22); downside ARR uses the
 *                        same per-account amount, so it never exceeds ARR
 *
 * The funnel, seat count and tier choice are product ASSUMPTIONS proposed by
 * the writer, not measured facts; the compiler must label them that way.
 * Only USD tiers with one fixed month or year price can drive the math:
 * Free, Custom, ranges, "from" prices, introductory prices and usage add-ons
 * are rejected rather than guessed.
 */

import { parsePriceTerms, priceToCents } from "./evidence/amount.ts";
import type { PriceTerms, YearOnePlanV2 } from "./evidence/contract.ts";
import type { PricingTier } from "./research-record.ts";

/** ARR above this many cents ($10,000,000,000) is rejected as implausible. */
export const ARR_CAP_CENTS = 1_000_000_000_000;

const PATH = "editorial.yearOne";
const MAX_STAGES = 12;
const MAX_STAGE_CHARS = 200;

/** Why computeYearOne refused a plan or price. */
export type YearOneMathErrorCode = "invalid_plan" | "invalid_price" | "arr_cap";

/** Typed failure of computeYearOne (bad inputs, or ARR above the cap). */
export class YearOneMathError extends Error {
  readonly code: YearOneMathErrorCode;

  constructor(code: YearOneMathErrorCode, message: string) {
    super(message);
    this.name = "YearOneMathError";
    this.code = code;
  }
}

/** Exact year-one figures in integer cents. */
export type YearOneMath = {
  baseAccounts: number;
  seatsPerAccount: number;
  unitPriceCents: number;
  period: "month" | "year";
  perAccountCents: number;
  arrCents: number;
  downsideAccounts: number;
  downsideArrCents: number;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isWholeCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
}

function describe(value: unknown): string {
  if (typeof value === "number") return String(value);
  if (value === undefined) return "nothing";
  return typeof value;
}

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Exact USD display: "$54,000", "$24.99", "$1,199.88" (cents shown only when non-zero). */
export function formatUsdCents(cents: number): string {
  if (!Number.isSafeInteger(cents)) throw new RangeError(`cents must be a safe integer (got ${cents})`);
  const magnitude = BigInt(Math.abs(cents));
  const dollars = magnitude / BigInt(100);
  const rest = magnitude % BigInt(100);
  const body = `$${groupThousands(dollars.toString())}${rest === BigInt(0) ? "" : `.${rest.toString().padStart(2, "0")}`}`;
  return cents < 0 ? `-${body}` : body;
}

/** Why a price cannot drive year-one math, or null when it can. */
function priceIssue(terms: PriceTerms): string | null {
  if (terms.period !== "month" && terms.period !== "year") return "tier price must be per month or per year";
  if (terms.amount.unit !== "currency" || terms.amount.currency !== "USD") {
    return `year-one math is in USD; the tier price is in ${terms.amount.currency ?? "no currency"}`;
  }
  const variable = terms.qualifiers.filter((q) => q === "starting_at" || q === "introductory" || q === "plus_usage");
  if (variable.length > 0) return `tier price is not one fixed price (${variable.join(", ")})`;
  const cents = priceToCents(terms);
  if (cents === null) return "tier price has sub-cent precision or is too large";
  if (cents <= 0) return "tier price must be greater than zero";
  return null;
}

/**
 * The pricing tier a year-one plan lands on, with its parsed price, or the
 * reason it cannot be used (unknown or duplicate name, unparseable price,
 * not monthly/annual, not USD, not a fixed price).
 */
export function yearOneTierTerms(
  tierName: string,
  tiers: ReadonlyArray<PricingTier>,
): { ok: true; tier: PricingTier; terms: PriceTerms } | { ok: false; issue: string } {
  const name = tierName.trim();
  const matches = tiers.filter((t) => typeof t.name === "string" && t.name.trim() === name);
  if (matches.length === 0) {
    const names = tiers.map((t) => t.name).join(", ") || "none";
    return { ok: false, issue: `"${name}" is not a pricing tier (tiers: ${names})` };
  }
  const tier = matches[0];
  if (matches.length > 1 || !tier) return { ok: false, issue: `"${name}" names more than one pricing tier` };
  const terms = typeof tier.price === "string" ? parsePriceTerms(tier.price) : null;
  if (!terms) {
    return { ok: false, issue: `tier price "${String(tier.price)}" is not one supported fixed price` };
  }
  const issue = priceIssue(terms);
  return issue ? { ok: false, issue } : { ok: true, tier, terms };
}

/**
 * Exact year-one figures. Throws YearOneMathError for counts that are not
 * whole numbers ≥ 1, seats ≠ 1 on a flat or per-workspace price, a price
 * that is not a positive USD month/year amount in whole cents, or an ARR
 * above ARR_CAP_CENTS. Inputs are checked before any multiplication.
 */
export function computeYearOne(plan: YearOnePlanV2, tierTerms: PriceTerms): YearOneMath {
  const accounts = plan.payingAccounts;
  const seats = plan.seatsPerAccount;
  if (!isWholeCount(accounts)) {
    throw new YearOneMathError("invalid_plan", `payingAccounts must be a whole number ≥ 1 (got ${describe(accounts)})`);
  }
  if (!isWholeCount(seats)) {
    throw new YearOneMathError("invalid_plan", `seatsPerAccount must be a whole number ≥ 1 (got ${describe(seats)})`);
  }
  if (tierTerms.basis !== "per_user" && seats !== 1) {
    throw new YearOneMathError("invalid_plan", `seatsPerAccount must be 1 for a ${tierTerms.basis} price`);
  }
  const issue = priceIssue(tierTerms);
  const unit = priceToCents(tierTerms);
  if (issue || unit === null || (tierTerms.period !== "month" && tierTerms.period !== "year")) {
    throw new YearOneMathError("invalid_price", issue ?? "tier price cannot drive year-one math");
  }
  const periodsPerYear = BigInt(tierTerms.period === "month" ? 12 : 1);
  const perAccount = BigInt(unit) * BigInt(seats);
  const arr = BigInt(accounts) * perAccount * periodsPerYear;
  if (arr > BigInt(ARR_CAP_CENTS)) {
    throw new YearOneMathError("arr_cap", `ARR ${formatUsdCentsBig(arr)} is above the ${formatUsdCents(ARR_CAP_CENTS)} cap`);
  }
  const downsideAccounts = Math.floor(accounts / 2);
  const downsideArr = BigInt(downsideAccounts) * perAccount * periodsPerYear;
  // arr ≤ ARR_CAP_CENTS < Number.MAX_SAFE_INTEGER, and perAccount, downsideArr ≤ arr.
  return {
    baseAccounts: accounts,
    seatsPerAccount: seats,
    unitPriceCents: unit,
    period: tierTerms.period,
    perAccountCents: Number(perAccount),
    arrCents: Number(arr),
    downsideAccounts,
    downsideArrCents: Number(downsideArr),
  };
}

function formatUsdCentsBig(cents: bigint): string {
  const dollars = cents / BigInt(100);
  const rest = cents % BigInt(100);
  return `$${groupThousands(dollars.toString())}${rest === BigInt(0) ? "" : `.${rest.toString().padStart(2, "0")}`}`;
}

/** Exact cents for a legacy decimal number such as 99.95, or null. */
function legacyNumberToCents(value: number): number | null {
  const text = String(value);
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!m) return null;
  const cents = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}

function readFunnel(raw: unknown, issues: string[]): Array<{ stage: string; count: number }> {
  if (!Array.isArray(raw) || raw.length < 2) {
    issues.push(`${PATH}.funnel: need at least 2 stages`);
    return [];
  }
  if (raw.length > MAX_STAGES) issues.push(`${PATH}.funnel: at most ${MAX_STAGES} stages`);
  const funnel: Array<{ stage: string; count: number }> = [];
  raw.forEach((row, i) => {
    if (!isPlainObject(row)) {
      issues.push(`${PATH}.funnel[${i}]: expected { stage, count }`);
      return;
    }
    const stage = typeof row.stage === "string" ? row.stage.trim() : "";
    if (!stage || stage.length > MAX_STAGE_CHARS) issues.push(`${PATH}.funnel[${i}].stage: required, at most ${MAX_STAGE_CHARS} characters`);
    if (!isWholeCount(row.count)) {
      issues.push(`${PATH}.funnel[${i}].count: must be a whole number ≥ 1 (got ${describe(row.count)})`);
      return;
    }
    if (stage) funnel.push({ stage, count: row.count });
  });
  if (funnel.length === raw.length) {
    for (let i = 1; i < funnel.length; i += 1) {
      const previous = funnel[i - 1];
      const current = funnel[i];
      if (previous && current && current.count > previous.count) {
        issues.push(`${PATH}.funnel: stage counts must not increase (stage ${i})`);
        break;
      }
    }
  }
  return funnel;
}

/**
 * Validate a v2 year-one plan against the record's pricing tiers. Never
 * rounds: 0.4, 0, negatives, NaN, Infinity and unsafe integers are issues.
 * A legacy `monthlyRevenuePerAccount`, when present, must equal the tier's
 * monthly price × seats exactly; it is never used. Returns the plan only
 * when there are no issues (the ARR cap included).
 */
export function validateYearOnePlan(
  raw: unknown,
  tiers: ReadonlyArray<PricingTier>,
): { plan?: YearOnePlanV2; issues: string[] } {
  if (!isPlainObject(raw)) return { issues: [`${PATH}: expected an object`] };
  const issues: string[] = [];
  const funnel = readFunnel(raw.funnel, issues);
  const last = funnel[funnel.length - 1];

  const accounts = raw.payingAccounts;
  if (!isWholeCount(accounts)) {
    issues.push(`${PATH}.payingAccounts: must be a whole number ≥ 1 (got ${describe(accounts)})`);
  } else if (last && funnel.length === (Array.isArray(raw.funnel) ? raw.funnel.length : 0) && accounts !== last.count) {
    issues.push(`${PATH}.payingAccounts: must equal the last funnel stage count (${last.count})`);
  }

  const seats = raw.seatsPerAccount;
  if (!isWholeCount(seats)) {
    issues.push(`${PATH}.seatsPerAccount: must be a whole number ≥ 1 (got ${describe(seats)})`);
  }

  const tierName = typeof raw.tier === "string" ? raw.tier.trim() : "";
  let terms: PriceTerms | null = null;
  if (!tierName) {
    issues.push(`${PATH}.tier: required`);
  } else {
    const resolved = yearOneTierTerms(tierName, tiers);
    if (resolved.ok) terms = resolved.terms;
    else issues.push(`${PATH}.tier: ${resolved.issue}`);
  }
  if (terms && isWholeCount(seats) && terms.basis !== "per_user" && seats !== 1) {
    issues.push(`${PATH}.seatsPerAccount: must be 1 for a ${terms.basis === "flat" ? "flat" : "per-workspace"} tier price`);
  }

  if (raw.assumptions !== undefined && raw.assumptions !== null && typeof raw.assumptions !== "string") {
    issues.push(`${PATH}.assumptions: must be a string`);
  }
  const assumptions = typeof raw.assumptions === "string" ? raw.assumptions.trim() : "";

  const legacy = raw.monthlyRevenuePerAccount;
  if (legacy !== undefined && legacy !== null) {
    const legacyCents = typeof legacy === "number" ? legacyNumberToCents(legacy) : null;
    const unit = terms ? priceToCents(terms) : null;
    if (legacyCents === null) {
      issues.push(`${PATH}.monthlyRevenuePerAccount: must be a whole-cent USD amount (got ${describe(legacy)})`);
    } else if (terms && terms.period === "year") {
      issues.push(`${PATH}.monthlyRevenuePerAccount: does not apply to an annually priced tier; remove it`);
    } else if (unit !== null && isWholeCount(seats) && legacyCents !== unit * seats) {
      issues.push(
        `${PATH}.monthlyRevenuePerAccount: ${formatUsdCents(legacyCents)} is not ${formatUsdCents(unit)} × ${seats} seats = ${formatUsdCents(unit * seats)}`,
      );
    }
  }

  if (issues.length > 0 || !terms || !isWholeCount(accounts) || !isWholeCount(seats)) return { issues };
  const plan: YearOnePlanV2 = {
    funnel,
    tier: tierName,
    payingAccounts: accounts,
    seatsPerAccount: seats,
    ...(assumptions ? { assumptions } : {}),
  };
  try {
    computeYearOne(plan, terms);
  } catch (error) {
    if (error instanceof YearOneMathError) return { issues: [`${PATH}: ${error.message}`] };
    throw error;
  }
  return { plan, issues: [] };
}
