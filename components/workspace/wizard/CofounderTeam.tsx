"use client";

import { ConvexError } from "convex/values";
import { Loader2 } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { BTN_SECONDARY, CARD } from "@/components/workspace/kit/styles";
import type { LaunchView } from "@/lib/workspace/crew/launch";
import { cn } from "@/lib/utils";

/**
 * The pre-T1 "Your team" card (WP75-S1). Meet your co-founder no longer draws
 * it (the T1 screen in `MeetCofounder.tsx` replaced it), but its launch-state
 * helpers (`teamView`, `teamAnnouncement`, `launchErrorMessage`,
 * `launchStateKey`) are shared, and Team HQ still imports `CofounderTeam`
 * until its own rebuild drops it. Delete the component then.
 */

export type CofounderTeamProps = {
  /** The partner's name (the Crew Lead). */
  readonly partnerName: string;
  /** `undefined` while the launch is loading. */
  readonly launch: LaunchView | undefined;
  /** Try again after the launch could not start (`startLaunch` refused, so nothing started). */
  readonly onStart: () => void;
  /** Try again after the blueprint failed or paused (`retryLaunch`). */
  readonly onRetry: () => void;
  /** A start or retry is in flight. */
  readonly retrying: boolean;
  /** A refused start or retry, in plain words, for the launch state it happened in. */
  readonly error: string | null;
  /** Heading level of the section: 3 in the wizard (default), 2 on Team HQ. Sub-headings sit one level below. */
  readonly level?: 2 | 3;
};

/** Which of the team section's views shows. */
export type TeamView = "assembling" | "start_failed" | "failed" | "terminal" | "ready";

export function teamView(launch: LaunchView | undefined, error: string | null): TeamView {
  if (launch === undefined || launch.state === "not_started") return error === null ? "assembling" : "start_failed";
  if (launch.state === "assembling") return "assembling";
  if (launch.state === "failed") return launch.retryable ? "failed" : "terminal";
  return "ready";
}

/** What the polite live region says for each state (always mounted, so each change is read once). */
export function teamAnnouncement(launch: LaunchView | undefined, partnerName: string, error: string | null = null): string {
  switch (teamView(launch, error)) {
    case "assembling":
      return `${partnerName} is putting your team together.`;
    case "start_failed":
      return `${partnerName} could not start putting your team together. You can try again.`;
    case "failed":
      return launch?.state === "failed" && launch.paused
        ? `${partnerName} paused putting your team together. You can try again.`
        : `${partnerName} could not put your team together. You can try again.`;
    case "terminal":
      return `${partnerName} could not put your team together for this business.`;
    case "ready":
      return launch?.state === "ready"
        ? `Your team is ready: ${launch.hired.length} hired, ${launch.skipped.length} skipped for now.`
        : "";
  }
}

/**
 * The team section: "putting your team together", a failed state with a
 * Try again button (or, when no retry can help, a plain message and no
 * button), or the hired and skipped roles with their C-ROSTER reasons. Owner
 * ruling Q13: no approval card; the team just appears. Skipped roles are
 * always labelled "Skipped" in text, never by colour alone. After Try again,
 * when the button goes away, focus moves to the section heading (WCAG 2.4.3).
 */
