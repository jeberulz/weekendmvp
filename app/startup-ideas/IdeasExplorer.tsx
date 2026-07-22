"use client";

/**
 * Search + category filter + paginated grid for /startup-ideas — a port of
 * the legacy inline filtering script (startup-ideas.html, IDEAS_PER_PAGE=12).
 *
 * Legacy filter set, replicated exactly:
 *   - free-text search over lowercased title + description
 *   - single-select category chips ("All Ideas" + per-category with counts)
 *   - 12-per-page reveal with a Load More button
 * (No sort controls, no tool/audience/revenue filters, no filter analytics —
 * the legacy page had none.)
 *
 * SEO: ALL idea cards are rendered in the server HTML, visible by default.
 * Pagination/filtering only hides cards (`hidden` class) after hydration —
 * the same display:none approach the legacy script used.
 *
 * Filter state lives in the URL (?category=…&q=…) via history.replaceState
 * so reload/back/forward restores it. The URL is read in an effect (not
 * useSearchParams) so the fully cached page needs no Suspense boundary and
 * the grid stays in the prerendered HTML.
 */

import * as React from "react";
import { Search } from "lucide-react";

import { IdeaCard as SharedIdeaCard } from "@/components/primitives/IdeaCard";

export type IdeaCardData = {
  slug: string;
  title: string;
  description: string;
  /** null on the MDX build-time fallback path (no Convex metadata). */
  category: string | null;
  /** Legacy humanized label, e.g. "Developer Tools", "Ai Tools". */
  categoryLabel: string | null;
  /** "deep" → Deep Research badge, anything else → Quick Idea. */
  researchLevel: string | null;
  buildTime: string | null;
  /** Publish timestamp (ms) — drives the newest/oldest sort. 0 on the MDX
   *  fallback, where the sort control is hidden anyway. */
  publishedAt: number;
};

export type SortOrder = "newest" | "oldest";

export type CategoryFilter = {
  slug: string;
  label: string;
  count: number;
};

const IDEAS_PER_PAGE = 12;

const ACTIVE_BTN =
  "filter-btn px-4 py-2 bg-white text-black rounded-full text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-white/40";
const INACTIVE_BTN =
  "filter-btn px-4 py-2 bg-white/5 border border-white/10 rounded-full text-sm text-neutral-400 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-white/40";

function readUrlState(categories: Set<string>): {
  category: string;
  query: string;
  sort: SortOrder;
} {
  const params = new URLSearchParams(window.location.search);
  const category = params.get("category") ?? "all";
  return {
    category: categories.has(category) ? category : "all",
    query: params.get("q") ?? "",
    sort: params.get("sort") === "oldest" ? "oldest" : "newest",
  };
}

function writeUrlState(category: string, query: string, sort: SortOrder) {
  try {
    const url = new URL(window.location.href);
    if (category === "all") url.searchParams.delete("category");
    else url.searchParams.set("category", category);
    if (query) url.searchParams.set("q", query);
    else url.searchParams.delete("q");
    // "newest" is the default server order — keep it out of the URL.
    if (sort === "oldest") url.searchParams.set("sort", sort);
    else url.searchParams.delete("sort");
    window.history.replaceState(
      window.history.state,
      "",
      url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : "") + url.hash,
    );
  } catch {
    /* ignore */
  }
}

function matches(idea: IdeaCardData, category: string, query: string): boolean {
  const matchesCategory = category === "all" || idea.category === category;
  const q = query.toLowerCase();
  const matchesSearch =
    !q ||
    idea.title.toLowerCase().includes(q) ||
    idea.description.toLowerCase().includes(q);
  return matchesCategory && matchesSearch;
}

/** One idea card — composes the shared IdeaCard primitive (elevated, dark). */
function IdeaCard({ idea, hidden }: { idea: IdeaCardData; hidden: boolean }) {
  return (
    <SharedIdeaCard
      surface="elevated"
      hidden={hidden}
      idea={{
        slug: idea.slug,
        title: idea.title,
        description: idea.description,
        category: idea.category ?? undefined,
        categoryLabel: idea.categoryLabel,
        buildTime: idea.buildTime ?? undefined,
        researchLevel: idea.researchLevel,
      }}
    />
  );
}

