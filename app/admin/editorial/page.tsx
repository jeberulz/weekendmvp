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
import { IdeaFilters, QueueBuckets, QueueSummaryLine } from "@/components/admin/editorial/queue/QueueControls";
import { EDITORIAL_BASE } from "@/components/admin/editorial/shell/nav-items";
import { QUEUE_BUCKET_LABELS } from "@/lib/editorial/contracts/views";
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
  return { title: { absolute: "Review queue — Editorial" } };
}

const PAGE_SIZE = 25;

export default function ReviewQueuePage({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  assertEditorialRoutesEnabled();
  return (
    <PageBody>
      <Suspense fallback={<ListSkeleton label="Loading…" />}>
        <GatedPageHeader
          title="Review queue"
          description="Candidates and revisions waiting for your decision. Engine scores are recommendations, not approval."
        />
        <QueueContent searchParams={searchParams} />
      </Suspense>
    </PageBody>
  );
}

async function QueueContent({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  const workspace = await requireEditorialWorkspace();
  const params = await searchParams;
  const filter = parseIdeaFilter("queue", params);
  const cursor = parseCursor(params);
  const start = cursor ? parseStart(params) : 1;
  const [summary, page] = await Promise.all([
    workspace.repository.getQueueSummary(),
    workspace.repository.listIdeas(filter, cursor, PAGE_SIZE),
  ]);
  if (!summary.ok || !page.ok) {
    const error = !summary.ok ? summary.error : !page.ok ? page.error : null;
    return (
      <ErrorState title="The review queue could not be loaded">
        {error?.message} {error ? <span className="font-mono">({error.code})</span> : null}
      </ErrorState>
    );
  }
  const nowMs = workspace.nowMs;
  const filtered = activeFilterCount(filter) > 0;
  const heading = filter.bucket ? QUEUE_BUCKET_LABELS[filter.bucket] : "All ideas needing attention";
  return (
    <>
      <QueueSummaryLine summary={summary.value} />
      <QueueBuckets filter={filter} summary={summary.value} />
      <IdeaFilters filter={filter} scope="queue" />
      <section aria-labelledby="queue-results" className="flex flex-col gap-3">
        <h2 id="queue-results" className="text-base font-semibold">
          {heading}{" "}
          <span className="font-mono text-sm font-normal tabular-nums text-(--ed-text-2)">
            ({page.value.total}
            <span className="sr-only"> {page.value.total === 1 ? "idea" : "ideas"}</span>)
          </span>
        </h2>
        {page.value.items.length === 0 ? (
          filtered ? (
            <EmptyState
              title="No ideas match these filters"
              action={
                <Link href={`${EDITORIAL_BASE}${ideaFilterQuery({ ...filter, decision: null, severity: null, sourceAge: null, engineRunId: null, category: null, search: null })}`} className={buttonClass.secondary}>
                  Clear filters
                </Link>
              }
            >
              Nothing in this part of the queue matches. Clear the filters to see everything that needs you.
            </EmptyState>
          ) : (
            <EmptyState title="Nothing needs review here">
              New engine candidates and edited revisions appear here. Accepted ideas that are approved or live and
              unchanged leave the queue.
            </EmptyState>
          )
        ) : (
          <IdeaTable items={page.value.items} variant="queue" nowMs={nowMs} caption={`${heading}: review queue`} />
        )}
        <Pagination
          label="Review queue"
          total={page.value.total}
          start={start}
          count={page.value.items.length}
          firstHref={cursor ? `${EDITORIAL_BASE}${ideaFilterQuery(filter)}` : null}
          nextHref={
            page.value.nextCursor
              ? `${EDITORIAL_BASE}${ideaFilterQuery(filter, {
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
