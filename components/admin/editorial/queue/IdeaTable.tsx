import Link from "next/link";
import type { ReactNode } from "react";

import type { IdeaListItem } from "@/lib/editorial/contracts/views";
import { CATEGORY_LABELS } from "@/lib/editorial/contracts/taxonomy";
import { StatusBadge, Time, linkClass } from "../common/primitives";
import {
  BlockersCell,
  CandidateBadge,
  EngineRecommendation,
  EvidenceCell,
  PublicationCell,
  ReviewCoverageCell,
  WorkingRevisionCell,
} from "../common/status";
import { EDITORIAL_BASE } from "../shell/nav-items";

type Column = {
  key: string;
  header: string;
  cell: (item: IdeaListItem) => ReactNode;
  className?: string;
};

function IdeaCell({ item }: { item: IdeaListItem }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <Link href={`${EDITORIAL_BASE}/ideas/${item.id}`} className={`${linkClass} font-medium text-(--ed-text) no-underline hover:underline`}>
        {item.title}
      </Link>
      <span className="text-xs text-(--ed-text-2)">{item.buyer}</span>
      {item.duplicateOf ? (
        <span className="mt-0.5">
          <StatusBadge tone="warning">Slug already used by “{item.duplicateOf.title}”</StatusBadge>
        </span>
      ) : null}
    </div>
  );
}

function columns(variant: "queue" | "library", nowMs: number): Column[] {
  const idea: Column = { key: "idea", header: "Idea", cell: (item) => <IdeaCell item={item} />, className: "min-w-[16rem]" };
  const updated: Column = { key: "updated", header: "Updated", cell: (item) => <Time iso={item.updatedAt} nowMs={nowMs} /> };
  const working: Column = { key: "working", header: "Working revision", cell: (item) => <WorkingRevisionCell item={item} /> };
  const publication: Column = { key: "publication", header: "Publication", cell: (item) => <PublicationCell item={item} /> };
  const evidence: Column = { key: "evidence", header: "Evidence", cell: (item) => <EvidenceCell item={item} /> };
  const reviewed: Column = { key: "reviewed", header: "Reviewed", cell: (item) => <ReviewCoverageCell item={item} /> };
  if (variant === "queue") {
    return [
      idea,
      {
        key: "decision",
        header: "Decision",
        cell: (item) => (
          <div className="flex flex-col items-start gap-1">
            <CandidateBadge item={item} />
            <EngineRecommendation item={item} />
          </div>
        ),
      },
      working,
      publication,
      { key: "blockers", header: "Blockers", cell: (item) => <BlockersCell item={item} /> },
      reviewed,
      evidence,
      updated,
    ];
  }
  return [
    idea,
    publication,
    working,
    reviewed,
    evidence,
    { key: "category", header: "Category", cell: (item) => <span className="text-(--ed-text-2)">{CATEGORY_LABELS[item.category]}</span> },
    updated,
  ];
}

/**
 * Semantic table from 768px; stacked cards below. Only one is displayed at a
 * time (the other is `display: none`), so assistive tech reads it once.
 */
export function IdeaTable({
  items,
  variant,
  nowMs,
  caption,
}: {
  items: IdeaListItem[];
  variant: "queue" | "library";
  nowMs: number;
  caption: string;
}) {
  const cols = columns(variant, nowMs);
  return (
    <>
      <div className="hidden overflow-x-auto rounded-lg border border-(--ed-border) bg-(--ed-surface) md:block">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-(--ed-border-strong) text-left">
              {cols.map((col) => (
                <th key={col.key} scope="col" className="px-3 py-2.5 text-xs font-semibold text-(--ed-text-2)">
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-(--ed-border) align-top last:border-b-0 hover:bg-(--ed-canvas)">
                {cols.map((col) => (
                  <td key={col.key} className={`px-3 py-3 ${col.className ?? ""}`}>
                    {col.cell(item)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul aria-label={caption} className="flex flex-col gap-3 md:hidden">
        {items.map((item) => (
          <li key={item.id} className="rounded-lg border border-(--ed-border) bg-(--ed-surface) p-4">
            <IdeaCell item={item} />
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              {cols
                .filter((col) => col.key !== "idea")
                .map((col) => (
                  <div key={col.key} className="contents">
                    <dt className="text-xs text-(--ed-text-2)">{col.header}</dt>
                    <dd className="min-w-0">{col.cell(item)}</dd>
                  </div>
                ))}
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