export function IdeasExplorer({
  ideas,
  filters,
  showFilters,
}: {
  ideas: IdeaCardData[];
  filters: CategoryFilter[];
  /** false on the MDX build-time fallback (no category metadata). */
  showFilters: boolean;
}) {
  const [category, setCategory] = React.useState("all");
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<SortOrder>("newest");
  const [page, setPage] = React.useState(1);
  // Pre-hydration (and in the server HTML) every card is visible; the
  // legacy page behaved identically until its DOMContentLoaded filter ran.
  const [ready, setReady] = React.useState(false);

  const categorySlugs = React.useMemo(
    () => new Set(filters.map((f) => f.slug)),
    [filters],
  );

  // Initial URL → state, plus back/forward restoration.
  React.useEffect(() => {
    const apply = () => {
      const state = readUrlState(categorySlugs);
      setCategory(state.category);
      setQuery(state.query);
      setSort(state.sort);
      setPage(1);
    };
    apply();
    setReady(true);
    window.addEventListener("popstate", apply);
    return () => window.removeEventListener("popstate", apply);
  }, [categorySlugs]);

  function selectCategory(next: string) {
    setCategory(next);
    setPage(1);
    writeUrlState(next, query, sort);
  }

  function search(next: string) {
    setQuery(next);
    setPage(1);
    writeUrlState(category, next, sort);
  }

  function selectSort(next: SortOrder) {
    setSort(next);
    setPage(1);
    writeUrlState(category, query, next);
  }

  // Reorder by publish date after hydration. Pre-hydration we keep the prop
  // order (Convex newest-first) so the client's first render matches the
  // server HTML; React then reconciles the keyed cards into sorted order.
  const ordered = React.useMemo(() => {
    if (!ready || sort === "newest") return ideas;
    return [...ideas].sort((a, b) => a.publishedAt - b.publishedAt);
  }, [ideas, ready, sort]);

  const filtered = ordered.filter((idea) => matches(idea, category, query));
  const shown = ready
    ? new Set(
        filtered.slice(0, page * IDEAS_PER_PAGE).map((idea) => idea.slug),
      )
    : null;
  const hasMore = ready && filtered.length > page * IDEAS_PER_PAGE;

  return (
    <>
      {/* Search and Filters */}
      {showFilters ? (
        <div className="mb-8 space-y-4">
          {/* Search + sort */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500"
                aria-hidden="true"
              />
              <input
                type="text"
                id="idea-search"
                placeholder="Search ideas..."
                aria-label="Search startup ideas"
                value={query}
                onChange={(e) => search(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-white/40 transition-all"
              />
            </div>

            {/* Sort by publish date */}
            <div
              className="flex items-center gap-2 shrink-0"
              role="group"
              aria-label="Sort ideas by publish date"
            >
              <span
                className="text-xs text-neutral-500 shrink-0"
                aria-hidden="true"
              >
                Sort
              </span>
              <button
                className={sort === "newest" ? ACTIVE_BTN : INACTIVE_BTN}
                aria-pressed={sort === "newest"}
                onClick={() => selectSort("newest")}
              >
                Newest
              </button>
              <button
                className={sort === "oldest" ? ACTIVE_BTN : INACTIVE_BTN}
                aria-pressed={sort === "oldest"}
                onClick={() => selectSort("oldest")}
              >
                Oldest
              </button>
            </div>
          </div>

          {/* Category Filters */}
          <div
            className="flex flex-wrap gap-2"
            id="category-filters"
            role="group"
            aria-label="Filter by category"
          >
            <button
              className={category === "all" ? ACTIVE_BTN : INACTIVE_BTN}
              aria-pressed={category === "all"}
              onClick={() => selectCategory("all")}
            >
              All Ideas
            </button>
            {filters.map((filter) => (
              <button
                key={filter.slug}
                className={category === filter.slug ? ACTIVE_BTN : INACTIVE_BTN}
                aria-pressed={category === filter.slug}
                onClick={() => selectCategory(filter.slug)}
              >
                {filter.label} ({filter.count})
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Ideas Grid — every card is in the HTML; filtering only hides */}
      <div
        id="ideas-grid"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      >
        {ordered.map((idea) => (
          <IdeaCard
            key={idea.slug}
            idea={idea}
            hidden={shown !== null && !shown.has(idea.slug)}
          />
        ))}
        {ready && filtered.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <p className="text-neutral-500">
              No ideas found. Try a different search or filter.
            </p>
          </div>
        ) : null}
      </div>

      {/* Load More (legacy script's #load-more pagination) */}
      {hasMore ? (
        <div className="mt-10 text-center">
          <button
            id="load-more"
            onClick={() => setPage((p) => p + 1)}
            className="px-6 py-3 bg-white/5 border border-white/10 rounded-full text-sm text-white font-medium hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-white/40"
          >
            Load More Ideas
          </button>
        </div>
      ) : null}
    </>
  );
}
