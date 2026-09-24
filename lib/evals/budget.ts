/**
 * WP41-S2. Hard spend cap for one content-eval run.
 *
 * Ruled 2026-09-24 (`docs/wp/RULINGS.md`, "WP41 / eval budget"): a full sweep
 * must cost under $10, enforced before spending rather than reported after.
 *
 * Every call reserves its worst-case cost first. A reservation that would
 * push spent + open reservations over the cap is refused, so concurrent
 * calls (three judges in parallel) cannot jointly overspend. After the call,
 * the reservation settles to the actual charge.
 *
 * All sums are whole micro-dollars (millionths). Floats are never compared
 * to the cap, and costs round up: an understated cost is the only rounding
 * error that can overspend.
 */

import { BudgetExceededError, EvalConfigError } from "./errors.ts";

/** The ruled ceiling. EVALS_MAX_USD may lower it, never raise it. */
export const MAX_CAP_USD = 10;

export function toMicroUsd(usd: number): number {
  if (!Number.isFinite(usd) || usd < 0) {
    throw new Error(`cost must be a non-negative finite number, got ${usd}`);
  }
  // Trim float noise first so 0.1 + 0.2 does not round up to an extra µ$.
  return Math.ceil(Number((usd * 1_000_000).toFixed(6)));
}

export function fromMicroUsd(microUsd: number): number {
  return microUsd / 1_000_000;
}

/**
 * Read the cap from EVALS_MAX_USD. Unset or empty means the ruled $10.
 * Anything that is not a positive number at or under $10 fails closed.
 */
export function readCapUsd(env: Record<string, string | undefined> = process.env): number {
  const raw = env.EVALS_MAX_USD?.trim();
  if (raw === undefined || raw === "") return MAX_CAP_USD;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new EvalConfigError(
      `EVALS_MAX_USD must be a positive number of dollars, got '${raw}'`,
    );
  }
  if (value > MAX_CAP_USD) {
    throw new EvalConfigError(
      `EVALS_MAX_USD=${raw} is above the $${MAX_CAP_USD} ruling (docs/wp/RULINGS.md, WP41 / eval budget). Record a new ruling before raising it.`,
    );
  }
  return value;
}

export type Reservation = { readonly id: number; readonly microUsd: number };

export type Budget = {
  readonly capMicroUsd: number;
  /** Refuse (throw) or hold the worst case for one call. */
  reserve(worstCaseUsd: number): Reservation;
  /** Replace a reservation with what the call actually cost. */
  settle(reservation: Reservation, actualUsd: number): number;
  /** Drop a reservation for a call that was never sent or never billed. */
  release(reservation: Reservation): void;
  spentUsd(): number;
  reservedUsd(): number;
  remainingUsd(): number;
};

export function createBudget(capUsd: number): Budget {
  const capMicroUsd = toMicroUsd(capUsd);
  const open = new Map<number, number>();
  let spent = 0;
  let nextId = 1;

  const reserved = () => [...open.values()].reduce((a, b) => a + b, 0);

  const close = (reservation: Reservation) => {
    if (!open.delete(reservation.id)) {
      throw new Error(`reservation ${reservation.id} is not open`);
    }
  };

  return {
    capMicroUsd,

    reserve(worstCaseUsd) {
      const microUsd = toMicroUsd(worstCaseUsd);
      const committed = spent + reserved();
      if (committed + microUsd > capMicroUsd) {
        throw new BudgetExceededError({
          capMicroUsd,
          committedMicroUsd: committed,
          requestedMicroUsd: microUsd,
        });
      }
      const reservation = { id: nextId++, microUsd };
      open.set(reservation.id, microUsd);
      return reservation;
    },

    settle(reservation, actualUsd) {
      close(reservation);
      // A provider may report slightly more than the estimate. Record the
      // truth: the next reservation then sees the real total and stops.
      const microUsd = toMicroUsd(actualUsd);
      spent += microUsd;
      return microUsd;
    },

    release(reservation) {
      close(reservation);
    },

    spentUsd: () => fromMicroUsd(spent),
    reservedUsd: () => fromMicroUsd(reserved()),
    remainingUsd: () => fromMicroUsd(Math.max(0, capMicroUsd - spent - reserved())),
  };
}
