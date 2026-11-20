/**
 * WP93 Phase 2. The rules behind the ops controls, shared by the Convex
 * mutation (which enforces them) and the console (which explains them).
 *
 * Owner decision 2026-11-20: only risky changes need a fresh sign-in and a
 * typed confirm. Turning things off and lowering budgets stay one click.
 */

import { STRONG_AUTH_MAX_AGE_MS } from "../../editorial/contracts/principal";
import { MICRO_USD_PER_USD } from "./money";

export const SWITCH_KEYS = ["ai", "studioVideo", "publish", "email", "social", "ads"] as const;
export type SwitchKey = (typeof SWITCH_KEYS)[number];

/** `true` means the kill switch is set: the feature is off. */
export type KillSwitches = Readonly<Record<SwitchKey, boolean>>;

export const SWITCH_LABELS: Readonly<Record<SwitchKey, string>> = {
  ai: "AI calls",
  studioVideo: "Studio video",
  publish: "Publishing",
  email: "Email sending",
  social: "Social posting",
  ads: "Ads",
};

export type Pool = "free" | "paid";
export const POOL_LABELS: Readonly<Record<Pool, string>> = { free: "Free pool", paid: "Paid pool" };

export type SpendControls = {
  readonly freeBudgetMicroUsd: number;
  readonly paidBudgetMicroUsd: number;
  readonly killSwitches: KillSwitches;
};

/** A typo guard: no pool budget above $100 a day. */
export const POOL_BUDGET_CEILING_MICRO_USD = 100 * MICRO_USD_PER_USD;

/** What the owner types to confirm a risky change. */
export const CONFIRM_PHRASE = "confirm";

/** A recent full sign-in, the same window as the editorial step-up. */
export const STEP_UP_MAX_AGE_MS = STRONG_AUTH_MAX_AGE_MS;

/** The session's creation time is the last full sign-in (Convex Auth keeps it across refreshes). */
export function signedInRecently(sessionCreatedAt: number, nowMs: number): boolean {
  return sessionCreatedAt <= nowMs + 1000 && nowMs - sessionCreatedAt <= STEP_UP_MAX_AGE_MS;
}

export function confirmMatches(typed: string | null | undefined): boolean {
  return typeof typed === "string" && typed.trim().toLowerCase() === CONFIRM_PHRASE;
}

/**
 * Parses a dollar amount typed by the owner ("7", "7.5", "$12.00") into
 * integer micro-USD. Cents at most; null for anything else.
 */
export function parseUsdInput(input: string): number | null {
  const match = /^\s*\$?\s*(\d{1,6})(?:\.(\d{1,2}))?\s*$/.exec(input);
  if (!match) return null;
  const cents = Number(match[1]) * 100 + Number((match[2] ?? "0").padEnd(2, "0"));
  return cents * (MICRO_USD_PER_USD / 100);
}

/** A budget the server accepts: whole micro-USD, not negative, at most the ceiling. */
export function budgetAllowed(microUsd: number): boolean {
  return Number.isSafeInteger(microUsd) && microUsd >= 0 && microUsd <= POOL_BUDGET_CEILING_MICRO_USD;
}

export type RiskReason =
  | { kind: "switch_on"; key: SwitchKey }
  | { kind: "budget_from_zero"; pool: Pool }
  | { kind: "budget_over_spend"; pool: Pool; spentMicroUsd: number };

/**
 * Why a change is risky, or an empty list. Risky means it turns something
 * on, or raises a pool budget from $0 or above twice today's spend in it.
 */
export function riskReasons(
  current: SpendControls,
  next: SpendControls,
  spentToday: Readonly<Record<Pool, number>>,
): RiskReason[] {
  const reasons: RiskReason[] = [];
  for (const key of SWITCH_KEYS) {
    if (current.killSwitches[key] && !next.killSwitches[key]) reasons.push({ kind: "switch_on", key });
  }
  const pools: readonly [Pool, number, number][] = [
    ["free", current.freeBudgetMicroUsd, next.freeBudgetMicroUsd],
    ["paid", current.paidBudgetMicroUsd, next.paidBudgetMicroUsd],
  ];
  for (const [pool, before, after] of pools) {
    if (after <= before) continue;
    if (before === 0) reasons.push({ kind: "budget_from_zero", pool });
    else if (after > 2 * spentToday[pool]) reasons.push({ kind: "budget_over_spend", pool, spentMicroUsd: spentToday[pool] });
  }
  return reasons;
}

export function describeRisk(reason: RiskReason): string {
  if (reason.kind === "switch_on") return `turns ${SWITCH_LABELS[reason.key].toLowerCase()} back on`;
  if (reason.kind === "budget_from_zero") return `raises the ${POOL_LABELS[reason.pool].toLowerCase()} budget from $0`;
  return `raises the ${POOL_LABELS[reason.pool].toLowerCase()} budget above twice today's spend`;
}

/** Refusal codes the controls return, and what the console says for each. */
export const CONTROL_ERRORS = {
  FORBIDDEN: "Only the super admin can change these controls.",
  REAUTH_REQUIRED: "This change needs a sign-in from the last 10 minutes. Confirm it's you, then save again.",
  CONFIRM_REQUIRED: `Type "${CONFIRM_PHRASE}" to make this change.`,
  BUDGET_TOO_HIGH: "A pool budget can be at most $100 a day.",
  INVALID_BUDGET: "Enter a dollar amount, like 7 or 7.50.",
  STALE: "These settings changed since the page loaded. Reload to see the current values.",
  NO_CHANGE: "Nothing to save: the values are the same as now.",
  REASON_REQUIRED: "Give a reason for removing this tester.",
  NOT_VERIFIED: "This account has not verified its email, so it cannot join the cohort.",
  RESOURCE_NOT_FOUND: "That account no longer exists.",
  UNAVAILABLE: "The change could not be saved. Nothing was changed; reload and try again.",
  CAP_TOO_HIGH: "A founder's daily cap can be raised to at most $25.",
  CAP_NOT_A_RAISE: "Enter more than the plan's daily cap: an override only raises it.",
  CAP_REASON_REQUIRED: "Give a reason for raising this founder's cap.",
  NOT_AVAILABLE: "Raising a founder's cap is switched off. Nothing was changed.",
} as const;

export type ControlErrorCode = keyof typeof CONTROL_ERRORS;

export function isControlErrorCode(code: unknown): code is ControlErrorCode {
  return typeof code === "string" && Object.hasOwn(CONTROL_ERRORS, code);
}

/** Reasons longer than this are cut; the audit row keeps them short. */
export const REASON_MAX = 300;

export function cleanReason(reason: string | null | undefined): string | null {
  const trimmed = (reason ?? "").trim().replace(/\s+/g, " ");
  return trimmed.length === 0 ? null : trimmed.slice(0, REASON_MAX);
}

/** Lower-cased and trimmed; null when it cannot be an email address. */
export function normalizeEmail(input: string): string | null {
  const email = input.trim().toLowerCase();
  if (email.length < 3 || email.length > 254 || !/^[^\s@]+@[^\s@]+$/.test(email)) return null;
  return email;
}
