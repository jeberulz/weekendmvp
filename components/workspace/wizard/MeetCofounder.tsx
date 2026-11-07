"use client";

import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode, type Ref } from "react";
import { QuietErrorBoundary } from "@/components/platform/client-gates";
import { BTN_PRIMARY, BTN_SECONDARY, CARD, EYEBROW } from "@/components/workspace/kit/styles";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { partnerNameFromWizard, type WizardAnswersProgress } from "@/lib/workspace/contracts/wizard";
import type { LaunchView } from "@/lib/workspace/crew/launch";
import { PARTNER_PERSONALITY_OPTIONS } from "@/lib/workspace/wizard/labels";
import { workspacePath } from "@/lib/workspace/routes";
import { cn } from "@/lib/utils";

export type MeetCofounderProps = {
  readonly answers: WizardAnswersProgress;
  /** The business `createBusiness` made (WP74-S4). */
  readonly business: { readonly projectId: string; readonly name: string; readonly slug: string };
  readonly headingRef?: Ref<HTMLHeadingElement>;
  /** WP75-S1: the team section (`LiveCofounderTeam` in the wizard, `CofounderTeam` in tests). */
  readonly team?: ReactNode;
};

/**
 * The wizard's end screen, after the business exists: the partner, the
 * business, (WP75-S1) the team the crew lead puts together, and (L1-C5) the
 * way into the business's workspace. The link is always there once the
 * business exists, so a slow or failed team never leaves a dead end.
 */
export function MeetCofounder({ answers, business, headingRef, team }: MeetCofounderProps) {
  const name = partnerNameFromWizard(answers);
  const personality = answers.partnerPersonality ? PARTNER_PERSONALITY_OPTIONS[answers.partnerPersonality] : null;
  return (
    <section aria-labelledby="meet-cofounder-heading" className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className={EYEBROW}>Meet your co-founder</p>
        <h2
          id="meet-cofounder-heading"
          ref={headingRef}
          tabIndex={-1}
          className="font-editorial text-[28px] leading-tight tracking-[-0.015em] text-home-ink focus:outline-none sm:text-[32px]"
        >
          Meet {name}, your co-founder
        </h2>
      </div>
      <div className={cn(CARD, "flex flex-col gap-2 p-5 text-sm text-home-ink-2")}>
        {personality ? (
          <p>
            <span className="font-medium text-home-ink">{personality.label}.</span> {personality.hint}
          </p>
        ) : null}
        <p>
          <span className="font-medium text-home-ink">{business.name}</span> is created. {name} is building it with you.
        </p>
        <p>
          Suggested web address: <span className="font-mono text-home-ink">{business.slug}.weekendmvp.app</span>. It is
          confirmed when you publish.
        </p>
        {team === undefined ? <p>{name} puts your team together in the next step.</p> : null}
      </div>
      {team}
      <div className="flex flex-col items-start gap-2">
        <Link href={workspacePath(business.projectId)} className={BTN_PRIMARY}>
          Go to your workspace
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
        <p className="text-[13px] text-home-ink-2">
          Your launch carries on there with {name} and the team.
        </p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// The team (WP75-S1)
// ---------------------------------------------------------------------------

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
};

/** Which of the team section's views shows. */
type TeamView = "assembling" | "start_failed" | "failed" | "terminal" | "ready";

function teamView(launch: LaunchView | undefined, error: string | null): TeamView {
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
export function CofounderTeam({ partnerName, launch, onStart, onRetry, retrying, error }: CofounderTeamProps) {
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
      <h3
        id="cofounder-team-heading"
        ref={headingRef}
        tabIndex={-1}
        className="text-base font-semibold text-home-ink focus:outline-none"
      >
        Your team
      </h3>
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
            <h4 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-home-ink">Hired</h4>
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
              <h4 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-home-ink">Skipped for now</h4>
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
function launchStateKey(launch: LaunchView | undefined): string {
  if (launch === undefined || launch.state === "not_started") return "not_started";
  return launch.state === "failed" ? `failed:${launch.paused}:${launch.retryable}` : launch.state;
}

/** Starts the launch once the business exists, then shows it live. */
function LiveTeam({ projectId, partnerName }: { readonly projectId: Id<"projects">; readonly partnerName: string }) {
  const startLaunch = useMutation(api.crew.roster.startLaunch);
  const retryLaunch = useMutation(api.crew.roster.retryLaunch);
  const launch = useQuery(api.crew.roster.launchStatus, { projectId });
  const [retrying, setRetrying] = useState(false);
  // A refusal is shown only while the launch is still in the state it happened in; once the launch moves on, it is stale.
  const [refusal, setRefusal] = useState<{ readonly message: string; readonly during: string } | null>(null);
  const started = useRef<Id<"projects"> | null>(null);
  const stateKey = launchStateKey(launch);
  const error = refusal !== null && refusal.during === stateKey ? refusal.message : null;

  // `startLaunch` is idempotent and never retries a failure, so a reload is safe.
  useEffect(() => {
    if (started.current === projectId) return;
    started.current = projectId;
    startLaunch({ projectId }).catch((caught: unknown) =>
      setRefusal({ message: launchErrorMessage(caught), during: "not_started" }));
  }, [projectId, startLaunch]);

  const refuse = (caught: unknown, during: string) => setRefusal({ message: launchErrorMessage(caught), during });

  const run = (action: () => Promise<LaunchView>) => {
    // The state the founder clicked in: a refusal stays shown only while the launch is still there.
    const during = stateKey;
    setRetrying(true);
    setRefusal(null);
    action()
      .catch((caught: unknown) => refuse(caught, during))
      .finally(() => setRetrying(false));
  };

  return (
    <CofounderTeam
      partnerName={partnerName}
      launch={launch}
      retrying={retrying}
      error={error}
      onStart={() => run(() => startLaunch({ projectId }))}
      onRetry={() => run(() => retryLaunch({ projectId }))}
    />
  );
}

/** The live team for the wizard; a read that fails (AI switched off, say) never takes the page down. */
export function LiveCofounderTeam({ projectId, partnerName }: { readonly projectId: Id<"projects">; readonly partnerName: string }) {
  return (
    <QuietErrorBoundary
      fallback={
        <p className={cn(CARD, "p-5 text-sm text-home-ink-2")}>
          Your team cannot be shown right now. It will be in your workspace.
        </p>
      }
    >
      <LiveTeam projectId={projectId} partnerName={partnerName} />
    </QuietErrorBoundary>
  );
}
