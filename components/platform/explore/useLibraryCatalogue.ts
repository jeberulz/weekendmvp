"use client";

import { usePaginatedQuery } from "convex/react";
import { useEffect } from "react";
import { api } from "@/convex/_generated/api";

/** Page size for the member catalogue drain. Smaller pages cut reactive
 * re-read cost when `ideas` writes invalidate an open subscription; total
 * docs for a full drain stay the same. */
const LIBRARY_PAGE = 40;

/** Read every bounded page before claiming complete ranking or facet counts. */
export function useLibraryCatalogue() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.platform.ideas.libraryPage,
    {},
    { initialNumItems: LIBRARY_PAGE },
  );
  useEffect(() => {
    if (status === "CanLoadMore") loadMore(LIBRARY_PAGE);
  }, [status, loadMore]);
  return { cards: results, complete: status === "Exhausted" };
}
