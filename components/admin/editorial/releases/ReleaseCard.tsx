import Link from "next/link";
import type { ReactNode } from "react";

import { RELEASE_OPERATION_LABELS, releaseStateLabel } from "@/lib/editorial/contracts/states";
import type { ReleaseView } from "@/lib/editorial/contracts/views";
import { formatAbsolute } from "@/lib/editorial/presentation/format";
import { StatusBadge, Time, linkClass } from "../common/primitives";
import { ReleaseStateBadge } from "../common/status";
import { EDITORIAL_BASE } from "../shell/nav-items";

function Steps({ release }: { release: ReleaseView }) {
  return (
    <ol className="flex flex-col gap-2 border-l border-(--ed-border-strong) pl-4">
      {release.steps.map((step, index) => (
        <li key={`${step.state}-${index}`} className="text-sm">
          <span className="font-medium">{step.label}</span>{" "}
          <time dateTime={step.at} className="font-mono text-xs text-(--ed-text-2)">
            {formatAbsolute(step.at)}
          </time>
          {step.detail ? <p className="text-xs text-(--ed-text-2)">{step.detail}</p> : null}
        </li>
      ))}
    </ol>
  );
}

/**
 * One release: exact revision, operation, state, error and the full step
 * history. Every fixture release says it is simulated.
 */
export function ReleaseCard({
  release,
  nowMs,
  actions,
  headingLevel = "h2",
}: {
  release: ReleaseView;
  nowMs: number;
  actions?: ReactNode;
  headingLevel?: "h2" | "h3";
}) {
  const Heading = headingLevel;
  const expanded = release.state === "failed" || release.state === "needs_reconciliation" || release.availableActions.length > 0;
  const currentLabel = releaseStateLabel(release.operation, release.state);
  return (
    <article className="flex flex-col gap-3 rounded-lg border border-(--ed-border) bg-(--ed-surface) p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <Heading className="text-base font-semibold">
            <Link href={`${EDITORIAL_BASE}/ideas/${release.ideaId}`} className={`${linkClass} no-underline hover:underline`}>
              {release.ideaTitle}
            </Link>
          </Heading>
          <p className="text-sm text-(--ed-text-2)">
            {RELEASE_OPERATION_LABELS[release.operation]}
            {release.revisionNumber !== null ? (
              <>
                {" "}
                of <span className="font-mono text-(--ed-text)">v{release.revisionNumber}</span>
              </>
            ) : null}
            {release.attempt > 1 ? ` · attempt ${release.attempt}` : ""} · requested by {release.requestedBy.label} ·{" "}
            <Time iso={release.createdAt} nowMs={nowMs} />
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <ReleaseStateBadge operation={release.operation} state={release.state} label={currentLabel} />
          {release.simulated && release.operation !== "legacy_baseline" ? <StatusBadge>Simulated</StatusBadge> : null}
        </div>
      </div>
      {release.reason ? <p className="text-sm">Reason: {release.reason}</p> : null}
      {release.error ? (
        <div role="note" className="rounded-md border border-(--ed-danger) bg-(--ed-danger-bg) px-3 py-2 text-sm text-(--ed-danger)">
          <span className="font-semibold">{release.error.message}</span>{" "}
          <span className="font-mono text-xs">({release.error.code})</span>
        </div>
      ) : null}
      {release.state === "needs_reconciliation" ? (
        <p className="rounded-md border border-(--ed-warning) bg-(--ed-warning-bg) px-3 py-2 text-sm text-(--ed-warning)">
          The outcome is uncertain. The last confirmed live version is shown until a probe confirms what happened.
          Reconcile instead of retrying.
        </p>
      ) : null}
      {release.preview ? (
        <p className="text-sm">
          <Link href={release.preview.href ?? "#"} className={linkClass}>
            Open preview
          </Link>{" "}
          <span className="text-xs text-(--ed-text-2)">— {release.preview.label}</span>
        </p>
      ) : null}
      {expanded ? (
        <Steps release={release} />
      ) : (
        <details>
          <summary className="min-h-9 cursor-pointer text-sm text-(--ed-text-2) outline-hidden focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-(--ed-focus)">
            Show {release.steps.length} step{release.steps.length === 1 ? "" : "s"}
          </summary>
          <div className="mt-2">
            <Steps release={release} />
          </div>
        </details>
      )}
      {actions ? <div className="flex flex-wrap gap-2 border-t border-(--ed-border) pt-3">{actions}</div> : null}
    </article>
  );
}
