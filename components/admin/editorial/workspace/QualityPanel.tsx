"use client";

import { AlertTriangle, CheckCircle2, CircleSlash, OctagonAlert } from "lucide-react";

import type { CheckOutcome } from "@/lib/editorial/contracts/checks";
import type { EditorialTarget } from "@/lib/editorial/contracts/errors";
import type { CheckView, IssueView, RevisionView } from "@/lib/editorial/contracts/views";
import { formatAbsolute } from "@/lib/editorial/presentation/format";
import { CHECK_OUTCOME_LABELS, CHECK_SEVERITY_LABELS } from "@/lib/editorial/presentation/review";
import { cn } from "@/lib/utils";
import { EDITORIAL_LIMITS } from "@/lib/editorial/contracts/limits";
import { ReasonDialog } from "../common/ReasonDialog";
import { StatusBadge, Time } from "../common/primitives";
import { smallButtonClass, textButtonClass } from "./ui";

type Resolve = {
  disabledReason: string | null;
  onResolve(issueId: string, dependencyHash: string, note: string): Promise<string | null>;
};

const OUTCOME_ICONS: Record<CheckOutcome, { icon: typeof CheckCircle2; className: string }> = {
  pass: { icon: CheckCircle2, className: "text-(--ed-success)" },
  fail: { icon: OctagonAlert, className: "text-(--ed-danger)" },
  warning: { icon: AlertTriangle, className: "text-(--ed-warning)" },
  not_run: { icon: CircleSlash, className: "text-(--ed-text-2)" },
  error: { icon: OctagonAlert, className: "text-(--ed-danger)" },
};

/**
 * Navigable issues and the checks behind them. There is deliberately no
 * aggregate score: blockers and warnings are listed one by one.
 */
