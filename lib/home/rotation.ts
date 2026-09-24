/**
 * Weekly picks for "Idea of the week" (section 03) and "Inside every idea"
 * (section 06). Weeks start Monday 00:00 UTC.
 *
 * The picks must hold for the whole week even though the page regenerates
 * hourly and the pool can change midweek (a publish, a retirement, OG art
 * finishing). So instead of indexing into the pool, each week ranks its
 * candidates by a hash of (week, slug) and takes the top two:
 *
 * - candidates are ideas published before that week's Monday, so a midweek
 *   publish never enters the running week;
 * - removing or adding any idea other than a winner cannot change the
 *   winners, because every other idea keeps its own hash;
 * - last week's two picks are skipped, so no idea repeats in back-to-back
 *   weeks, and section 06 is always a different idea from section 03.
 *
 * A winner changes midweek only if that idea itself stops qualifying (for
 * example it is retired), or an idea published before Monday newly qualifies
 * and outranks it (roughly a 1-in-pool-size chance per such change).
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

/** 32-bit FNV-1a. Stable across runtimes, which is all the ranking needs. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export type WeeklyCandidate = { slug: string; publishedAt?: string };

/** Candidates for week `w`, best first. Falls back to every candidate while the snapshot is too small. */
function ranked<T extends WeeklyCandidate>(pool: readonly T[], w: number): T[] {
  const monday = new Date(EPOCH_MS + w * 7 * DAY_MS).toISOString().slice(0, 10);
  const snapshot = pool.filter((c) => (c.publishedAt ?? "") < monday);
  const list = snapshot.length >= 2 ? snapshot : [...pool];
  return list
    .map((c) => ({ c, score: hash(`${w}:${c.slug}`) }))
    .sort((a, b) => b.score - a.score || a.c.slug.localeCompare(b.c.slug))
    .map((r) => r.c);
}

function topTwo<T extends WeeklyCandidate>(pool: readonly T[], w: number, skip: ReadonlySet<string>): T[] {
  const order = ranked(pool, w);
  const fresh = order.filter((c) => !skip.has(c.slug));
  return (fresh.length >= 2 ? fresh : order).slice(0, 2);
}

/** Weeks replayed before `now` so last week's picks are the ones it really showed. */
const REPLAY_WEEKS = 4;

export function pickWeekly<T extends WeeklyCandidate>(pool: readonly T[], now: Date): { spotlight: T; inside: T } | null {
  if (pool.length === 0) return null;
  const w = weekIndex(now);
  let picks: T[] = [];
  for (let week = w - REPLAY_WEEKS; week <= w; week++) {
    picks = topTwo(pool, week, new Set(picks.map((c) => c.slug)));
  }
  const [spotlight, inside = spotlight] = picks;
  return { spotlight, inside };
}
