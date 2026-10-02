import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { GatedPageHeader } from "@/components/admin/editorial/common/GatedPageHeader";
import { ListSkeleton } from "@/components/admin/editorial/common/ListSkeleton";
import { EmptyState, ErrorState, PageBody, Pagination, ScrollRegion, Time, linkClass } from "@/components/admin/editorial/common/primitives";
import { EDITORIAL_BASE } from "@/components/admin/editorial/shell/nav-items";
import { RestoreButton } from "@/components/admin/editorial/trash/RestoreButton";
import { CANDIDATE_LABELS, PUBLICATION_LABELS } from "@/lib/editorial/contracts/states";
import { parseCursor, parseStart, type SearchParamsRecord } from "@/lib/editorial/presentation/filters";
import { assertEditorialRoutesEnabled } from "@/lib/editorial/runtime/route-guard";
import { requireEditorialWorkspace } from "@/lib/editorial/runtime/workspace";

export async function generateMetadata(): Promise<Metadata> {
  assertEditorialRoutesEnabled();
  return { title: { absolute: "Trash — Editorial" } };
}

const TRASH = `${EDITORIAL_BASE}/trash`;

export default function TrashPage({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  assertEditorialRoutesEnabled();
  return (
    <PageBody>
      <Suspense fallback={<ListSkeleton label="Loading…" rows={3} />}>
        <GatedPageHeader
          title="Trash"
          description="Ideas moved to Trash stay recoverable. Nothing here expires or is permanently deleted, and restoring never makes an idea live."
        />
        <TrashContent searchParams={searchParams} />
      </Suspense>
    </PageBody>
  );
}

async function TrashContent({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  const workspace = await requireEditorialWorkspace();
  const params = await searchParams;
  const cursor = parseCursor(params);
  const start = cursor ? parseStart(params) : 1;
  const page = await workspace.repository.listTrash(cursor, 25);
  if (!page.ok) {
    return (
      <ErrorState title="Trash could not be loaded">
        {page.error.message} <span className="font-mono">({page.error.code})</span>
      </ErrorState>
    );
  }
  const nowMs = workspace.nowMs;
  if (page.value.items.length === 0) {
    return (
      <EmptyState title="Trash is empty">
        Only ideas that are not live can be moved here. A live idea must be unpublished first.
      </EmptyState>
    );
  }
  return (
    <>
      <ScrollRegion label="Ideas in Trash" className="rounded-lg border border-(--ed-border) bg-(--ed-surface)">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Ideas in Trash</caption>
          <thead>
            <tr className="border-b border-(--ed-border-strong) text-left">
              <th scope="col" className="px-3 py-2.5 text-xs font-semibold text-(--ed-text-2)">Idea</th>
              <th scope="col" className="px-3 py-2.5 text-xs font-semibold text-(--ed-text-2)">Reason</th>
              <th scope="col" className="px-3 py-2.5 text-xs font-semibold text-(--ed-text-2)">Before Trash</th>
              <th scope="col" className="px-3 py-2.5 text-xs font-semibold text-(--ed-text-2)">Moved</th>
              <th scope="col" className="px-3 py-2.5 text-xs font-semibold text-(--ed-text-2)">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {page.value.items.map((item) => (
              <tr key={item.ideaId} className="border-b border-(--ed-border) align-top last:border-b-0">
                <td className="min-w-[14rem] px-3 py-3">
                  <Link href={`${EDITORIAL_BASE}/ideas/${item.ideaId}`} className={`${linkClass} font-medium no-underline hover:underline`}>
                    {item.title}
                  </Link>
                  <p className="font-mono text-xs text-(--ed-text-2)">{item.slug}</p>
                </td>
                <td className="min-w-[14rem] px-3 py-3">{item.reason}</td>
                <td className="px-3 py-3 text-(--ed-text-2)">
                  {CANDIDATE_LABELS[item.previousCandidate]} · {PUBLICATION_LABELS[item.previousPublication]}
                </td>
                <td className="px-3 py-3">
                  <Time iso={item.trashedAt} nowMs={nowMs} />
                  <p className="text-xs text-(--ed-text-2)">by {item.trashedBy.label}</p>
                </td>
                <td className="px-3 py-3 text-right">
                  <RestoreButton ideaId={item.ideaId} title={item.title} version={item.version} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollRegion>
      <Pagination
        label="Trash"
        total={page.value.total}
        start={start}
        count={page.value.items.length}
        firstHref={cursor ? TRASH : null}
        nextHref={
          page.value.nextCursor
            ? `${TRASH}?cursor=${page.value.nextCursor}&start=${start + page.value.items.length}`
            : null
        }
      />
    </>
  );
}
