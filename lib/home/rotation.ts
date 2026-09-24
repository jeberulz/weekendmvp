/**
 * Weekly rotation for "Idea of the week" (section 03) and "Inside every idea"
 * (section 06). Weeks start Monday 00:00 UTC. Section 06 sits half a rotation
 * away from section 03, so the two never show the same idea.
 */

const DAY_MS = 86_400_000;
/** Monday 2026-01-05, the start of week 0. Any Monday works; it only fixes the phase. */
const EPOCH_MS = Date.UTC(2026, 0, 5);

export function weekStartUtc(now: Date): Date {
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const daysSinceMonday = (now.getUTCDay() + 6) % 7;
  return new Date(midnight - daysSinceMonday * DAY_MS);
}

export function weekIndex(now: Date): number {
  return Math.floor((weekStartUtc(now).getTime() - EPOCH_MS) / (7 * DAY_MS));
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Sep 21–27", or "Sep 28–Oct 4" when the week crosses a month. */
export function weekLabel(now: Date): string {
  const start = weekStartUtc(now);
  const end = new Date(start.getTime() + 6 * DAY_MS);
  const from = `${MONTHS[start.getUTCMonth()]} ${start.getUTCDate()}`;
  const to = end.getUTCMonth() === start.getUTCMonth() ? `${end.getUTCDate()}` : `${MONTHS[end.getUTCMonth()]} ${end.getUTCDate()}`;
  return `${from}–${to}`;
}

export function pickWeekly<T>(pool: readonly T[], now: Date): { spotlight: T; inside: T } | null {
  const n = pool.length;
  if (n === 0) return null;
  const i = ((weekIndex(now) % n) + n) % n;
  return { spotlight: pool[i], inside: pool[(i + Math.floor(n / 2)) % n] };
}
