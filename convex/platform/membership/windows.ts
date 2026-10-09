/**
 * WP63-S7. The founding offer windows (ruling "WP55 / founding offer order").
 * Window 1 opens for ship·able and DARE buyers, window 2 adds newsletter
 * subscribers, window 3 opens to every signed-in member. Each window stays
 * open until the 50 seats are gone. Windows only add people.
 *
 * Dates are milliseconds since the epoch. Null keeps a window closed. All
 * three stay null until the owner sets them at launch (O7, WP63-S12 step 6),
 * so a merge offers nobody a seat. Changing a date is a code change and a
 * deploy, like a promo in `lib/dashboard/offers.ts`.
 */

export type FoundingWindows = {
  buyers: number | null;
  newsletter: number | null;
  everyone: number | null;
};

export const FOUNDING_WINDOWS: FoundingWindows = {
  buyers: null,
  newsletter: null,
  everyone: null,
};