export function CofounderTeam({ partnerName, launch, onStart, onRetry, retrying, error, level = 3 }: CofounderTeamProps) {
  const Heading = level === 2 ? "h2" : "h3";
  const SubHeading = level === 2 ? "h3" : "h4";
  const failureId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusHeadingWhenGone = useRef(false);
  const view = teamView(launch, error);
  const hasButton = view === "start_failed" || view === "failed";
  const announcement = teamAnnouncement(launch, partnerName, error);

  useEffect(() => {
    if (hasButton || !focusHeadingWhenGone.current) return;
    focusHeadingWhenGone.current = false;
    // Only when the click left focus nowhere (the button unmounted); never take focus the founder moved.
    const active = document.activeElement;
    if (active === null || active === document.body) headingRef.current?.focus();
  }, [hasButton]);

  const failureCopy =
    view === "start_failed"
      ? `${partnerName} could not start putting your team together. Nothing was charged.`
      : launch?.state === "failed" && launch.paused
        ? `${partnerName} paused putting your team together. Nothing was charged.`
        : `${partnerName} could not put your team together this time. Nothing was charged.`;

  return (
    <section aria-labelledby="cofounder-team-heading" className={cn(CARD, "flex flex-col gap-4 p-5 text-sm text-home-ink-2")}>
      <Heading
        id="cofounder-team-heading"
        ref={headingRef}
        tabIndex={-1}
        className={cn(
          "text-base font-semibold text-home-ink",
          level === 2 ? "focus:outline-2 focus:outline-offset-2 focus:outline-home-orange-ink" : "focus:outline-none",
        )}
      >
        Your team
      </Heading>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
      {view === "assembling" ? (
        <p data-state="assembling" className="flex items-center gap-2">
          <Loader2 aria-hidden="true" className="size-4 animate-spin text-home-orange-ink motion-reduce:animate-none" />
          <span>{partnerName} is putting your team together. This takes about a minute.</span>
        </p>
      ) : null}
      {hasButton ? (
        <div data-state={view} className="flex flex-col items-start gap-3">
          <p id={failureId}>{failureCopy}</p>
          <button
            type="button"
            className={BTN_SECONDARY}
            aria-label={retrying ? "Trying again to put your team together" : "Try again: put your team together"}
            aria-describedby={failureId}
            aria-disabled={retrying || undefined}
            onClick={() => {
              if (retrying) return;
              focusHeadingWhenGone.current = true;
              if (view === "start_failed") onStart();
              else onRetry();
            }}
          >
            {retrying ? "Trying again…" : "Try again"}
          </button>
        </div>
      ) : null}
      {view === "terminal" ? (
        <p data-state="terminal">
          {partnerName} could not put your team together from what this business has so far. Nothing was charged, and
          trying again will not change it. Your business is saved.
        </p>
      ) : null}
      {launch?.state === "ready" ? (
        <div data-state="ready" className="flex flex-col gap-4">
          <p>
            {partnerName} hired {launch.hired.length} and skipped {launch.skipped.length} for now. You can hire or skip
            later.
          </p>
          <div className="flex flex-col gap-2">
            <SubHeading className="text-[13px] font-semibold uppercase tracking-[0.08em] text-home-ink">Hired</SubHeading>
            <ul className="flex flex-col divide-y divide-home-rule">
              {launch.hired.map((role) => (
                <li key={role.roleKey} data-role={role.roleKey} className="flex flex-col gap-0.5 py-2">
                  <span className="text-home-ink">
                    <span className="font-medium">{role.employeeName}</span>, {role.roleLabel}
                  </span>
                  <span>{role.reason}</span>
                </li>
              ))}
            </ul>
          </div>
          {launch.skipped.length > 0 ? (
            <div className="flex flex-col gap-2">
              <SubHeading className="text-[13px] font-semibold uppercase tracking-[0.08em] text-home-ink">Skipped for now</SubHeading>
              <ul className="flex flex-col gap-2">
                {launch.skipped.map((role) => (
                  <li
                    key={role.roleKey}
                    data-skipped-role={role.roleKey}
                    className="flex flex-col gap-0.5 rounded-lg border border-dashed border-home-d2 px-3 py-2"
                  >
                    <span className="text-home-ink">
                      <span className="font-medium">{role.roleLabel}</span>: <strong className="font-semibold">Skipped</strong>
                    </span>
                    <span>{role.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-lg border border-home-clay-ink/30 bg-home-clay px-3 py-2 text-home-clay-ink">
          {error}
        </p>
      ) : null}
    </section>
  );
}

const LAUNCH_ERROR_COPY: Record<string, string> = {
  AI_DISABLED: "AI work is switched off right now. Try again later.",
  WORKSPACE_DISABLED: "Building is switched off right now. Try again later.",
  UNAUTHENTICATED: "Your session ended. Sign in again to carry on.",
  RESOURCE_NOT_FOUND: "We could not find this business.",
};

/** A start or retry refusal in plain words; never the raw error. */
export function launchErrorMessage(error: unknown): string {
  if (error instanceof ConvexError && typeof error.data === "object" && error.data !== null) {
    const data: { code?: unknown; kind?: unknown } = error.data;
    if (data.kind === "RateLimited") return "You have started a lot of crew work this hour. Try again in a little while.";
    if (typeof data.code === "string" && LAUNCH_ERROR_COPY[data.code]) return LAUNCH_ERROR_COPY[data.code];
  }
  return "Something went wrong. Try again.";
}

/** The launch state a refusal belongs to: loading and not started are the same (nothing started yet). */
export function launchStateKey(launch: LaunchView | undefined): string {
  if (launch === undefined || launch.state === "not_started") return "not_started";
  return launch.state === "failed" ? `failed:${launch.paused}:${launch.retryable}` : launch.state;
}
