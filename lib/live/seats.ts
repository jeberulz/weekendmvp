import { SEATS_TOTAL } from "@/lib/live/config";

/**
 * Seat-copy rules from the design spec.
 * Only show a count when `sold` comes from real ticket sales (or a manual
 * override of that real count). Never invent a number.
 */

export type SeatsInfo = {
  total: number;
  /** null = no live count available */
  sold: number | null;
  left: number | null;
  soldOut: boolean;
};

export function seatsFromSold(sold: number | null): SeatsInfo {
  if (sold === null) {
    return { total: SEATS_TOTAL, sold: null, left: null, soldOut: false };
  }
  const clamped = Math.max(0, Math.min(SEATS_TOTAL, Math.floor(sold)));
  const left = SEATS_TOTAL - clamped;
  return {
    total: SEATS_TOTAL,
    sold: clamped,
    left,
    soldOut: left <= 0,
  };
}

/** Spec table: default / only-N / last / no-count / sold-out handled by caller. */
export function seatsLine(info: SeatsInfo): string {
  if (info.soldOut) return "Sold out";
  if (info.left === null) return `${info.total} seats only.`;
  if (info.left === 1) return "Last seat.";
  if (info.left <= 5) return `Only ${info.left} seats left.`;
  return `${info.total} seats. ${info.left} left.`;
}
