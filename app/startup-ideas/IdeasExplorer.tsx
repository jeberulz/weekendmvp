"use client";

/**
 * Search + filters + sort + paginated grid for /startup-ideas.
 *
 * Extends the legacy filter set (free-text search over title + description,
 * single-select category chips, 12-per-page Load More) with the metadata
 * Convex already stores per idea:
 *   - facet selects: revenue goal, build time bucket, tool, audience
 *   - sort: newest (server order) / opportunity / builder confidence /
 *     quickest build — non-newest sorts reorder cards via the CSS `order`
 *     property so the server HTML order never changes
 *   - a compact score chip on each card (sum of the 4 idea scores)
 *
 * SEO: ALL idea cards are rendered in the server HTML, visible by default.
 * Pagination/filtering only hides cards (`hidden` class) after hydration —
 * the same display:none approach the legacy script used.
 *
 * Filter state lives in the URL (?category=…&q=…&revenue=…&time=…&tool=…
 * &audience=…&sort=…) via history.replaceState so reload/back/forward
 * restores it and filtered views are shareable. The URL is read in an effect
 * (not useSearchParams) so the fully cached page needs no Suspense boundary
 * and the grid stays in the prerendered HTML.
 */

import * as React from "react";
import { Search } from "lucide-react";

import { IdeaCard as SharedIdeaCard } from "@/components/primitives/IdeaCard";
import {
  audienceName,
  revenueName,
  toolName,
} from "@/components/ideas/idea-meta";

export type IdeaScores = {
  opportunity: number;
  pain: number;
  timing: number;
  builder_confidence: number;
};

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
  /** Parsed hours (null when buildTime is non-numeric or unavailable). */
  buildTimeHours: number | null;
  revenueGoal: string | null;
  tools: string[];
  audiences: string[];
  scores: IdeaScores | null;
};

export type CategoryFilter = {
  slug: string;
  label: string;
  count: number;
};

const IDEAS_PER_PAGE = 12;

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "opportunity", label: "Highest opportunity" },
  { value: "confidence", label: "Highest confidence" },
  { value: "quickest", label: "Quickest build" },
] as const;

type SortValue = (typeof SORT_OPTIONS)[number]["value"];

const SORT_VALUES = new Set<string>(SORT_OPTIONS.map((o) => o.value));

/** Build-time buckets (buildTime is stored as an hour-count string). */
const TIME_BUCKETS = [
  { value: "8h", label: "8 hours or less", match: (h: number) => h <= 8 },
  { value: "16h", label: "9–16 hours", match: (h: number) => h > 8 && h <= 16 },
  { value: "17h", label: "17+ hours", match: (h: number) => h > 16 },
] as const;

const ACTIVE_BTN =
  "filter-btn px-4 py-2 bg-white text-black rounded-full text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-white/40";
const INACTIVE_BTN =
  "filter-btn px-4 py-2 bg-white/5 border border-white/10 rounded-full text-sm text-neutral-400 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-white/40";

const SELECT_CLASS =
  "bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-neutral-300 focus:outline-none focus:ring-2 focus:ring-white/40 transition-all [&>option]:bg-neutral-900";

type ExplorerState = {
  category: string;
  query: string;
  revenue: string;
  time: string;
  tool: string;
  audience: string;
  sort: SortValue;
};

const DEFAULT_STATE: ExplorerState = {
  category: "all",
  query: "",
  revenue: "all",
  time: "all",
  tool: "all",
  audience: "all",
  sort: "newest",
};

function readUrlState(categories: Set<string>): ExplorerState {
  const params = new URLSearchParams(window.location.search);
  const category = params.get("category") ?? "all";
  const sort = params.get("sort") ?? "newest";
  return {
    category: categories.has(category) ? category : "all",
    query: params.get("q") ?? "",
    revenue: params.get("revenue") ?? "all",
    time: params.get("time") ?? "all",
    tool: params.get("tool") ?? "all",
    audience: params.get("audience") ?? "all",
    sort: SORT_VALUES.has(sort) ? (sort as SortValue) : "newest",
  };
}

