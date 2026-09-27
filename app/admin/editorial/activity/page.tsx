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
  StatusBadge,
  Time,
  linkClass,
} from "@/components/admin/editorial/common/primitives";
import { EDITORIAL_BASE } from "@/components/admin/editorial/shell/nav-items";
import { ACTIVITY_LABELS } from "@/lib/editorial/presentation/activity";
import { parseCursor, parseStart, type SearchParamsRecord } from "@/lib/editorial/presentation/filters";
import { assertEditorialRoutesEnabled } from "@/lib/editorial/runtime/route-guard";
import { requireEditorialWorkspace } from "@/lib/editorial/runtime/workspace";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  assertEditorialRoutesEnabled();
  return { title: { absolute: "Activity — Editorial" } };
}

const ACTIVITY = `${EDITORIAL_BASE}/activity`;
const OUTCOMES = [
  { key: null, label: "All" },
  { key: "denied", label: "Denied" },
  { key: "failed", label: "Failed" },
] as const;

export default function ActivityPage({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  assertEditorialRoutesEnabled();
  return (
    <PageBody>
      <Suspense fallback={<ListSkeleton label="Loading…" />}>
        <GatedPageHeader
          title="Activity"
          description="A read-only record of edits, decisions, reviews, releases and refused attempts. Details are redacted: no article text, tokens or provider responses."
        />
        <ActivityContent searchParams={searchParams} />
      </Suspense>
    </PageBody>
  );
}

async function ActivityContent({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  const workspace = await requireEditorialWorkspace();
  const params = await searchParams;
  const rawOutcome = typeof params.outcome === "string" ? params.outcome : null;
  const outcome = rawOutcome === "denied" || rawOutcome === "failed" ? rawOutcome : null;
  const cursor = parseCursor(params);
  const start = cursor ? parseStart(params) : 1;
  const page = await workspace.repository.listActivity({ ideaId: null, outcome }, cursor, 50);
  if (!page.ok) {
    return (
      <ErrorState title="Activity could not be loaded">
        {page.error.message} <span className="font-mono">({page.error.code})</span>
      </ErrorState>
    );
  }
  const nowMs = workspace.nowMs;
  const query = (extra: Record<string, string>) => {
    const next = new URLSearchParams(extra);
    if (outcome) next.set("outcome", outcome);
    const text = next.toString();
    return text ? `?${text}` : "";
  };
  return (
    <>
      <nav aria-label="Activity outcome">
        <ul className="flex flex-wrap gap-1.5">
          {OUTCOMES.map((entry) => {
            const current = outcome === entry.key;
            return (
              <li key={entry.label}>
                <Link
                  href={entry.key ? `${ACTIVITY}?outcome=${entry.key}` : ACTIVITY}
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
        <EmptyState title={outcome ? `No ${outcome} attempts` : "No activity yet"}>
          {outcome === "denied"
            ? "Refused access attempts would appear here with the account type and the attempted action."
            : "Every edit, decision, review and release step is recorded here as it happens."}
        </EmptyState>
      ) : (
        <ol className="flex flex-col divide-y divide-(--ed-border) rounded-lg border border-(--ed-border) bg-(--ed-surface)">
          {page.value.items.map((entry) => (
            <li key={entry.id} className="grid gap-1 px-4 py-3 sm:grid-cols-[9rem_1fr] sm:gap-4">
              <Time iso={entry.at} nowMs={nowMs} className="text-(--ed-text-2)" />
              <div className="flex min-w-0 flex-col gap-1">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  <span className="font-medium">{ACTIVITY_LABELS[entry.action]}</span>
                  {entry.outcome !== "succeeded" ? (
                    <StatusBadge tone={entry.outcome === "denied" ? "danger" : "warning"}>
                      {entry.outcome === "denied" ? "Denied" : "Failed"}
                      {entry.code ? ` · ${entry.code}` : ""}
                    </StatusBadge>
                  ) : null}
                  {entry.ideaId && entry.ideaTitle ? (
                    <Link href={`${EDITORIAL_BASE}/ideas/${entry.ideaId}`} className={cn(linkClass, "text-(--ed-text-2)")}>
                      {entry.ideaTitle}
                      {entry.revisionNumber !== null ? ` · v${entry.revisionNumber}` : ""}
                    </Link>
                  ) : null}
                </p>
                <p className="text-xs text-(--ed-text-2)">
                  {entry.actor.label}
                  {entry.actor.kind !== "human" ? ` (${entry.actor.kind})` : ""}
                  {entry.detail ? ` — ${entry.detail}` : ""}
                </p>
                {entry.reason ? <p className="text-sm">Reason: {entry.reason}</p> : null}
              </div>
            </li>
          ))}
        </ol>
      )}
      <Pagination
        label="Activity"
        total={page.value.total}
        start={start}
        count={page.value.items.length}
        firstHref={cursor ? `${ACTIVITY}${query({})}` : null}
        nextHref={
          page.value.nextCursor
            ? `${ACTIVITY}${query({ cursor: page.value.nextCursor, start: String(start + page.value.items.length) })}`
            : null
        }
      />
    </>
  );
}
