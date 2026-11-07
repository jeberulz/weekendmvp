"use client";

import { useMutation } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";
import { EmployeeLink } from "@/components/workspace/kit/EmployeeLink";
import { EmptyState } from "@/components/workspace/kit/states";
import { StatusPill } from "@/components/workspace/kit/StatusPill";
import { BTN_SECONDARY } from "@/components/workspace/kit/styles";
import { ROLE_LABELS } from "@/components/workspace/kit/types";
import { SectionHeading } from "@/components/workspace/team/SectionHeading";
import {
  PROGRESS_NOT_STARTED_COPY,
  resumeMessage,
  retryMessage,
  RETRY_SENT_PROGRESS_COPY,
  TEAM_STAGE_KEYS,
  TRY_COST_COPY,
} from "@/lib/workspace/reviewPages";
import { employeeHref } from "@/lib/workspace/employeePage";
import {
  launchErrorMessage,
  planGroups,
  planSummary,
  stepPillStatus,
  type TeamHired,
  type TeamStep,
} from "@/lib/workspace/teamHq";

/**
 * "Launch steps, by owner." Each launch step with its owner chip and a status
 * pill (words, never colour alone). Steps that are not built yet sit under
 * "Coming later", never as queued.
 *
 * - `retryLaunch` runs every failed step that can run again (the blueprint and
 *   team stage belongs to the Crew Lead card); `resumeLaunch` hands paused
 *   steps back. Each spends one C-LIMITS token per click, so a refusal is plain
 *   words. A failed step that no retry can help shows its reason and no button.
 * - The step count and the result of an action are read from polite live
 *   regions that stay mounted. Buttons stay focusable while working
 *   (`aria-disabled`). If a button goes away because it worked, and focus was
 *   on it, focus moves to the heading.
 */

function OwnerChip({ step, roster, projectId }: { step: TeamStep; roster: readonly TeamHired[]; projectId: string }) {
  const hired = roster.find((entry) => entry.role === step.employee);
  const roleLabel = ROLE_LABELS[step.employee];
  const name = hired?.name ?? roleLabel;
  // WP67: the chip is one link to the owner's page (the Crew Lead has none, so it stays plain).
  return (
    <EmployeeLink
      href={employeeHref(projectId, step.employee)}
      name={name}
      role={step.employee}
      linkComponent={Link}
      className="rounded-full border border-home-rule py-px pl-0.5 pr-2 text-xs text-home-ink"
    >
      <span className="sr-only">Owner: {name}, </span>
      <span>{roleLabel}</span>
    </EmployeeLink>
  );
}

function StepRow({ step, roster, projectId }: { step: TeamStep; roster: readonly TeamHired[]; projectId: string }) {
  return (
    <li
      data-step={step.key}
      className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-2 rounded-[10px] border border-home-rule bg-home-card px-3 py-2.5"
    >
      <span className="flex min-w-0 flex-[1_1_160px] flex-col gap-1">
        <span className="text-sm font-medium text-home-ink">{step.title}</span>
        <span className="flex flex-wrap items-center gap-1.5">
          <OwnerChip step={step} roster={roster} projectId={projectId} />
          {step.reason === undefined ? null : <span className="text-xs text-home-ink-3">{step.reason}</span>}
        </span>
      </span>
      <StatusPill set="step" status={stepPillStatus(step)} />
    </li>
  );
}

const LIST = "grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-2";

