"use client";

import { useDeferredValue, useMemo, useState } from "react";

import { changedSections, diffLines, withContext } from "@/lib/editorial/domain/diff";
import { cn } from "@/lib/utils";
import { pressedToggleClass } from "./ui";

export type CompareTarget = {
  /** Stable key: a revision id, or "theirs" for the newer copy in a conflict. */
  key: string;
  label: string;
  title: string;
  markdown: string;
};

const MAX_ROWS = 1_500;

/** Line diff from an earlier (or newer, in a conflict) copy to the editor text. */
export function ComparePane({
  targets,
  current,
  currentLabel,
  initialKey,
}: {
  targets: CompareTarget[];
  current: { title: string; markdown: string };
  currentLabel: string;
  initialKey: string | null;
}) {
  const [selectedKey, setSelectedKey] = useState(initialKey ?? targets[0]?.key ?? null);
  const target = targets.find((candidate) => candidate.key === selectedKey) ?? targets[0] ?? null;
  const deferred = useDeferredValue(current.markdown);
  const diff = useMemo(() => {
    if (!target) return null;
    const result = diffLines(target.markdown, deferred);
    return {
      result,
      sections: changedSections(result, target.markdown, deferred),
      rows: withContext(result.lines, 3),
    };
  }, [target, deferred]);

  if (!target || !diff) {
    return (
      <p className="rounded-lg border border-dashed border-(--ed-border-strong) bg-(--ed-surface) px-4 py-6 text-sm text-(--ed-text-2)">
        There is no earlier revision to compare with. This is the first version of this idea.
      </p>
    );
  }

  const bodyChanged = diff.result.added > 0 || diff.result.removed > 0;
  const unchanged = !bodyChanged && target.title === current.title;
  const rows = diff.rows.slice(0, MAX_ROWS);

  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label="Compare with" className="flex flex-wrap gap-2">
        {targets.map((candidate) => (
          <button
            key={candidate.key}
            type="button"
            aria-pressed={candidate.key === target.key}
            className={pressedToggleClass}
            onClick={() => setSelectedKey(candidate.key)}
          >
            {candidate.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-1 text-sm">
        <p>
          From <strong className="font-semibold">{target.label}</strong> to <strong className="font-semibold">{currentLabel}</strong>
          {unchanged ? " — no differences." : ""}
        </p>
        {bodyChanged ? (
          <p className="text-(--ed-text-2)">
            <span className="font-mono tabular-nums text-(--ed-success)">+{diff.result.added}</span> added ·{" "}
            <span className="font-mono tabular-nums text-(--ed-danger)">−{diff.result.removed}</span> removed lines
            {diff.sections.length > 0 ? ` · Changed sections: ${diff.sections.join(", ")}` : ""}
          </p>
        ) : !unchanged ? (
          <p className="text-(--ed-text-2)">The article body is identical; only the title differs.</p>
        ) : null}
        {diff.result.truncated ? (
          <p className="text-(--ed-warning)">The change is too large for a line-by-line diff; showing everything as removed and added.</p>
        ) : null}
      </div>

      {target.title !== current.title ? (
        <dl className="grid gap-1 rounded-md border border-(--ed-border) bg-(--ed-surface) px-3 py-2 text-sm sm:grid-cols-[6rem_1fr]">
          <dt className="text-(--ed-text-2)">Title before</dt>
          <dd className="bg-(--ed-danger-bg)">{target.title}</dd>
          <dt className="text-(--ed-text-2)">Title after</dt>
          <dd className="bg-(--ed-success-bg)">{current.title}</dd>
        </dl>
      ) : null}

      {bodyChanged ? (
        <ol
          aria-label={`Line changes from ${target.label}`}
          className="overflow-hidden rounded-lg border border-(--ed-border) bg-(--ed-surface) font-mono text-[0.8125rem] leading-6"
        >
          {rows.map((row, index) =>
            row.kind === "gap" ? (
              <li key={`gap-${index}`} className="bg-(--ed-sunk) px-3 text-(--ed-text-2)">
                ⋯ {row.hidden} unchanged line{row.hidden === 1 ? "" : "s"}
              </li>
            ) : (
              <li
                key={`${row.kind}-${row.oldNumber ?? "n"}-${row.newNumber ?? "n"}-${index}`}
                className={cn(
                  "grid grid-cols-[2.75rem_2.75rem_1.25rem_minmax(0,1fr)]",
                  row.kind === "add" && "bg-(--ed-success-bg)",
                  row.kind === "remove" && "bg-(--ed-danger-bg)",
                )}
              >
                <span aria-hidden="true" className="select-none pr-2 text-right text-(--ed-text-2)">
                  {row.oldNumber ?? ""}
                </span>
                <span aria-hidden="true" className="select-none pr-2 text-right text-(--ed-text-2)">
                  {row.newNumber ?? ""}
                </span>
                <span aria-hidden="true" className={cn("select-none", row.kind === "add" ? "text-(--ed-success)" : "text-(--ed-danger)")}>
                  {row.kind === "add" ? "+" : row.kind === "remove" ? "−" : ""}
                </span>
                <span className="whitespace-pre-wrap break-words pr-3">
                  <span className="sr-only">
                    {row.kind === "add" ? `Added, line ${row.newNumber}: ` : row.kind === "remove" ? `Removed, line ${row.oldNumber}: ` : "Unchanged: "}
                  </span>
                  {row.text || " "}
                </span>
              </li>
            ),
          )}
          {diff.rows.length > MAX_ROWS ? (
            <li className="bg-(--ed-sunk) px-3 text-(--ed-text-2)">{diff.rows.length - MAX_ROWS} more rows not shown.</li>
          ) : null}
        </ol>
      ) : null}
    </div>
  );
}
