"use client";

import { usePaginatedQuery } from "convex/react";
import { useEffect } from "react";
import { api } from "@/convex/_generated/api";

/** Read every bounded page before claiming complete ranking or facet counts. */
export function useLibraryCatalogue() {
  const { results, status, loadMore } = usePaginatedQuery(api.platform.ideas.libraryPage, {}, { initialNumItems: 100 });
  useEffect(() => {
    if (status === "CanLoadMore") loadMore(100);
  }, [status, loadMore]);
  return { cards: results, complete: status === "Exhausted" };
}
