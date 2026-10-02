"use client";

import { AlertTriangle, CheckCircle2, Circle, Flag, OctagonAlert } from "lucide-react";

import type { ReviewStatus } from "@/lib/editorial/contracts/views";
import type { OutlineEntry } from "@/lib/editorial/editor/outline";
import { REVIEW_STATUS_LABELS } from "@/lib/editorial/presentation/review";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<ReviewStatus, { icon: typeof Circle; className: string }> = {
  reviewed: { icon: CheckCircle2, className: "text-(--ed-success)" },
  stale: { icon: AlertTriangle, className: "text-(--ed-warning)" },
  flagged: { icon: Flag, className: "text-(--ed-danger)" },
  unreviewed: { icon: Circle, className: "text-(--ed-text-2)" },
};

/**
 * The eight required sections in order, with the review status of the saved
 * copy. Selecting one moves the editor caret (Write) or scrolls the preview.
 */
export function SectionOutline({
  entries,
  onSelect,
}: {
  entries: OutlineEntry[];
  onSelect(entry: OutlineEntry): void;
}) {
  const reviewed = entries.filter((entry) => entry.status === "reviewed").length;
  return (
    <nav aria-label="Article sections">
      <details open className="group rounded-lg border border-(--ed-border) bg-(--ed-surface) px-3 py-2">
        <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between gap-2 rounded text-sm outline-hidden focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-(--ed-focus) [&::-webkit-details-marker]:hidden">
          <span className="font-semibold">Sections</span>
          <span className="text-xs text-(--ed-text-2)">
            <span className="font-mono tabular-nums text-(--ed-text)">
              {reviewed}/{entries.length}
            </span>{" "}
            reviewed in the saved copy
            <span aria-hidden="true" className="ml-2 inline-block group-open:rotate-180">
              ▾
            </span>
          </span>
        </summary>
        <ol className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(min(100%,12.5rem),1fr))] gap-1.5">
        {entries.map((entry, index) => {
          const style = STATUS_STYLE[entry.status];
          const Icon = style.icon;
          const content = (
            <>
              <span className="font-mono text-xs tabular-nums text-(--ed-text-2)">{index + 1}</span>
              <span className="flex min-w-0 flex-1 flex-col items-start text-left">
                <span className="text-sm font-medium leading-snug">{entry.title}</span>
                <span className={cn("flex items-center gap-1 text-xs", entry.line === null ? "text-(--ed-danger)" : style.className)}>
                  {entry.line === null ? (
                    <OctagonAlert aria-hidden="true" className="size-3.5" />
                  ) : (
                    <Icon aria-hidden="true" className="size-3.5" />
                  )}
                  {entry.line === null ? "Heading missing" : REVIEW_STATUS_LABELS[entry.status]}
                  {entry.issueCount > 0 ? ` · ${entry.issueCount} issue${entry.issueCount === 1 ? "" : "s"}` : ""}
                </span>
              </span>
            </>
          );
          return (
            <li key={entry.key}>
              {entry.line === null ? (
                <div className="flex min-h-12 items-center gap-2 rounded-md border border-dashed border-(--ed-danger) bg-(--ed-surface) px-2.5 py-1.5">
                  {content}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onSelect(entry)}
                  className="flex min-h-12 w-full items-center gap-2 rounded-md border border-(--ed-border-strong) bg-(--ed-surface) px-2.5 py-1.5 outline-hidden hover:bg-(--ed-sunk) focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-(--ed-focus)"
                >
                  {content}
                  <span className="sr-only"> — go to section</span>
                </button>
              )}
            </li>
          );
        })}
        </ol>
      </details>
    </nav>
  );
}
