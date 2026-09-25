"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { LIBRARY_VIEWS } from "@/convex/platform/libraryFilters";
import { ModuleSkeleton, PersonalModule } from "@/components/platform/home/module-states";
import { cn } from "@/lib/utils";
import { IdeaCard, IdeaRow } from "./IdeaCard";
import { ActiveFilters, LibraryFilters } from "./LibraryFilters";
import { useLibraryLayout } from "./layout-pref";
import {
  VIEW_LABEL,
  hasFilters,
  libraryHref,
  libraryKey,
  newSince,
  parseLibraryParams,
  type LibraryParams,
} from "./library-params";

const PAGE = 24;
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink";

export function LibrarySkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div aria-hidden className="h-11 w-64 rounded-lg bg-home-sunk" />
      <div aria-hidden className="h-10 w-full max-w-2xl rounded-lg bg-home-sunk" />
      <ModuleSkeleton label="Loading ideas" className="h-[420px]" />
    </div>
  );
}

function ViewTabs({ params }: { params: LibraryParams }) {
  return (
    <nav aria-label="Idea views" className="border-b border-home-rule">
      <ul className="-mb-px flex gap-1">
        {LIBRARY_VIEWS.map((view) => {
          const current = params.view === view;
          return (
            <li key={view}>
              <Link
                href={libraryHref(params, { view, sort: undefined })}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "inline-flex h-11 items-center border-b-2 px-3 text-sm transition-colors",
                  current
                    ? "border-home-ink font-medium text-home-ink"
                    : "border-transparent text-home-ink-2 hover:text-home-ink",
                  FOCUS,
                )}
              >
                {VIEW_LABEL[view]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function LiveLibrary() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = parseLibraryParams(searchParams);
  const key = libraryKey(params);
  const [layout, setLayout] = useLibraryLayout();
  const [since] = useState(() => newSince(new Date()));

  // "Show more" grows the page. A new search or filter starts over.
  const [page, setPage] = useState({ key, limit: PAGE });
  if (page.key !== key) setPage({ key, limit: PAGE });
  const limit = page.key === key ? page.limit : PAGE;

  const result = useQuery(api.platform.ideas.library, {
    view: params.view,
    search: params.q || undefined,
    category: params.category,
    tools: params.tools.length > 0 ? params.tools : undefined,
    hours: params.hours,
    goal: params.goal,
    sort: params.sort,
    publishedAfter: params.view === "new" ? since : undefined,
    limit,
  });
  // Keep the last results on screen while the next ones load.
  const [shown, setShown] = useState(result);
  if (result !== undefined && result !== shown) setShown(result);
  const data = result ?? shown;

  function update(patch: Partial<LibraryParams>) {
    router.replace(libraryHref(params, patch), { scroll: false });
  }

  if (data === undefined) return <LibrarySkeleton />;

  const { items, total } = data;
  const empty = items.length === 0;
  const countLine =
    params.q !== ""
      ? `${total} ${total === 1 ? "idea matches" : "ideas match"} “${params.q}”`
      : `${total} ${total === 1 ? "idea" : "ideas"}`;

  return (
    <div className="flex flex-col gap-5">
      <ViewTabs params={params} />
      {params.view === "for_you" && (
        <p className="text-sm text-home-ink-2">
          Ranked by research score, with a small lift for categories you save.
        </p>
      )}
      {params.view === "new" && (
        <p className="text-sm text-home-ink-2">Published in the last 30 days, newest first.</p>
      )}
      <LibraryFilters
        params={params}
        facets={data.facets}
        onChange={update}
        layout={layout}
        onLayout={setLayout}
      />
      <ActiveFilters params={params} onChange={update} />
      <p role="status" className="font-mono text-[11px] uppercase tracking-[0.08em] text-home-ink-3">
        {countLine}
      </p>

      <h2 className="sr-only">Results</h2>
      {empty ? (
        <div className="rounded-[14px] border border-home-rule bg-home-card px-5 py-6">
          <p className="text-[15px] text-home-ink">
            {params.view === "new" && !hasFilters(params)
              ? "No new ideas in the last 30 days."
              : "No ideas match these filters."}
          </p>
          <p className="mt-1 text-sm text-home-ink-2">
            {hasFilters(params) ? (
              <button
                type="button"
                onClick={() =>
                  update({ q: "", category: undefined, tools: [], hours: undefined, goal: undefined, sort: undefined })
                }
                className={cn("font-medium text-home-orange-ink underline underline-offset-4 hover:text-home-ink", FOCUS)}
              >
                Clear search and filters
              </button>
            ) : (
              <Link
                href={libraryHref(params, { view: "all" })}
                className={cn("font-medium text-home-orange-ink underline underline-offset-4 hover:text-home-ink", FOCUS)}
              >
                See all ideas
              </Link>
            )}
          </p>
        </div>
      ) : (
        <ul
          aria-busy={result === undefined}
          className={cn(
            "transition-opacity",
            result === undefined && "opacity-60",
            layout === "grid"
              ? "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
              : "divide-y divide-home-rule border-y border-home-ink",
          )}
        >
          {items.map((idea) => (
            <li key={idea.ideaId}>
              {layout === "grid" ? <IdeaCard idea={idea} source="ideas" /> : <IdeaRow idea={idea} source="ideas" />}
            </li>
          ))}
        </ul>
      )}

      {!empty && (
        <div className="flex flex-col items-center gap-2 py-4">
          <p className="text-[13px] text-home-ink-3">
            Showing {items.length} of {total}
          </p>
          {items.length < total && (
            <button
              type="button"
              onClick={() => setPage({ key, limit: limit + PAGE })}
              disabled={result === undefined}
              className={cn(
                "inline-flex h-11 items-center rounded-[9px] border border-home-rule bg-home-card px-5 text-sm font-medium text-home-ink transition-colors hover:border-home-ink-3 disabled:cursor-wait disabled:opacity-60",
                FOCUS,
              )}
            >
              Show more ideas
            </button>
          )}
          {data.truncated && (
            <p className="text-[12px] text-home-ink-3">Browsing covers the newest 1,000 ideas. Search reaches the rest.</p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The Ideas library (WP44-S5): tabs, filters, sort, grid or list, and "Show
 * more". Search comes from the top bar, so the page has no second field.
 */
export function IdeasLibrary() {
  return (
    <PersonalModule skeleton={<LibrarySkeleton />}>
      <LiveLibrary />
    </PersonalModule>
  );
}
