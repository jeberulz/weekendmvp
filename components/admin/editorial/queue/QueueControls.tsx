import Link from "next/link";

import type { IdeaFilter } from "@/lib/editorial/contracts/commands";
import { CANDIDATE_LABELS, PUBLICATION_LABELS } from "@/lib/editorial/contracts/states";
import { CATEGORY_LABELS, CATEGORY_SLUGS } from "@/lib/editorial/contracts/taxonomy";
import { QUEUE_BUCKETS, QUEUE_BUCKET_LABELS, type QueueSummary } from "@/lib/editorial/contracts/views";
import { activeFilterCount, ideaFilterQuery } from "@/lib/editorial/presentation/filters";
import { cn } from "@/lib/utils";
import { buttonClass, fieldClass, linkClass } from "../common/primitives";
import { EDITORIAL_BASE } from "../shell/nav-items";

/** "7 need review · 3 blocked by evidence · 2 releases need attention", from data. */
export function QueueSummaryLine({ summary }: { summary: QueueSummary }) {
  const parts = [
    { count: summary.needReview, label: "need review", href: EDITORIAL_BASE },
    { count: summary.blockedByEvidence, label: "blocked by evidence", href: `${EDITORIAL_BASE}?severity=evidence` },
    {
      count: summary.releasesNeedingAttention,
      label: summary.releasesNeedingAttention === 1 ? "release needs attention" : "releases need attention",
      href: `${EDITORIAL_BASE}/releases?group=attention`,
    },
  ];
  return (
    <p className="text-[0.9375rem] text-(--ed-text-2)">
      {parts.map((part, index) => (
        <span key={part.label}>
          {index > 0 ? <span aria-hidden="true"> · </span> : null}
          {index > 0 ? <span className="sr-only">, </span> : null}
          <Link href={part.href} className={cn(linkClass, "text-(--ed-text-2)")}>
            <span className="font-mono tabular-nums text-(--ed-text)">{part.count}</span> {part.label}
          </Link>
        </span>
      ))}
    </p>
  );
}

