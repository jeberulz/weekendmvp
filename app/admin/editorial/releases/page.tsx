import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { GatedPageHeader } from "@/components/admin/editorial/common/GatedPageHeader";
import { ListSkeleton } from "@/components/admin/editorial/common/ListSkeleton";
import { EmptyState, ErrorState, PageBody, Pagination } from "@/components/admin/editorial/common/primitives";
import { ReleaseCard } from "@/components/admin/editorial/releases/ReleaseCard";
import { ReleaseCardActions } from "@/components/admin/editorial/releases/ReleaseCardActions";
import { SimulatedWorkerTicker } from "@/components/admin/editorial/releases/SimulatedWorkerTicker";
import { EDITORIAL_BASE } from "@/components/admin/editorial/shell/nav-items";
import type { ReleaseFilter } from "@/lib/editorial/contracts/commands";
import { parseCursor, parseReleaseFilter, parseStart, type SearchParamsRecord } from "@/lib/editorial/presentation/filters";
import { assertEditorialRoutesEnabled } from "@/lib/editorial/runtime/route-guard";
import { requireEditorialWorkspace } from "@/lib/editorial/runtime/workspace";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  assertEditorialRoutesEnabled();
  return { title: { absolute: "Releases — Editorial" } };
}

const RELEASES = `${EDITORIAL_BASE}/releases`;
const GROUPS: { key: ReleaseFilter["group"]; label: string; empty: string }[] = [
  { key: "all", label: "All", empty: "No releases yet." },
  { key: "attention", label: "Needs attention", empty: "No failed or uncertain releases." },
  { key: "in_flight", label: "Running", empty: "Nothing is running." },
  { key: "preview_ready", label: "Preview ready", empty: "No previews are waiting for a publish decision." },
  { key: "completed", label: "Completed", empty: "No completed releases yet." },
];

export default function ReleasesPage({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  assertEditorialRoutesEnabled();
  return (
    <PageBody>
      <Suspense fallback={<ListSkeleton label="Loading…" />}>
        <GatedPageHeader
          title="Releases"
          description="Every staged preview, publication, rollback and unpublish, with each step and its outcome. A release is live only after verified activation."
        />
        <ReleasesContent searchParams={searchParams} />
      </Suspense>
    </PageBody>
  );
}

async function ReleasesContent({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  const workspace = await requireEditorialWorkspace();
  const params = await searchParams;
  const filter = parseReleaseFilter(params);
  const cursor = parseCursor(params);
  const start = cursor ? parseStart(params) : 1;
  const page = await workspace.repository.listReleases(filter, cursor, 20);
  if (!page.ok) {
    return (
      <ErrorState title="Releases could not be loaded">
        {page.error.message} <span className="font-mono">({page.error.code})</span>
      </ErrorState>
    );
  }
  const nowMs = workspace.nowMs;
  const running = await workspace.repository.listReleases({ group: "in_flight", ideaId: null }, null, 1);
  const settings = await workspace.repository.getSettings();
  const authMechanism = settings.ok ? settings.value.strongAuth.mechanism : "Unavailable";
  const group = GROUPS.find((entry) => entry.key === filter.group) ?? GROUPS[0];
  const base = filter.group === "all" ? RELEASES : `${RELEASES}?group=${filter.group}`;
  return (
    <>
      <SimulatedWorkerTicker active={running.ok && running.value.total > 0} />
      <nav aria-label="Release groups">
        <ul className="flex flex-wrap gap-1.5">
          {GROUPS.map((entry) => {
            const current = entry.key === filter.group;
            return (
              <li key={entry.key}>
                <Link
                  href={entry.key === "all" ? RELEASES : `${RELEASES}?group=${entry.key}`}
                  aria-current={current ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-9 items-center rounded-md border px-3 text-sm outline-hidden focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-(--ed-focus)",
                    current
                      ? "border-(--ed-text) bg-(--ed-text) text-white"
                      : "border-(--ed-border-strong) bg-(--ed-surface) hover:bg-(--ed-sunk)",
                  )}
                >
                  {entry.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {page.value.items.length === 0 ? (
        <EmptyState title={group.empty} />
      ) : (
        <ul className="flex flex-col gap-3" aria-label={`${group.label} releases`}>
          {page.value.items.map((release) => (
            <li key={release.id}>
              <ReleaseCard
                release={release}
                nowMs={nowMs}
                liveRegion
                actions={
                  release.availableActions.length > 0 ? <ReleaseCardActions release={release} authMechanism={authMechanism} /> : undefined
                }
              />
            </li>
          ))}
        </ul>
      )}
      <Pagination
        label="Releases"
        total={page.value.total}
        start={start}
        count={page.value.items.length}
        firstHref={cursor ? base : null}
        nextHref={
          page.value.nextCursor
            ? `${RELEASES}?${new URLSearchParams({
                ...(filter.group === "all" ? {} : { group: filter.group }),
                cursor: page.value.nextCursor,
                start: String(start + page.value.items.length),
              }).toString()}`
            : null
        }
      />
    </>
  );
}