function writeUrlState(state: ExplorerState) {
  try {
    const url = new URL(window.location.href);
    const set = (key: string, value: string, empty: string) => {
      if (value === empty || !value) url.searchParams.delete(key);
      else url.searchParams.set(key, value);
    };
    set("category", state.category, "all");
    set("q", state.query, "");
    set("revenue", state.revenue, "all");
    set("time", state.time, "all");
    set("tool", state.tool, "all");
    set("audience", state.audience, "all");
    set("sort", state.sort, "newest");
    window.history.replaceState(
      window.history.state,
      "",
      url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : "") + url.hash,
    );
  } catch {
    /* ignore */
  }
}

function matches(idea: IdeaCardData, state: ExplorerState): boolean {
  if (state.category !== "all" && idea.category !== state.category) {
    return false;
  }
  if (state.revenue !== "all" && idea.revenueGoal !== state.revenue) {
    return false;
  }
  if (state.time !== "all") {
    const bucket = TIME_BUCKETS.find((b) => b.value === state.time);
    if (!bucket || idea.buildTimeHours === null || !bucket.match(idea.buildTimeHours)) {
      return false;
    }
  }
  if (state.tool !== "all" && !idea.tools.includes(state.tool)) {
    return false;
  }
  if (state.audience !== "all" && !idea.audiences.includes(state.audience)) {
    return false;
  }
  const q = state.query.toLowerCase();
  return (
    !q ||
    idea.title.toLowerCase().includes(q) ||
    idea.description.toLowerCase().includes(q)
  );
}

function sortIdeas(ideas: IdeaCardData[], sort: SortValue): IdeaCardData[] {
  if (sort === "newest") return ideas;
  const sorted = [...ideas];
  if (sort === "opportunity") {
    sorted.sort(
      (a, b) => (b.scores?.opportunity ?? -1) - (a.scores?.opportunity ?? -1),
    );
  } else if (sort === "confidence") {
    sorted.sort(
      (a, b) =>
        (b.scores?.builder_confidence ?? -1) -
        (a.scores?.builder_confidence ?? -1),
    );
  } else if (sort === "quickest") {
    sorted.sort(
      (a, b) =>
        (a.buildTimeHours ?? Number.MAX_SAFE_INTEGER) -
        (b.buildTimeHours ?? Number.MAX_SAFE_INTEGER),
    );
  }
  return sorted;
}

function totalScore(scores: IdeaScores | null): number | null {
  if (!scores) return null;
  return (
    scores.opportunity + scores.pain + scores.timing + scores.builder_confidence
  );
}

type FacetOption = { value: string; label: string; count: number };

function facetOptions(
  ideas: IdeaCardData[],
  pick: (idea: IdeaCardData) => string[],
  label: (slug: string) => string,
): FacetOption[] {
  const counts = new Map<string, number>();
  for (const idea of ideas) {
    for (const value of pick(idea)) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([value, count]) => ({ value, label: label(value), count }));
}

