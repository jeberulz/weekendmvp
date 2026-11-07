"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useEffect, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { QuietErrorBoundary } from "@/components/platform/client-gates";
import { EmptyState, LoadingState } from "@/components/workspace/kit/states";
import { BTN_SECONDARY, CARD } from "@/components/workspace/kit/styles";
import { launchErrorMessage } from "@/components/workspace/wizard/MeetCofounder";
import { cn } from "@/lib/utils";
import {
  PROGRESS_NOT_STARTED_COPY,
  PROGRESS_UNAVAILABLE_COPY,
  progressSummary,
  resumeMessage,
  STEP_STATE_LABELS,
} from "@/lib/workspace/reviewPages";

type Progress = FunctionReturnType<typeof api.crew.launch.launchProgress>;

/**
 * L1-C6: launch progress on Team HQ, from `launchProgress`.
 *
 * - `retryLaunch` runs every failed step that can run again (the blueprint and
 *   team stage, and later steps); `resumeLaunch` hands paused steps back.
 *   Each spends one C-LIMITS token per click, so a refusal is plain words.
 *   A failed step that no retry can help shows its reason and no button.
 * - State is words ("Failed"), never colour alone. The step count and the
 *   result of an action are read from polite live regions that stay mounted.
 * - Buttons stay focusable while working (`aria-disabled`). If a button goes
 *   away because it worked, and focus was on it, focus moves to the heading.
 */

function Steps({ progress }: { progress: Progress }) {
  return (
    <ol className="flex flex-col gap-2">
      {progress.steps.map((step) => (
        <li key={step.key} data-step={step.key} className={cn(CARD, "flex flex-col gap-0.5 p-3")}>
          <p className="text-sm text-home-ink">
            <span className="font-medium">{step.title}</span>
            <span className="text-home-ink-2">: {STEP_STATE_LABELS[step.state]}</span>
          </p>
          {step.reason === undefined ? null : <p className="text-[13px] text-home-ink-2">{step.reason}</p>}
        </li>
      ))}
    </ol>
  );
}

function Body({ projectId, progress }: { projectId: Id<"projects">; progress: Progress }) {
  const retryLaunch = useMutation(api.crew.roster.retryLaunch);
  const resumeLaunch = useMutation(api.crew.launch.resumeLaunch);
  const [working, setWorking] = useState<"retry" | "resume" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const headingFocus = useRef(false);
  const inFlight = useRef(false);
  const canRetry = progress.started && progress.retryable;
  const canResume = progress.started && progress.steps.some((step) => step.state === "paused");

  useEffect(() => {
    if (canRetry || canResume || !headingFocus.current) return;
    headingFocus.current = false;
    // Only when the click left focus nowhere (the button unmounted); never take focus the founder moved.
    const active = document.activeElement;
    if (active === null || active === document.body) document.getElementById("launch-progress-title")?.focus();
  }, [canRetry, canResume]);

  if (!progress.started) return <EmptyState>{PROGRESS_NOT_STARTED_COPY}</EmptyState>;

  const run = (kind: "retry" | "resume") => {
    if (inFlight.current) return;
    inFlight.current = true;
    headingFocus.current = true;
    setWorking(kind);
    setError(null);
    setMessage("");
    const action = kind === "retry"
      ? retryLaunch({ projectId }).then(() => "Trying the failed steps again.")
      : resumeLaunch({ projectId }).then(resumeMessage);
    action
      .then(setMessage)
      .catch((caught: unknown) => setError(launchErrorMessage(caught)))
      .finally(() => {
        inFlight.current = false;
        setWorking(null);
      });
  };

  return (
    <div className="flex flex-col gap-3">
      <p role="status" aria-live="polite" className="text-[13px] text-home-ink-2">
        {progressSummary(progress.steps.map((step) => step.state))}
      </p>
      <Steps progress={progress} />
      {canRetry || canResume ? (
        <div className="flex flex-wrap gap-2">
          {canRetry ? (
            <button
              type="button"
              className={BTN_SECONDARY}
              aria-disabled={working === "retry" || undefined}
              aria-label={working === "retry" ? "Trying the failed steps again" : "Try again: run the failed steps again"}
              onClick={() => run("retry")}
            >
              {working === "retry" ? "Trying again…" : "Try again"}
            </button>
          ) : null}
          {canResume ? (
            <button
              type="button"
              className={BTN_SECONDARY}
              aria-disabled={working === "resume" || undefined}
              aria-label={working === "resume" ? "Resuming the paused steps" : "Resume: restart the paused steps"}
              onClick={() => run("resume")}
            >
              {working === "resume" ? "Resuming…" : "Resume"}
            </button>
          ) : null}
        </div>
      ) : null}
      <p role="status" aria-live="polite" className="text-[13px] text-home-ink-2">{message}</p>
      {error === null ? null : (
        <p role="alert" className="rounded-lg border border-home-clay-ink/30 bg-home-clay px-3 py-2 text-sm text-home-clay-ink">
          {error}
        </p>
      )}
    </div>
  );
}

function Live({ projectId }: { projectId: Id<"projects"> }) {
  const progress = useQuery(api.crew.launch.launchProgress, { projectId });
  if (progress === undefined) return <LoadingState label="Loading your launch progress…" />;
  return <Body projectId={projectId} progress={progress} />;
}

export function LaunchProgress({ projectId }: { projectId: Id<"projects"> }) {
  return (
    <section aria-labelledby="launch-progress-title" className="flex flex-col gap-3">
      <h2 id="launch-progress-title" tabIndex={-1} className="text-lg font-medium text-home-ink focus:outline-none">Launch progress</h2>
      <QuietErrorBoundary fallback={<EmptyState>{PROGRESS_UNAVAILABLE_COPY}</EmptyState>}>
        <Live projectId={projectId} />
      </QuietErrorBoundary>
    </section>
  );
}
