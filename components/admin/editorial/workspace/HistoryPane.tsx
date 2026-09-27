import Link from "next/link";

import type { RevisionSummary } from "@/lib/editorial/contracts/views";
import { REVIEW_LABELS, REVISION_KIND_LABELS, shortHash } from "@/lib/editorial/presentation/format";
import { cn } from "@/lib/utils";
import { StatusBadge, Time, linkClass } from "../common/primitives";

/** Every revision of the idea, newest first. Opening one never changes what is live. */
export function HistoryPane({
  revisions,
  selectedId,
  hrefFor,
  nowMs,
}: {
  revisions: RevisionSummary[];
  selectedId: string;
  hrefFor(revisionId: string): string;
  nowMs: number;
}) {
  const ordered = [...revisions].sort((a, b) => b.number - a.number);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-(--ed-text-2)">
        Opening a revision shows it read-only unless it is the working draft. Discarding a draft or opening an older revision never
        changes the live page.
      </p>
      <ol aria-label="Revisions, newest first" className="flex flex-col gap-2">
        {ordered.map((revision) => {
          const selected = revision.id === selectedId;
          return (
            <li
              key={revision.id}
              className={cn(
                "flex flex-col gap-2 rounded-lg border bg-(--ed-surface) px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
                selected ? "border-(--ed-text)" : "border-(--ed-border)",
              )}
            >
              <div className="flex min-w-0 flex-col gap-1">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-semibold">v{revision.number}</span>
                  <span className="text-sm">{REVISION_KIND_LABELS[revision.kind]}</span>
                  {revision.isLive ? <StatusBadge tone="success">Live</StatusBadge> : null}
                  {revision.isWorking ? <StatusBadge tone="info">Working</StatusBadge> : null}
                  {revision.discarded ? <StatusBadge>Discarded</StatusBadge> : null}
                  {revision.kind !== "legacy_snapshot" ? <StatusBadge>Review: {REVIEW_LABELS[revision.reviewState]}</StatusBadge> : null}
                  {revision.approval ? (
                    <StatusBadge tone={revision.approval.status === "active" ? "success" : "warning"}>
                      Approval {revision.approval.status === "active" ? "active" : revision.approval.status}
                    </StatusBadge>
                  ) : null}
                </p>
                <p className="flex flex-wrap gap-x-3 text-xs text-(--ed-text-2)">
                  <span>
                    Created <Time iso={revision.createdAt} nowMs={nowMs} /> by {revision.createdBy.label}
                  </span>
                  <span>
                    Updated <Time iso={revision.updatedAt} nowMs={nowMs} />
                  </span>
                  <span>
                    Artifact <span className="font-mono">{shortHash(revision.artifactHash)}</span>
                  </span>
                </p>
              </div>
              {selected ? (
                <span aria-current="page" className="text-sm font-medium">
                  Showing
                </span>
              ) : (
                <Link href={hrefFor(revision.id)} className={`${linkClass} text-sm font-medium`}>
                  Open v{revision.number}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