/** One idea card + score chip, composing the shared IdeaCard primitive. */
function IdeaCard({
  idea,
  hidden,
  order,
}: {
  idea: IdeaCardData;
  hidden: boolean;
  order: number | null;
}) {
  const score = totalScore(idea.scores);
  return (
    <div
      className={hidden ? "hidden" : "relative"}
      style={order === null ? undefined : { order }}
    >
      <SharedIdeaCard
        surface="elevated"
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
      {score !== null ? (
        <span className="absolute top-6 right-6 px-2 py-1 rounded-md text-[10px] font-semibold bg-white/5 border border-white/10 text-neutral-400">
          <span className="sr-only">Idea score: </span>
          {score}/40
        </span>
      ) : null}
    </div>
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
  const [state, setState] = React.useState<ExplorerState>(DEFAULT_STATE);
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
      setState(readUrlState(categorySlugs));
      setPage(1);
    };
    apply();
    setReady(true);
    window.addEventListener("popstate", apply);
    return () => window.removeEventListener("popstate", apply);
  }, [categorySlugs]);

  function update(patch: Partial<ExplorerState>) {
    setState((prev) => {
      const next = { ...prev, ...patch };
      writeUrlState(next);
      return next;
    });
    setPage(1);
  }

  const revenueOptions = React.useMemo(
    () =>
      facetOptions(
        ideas,
        (i) => (i.revenueGoal ? [i.revenueGoal] : []),
        revenueName,
      ),
    [ideas],
  );
  const toolOptions = React.useMemo(
    () => facetOptions(ideas, (i) => i.tools, toolName),
    [ideas],
  );
  const audienceOptions = React.useMemo(
    () => facetOptions(ideas, (i) => i.audiences, audienceName),
    [ideas],
  );

  const filtered = ideas.filter((idea) => matches(idea, state));
  const sorted = sortIdeas(filtered, state.sort);
  const shown = ready
    ? new Set(sorted.slice(0, page * IDEAS_PER_PAGE).map((idea) => idea.slug))
    : null;
  const hasMore = ready && sorted.length > page * IDEAS_PER_PAGE;

  // CSS order per slug when a non-newest sort is active (server DOM order
  // stays untouched; the grid re-arranges visually).
  const orderBySlug = React.useMemo(() => {
    if (!ready || state.sort === "newest") return null;
    const map = new Map<string, number>();
    sorted.forEach((idea, index) => map.set(idea.slug, index));
    return map;
  }, [ready, state.sort, sorted]);

  return (
    <>
      {/* Search, Filters, Sort */}
      {showFilters ? (
        <div className="mb-8 space-y-4">
          {/* Search Input */}
          <div className="relative">
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
              value={state.query}
              onChange={(e) => update({ query: e.target.value })}
              className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-white/40 transition-all"
            />
          </div>

          {/* Category Filters */}
          <div
            className="flex flex-wrap gap-2"
            id="category-filters"
            role="group"
            aria-label="Filter by category"
          >
            <button
              className={state.category === "all" ? ACTIVE_BTN : INACTIVE_BTN}
              aria-pressed={state.category === "all"}
              onClick={() => update({ category: "all" })}
            >
              All Ideas
            </button>
            {filters.map((filter) => (
              <button
                key={filter.slug}
                className={
                  state.category === filter.slug ? ACTIVE_BTN : INACTIVE_BTN
                }
                aria-pressed={state.category === filter.slug}
                onClick={() => update({ category: filter.slug })}
              >
                {filter.label} ({filter.count})
              </button>
            ))}
          </div>

          {/* Facets + Sort */}
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-neutral-500">
              Revenue goal
              <select
                value={state.revenue}
                onChange={(e) => update({ revenue: e.target.value })}
                className={SELECT_CLASS}
                aria-label="Filter by revenue goal"
              >
                <option value="all">All</option>
                {revenueOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label} ({opt.count})
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2 text-xs text-neutral-500">
              Build time
              <select
                value={state.time}
                onChange={(e) => update({ time: e.target.value })}
                className={SELECT_CLASS}
                aria-label="Filter by build time"
              >
                <option value="all">All</option>
                {TIME_BUCKETS.map((bucket) => (
                  <option key={bucket.value} value={bucket.value}>
                    {bucket.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2 text-xs text-neutral-500">
              Tool
              <select
                value={state.tool}
                onChange={(e) => update({ tool: e.target.value })}
                className={SELECT_CLASS}
                aria-label="Filter by build tool"
              >
                <option value="all">All</option>
                {toolOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label} ({opt.count})
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2 text-xs text-neutral-500">
              Audience
              <select
                value={state.audience}
                onChange={(e) => update({ audience: e.target.value })}
                className={SELECT_CLASS}
                aria-label="Filter by audience"
              >
                <option value="all">All</option>
                {audienceOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label} ({opt.count})
                  </option>
                ))}
              </select>
            </label>

            <label className="ml-auto flex items-center gap-2 text-xs text-neutral-500">
              Sort by
              <select
                value={state.sort}
                onChange={(e) =>
                  update({ sort: e.target.value as SortValue })
                }
                className={SELECT_CLASS}
                aria-label="Sort ideas"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      ) : null}

      {/* Ideas Grid — every card is in the HTML; filtering only hides,
          sorting only reorders via CSS `order`. */}
      <div
        id="ideas-grid"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      >
        {ideas.map((idea) => (
          <IdeaCard
            key={idea.slug}
            idea={idea}
            hidden={shown !== null && !shown.has(idea.slug)}
            order={orderBySlug?.get(idea.slug) ?? null}
          />
        ))}
        {ready && sorted.length === 0 ? (
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
