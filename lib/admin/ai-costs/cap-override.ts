/**
 * WP93 Phase 3. The rules for raising one founder's daily AI cap for a while,
 * shared by the fixture store and the Convex mutation (`convex/admin/aiControls.ts`).
 * The meter reads the stored override (Codex C2, `docs/wp/wp93-codex-cap-override.md`).
 *
 * An override only ever raises the plan's daily cap. It never lifts the Free
 * lifetime ceiling, the pool budgets or the kill switches.
 */

import { MICRO_USD_PER_USD } from "./money";

/**
 * On since the meter reads overrides (Codex C2, #296). Set it to false to hide
 * the live form: the console then shows a note, and the live backend refuses
 * every write without calling Convex.
 */
export const CAP_OVERRIDE_LIVE = true;

/** A typo guard: no founder above $25 a day. */
export const CAP_OVERRIDE_CEILING_MICRO_USD = 25 * MICRO_USD_PER_USD;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const EXPIRY_CHOICES = ["1h", "4h", "end_of_day"] as const;
export type ExpiryChoice = (typeof EXPIRY_CHOICES)[number];

export const EXPIRY_LABELS: Readonly<Record<ExpiryChoice, string>> = {
  "1h": "In 1 hour",
  "4h": "In 4 hours",
  end_of_day: "At the end of today (UTC)",
};

export type CapOverride = {
  readonly ownerId: string;
  readonly capMicroUsd: number;
  readonly expiresAt: number;
  readonly setAt: number;
  readonly reason: string;
};

/** Midnight UTC after `nowMs`: the latest an override may last. */
export function endOfUtcDay(nowMs: number): number {
  return Math.floor(nowMs / DAY_MS) * DAY_MS + DAY_MS;
}

/** When an override set now ends. Never past the end of the UTC day. */
export function expiryFor(choice: ExpiryChoice, nowMs: number): number {
  const end = endOfUtcDay(nowMs);
  if (choice === "1h") return Math.min(nowMs + HOUR_MS, end);
  if (choice === "4h") return Math.min(nowMs + 4 * HOUR_MS, end);
  return end;
}

export type CapRefusal = "INVALID_BUDGET" | "CAP_NOT_A_RAISE" | "CAP_TOO_HIGH";

/** Null when `capMicroUsd` is a raise the server accepts over `baseCapMicroUsd`. */
export function capOverrideRefusal(capMicroUsd: number, baseCapMicroUsd: number): CapRefusal | null {
  if (!Number.isSafeInteger(capMicroUsd) || capMicroUsd < 0) return "INVALID_BUDGET";
  if (capMicroUsd > CAP_OVERRIDE_CEILING_MICRO_USD) return "CAP_TOO_HIGH";
  if (capMicroUsd <= baseCapMicroUsd) return "CAP_NOT_A_RAISE";
  return null;
}

export function isActive(override: Pick<CapOverride, "expiresAt"> | null | undefined, nowMs: number): boolean {
  return override !== null && override !== undefined && nowMs < override.expiresAt;
}

/** The daily cap the meter applies now: the override while it lasts, the plan's cap otherwise. */
export function effectiveDailyCap(baseCapMicroUsd: number, override: CapOverride | null | undefined, nowMs: number): number {
  return override && isActive(override, nowMs) ? override.capMicroUsd : baseCapMicroUsd;
}