export function QualityPanel({
  view,
  nowMs,
  runChecks,
  resolve,
  onGoTo,
}: {
  view: RevisionView;
  nowMs: number;
  runChecks: { disabledReason: string | null; running: boolean; error: string | null; onRun(): void };
  /** Warnings and flags can be resolved with a written reason; blockers cannot. */
  resolve?: Resolve;
  onGoTo(target: EditorialTarget): void;
}) {
  const blockers = view.issues.filter((issue) => issue.severity === "blocker");
  const warnings = view.issues.filter((issue) => issue.severity === "warning");
  return (
    <div className="flex flex-col gap-5">
      <section aria-labelledby="checks-status" className="flex flex-col gap-2 rounded-lg border border-(--ed-border) bg-(--ed-surface) px-3 py-3">
        <h2 id="checks-status" className="text-sm font-semibold">
          Automated checks
        </h2>
        <p className="text-sm">
          Policy <span className="font-mono">{view.policy.version}</span> ·{" "}
          {view.policy.checksCurrent ? (
            <span className="text-(--ed-success)">current for this content</span>
          ) : (
            <span className="text-(--ed-warning)">out of date — content or policy changed since the last run</span>
          )}
        </p>
        <p className="text-xs text-(--ed-text-2)">
          {view.policy.checksRunAt ? (
            <>
              Last run <Time iso={view.policy.checksRunAt} nowMs={nowMs} /> on the saved copy. Checks in the local demo are simulated.
            </>
          ) : (
            "Checks have not run on this revision."
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={smallButtonClass}
            disabled={runChecks.disabledReason !== null}
            aria-disabled={runChecks.running || undefined}
            aria-describedby={runChecks.disabledReason ? "run-checks-reason" : undefined}
            onClick={() => {
              if (!runChecks.running) runChecks.onRun();
            }}
          >
            {runChecks.running ? "Running checks…" : "Run checks"}
          </button>
          {runChecks.disabledReason ? (
            <span id="run-checks-reason" className="text-xs text-(--ed-text-2)">
              {runChecks.disabledReason}
            </span>
          ) : null}
        </div>
        {runChecks.error ? (
          <p role="alert" className="text-sm text-(--ed-danger)">
            {runChecks.error}
          </p>
        ) : null}
      </section>

      <IssueList title="Blockers" tone="danger" issues={blockers} empty="No blockers." onGoTo={onGoTo} resolve={resolve} />
      <IssueList title="Warnings" tone="warning" issues={warnings} empty="No warnings." onGoTo={onGoTo} resolve={resolve} />

      <details className="rounded-lg border border-(--ed-border) bg-(--ed-surface) px-3 py-2">
        <summary className="min-h-9 cursor-pointer rounded py-1.5 text-sm font-semibold outline-hidden focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-(--ed-focus)">
          All checks ({view.checks.length})
        </summary>
        <ul className="mt-2 flex flex-col gap-2">
          {view.checks.map((check) => (
            <CheckRow key={check.id} check={check} />
          ))}
        </ul>
      </details>
    </div>
  );
}

function IssueList({
  title,
  tone,
  issues,
  empty,
  onGoTo,
  resolve,
}: {
  title: string;
  tone: "danger" | "warning";
  issues: IssueView[];
  empty: string;
  onGoTo(target: EditorialTarget): void;
  resolve?: Resolve;
}) {
  const headingId = `issues-${title.toLowerCase()}`;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h2 id={headingId} className="text-sm font-semibold">
        {title} <span className="font-mono font-normal text-(--ed-text-2)">({issues.length})</span>
      </h2>
      {issues.length === 0 ? (
        <p className="text-sm text-(--ed-text-2)">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {issues.map((issue) => (
            <li key={issue.id} className="flex flex-col gap-1.5 rounded-lg border border-(--ed-border) bg-(--ed-surface) px-3 py-2.5">
              <p className="flex items-start gap-2 text-sm">
                <StatusBadge tone={tone} className="shrink-0">
                  {tone === "danger" ? "Blocker" : "Warning"}
                </StatusBadge>
                <span>{issue.message}</span>
              </p>
              <p className="text-xs text-(--ed-text-2)">
                Category: {issue.category}
                {issue.resolvable ? " · can be resolved with a written reason" : " · change the content or evidence to clear it"}
              </p>
              {issue.resolution ? (
                <p className="text-xs">
                  Resolved {formatAbsolute(issue.resolution.at)}: {issue.resolution.note}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-3">
                {issue.target ? (
                  <button type="button" className={`${textButtonClass} text-xs`} onClick={() => issue.target && onGoTo(issue.target)}>
                    Go to {issue.target.kind === "section" ? "section" : issue.target.kind}
                    <span className="sr-only">: {issue.message}</span>
                  </button>
                ) : null}
                {resolve && issue.resolvable && !issue.resolution ? (
                  <ReasonDialog
                    title="Resolve with a reason"
                    description={`Write down why this is acceptable. The note stays with the revision's history. Issue: ${issue.message}`}
                    label="Reason"
                    maxLength={EDITORIAL_LIMITS.noteChars}
                    confirmLabel="Resolve"
                    trigger={
                      <button type="button" className={`${textButtonClass} text-xs`} disabled={resolve.disabledReason !== null}>
                        Resolve with a reason…<span className="sr-only"> {issue.message}</span>
                      </button>
                    }
                    onConfirm={(note) => resolve.onResolve(issue.id, issue.dependencyHash, note)}
                  />
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CheckRow({ check }: { check: CheckView }) {
  const outcome = OUTCOME_ICONS[check.outcome];
  const Icon = outcome.icon;
  return (
    <li className="flex flex-col gap-0.5 border-b border-(--ed-border) pb-2 text-sm last:border-b-0">
      <p className="flex items-start gap-2">
        <Icon aria-hidden="true" className={cn("mt-0.5 size-4 shrink-0", outcome.className)} />
        <span className="font-medium">{check.label}</span>
      </p>
      <p className="pl-6 text-xs text-(--ed-text-2)">
        {CHECK_OUTCOME_LABELS[check.outcome]} · {CHECK_SEVERITY_LABELS[check.severity]} · {check.category}
        {check.producer === "fixture_simulated" ? " · simulated" : ""}
        {check.current ? "" : " · out of date"}
      </p>
      {check.message ? <p className="pl-6 text-xs">{check.message}</p> : null}
    </li>
  );
}
