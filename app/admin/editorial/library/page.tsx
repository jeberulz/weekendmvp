import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { GatedPageHeader } from "@/components/admin/editorial/common/GatedPageHeader";
import { ListSkeleton } from "@/components/admin/editorial/common/ListSkeleton";
import {
  EmptyState,
  ErrorState,
  PageBody,
  Pagination,
  buttonClass,
} from "@/components/admin/editorial/common/primitives";
import { IdeaTable } from "@/components/admin/editorial/queue/IdeaTable";
import { IdeaFilters } from "@/components/admin/editorial/queue/QueueControls";
import { EDITORIAL_BASE } from "@/components/admin/editorial/shell/nav-items";
import {
  activeFilterCount,
  ideaFilterQuery,
  parseCursor,
  parseIdeaFilter,
  parseStart,
  type SearchParamsRecord,
} from "@/lib/editorial/presentation/filters";
import { assertEditorialRoutesEnabled } from "@/lib/editorial/runtime/route-guard";
import { requireEditorialWorkspace } from "@/lib/editorial/runtime/workspace";

export async function generateMetadata(): Promise<Metadata> {
  assertEditorialRoutesEnabled();
  return { title: { absolute: "Library — Editorial" } };
}

const PAGE_SIZE = 25;
const LIBRARY = `${EDITORIAL_BASE}/library`;

export default function LibraryPage({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  assertEditorialRoutesEnabled();
  return (
    <PageBody>
      <Suspense fallback={<ListSkeleton label="Loading…" />}>
        <GatedPageHeader
          title="Library"
          description="Every idea: live pages that predate this workspace, unpublished ideas and private drafts. Trash is listed separately."
        />
        <LibraryContent searchParams={searchParams} />
      </Suspense>
    </PageBody>
  );
}

async function LibraryContent({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  const workspace = await requireEditorialWorkspace();
  const params = await searchParams;
  const filter = parseIdeaFilter("library", params);
  const cursor = parseCursor(params);
  const start = cursor ? parseStart(params) : 1;
  const page = await workspace.repository.listIdeas(filter, cursor, PAGE_SIZE);
  if (!page.ok) {
    return (
      <ErrorState title="The library could not be loaded">
        {page.error.message} <span className="font-mono">({page.error.code})</span>
      </ErrorState>
    );
  }
  const nowMs = workspace.nowMs;
  return (
    <>
      <IdeaFilters filter={filter} scope="library" />
      <section aria-labelledby="library-results" className="flex flex-col gap-3">
        <h2 id="library-results" className="text-base font-semibold">
          {filter.search ? `Results for “${filter.search}”` : "All ideas"}{" "}
          <span className="font-mono text-sm font-normal tabular-nums text-(--ed-text-2)">
            ({page.value.total}
            <span className="sr-only"> {page.value.total === 1 ? "idea" : "ideas"}</span>)
          </span>
        </h2>
        {page.value.items.length === 0 ? (
          activeFilterCount(filter) > 0 ? (
            <EmptyState
              title="No ideas match"
              action={
                <Link href={LIBRARY} className={buttonClass.secondary}>
                  Clear search and filters
                </Link>
              }
            >
              Try a shorter search, or search by buyer or job instead of the title.
            </EmptyState>
          ) : (
            <EmptyState title="The library is empty">
              Ideas appear here once the engine submits them or live pages are imported.
            </EmptyState>
          )
        ) : (
          <IdeaTable items={page.value.items} variant="library" nowMs={nowMs} caption="Library of ideas" />
        )}
        <Pagination
          label="Library"
          total={page.value.total}
          start={start}
          count={page.value.items.length}
          firstHref={cursor ? `${LIBRARY}${ideaFilterQuery(filter)}` : null}
          nextHref={
            page.value.nextCursor
              ? `${LIBRARY}${ideaFilterQuery(filter, {
                  cursor: page.value.nextCursor,
                  start: String(start + page.value.items.length),
                })}`
              : null
          }
        />
      </section>
    </>
  );
}
