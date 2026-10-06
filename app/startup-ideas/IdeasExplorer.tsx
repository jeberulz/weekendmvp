"use client";

/**
 * Search + sort + category filter + paginated list for /startup-ideas — a
 * port of the legacy inline filtering script (startup-ideas.html,
 * IDEAS_PER_PAGE=12), drawn with the WP56 research-desk kit.
 *
 * Legacy filter set, replicated exactly:
 *   - free-text search over lowercased title + description
 *   - single-select category tabs ("All Ideas" + per-category with counts)
 *   - 12-per-page reveal with a load-more button
 * Plus the newest/oldest publish-date sort, and the kit's Cards/Rows view
 * (shared with the hubs through useIdeaView).
 *
 * SEO: ALL ideas are rendered in the server HTML, visible by default.
 * Filtering and pagination only start after hydration; ideas that fall
 * outside the current page or filter stay in the DOM as plain links inside
 * a `hidden` list — the same display:none approach the legacy script used.
 *
 * Filter state lives in the URL (?category=…&q=…&sort=…) via
 * history.replaceState so reload/back/forward restores it. The URL is read
 * in an effect (not useSearchParams) so the fully cached page needs no
 * Suspense boundary and the list stays in the prerendered HTML.
 */

import * as React from "react";
import Link from "next/link";
import { Search } from "lucide-react";

import { Em, buttonClass } from "@/components/home/ui";
import { IdeaList, ViewToggle, useIdeaView } from "@/components/public/IdeaBrowser";
import type { PublicIdea } from "@/components/public/types";
import { cn } from "@/lib/utils";

