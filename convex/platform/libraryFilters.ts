/**
 * Pure filter vocabulary for the Ideas library (WP44-S5). Shared by the
 * Convex query and the client, so a URL value always means the same thing on
 * both sides. No server imports here.
 */

export const LIBRARY_VIEWS = ["all", "for_you", "new"] as const;
export type LibraryView = (typeof LIBRARY_VIEWS)[number];

/** Sorts a member can pick on the All tab. For you and New fix their own. */
export const LIBRARY_SORTS = ["relevance", "newest", "score"] as const;
export type LibrarySort = (typeof LIBRARY_SORTS)[number] | "recommended";

export const HOURS_BUCKETS = ["8", "12", "16", "more"] as const;
export type HoursBucket = (typeof HOURS_BUCKETS)[number];

/** "8" is one Saturday, "12" fits most weekends, "16" is the whole weekend. */
export function hoursBucket(buildTime: number): HoursBucket {
  if (buildTime <= 8) return "8";
  if (buildTime <= 12) return "12";
  if (buildTime <= 16) return "16";
  return "more";
}

/** Ideas the New tab covers: published in the last 30 days. */
export const NEW_WINDOW_DAYS = 30;

/** Most tools a member can pick at once. */
export const MAX_TOOL_FILTERS = 8;
export const MAX_SEARCH_LENGTH = 80;
/** Largest page the client may ask for. "Show more" grows toward it. */
export const MAX_LIBRARY_LIMIT = 240;

export function effectiveSort(
  view: LibraryView,
  sort: (typeof LIBRARY_SORTS)[number] | undefined,
  hasSearch: boolean,
): LibrarySort {
  if (view === "for_you") return "recommended";
  if (view === "new") return "newest";
  if (sort === "relevance" && !hasSearch) return "newest";
  return sort ?? (hasSearch ? "relevance" : "newest");
}
