/**
 * WP64-S7. The founding offer windows (ruling "WP55 / founding offer order").
 * Window 1 opens for ship·able and DARE buyers, window 2 adds newsletter
 * subscribers, window 3 opens to every signed-in member. Each window stays
 * open until the 50 seats are gone. Windows only add people.
 *
 * Dates are milliseconds since the epoch. Null keeps a window closed.
 * Changing a date is a code change and a deploy, like a promo in
 * `lib/dashboard/offers.ts`.
 *
 * Ruling "WP64 / founding windows" (O7, 2026-10-09): the owner opened the
 * offer to every signed-in member from 2026-10-09 13:32 UTC. Windows 1 and 2
 * stay closed: with window 3 open, an earlier window would add nobody.
 */

export type FoundingWindows = {
  buyers: number | null;
  newsletter: number | null;
  everyone: number | null;
};

export const FOUNDING_WINDOWS: FoundingWindows = {
  buyers: null,
  newsletter: null,
  // 2026-10-09T13:32:00Z
  everyone: 1791552720000,
};