export function PlanByOwner({
  projectId,
  started,
  steps,
  roster,
}: {
  projectId: Id<"projects">;
  started: boolean;
  steps: readonly TeamStep[];
  roster: readonly TeamHired[];
}) {
  const retryLaunch = useMutation(api.crew.roster.retryLaunch);
  const resumeLaunch = useMutation(api.crew.launch.resumeLaunch);
  const [working, setWorking] = useState<"retry" | "resume" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const headingFocus = useRef(false);
  const inFlight = useRef(false);
  // The blueprint and team stage is owned by the Crew Lead card (same `retryLaunch`), so its failure or pause gets no second button here.
  const later = steps.filter((step) => !TEAM_STAGE_KEYS.includes(step.key));
  const canRetry = started && later.some((step) => step.state === "failed" && step.retryable === true);
  const canResume = started && later.some((step) => step.state === "paused");
  const busy = working !== null;

  useEffect(() => {
    if (canRetry || canResume || !headingFocus.current) return;
    headingFocus.current = false;
    // Only when the click left focus nowhere (the button unmounted); never take focus the founder moved.
    const active = document.activeElement;
    if (active === null || active === document.body) document.getElementById("launch-progress-title")?.focus();
  }, [canRetry, canResume]);

  const run = (kind: "retry" | "resume") => {
    if (inFlight.current) return;
    inFlight.current = true;
    headingFocus.current = true;
    setWorking(kind);
    setError(null);
    setMessage("");
    const action = kind === "retry"
      ? retryLaunch({ projectId }).then((view) => retryMessage(view, RETRY_SENT_PROGRESS_COPY))
      : resumeLaunch({ projectId }).then(resumeMessage);
    action
      .then(setMessage)
      .catch((caught: unknown) => setError(launchErrorMessage(caught)))
      .finally(() => {
        inFlight.current = false;
        setWorking(null);
      });
  };

  const { now, later: comingLater } = planGroups(steps);
  return (
    <section aria-labelledby="launch-progress-title" className="flex flex-col gap-3">
      <SectionHeading
        id="launch-progress-title"
        focusable
        eyebrow={
          started ? (
            <span role="status" aria-live="polite">{planSummary(steps)}</span>
          ) : (
            "Launch progress"
          )
        }
        lead="Launch steps,"
        tail="by owner."
      />
      {started ? (
        <>
          <ul aria-label="Launch steps and owners" className={LIST}>
            {now.map((step) => (
              <StepRow key={step.key} step={step} roster={roster} projectId={projectId} />
            ))}
          </ul>
          {comingLater.length === 0 ? null : (
            <div className="flex flex-col gap-2">
              <h3 className="text-[15px] font-semibold text-home-ink">Coming later ({comingLater.length})</h3>
              <ul aria-label="Launch steps coming later" className={LIST}>
                {comingLater.map((step) => (
                  <StepRow key={step.key} step={step} roster={roster} projectId={projectId} />
                ))}
              </ul>
            </div>
          )}
          {canRetry || canResume ? (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                {canRetry ? (
                  <button
                    type="button"
                    className={BTN_SECONDARY}
                    aria-disabled={busy || undefined}
                    aria-label={working === "retry" ? "Trying again: running the failed steps" : "Try again: run the failed steps again"}
                    onClick={() => run("retry")}
                  >
                    {working === "retry" ? "Trying again" : "Try again"}
                  </button>
                ) : null}
                {canResume ? (
                  <button
                    type="button"
                    className={BTN_SECONDARY}
                    aria-disabled={busy || undefined}
                    aria-label={working === "resume" ? "Resuming: restarting the paused steps" : "Resume: restart the paused steps"}
                    onClick={() => run("resume")}
                  >
                    {working === "resume" ? "Resuming" : "Resume"}
                  </button>
                ) : null}
              </div>
              <p className="text-[13px] text-home-ink-2">{TRY_COST_COPY}</p>
            </div>
          ) : null}
        </>
      ) : (
        <EmptyState>{PROGRESS_NOT_STARTED_COPY}</EmptyState>
      )}
      <p role="status" aria-live="polite" className="text-[13px] text-home-ink-2">{message}</p>
      {error === null ? null : (
        <p role="alert" className="rounded-lg border border-home-clay-ink/30 bg-home-clay px-3 py-2 text-sm text-home-clay-ink">
          {error}
        </p>
      )}
    </section>
  );
}
