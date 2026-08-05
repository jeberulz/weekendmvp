"use client";

import { Filter, Search } from "lucide-react";
import { usePaginatedQuery } from "convex/react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { api } from "@/convex/_generated/api";
import { isValidPlatformConvexUrl } from "@/lib/platform-convex-url";
import { ExploreCard } from "./ExploreCard";

const emptySubscribe = () => () => undefined;

const viewOptions = [
  { value: "all", label: "All" },
  { value: "for_you", label: "For you" },
  { value: "saved", label: "Saved" },
  { value: "interested", label: "Interested" },
  { value: "building", label: "Building" },
] as const;

type ExploreView = (typeof viewOptions)[number]["value"];
type ExploreSort = "recommended" | "newest" | "score";

const categoryOptions = [
  "ai-tools",
  "automation",
  "b2b",
  "creator-tools",
  "developer-tools",
  "ecommerce",
  "education",
  "fintech",
  "health",
  "marketplace",
  "productivity",
  "saas",
] as const;

function isView(value: string | null): value is ExploreView {
  return viewOptions.some((option) => option.value === value);
}

function isSort(value: string | null): value is ExploreSort {
  return value === "recommended" || value === "newest" || value === "score";
}

function titleCase(value: string) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function ExploreSkeleton() {
  return (
    <div aria-label="Loading ideas" className="animate-pulse motion-reduce:animate-none">
      <div className="h-10 w-full max-w-3xl rounded-lg bg-white/6" />
      <div className="mt-8 space-y-5">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-40 border-b border-white/10 bg-white/[0.015]" />
        ))}
      </div>
    </div>
  );
}

function ExploreConfigurationError() {
  return (
    <div role="alert" className="rounded-xl border border-white/10 p-5">
      <h2 className="text-base font-semibold text-zinc-100">Explore data is unavailable</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-400">
        The workspace data connection is not configured. No idea or intent state was changed.
      </p>
    </div>
  );
}

function ExploreSearchForm({
  initialQuery,
  view,
  category,
  sort,
}: {
  initialQuery: string;
  view: ExploreView;
  category: string | undefined;
  sort: ExploreSort;
}) {
  const [searchValue, setSearchValue] = useState(initialQuery);

  return (
    <form action="/dashboard/explore" method="get" className="min-w-0 flex-1">
      <label
        htmlFor="explore-search"
        className="mb-2 block text-sm font-medium text-zinc-300"
      >
        Search loaded idea metadata
      </label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400"
          aria-hidden
        />
        <input
          id="explore-search"
          name="q"
          type="search"
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
          maxLength={80}
          placeholder="Title, description, or category"
          className="min-h-11 w-full rounded-lg border border-white/10 bg-white/[0.025] py-2 pl-10 pr-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-500/30"
        />
      </div>
      {view !== "all" && <input type="hidden" name="view" value={view} />}
      {category && <input type="hidden" name="category" value={category} />}
      <input type="hidden" name="sort" value={sort} />
    </form>
  );
}