export function QueueBuckets({ filter, summary }: { filter: IdeaFilter; summary: QueueSummary }) {
  const total = QUEUE_BUCKETS.reduce((sum, bucket) => sum + summary.buckets[bucket], 0);
  const entries: { key: string | null; label: string; count: number }[] = [
    { key: null, label: "All", count: total },
    ...QUEUE_BUCKETS.map((bucket) => ({ key: bucket, label: QUEUE_BUCKET_LABELS[bucket], count: summary.buckets[bucket] })),
  ];
  return (
    <nav aria-label="Queue buckets">
      <ul className="flex flex-wrap gap-1.5">
        {entries.map((entry) => {
          const current = filter.bucket === entry.key;
          return (
            <li key={entry.label}>
              <Link
                href={`${EDITORIAL_BASE}${ideaFilterQuery({ ...filter, bucket: null }, { bucket: entry.key })}`}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-9 items-center gap-2 rounded-md border px-3 text-sm outline-hidden focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-(--ed-focus)",
                  current
                    ? "border-(--ed-text) bg-(--ed-text) text-white"
                    : "border-(--ed-border-strong) bg-(--ed-surface) text-(--ed-text) hover:bg-(--ed-sunk)",
                )}
              >
                {entry.label}
                <span className="font-mono text-xs tabular-nums">{entry.count}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Select({
  id,
  name,
  label,
  value,
  options,
}: {
  id: string;
  name: string;
  label: string;
  value: string | null;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex min-w-[10rem] flex-1 flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-(--ed-text-2)">
        {label}
      </label>
      <select id={id} name={name} defaultValue={value ?? ""} className={fieldClass}>
        <option value="">Any</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * Plain GET form: works without JavaScript, keeps filters in the URL, and
 * changes nothing until "Apply filters" is pressed.
 */
export function IdeaFilters({ filter, scope }: { filter: IdeaFilter; scope: IdeaFilter["scope"] }) {
  const active = activeFilterCount(filter);
  const action = scope === "queue" ? EDITORIAL_BASE : `${EDITORIAL_BASE}/library`;
  const clearHref = scope === "queue" ? `${action}${ideaFilterQuery({ ...filter, ...emptyFilters }, {})}` : action;
  return (
    <details open={active > 0} className="rounded-lg border border-(--ed-border) bg-(--ed-surface)">
      <summary className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-4 text-sm font-medium outline-hidden focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-(--ed-focus)">
        Filters
        {active > 0 ? <span className="text-(--ed-text-2)">· {active} active</span> : null}
      </summary>
      <form method="get" action={action} className="flex flex-col gap-4 border-t border-(--ed-border) px-4 py-4">
        {scope === "queue" && filter.bucket ? <input type="hidden" name="bucket" value={filter.bucket} /> : null}
        <div className="flex flex-col gap-1">
          <label htmlFor={`${scope}-search`} className="text-xs font-medium text-(--ed-text-2)">
            Search title, slug, buyer or job
          </label>
          <input
            id={`${scope}-search`}
            name="q"
            type="search"
            defaultValue={filter.search ?? ""}
            maxLength={120}
            className={fieldClass}
          />
        </div>
        <div className="flex flex-wrap gap-3">
          {scope === "queue" ? (
            <>
              <Select
                id="filter-severity"
                name="severity"
                label="Issues"
                value={filter.severity}
                options={[
                  { value: "blocking", label: "Blocking issues" },
                  { value: "evidence", label: "Evidence blockers" },
                  { value: "warnings", label: "Warnings only" },
                  { value: "clean", label: "No open issues" },
                ]}
              />
              <Select
                id="filter-decision"
                name="decision"
                label="Decision"
                value={filter.decision}
                options={(["new", "accepted", "needs_research", "rejected", "legacy"] as const).map((state) => ({
                  value: state,
                  label: CANDIDATE_LABELS[state],
                }))}
              />
            </>
          ) : (
            <>
              <Select
                id="filter-publication"
                name="publication"
                label="Publication"
                value={filter.publication}
                options={(["live", "unpublished", "never_published"] as const).map((state) => ({
                  value: state,
                  label: PUBLICATION_LABELS[state],
                }))}
              />
              <Select
                id="filter-coverage"
                name="coverage"
                label="Review coverage"
                value={filter.coverage}
                options={[
                  { value: "complete", label: "All sections reviewed" },
                  { value: "partial", label: "Partly reviewed" },
                  { value: "none", label: "Not reviewed" },
                ]}
              />
            </>
          )}
          <Select
            id="filter-age"
            name="age"
            label="Evidence age"
            value={filter.sourceAge}
            options={[
              { value: "fresh", label: "Fresh" },
              { value: "aging", label: "Ageing" },
              { value: "stale", label: "Stale" },
              { value: "unknown", label: "Unknown" },
            ]}
          />
          <Select
            id="filter-category"
            name="category"
            label="Category"
            value={filter.category}
            options={CATEGORY_SLUGS.map((slug) => ({ value: slug, label: CATEGORY_LABELS[slug] }))}
          />
          {scope === "queue" ? (
            <div className="flex min-w-[10rem] flex-1 flex-col gap-1">
              <label htmlFor="filter-run" className="text-xs font-medium text-(--ed-text-2)">
                Engine run ID
              </label>
              <input
                id="filter-run"
                name="run"
                defaultValue={filter.engineRunId ?? ""}
                maxLength={64}
                pattern="[A-Za-z0-9][A-Za-z0-9_\-]*"
                title="Letters, numbers, hyphens and underscores"
                className={cn(fieldClass, "font-mono")}
              />
            </div>
          ) : (
            <Select
              id="filter-sort"
              name="sort"
              label="Sort by"
              value={filter.sort === "updated_desc" ? null : filter.sort}
              options={[
                { value: "updated_asc", label: "Least recently updated" },
                { value: "title_asc", label: "Title A–Z" },
              ]}
            />
          )}
        </div>
        {scope === "library" ? (
          <label className="flex min-h-10 items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="stale"
              value="1"
              defaultChecked={filter.staleEvidence}
              className="size-4 accent-(--ed-text)"
            />
            Only ideas with stale evidence
          </label>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button type="submit" className={buttonClass.primary}>
            Apply filters
          </button>
          {active > 0 ? (
            <Link href={clearHref} className={buttonClass.ghost}>
              Clear filters
            </Link>
          ) : null}
        </div>
      </form>
    </details>
  );
}

const emptyFilters: Partial<IdeaFilter> = {
  decision: null,
  severity: null,
  sourceAge: null,
  engineRunId: null,
  category: null,
  search: null,
  publication: null,
  coverage: null,
  staleEvidence: false,
  sort: "updated_desc",
};