/** A public list idea plus the publish timestamp the sort needs. */
export type ExplorerIdea = PublicIdea & {
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

const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink";

/** Mono underline toggle (sort + category tabs). */
const TOGGLE =
  "inline-flex min-h-11 shrink-0 items-center whitespace-nowrap border-b-[1.5px] font-mono text-[11px] uppercase tracking-[0.08em] transition-colors duration-150 ease-out motion-reduce:transition-none md:text-xs " +
  FOCUS;
const TOGGLE_ON = "border-home-orange-ink text-home-orange-ink";
const TOGGLE_OFF = "border-transparent text-home-ink-2 hover:text-home-ink";

const SORT_LABEL: Record<SortOrder, string> = {
  newest: "Newest",
  oldest: "Oldest",
};

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

function matches(idea: ExplorerIdea, category: string, query: string): boolean {
  const matchesCategory = category === "all" || idea.category === category;
  const q = query.toLowerCase();
  const matchesSearch =
    !q ||
    idea.title.toLowerCase().includes(q) ||
    idea.description.toLowerCase().includes(q);
  return matchesCategory && matchesSearch;
}

export function IdeasExplorer({
  ideas,
  filters,
  showFilters,
}: {
  ideas: ExplorerIdea[];
  filters: CategoryFilter[];
  /** false on the MDX build-time fallback (no category metadata). */
  showFilters: boolean;
}) {
  const [category, setCategory] = React.useState("all");
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<SortOrder>("newest");
  const [page, setPage] = React.useState(1);
  const [view, setView] = useIdeaView();
  // Pre-hydration (and in the server HTML) every idea is visible; the
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

  function clearFilters() {
    setCategory("all");
    setQuery("");
    setPage(1);
    writeUrlState("all", "", sort);
  }

  // Reorder by publish date after hydration. Pre-hydration we keep the prop
  // order (Convex newest-first) so the client's first render matches the
  // server HTML.
  const ordered = React.useMemo(() => {
    if (!ready || sort === "newest") return ideas;
    return [...ideas].sort((a, b) => a.publishedAt - b.publishedAt);
  }, [ideas, ready, sort]);

  const filtered = ready
    ? ordered.filter((idea) => matches(idea, category, query))
    : ordered;
  const shown = ready ? filtered.slice(0, page * IDEAS_PER_PAGE) : ordered;
  const shownSlugs = new Set(shown.map((idea) => idea.slug));
  const offPage = ready ? ordered.filter((idea) => !shownSlugs.has(idea.slug)) : [];
  const hasMore = ready && filtered.length > shown.length;
  const pages = Math.max(1, Math.ceil(filtered.length / IDEAS_PER_PAGE));
  const nextCount = Math.min(IDEAS_PER_PAGE, filtered.length - shown.length);
  const empty = ready && filtered.length === 0;

  const categoryLabel =
    category === "all" ? null : filters.find((f) => f.slug === category)?.label;
  const resultLine = [
    `Showing ${shown.length} of ${filtered.length}${categoryLabel ? ` ${categoryLabel} ideas` : ""}`,
    query ? `Matching “${query}”` : null,
    showFilters ? `${SORT_LABEL[sort]} first` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      {/* Toolbar: search, sort, view, category tabs, live result line */}
      <section aria-label="Find an idea" className="pt-11">
        <div className="flex flex-col gap-[18px] border-t border-b border-t-home-ink border-b-home-rule py-5">
          <div className="flex flex-wrap items-center gap-3">
            {showFilters ? (
              <>
                <div className="relative min-w-0 flex-[1_1_360px]">
                  <label htmlFor="idea-search" className="sr-only">
                    Search startup ideas
                  </label>
                  <Search
                    size={18}
                    strokeWidth={1.75}
                    className="pointer-events-none absolute left-[18px] top-1/2 -translate-y-1/2 text-home-ink-3"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    id="idea-search"
                    placeholder="Search ideas..."
                    value={query}
                    onChange={(e) => search(e.target.value)}
                    className="h-[52px] w-full rounded-full border border-home-ink-3 bg-home-card pl-12 pr-5 text-base text-home-ink placeholder:text-home-ink-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink"
                  />
                </div>

                {/* Sort by publish date */}
                <div
                  className="flex items-center gap-1"
                  role="group"
                  aria-label="Sort ideas by publish date"
                >
                  <span
                    className="pr-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-home-ink-3 md:text-xs"
                    aria-hidden="true"
                  >
                    Sort
                  </span>
                  {(["newest", "oldest"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={sort === value}
                      onClick={() => selectSort(value)}
                      className={cn(TOGGLE, "px-3", sort === value ? TOGGLE_ON : TOGGLE_OFF)}
                    >
                      {SORT_LABEL[value]}
                    </button>
                  ))}
                </div>
              </>
            ) : null}

            <ViewToggle
              view={view}
              onChange={setView}
              className={cn(!showFilters && "ml-auto")}
            />
          </div>

          {/* Category filters (single-select) */}
          {showFilters ? (
            <div
              className="flex gap-x-[22px] gap-y-1.5 max-md:-mx-5 max-md:overflow-x-auto max-md:px-5 max-md:no-scrollbar md:flex-wrap"
              id="category-filters"
              role="group"
              aria-label="Filter by category"
            >
              <button
                type="button"
                aria-pressed={category === "all"}
                onClick={() => selectCategory("all")}
                className={cn(TOGGLE, category === "all" ? TOGGLE_ON : TOGGLE_OFF)}
              >
                All Ideas
                <span className={cn("ml-1.5", category !== "all" && "text-home-ink-3")}>
                  {ideas.length}
                </span>
              </button>
              {filters.map((filter) => {
                const on = category === filter.slug;
                return (
                  <button
                    key={filter.slug}
                    type="button"
                    aria-pressed={on}
                    onClick={() => selectCategory(filter.slug)}
                    className={cn(TOGGLE, on ? TOGGLE_ON : TOGGLE_OFF)}
                  >
                    {filter.label}
                    <span className={cn("ml-1.5", !on && "text-home-ink-3")}>
                      {filter.count}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
        <p
          aria-live="polite"
          className="mt-4 font-mono text-[11px] uppercase tracking-[0.06em] text-home-ink-3 md:text-xs"
        >
          {resultLine}
        </p>
      </section>

      {/* Results — every idea is in the HTML; filtering only hides */}
      <section
        aria-labelledby="ideas-heading"
        id="ideas-grid"
        className="flex flex-col gap-7 pb-16 pt-6 lg:pb-24"
      >
        {/* Cards are h3s; this keeps the outline H1 → H2 → H3. */}
        <h2 id="ideas-heading" className="sr-only">
          All ideas
        </h2>
        {empty ? (
          <div className="flex flex-col items-start gap-3.5 border-t border-home-rule py-14">
            <p className="font-editorial text-[28px] font-normal leading-[1.1] tracking-[-0.02em] text-balance text-home-ink md:text-[32px]">
              No ideas found. <Em>Try a different search or filter.</Em>
            </p>
            <button
              type="button"
              onClick={clearFilters}
              className={buttonClass("secondary", "h-11 px-[18px] text-[15px] font-medium transition-colors duration-150 ease-out motion-reduce:transition-none")}
            >
              Show all ideas
            </button>
          </div>
        ) : (
          <IdeaList ideas={shown} view={view} />
        )}

        {offPage.length > 0 ? (
          <ul hidden>
            {offPage.map((idea) => (
              <li key={idea.slug}>
                <Link href={`/ideas/${idea.slug}`}>{idea.title}</Link>
              </li>
            ))}
          </ul>
        ) : null}

        {/* Load more (legacy script's #load-more pagination) */}
        {ready && !empty ? (
          <div className="flex flex-wrap items-center justify-between gap-3.5">
            <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-home-ink-3 md:text-xs">
              Page {Math.min(page, pages)} of {pages} · {IDEAS_PER_PAGE} per page
            </p>
            {hasMore ? (
              <button
                type="button"
                id="load-more"
                onClick={() => setPage((p) => p + 1)}
                className={buttonClass("secondary", "transition-colors duration-150 ease-out motion-reduce:transition-none")}
              >
                Show {nextCount} more
              </button>
            ) : null}
          </div>
        ) : null}
      </section>
    </>
  );
}