function ExploreWorkspaceData() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawView = searchParams.get("view");
  const view: ExploreView = isView(rawView) ? rawView : "all";
  const query = searchParams.get("q")?.trim().slice(0, 80) ?? "";
  const category = searchParams.get("category")?.trim() || undefined;
  const rawSort = searchParams.get("sort");
  const requestedSort: ExploreSort = isSort(rawSort)
    ? rawSort
    : view === "for_you"
      ? "recommended"
      : "newest";
  const sort = requestedSort as ExploreSort;

  const { results, status, loadMore } = usePaginatedQuery(
    api.platform.ideas.explore,
    {
      view,
      search: query || undefined,
      category,
      sort,
    },
    { initialNumItems: 16 },
  );

  function hrefFor(next: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (!value) params.delete(key);
      else params.set(key, value);
    }
    const suffix = params.toString();
    return suffix ? `${pathname}?${suffix}` : pathname;
  }

  function replaceParam(key: string, value: string) {
    router.replace(hrefFor({ [key]: value || undefined }), { scroll: false });
  }

  return (
    <>
      <div
        role="group"
        aria-label="Idea views"
        className="flex max-w-full gap-1 overflow-x-auto border-b border-white/10 pb-px"
      >
        {viewOptions.map((option) => (
          <Link
            key={option.value}
            href={hrefFor({ view: option.value, sort: option.value === "for_you" ? "recommended" : undefined })}
            aria-current={view === option.value ? "page" : undefined}
            className="inline-flex min-h-11 shrink-0 items-center border-b-2 border-transparent px-3 text-sm text-zinc-400 transition-colors duration-200 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-500 aria-current:border-orange-400 aria-current:font-medium aria-current:text-zinc-100"
          >
            {option.label}
          </Link>
        ))}
      </div>

      {view === "for_you" && (
        <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-400">
          Ranked within each indexed page by canonical scores and recency, with a small category boost from only the ideas you saved or marked Interested.
        </p>
      )}

      <div className="mt-6 flex flex-col gap-3 xl:flex-row xl:items-end">
        <ExploreSearchForm
          key={query}
          initialQuery={query}
          view={view}
          category={category}
          sort={sort}
        />

        <div className="grid gap-3 sm:grid-cols-2 xl:w-[26rem]">
          <label className="block text-sm font-medium text-zinc-300">
            <span className="mb-2 flex items-center gap-2">
              <Filter className="size-4" aria-hidden /> Category
            </span>
            <select
              value={category ?? ""}
              onChange={(event) => replaceParam("category", event.target.value)}
              className="min-h-11 w-full rounded-lg border border-white/10 bg-[#0b0b0b] px-3 text-sm text-zinc-200 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-500/30"
            >
              <option value="">All categories</option>
              {categoryOptions.map((option) => (
                <option key={option} value={option}>{titleCase(option)}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-zinc-300">
            <span className="mb-2 block">Sort page by</span>
            <select
              value={sort}
              onChange={(event) => replaceParam("sort", event.target.value)}
              className="min-h-11 w-full rounded-lg border border-white/10 bg-[#0b0b0b] px-3 text-sm text-zinc-200 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-500/30"
            >
              <option value="recommended">Recommended</option>
              <option value="newest">Newest</option>
              <option value="score">Canonical score</option>
            </select>
          </label>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs leading-5 text-zinc-400">
        <p>Search and filters apply to each indexed page as it loads.</p>
        {(query || category) && (
          <Link
            href={hrefFor({ q: undefined, category: undefined })}
            className="rounded-sm text-zinc-300 underline underline-offset-4 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
          >
            Clear search and filter
          </Link>
        )}
      </div>

      {status === "LoadingFirstPage" ? (
        <div className="mt-8"><ExploreSkeleton /></div>
      ) : results.length === 0 ? (
        <div className="mt-8 border-t border-white/10 py-10">
          <h2 className="text-base font-semibold text-zinc-100">No ideas on this page</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-400">
            Adjust the current search or filter, or load the next indexed page. Your saved and project state is unchanged.
          </p>
        </div>
      ) : (
        <div className="mt-8" aria-busy={status === "LoadingMore"}>
          {results.map((idea) => (
            <ExploreCard
              key={`${idea.ideaId}:${idea.saved}:${idea.interested}`}
              idea={idea}
            />
          ))}
        </div>
      )}

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {status === "LoadingMore"
          ? "Loading the next indexed page."
          : `${results.length} ideas currently shown.`}
      </p>

      {status !== "Exhausted" && status !== "LoadingFirstPage" && (
        <div className="flex justify-center py-8">
          <button
            type="button"
            onClick={() => loadMore(16)}
            disabled={status === "LoadingMore"}
            className="min-h-11 rounded-lg border border-white/15 px-5 text-sm font-medium text-zinc-200 hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 disabled:cursor-wait disabled:opacity-60"
          >
            {status === "LoadingMore" ? "Loading next page…" : "Load next page"}
          </button>
        </div>
      )}
    </>
  );
}

export function ExploreWorkspace() {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  if (!mounted) return <ExploreSkeleton />;
  if (!isValidPlatformConvexUrl(process.env.NEXT_PUBLIC_CONVEX_URL)) {
    return <ExploreConfigurationError />;
  }
  return <ExploreWorkspaceData />;
}
