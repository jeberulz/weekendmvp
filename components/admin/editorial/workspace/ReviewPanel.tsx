"use client";

import type { ReactNode } from "react";

import type { EditorialTarget } from "@/lib/editorial/contracts/errors";
import type { ReviewItemKind, ReviewItemView, ReviewStatus, RevisionView } from "@/lib/editorial/contracts/views";
import { formatAbsolute } from "@/lib/editorial/presentation/format";
import { REVIEW_ITEM_KIND_LABELS, REVIEW_STATUS_LABELS } from "@/lib/editorial/presentation/review";
import { StatusBadge, type Tone } from "../common/primitives";
import { textButtonClass } from "./ui";

const STATUS_TONES: Record<ReviewStatus, Tone> = {
  unreviewed: "neutral",
  reviewed: "success",
  stale: "warning",
  flagged: "danger",
};

const KIND_ORDER: ReviewItemKind[] = ["section", "claim", "source", "assumptions", "metadata", "preview"];

/**
 * The explicit review checklist for this revision. Every item is attested
 * one at a time against its dependency hash; there is no "mark all" action.
 * Approval stays unavailable until the listed blockers are gone.
 */
export function ReviewPanel({
  view,
  itemActions,
  onGoTo,
  approval,
}: {
  view: RevisionView;
  /** Per-item attestation controls (WP46-E3). */
  itemActions?: (item: ReviewItemView) => ReactNode;
  onGoTo(target: EditorialTarget): void;
  /** Approve controls (WP46-E3). */
  approval?: ReactNode;
}) {
  const total = view.reviewItems.length;
  const reviewed = view.reviewItems.filter((item) => item.status === "reviewed").length;
  const remaining = view.reviewItems.filter((item) => item.status !== "reviewed");
  const byKind = KIND_ORDER.map((kind) => ({ kind, items: view.reviewItems.filter((item) => item.kind === kind) })).filter(
    (group) => group.items.length > 0,
  );

  return (
    <div className="flex flex-col gap-5">
      <section aria-labelledby="review-summary" className="flex flex-col gap-2 rounded-lg border border-(--ed-border) bg-(--ed-surface) px-3 py-3">
        <h2 id="review-summary" className="text-sm font-semibold">
          Review checklist
        </h2>
        <p className="text-sm">
          <span className="font-mono tabular-nums">
            {reviewed} of {total}
          </span>{" "}
          items reviewed for this exact revision
          {remaining.length > 0 ? ` · ${remaining.length} remaining` : " · nothing remaining"}.
        </p>
        {view.changesRequestedNote ? (
          <p className="text-sm text-(--ed-warning)">Changes requested: {view.changesRequestedNote}</p>
        ) : null}
        {view.eligibility.canApprove ? (
          <p className="text-sm text-(--ed-success)">Every requirement for approval is met.</p>
        ) : (
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">Approval is unavailable because:</p>
            <ul className="flex flex-col gap-1 text-sm">
              {view.eligibility.blockers.map((blocker, index) => (
                <li key={`${blocker.code}-${index}`} className="flex flex-col items-start">
                  <span>{blocker.message}</span>
                  {blocker.target ? (
                    <button type="button" className={`${textButtonClass} text-xs`} onClick={() => blocker.target && onGoTo(blocker.target)}>
                      Go there<span className="sr-only">: {blocker.message}</span>
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        )}
        {approval}
      </section>

      {byKind.map((group) => (
        <section key={group.kind} aria-labelledby={`review-${group.kind}`} className="flex flex-col gap-2">
          <h2 id={`review-${group.kind}`} className="text-sm font-semibold">
            {REVIEW_ITEM_KIND_LABELS[group.kind]}{" "}
            <span className="font-mono font-normal text-(--ed-text-2)">
              ({group.items.filter((item) => item.status === "reviewed").length}/{group.items.length})
            </span>
          </h2>
          <ul className="flex flex-col gap-1.5">
            {group.items.map((item) => (
              <li key={item.id} className="flex flex-col gap-1.5 rounded-lg border border-(--ed-border) bg-(--ed-surface) px-3 py-2.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="min-w-0 flex-1 text-sm">{item.label}</p>
                  <StatusBadge tone={STATUS_TONES[item.status]}>{REVIEW_STATUS_LABELS[item.status]}</StatusBadge>
                </div>
                {item.attestedAt ? (
                  <p className="text-xs text-(--ed-text-2)">
                    Reviewed {formatAbsolute(item.attestedAt)}
                    {item.note ? ` — ${item.note}` : ""}
                  </p>
                ) : null}
                {item.flag ? (
                  <p className="text-xs text-(--ed-danger)">
                    Flagged ({item.flag.severity === "high" ? "high" : "low"} severity
                    {item.flag.resolved ? ", resolved" : ""}): {item.flag.note}
                    {item.flag.resolutionNote ? ` — ${item.flag.resolutionNote}` : ""}
                  </p>
                ) : null}
                <div className="flex flex-wrap items-center gap-2">
                  {item.target ? (
                    <button type="button" className={`${textButtonClass} text-xs`} onClick={() => item.target && onGoTo(item.target)}>
                      Open<span className="sr-only">: {item.label}</span>
                    </button>
                  ) : null}
                  {itemActions?.(item)}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
