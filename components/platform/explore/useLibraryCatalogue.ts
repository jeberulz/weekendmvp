"use client";

/**
 * @deprecated Do not use for new UI. Exhausting `libraryPage` dominated Free-plan
 * DB I/O (40 MB / 2 days while home+explore still called this). Home and explore
 * now use `api.platform.ideas.library` directly.
 *
 * This stub remains only so a stale import fails loudly in review instead of
 * silently re-subscribing to paginated full-doc reads. Prefer:
 *   useQuery(api.platform.ideas.library, { view, limit, ...filters })
 */
export function useLibraryCatalogue(): never {
  throw new Error(
    "useLibraryCatalogue was removed: it exhausted platform/ideas.libraryPage " +
      "(full idea docs × N pages × reactive re-runs). Use api.platform.ideas.library.",
  );
}
