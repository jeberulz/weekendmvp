"use client";

import { useMutation, useQuery } from "convex/react";
import { AlertCircle, Check, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode, type Ref } from "react";
import { QuietErrorBoundary } from "@/components/platform/client-gates";
import { EmployeeAvatar } from "@/components/workspace/kit";
import { LoadingState } from "@/components/workspace/kit/states";
import { BTN_SECONDARY, CARD, EYEBROW, EYEBROW_EMBER, FOCUS } from "@/components/workspace/kit/styles";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ROLE_CATALOGUE } from "@/convex/crew/roles";
import { ALWAYS_HIRED_ROLE_KEYS, ROLE_KEYS, type RoleKey } from "@/lib/workspace/contracts/roster";
import { partnerNameFromWizard, type WizardAnswersProgress } from "@/lib/workspace/contracts/wizard";
import type { LaunchView } from "@/lib/workspace/crew/launch";
import {
  COMMERCIAL_MODEL_OPTIONS,
  GOAL_KIND_OPTIONS,
  GOAL_TIMEFRAME_OPTIONS,
  PAID_PUSH_DAILY_USD,
  PLATFORM_OPTIONS,
} from "@/lib/workspace/wizard/labels";
import { workspacePath } from "@/lib/workspace/routes";
import { cn } from "@/lib/utils";
import { launchErrorMessage, launchStateKey, teamAnnouncement, teamView, type TeamView } from "./CofounderTeam";
import { ScreenHead } from "./wizard-ui";

// Team HQ still imports these from here (until its own rebuild drops the old card).
export { CofounderTeam, launchErrorMessage, teamAnnouncement } from "./CofounderTeam";
export type { CofounderTeamProps } from "./CofounderTeam";

/** One launch step as the "Meanwhile, building" list reads it (`api.crew.launch.launchProgress`). */
export type MeetProgressStep = {
  readonly key: string;
  readonly title: string;
  readonly notBuilt: boolean;
  readonly state: string;
};
export type MeetProgress = { readonly started: boolean; readonly steps: readonly MeetProgressStep[] };

export type MeetCofounderProps = {
  readonly answers: WizardAnswersProgress;
  /** The business `createBusiness` made (WP74-S4). */
  readonly business: { readonly projectId: string; readonly name: string; readonly slug: string };
  /** The library idea's title, for the "What I read" idea tile. */
  readonly ideaTitle?: string | null;
  readonly headingRef?: Ref<HTMLHeadingElement>;
  /** `undefined` while the launch is loading. */
  readonly launch: LaunchView | undefined;
  /** The launch could not be read at all: say so, keep the way into the workspace. */
  readonly unavailable?: boolean;
  /** Try again after the launch could not start. */
  readonly onStart?: () => void;
  /** Try again after the blueprint failed or paused. */
  readonly onRetry?: () => void;
  readonly retrying?: boolean;
  /** A refused start or retry, in plain words. */
  readonly error?: string | null;
  /** The "Meanwhile, building" section (`LiveMeanwhile` in the wizard). */
  readonly meanwhile?: ReactNode;
};

type Hired = Extract<LaunchView, { state: "ready" }>["hired"][number];

const SECTION_H2 = "font-editorial text-xl font-normal text-home-ink";
const SECTION_H2_LARGE = "font-editorial text-2xl font-normal text-home-ink";
const LINK_FOCUS_ON_DARK =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-light";

function asRoleKey(value: string): RoleKey | null {
  return (ROLE_KEYS as readonly string[]).includes(value) ? (value as RoleKey) : null;
}

const CATALOGUE_BY_KEY = new Map(ROLE_CATALOGUE.map((entry) => [entry.key, entry]));

function isAlways(roleKey: RoleKey | null): boolean {
  return roleKey !== null && (ALWAYS_HIRED_ROLE_KEYS as readonly string[]).includes(roleKey);
}

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

function Hero({
  name,
  business,
  headingRef,
}: {
  name: string;
  business: MeetCofounderProps["business"];
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  return (
    <div className="flex max-w-[760px] flex-col gap-2.5">
      <p className={EYEBROW_EMBER}>Meet your co-founder · your workspace is building</p>
      <ScreenHead
        headingId="meet-heading"
        headingRef={headingRef}
        lead="Hi, I'm "
        italic={name}
        tail="."
        sub={`I'm your Crew Lead for ${business.name}. I read your answers, pick the specialists it needs and skip the ones it doesn't. I stay in your chat; the team sends its work through me, one decision at a time.`}
        className="[&_h1]:text-[40px] [&_h1]:leading-[1.1]"
      />
      <ul className="flex flex-col gap-1 text-sm text-home-ink-2">
        <li>Drafts your brand kit, launch emails and posts. Nothing sends without your OK.</li>
        <li>Brings you one decision at a time, as review cards in your chat.</li>
        <li>Reworks anything you ask, with two free change rounds per piece.</li>
      </ul>
      <p className="text-[13px] text-home-ink-3">
        Suggested web address: <span className="font-mono text-home-ink">{business.slug}.weekendmvp.app</span>. It is
        confirmed when you publish.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Team status (the launch's real state, with the failure and retry logic)
// ---------------------------------------------------------------------------

function TeamStatus({
  name,
  launch,
  view,
  onStart,
  onRetry,
  retrying,
  error,
}: {
  name: string;
  launch: LaunchView | undefined;
  view: TeamView | "unavailable";
  onStart?: () => void;
  onRetry?: () => void;
  retrying: boolean;
  error: string | null;
}) {
  const failureId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusHeadingWhenGone = useRef(false);
  const hasButton = view === "start_failed" || view === "failed";
  const announcement = view === "unavailable" ? "" : teamAnnouncement(launch, name, error);

  useEffect(() => {
    if (hasButton || !focusHeadingWhenGone.current) return;
    focusHeadingWhenGone.current = false;
    // Only when the click left focus nowhere (the button unmounted); never take focus the founder moved.
    const active = document.activeElement;
    if (active === null || active === document.body) headingRef.current?.focus();
  }, [hasButton]);

  const failureCopy =
    view === "start_failed"
      ? `${name} could not start putting your team together. Nothing was charged.`
      : launch?.state === "failed" && launch.paused
        ? `${name} paused putting your team together. Nothing was charged.`
        : `${name} could not put your team together this time. Nothing was charged.`;

  let icon: ReactNode = <Loader2 aria-hidden="true" className="size-4 animate-spin text-home-orange-ink motion-reduce:animate-none" />;
  if (view === "ready") {
    icon = (
      <span aria-hidden="true" className="flex size-5 items-center justify-center rounded-full bg-home-sage-ink">
        <Check className="size-3 text-home-card" />
      </span>
    );
  } else if (view !== "assembling") {
    icon = <AlertCircle aria-hidden="true" className="size-4 text-home-clay-ink" />;
  }

  return (
    <section aria-labelledby="team-status-heading" className={cn(CARD, "flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3.5")}>
      <h2
        id="team-status-heading"
        ref={headingRef}
        tabIndex={-1}
        className="text-base font-semibold text-home-ink focus:outline-2 focus:outline-offset-2 focus:outline-home-orange-ink"
      >
        Your team
      </h2>
      {/* Always mounted, so each change of state is read once. */}
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <div className="flex min-w-60 flex-[1_1_260px] flex-col items-start gap-3 text-sm text-home-ink-2">
        {view === "assembling" ? (
          <p data-state="assembling" className="flex items-center gap-2">
            {icon}
            <span>{name} is putting your team together. This takes about a minute.</span>
          </p>
        ) : null}
        {hasButton ? (
          <div data-state={view} className="flex flex-col items-start gap-3">
            <p id={failureId} className="flex items-start gap-2">
              {icon}
              <span>{failureCopy}</span>
            </p>
            <button
              type="button"
              className={BTN_SECONDARY}
              aria-label={retrying ? "Trying again to put your team together" : "Try again: put your team together"}
              aria-describedby={failureId}
              aria-disabled={retrying || undefined}
              onClick={() => {
                if (retrying) return;
                focusHeadingWhenGone.current = true;
                if (view === "start_failed") onStart?.();
                else onRetry?.();
              }}
            >
              {retrying ? "Trying again…" : "Try again"}
            </button>
          </div>
        ) : null}
        {view === "terminal" ? (
          <p data-state="terminal" className="flex items-start gap-2">
            {icon}
            <span>
              {name} could not put your team together from what this business has so far. Nothing was charged, and
              trying again will not change it. Your business is saved.
            </span>
          </p>
        ) : null}
        {view === "unavailable" ? (
          <p data-state="unavailable">Your team cannot be shown right now. It will be in your workspace.</p>
        ) : null}
        {launch?.state === "ready" && view === "ready" ? (
          <p data-state="ready" className="flex items-center gap-2">
            {icon}
            <span>
              {name} hired {launch.hired.length} and left {launch.skipped.length} out for now.
            </span>
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="w-full rounded-lg border border-home-clay-ink/30 bg-home-clay px-3 py-2 text-home-clay-ink">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// What I read
// ---------------------------------------------------------------------------

function WhatIRead({
  answers,
  ideaTitle,
  businessName,
}: {
  answers: WizardAnswersProgress;
  ideaTitle: string | null | undefined;
  businessName: string;
}) {
  const tiles: { label: string; value: string; detail?: string }[] = [];
  const idea = answers.idea;
  if (idea) {
    tiles.push(
      idea.source === "library"
        ? { label: "Idea", value: "Library idea", detail: ideaTitle ?? businessName }
        : { label: "Idea", value: "Your own idea", detail: "Not yet validated" },
    );
  }
  if (answers.commercialModel) {
    const model = COMMERCIAL_MODEL_OPTIONS[answers.commercialModel];
    tiles.push({ label: "Money", value: model.label, detail: model.hint });
  }
  if (answers.goal) {
    const goal = answers.goal;
    tiles.push({
      label: "First goal",
      value: GOAL_KIND_OPTIONS[goal.kind].label,
      detail: `${GOAL_TIMEFRAME_OPTIONS[goal.timeframe].label}${goal.paidPush ? `, $${PAID_PUSH_DAILY_USD}/day paid test` : ""}`,
    });
  }
  if (answers.platform) {
    const platform = answers.platform;
    tiles.push(
      platform.kind === "custom"
        ? { label: "Platform", value: "Custom", detail: platform.description }
        : { label: "Platform", value: PLATFORM_OPTIONS[platform.kind].label, detail: PLATFORM_OPTIONS[platform.kind].hint },
    );
  }
  return (
    <section aria-labelledby="read-heading" className={cn(CARD, "px-[18px] py-4")}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="read-heading" className={SECTION_H2}>
          What I read
        </h2>
        <span className="font-mono text-xs text-home-ink-3">
          Your wizard answers{idea?.source === "library" ? " + library research" : ""}
        </span>
      </div>
      <dl className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2.5">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-lg border border-home-sunk bg-home-card px-3 py-2.5">
            <dt className={EYEBROW}>{tile.label}</dt>
            <dd className="mt-1 flex flex-col">
              <span className="font-semibold text-home-ink">{tile.value}</span>
              {tile.detail ? <span className="text-[13px] text-home-ink-3">{tile.detail}</span> : null}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Who I hired
// ---------------------------------------------------------------------------

function HiredRow({ role }: { role: Hired }) {
  const roleKey = asRoleKey(role.roleKey);
  const always = isAlways(roleKey);
  const lead = roleKey === "lead";
  const specialty = roleKey === null ? null : CATALOGUE_BY_KEY.get(roleKey)?.does;
  return (
    <li
      data-role={role.roleKey}
      className={cn(
        "flex flex-wrap items-center gap-x-3.5 gap-y-2.5 rounded-xl border bg-home-card px-3.5 py-2.5",
        lead ? "border-home-ink" : "border-home-rule",
      )}
    >
      {roleKey !== null ? (
        // The name and role are written next to it, so the avatar is not read out a second time.
        <span aria-hidden="true">
          <EmployeeAvatar name={role.employeeName} role={roleKey} size="lg" showAiBadge />
        </span>
      ) : null}
      <span className="flex min-w-60 flex-[1_1_260px] flex-col">
        <span className="text-home-ink">
          <span className="font-semibold">{role.employeeName}</span>
          <span className="text-home-ink-2"> · {role.roleLabel}</span>
          {lead ? (
            <span className="ml-1.5 rounded-full bg-home-ink px-2 py-px text-xs text-home-card">Stays in your chat</span>
          ) : null}
        </span>
        {specialty ? <span className="text-sm text-home-ink-2">{specialty}</span> : null}
      </span>
      <span
        className={cn(
          "max-w-[280px] rounded-full border px-2.5 py-1 text-xs leading-snug",
          always
            ? "border-home-rule bg-home-sunk text-home-ink-2"
            : "border-home-orange-ink/30 bg-home-ember-soft text-home-orange-ink",
        )}
      >
        <span className="sr-only">Why hired: </span>
        <b className="font-semibold">{always ? "Always" : "Added"}</b> · {role.reason}
      </span>
    </li>
  );
}

function SkeletonRows() {
  return (
    <div aria-hidden="true" data-skeleton="" className="flex flex-col gap-2">
      {[0, 1, 2].map((index) => (
        <div key={index} className="flex items-center gap-3.5 rounded-xl border border-dashed border-home-rule px-3.5 py-2.5">
          <span className="size-10 shrink-0 rounded-full bg-home-sunk" />
          <span className="flex flex-1 flex-col gap-1.5">
            <span className="h-2.5 w-36 rounded bg-home-sunk" />
            <span className="h-2 w-3/5 rounded bg-home-sunk/60" />
          </span>
        </div>
      ))}
    </div>
  );
}

function WhoIHired({ launch, assembling }: { launch: LaunchView | undefined; assembling: boolean }) {
  const ready = launch?.state === "ready" ? launch : null;
  return (
    <section aria-labelledby="hire-heading" className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="hire-heading" className={SECTION_H2_LARGE}>
          Who I hired
        </h2>
        {ready ? <span className="font-mono text-[13px] text-home-ink-2">Hired · {ready.hired.length}</span> : null}
      </div>
      {ready ? (
        <ol aria-label="Hired specialists" className="flex flex-col gap-2">
          {ready.hired.map((role) => (
            <HiredRow key={role.roleKey} role={role} />
          ))}
        </ol>
      ) : assembling ? (
        <>
          <p className="text-sm text-home-ink-3">Specialists appear here once I&rsquo;ve checked every role.</p>
          <SkeletonRows />
        </>
      ) : (
        <p className="rounded-xl border border-dashed border-home-d2 px-[18px] py-4 text-sm text-home-ink-2">
          No specialists to show yet.
        </p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Where I'm sending you
// ---------------------------------------------------------------------------

function ContinueLinks({
  projectId,
  name,
  businessName,
  dark,
}: {
  projectId: string;
  name: string;
  businessName: string;
  dark: boolean;
}) {
  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <Link
          href={workspacePath(projectId, "team")}
          className={cn(
            "inline-flex min-h-12 items-center rounded-full px-[22px] font-medium",
            dark ? `bg-home-card text-home-ink ${LINK_FOCUS_ON_DARK}` : `bg-home-ink text-home-card ${FOCUS}`,
          )}
        >
          Meet your team in Team HQ
        </Link>
        <Link
          href={workspacePath(projectId)}
          className={cn(
            "inline-flex min-h-11 items-center text-sm underline underline-offset-2",
            dark ? `text-home-card ${LINK_FOCUS_ON_DARK}` : `text-home-ink ${FOCUS}`,
          )}
        >
          Go to your workspace
        </Link>
      </div>
      <p className={cn("text-[13px]", dark ? "text-home-d2" : "text-home-ink-2")}>
        Your workspace is where you and {name} work on {businessName}.
      </p>
    </div>
  );
}

function Next({
  launch,
  business,
  name,
}: {
  launch: LaunchView | undefined;
  business: MeetCofounderProps["business"];
  name: string;
}) {
  if (launch?.state === "ready") {
    return (
      <section
        aria-labelledby="ready-heading"
        className="flex flex-col gap-4 rounded-xl bg-home-panel px-6 py-[22px] text-home-card"
      >
        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-home-orange-light">
            Team ready · {launch.hired.length} hired · {launch.skipped.length} skipped
          </p>
          <h2 id="ready-heading" className="font-editorial text-[26px] font-normal leading-tight">
            They start now. <i className="text-home-d2">I keep the chat.</i>
          </h2>
          <p className="max-w-[560px] text-sm text-home-d2">
            Specialists work in parallel and send their work to me. I bring it to you one card at a time. Nothing sends,
            posts or spends without your OK.
          </p>
        </div>
        <ContinueLinks projectId={business.projectId} name={name} businessName={business.name} dark />
      </section>
    );
  }
  return (
    <section aria-label="Where to next" className="flex flex-col gap-4 rounded-xl border border-dashed border-home-d2 px-[18px] py-4">
      <p className="text-sm text-home-ink-2">Your workspace is ready now. Team HQ fills in as I hire.</p>
      <ContinueLinks projectId={business.projectId} name={name} businessName={business.name} dark={false} />
    </section>
  );
}

// ---------------------------------------------------------------------------
// Aside: roles checked, not hiring, meanwhile
// ---------------------------------------------------------------------------

function RolesChecked({ launch, assembling, businessName }: { launch: LaunchView | undefined; assembling: boolean; businessName: string }) {
  const ready = launch?.state === "ready" ? launch : null;
  const hiredKeys = new Set(ready?.hired.map((role) => role.roleKey));
  return (
    <section aria-labelledby="checked-heading" className={cn(CARD, "flex flex-col gap-2.5 px-[18px] py-4")}>
      <h2 id="checked-heading" className={SECTION_H2}>
        Roles I checked
      </h2>
      {ready ? (
        <>
          <p className="text-sm text-home-ink-2">
            {ready.hired.length} fit {businessName}. {ready.skipped.length} don&rsquo;t, and I say why.
          </p>
          <ul aria-label="Roles checked" className="flex flex-wrap gap-1.5">
            {ROLE_CATALOGUE.map((entry) => {
              const hired = hiredKeys.has(entry.key);
              return (
                <li
                  key={entry.key}
                  className={cn(
                    "rounded-full px-2.5 py-[3px] text-xs",
                    hired
                      ? "border border-home-sage-ink/30 bg-home-sage text-home-sage-ink"
                      : "border border-dashed border-home-ink-3 bg-home-sunk text-home-ink-2",
                  )}
                >
                  {entry.label} · {hired ? "hire" : "skip"}
                </li>
              );
            })}
          </ul>
        </>
      ) : assembling ? (
        <p className="flex items-center gap-2 text-sm text-home-ink-2">
          <Loader2 aria-hidden="true" className="size-4 shrink-0 animate-spin text-home-orange-ink motion-reduce:animate-none" />
          Checking {ROLE_CATALOGUE.length} roles against your answers…
        </p>
      ) : (
        <p className="text-sm text-home-ink-3">The roles I checked show here once the team is ready.</p>
      )}
    </section>
  );
}

function NotHiring({ launch, assembling }: { launch: LaunchView | undefined; assembling: boolean }) {
  const ready = launch?.state === "ready" ? launch : null;
  return (
    <section aria-labelledby="skip-heading" className="flex flex-col gap-2.5">
      <h2 id="skip-heading" className={SECTION_H2}>
        Not hiring, on purpose
      </h2>
      {ready && ready.skipped.length > 0 ? (
        <>
          <ul aria-label="Skipped roles" className="flex flex-col gap-2">
            {ready.skipped.map((role) => (
              <li
                key={role.roleKey}
                data-skipped-role={role.roleKey}
                className="flex items-start gap-3 rounded-xl border border-home-rule bg-home-card px-3.5 py-3"
              >
                <span
                  aria-hidden="true"
                  className="flex size-8 shrink-0 items-center justify-center rounded-full border-[1.5px] border-dashed border-home-ink-3 font-editorial text-[15px] text-home-ink-2"
                >
                  {role.roleLabel.charAt(0)}
                </span>
                <span className="flex min-w-0 flex-col gap-1">
                  <b className="font-semibold text-home-ink">{role.roleLabel}</b>
                  <span className="rounded-[10px] bg-home-clay px-2.5 py-1 text-xs leading-snug text-home-clay-ink">
                    <b className="font-semibold">Skipped</b> · {role.reason}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <p className="text-[13px] text-home-ink-3">Hiring a skipped role is coming soon.</p>
        </>
      ) : ready ? (
        <p className="text-sm text-home-ink-2">I left no role out.</p>
      ) : (
        <p className="rounded-xl border border-dashed border-home-rule px-3.5 py-3 text-sm text-home-ink-3">
          {assembling
            ? "After hiring, I'll list the roles I'm leaving out and why."
            : "The roles I leave out show here once the team is ready."}
        </p>
      )}
    </section>
  );
}

const STEP_STATE_WORDS: Record<string, string> = {
  waiting: "Waiting",
  queued: "Queued",
  running: "Working",
  paused: "Paused",
  succeeded: "Done",
  failed: "Failed",
  skipped: "Skipped",
};

function titlesList(titles: readonly string[]): string {
  if (titles.length <= 1) return titles.join("");
  return `${titles.slice(0, -1).join(", ")} and ${titles[titles.length - 1]}`;
}

/**
 * "Meanwhile, building": the launch steps that are built in this beta, with
 * their real state. Nothing here is timed; it is exactly what `launchProgress`
 * says, and it updates live.
 */
export function MeanwhileBuilding({ progress }: { progress: MeetProgress | undefined }) {
  const built = progress?.steps.filter((step) => !step.notBuilt) ?? [];
  const later = progress?.steps.filter((step) => step.notBuilt).map((step) => step.title.toLowerCase()) ?? [];
  return (
    <section aria-labelledby="meanwhile-heading" className="flex flex-col gap-2.5 border-t border-home-rule pt-3.5">
      <h2 id="meanwhile-heading" className={EYEBROW}>
        Meanwhile, building
      </h2>
      {progress === undefined ? (
        <LoadingState label="Checking what is building…" className="px-0 py-1" />
      ) : !progress.started || built.length === 0 ? (
        <p className="text-sm text-home-ink-3">Nothing is building yet. It starts once your team is together.</p>
      ) : (
        <ul className="flex flex-col gap-2 text-sm">
          {built.map((step) => {
            const done = step.state === "succeeded";
            const active = step.state === "running" || step.state === "queued";
            return (
              <li key={step.key} data-step={step.key} className={cn("flex items-center gap-2", done || active ? "text-home-ink" : "text-home-ink-3")}>
                {done ? (
                  <span aria-hidden="true" className="flex size-4 shrink-0 items-center justify-center rounded-full bg-home-sage-ink">
                    <Check className="size-2.5 text-home-card" />
                  </span>
                ) : active ? (
                  <Loader2 aria-hidden="true" className="size-4 shrink-0 animate-spin text-home-orange-ink motion-reduce:animate-none" />
                ) : (
                  <span aria-hidden="true" className="size-4 shrink-0 rounded-full border border-home-d2" />
                )}
                <span>{step.title}</span>
                <span className="font-mono text-xs text-home-ink-3">{STEP_STATE_WORDS[step.state] ?? step.state}</span>
              </li>
            );
          })}
        </ul>
      )}
      {later.length > 0 ? (
        <p className="text-[13px] text-home-ink-3">
          {titlesList(later).replace(/^./, (letter) => letter.toUpperCase())} {later.length === 1 ? "is" : "are"} coming in a
          later update.
        </p>
      ) : null}
      <p className="text-[13px] text-home-ink-3">
        This can take a few minutes. You can head into your workspace now; I&rsquo;ll keep going.
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// The screen
// ---------------------------------------------------------------------------

/**
 * L1 UI fidelity T1: Meet your co-founder and Team assembly as one screen,
 * after the business exists. The team starts on its own (owner ruling Q13: it
 * just appears), so there is no "Assemble my team" button: the hero, "What I
 * read" and the hired rows fill in live from `launchStatus`, and "Meanwhile,
 * building" reads `launchProgress`. Every state is words as well as shape.
 * The way into Team HQ and the workspace is always on screen, so a slow or
 * failed team never leaves a dead end (L1-C5).
 */
export function MeetCofounder({
  answers,
  business,
  ideaTitle,
  headingRef,
  launch,
  unavailable = false,
  onStart,
  onRetry,
  retrying = false,
  error = null,
  meanwhile,
}: MeetCofounderProps) {
  const name = partnerNameFromWizard(answers);
  const view: TeamView | "unavailable" = unavailable ? "unavailable" : teamView(launch, error);
  const assembling = view === "assembling";
  const showTeam = view === "assembling" || view === "ready";
  return (
    <section aria-labelledby="meet-heading" className="flex flex-col gap-6">
      <Hero name={name} business={business} headingRef={headingRef} />
      <TeamStatus
        name={name}
        launch={launch}
        view={view}
        onStart={onStart}
        onRetry={onRetry}
        retrying={retrying}
        error={error}
      />
      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[999_1_600px] flex-col gap-5">
          <WhatIRead answers={answers} ideaTitle={ideaTitle} businessName={business.name} />
          {showTeam ? <WhoIHired launch={launch} assembling={assembling} /> : null}
          <Next launch={launch} business={business} name={name} />
        </div>
        {showTeam || meanwhile ? (
          <aside aria-label={`How ${name} chose`} className="flex max-w-[380px] flex-[1_1_320px] flex-col gap-5">
            {showTeam ? (
              <>
                <RolesChecked launch={launch} assembling={assembling} businessName={business.name} />
                <NotHiring launch={launch} assembling={assembling} />
              </>
            ) : null}
            {meanwhile}
          </aside>
        ) : null}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Live wiring
// ---------------------------------------------------------------------------

/** Reads `launchProgress` for "Meanwhile, building"; a read that fails never takes the page down. */
function ProgressReader({ projectId }: { readonly projectId: Id<"projects"> }) {
  const progress = useQuery(api.crew.launch.launchProgress, { projectId });
  return <MeanwhileBuilding progress={progress} />;
}

export function LiveMeanwhile({ projectId }: { readonly projectId: Id<"projects"> }) {
  return (
    <QuietErrorBoundary
      fallback={
        <section aria-labelledby="meanwhile-heading" className="flex flex-col gap-2.5 border-t border-home-rule pt-3.5">
          <h2 id="meanwhile-heading" className={EYEBROW}>
            Meanwhile, building
          </h2>
          <p className="text-sm text-home-ink-3">Progress shows in Team HQ.</p>
        </section>
      }
    >
      <ProgressReader projectId={projectId} />
    </QuietErrorBoundary>
  );
}

type MeetBase = Pick<MeetCofounderProps, "answers" | "business" | "ideaTitle" | "headingRef">;

/** Starts the launch once the business exists, then shows it live. */
function LiveMeet({ answers, business, ideaTitle, headingRef }: MeetBase) {
  const projectId = business.projectId as Id<"projects">;
  const startLaunch = useMutation(api.crew.roster.startLaunch);
  const retryLaunch = useMutation(api.crew.roster.retryLaunch);
  const launch = useQuery(api.crew.roster.launchStatus, { projectId });
  const [retrying, setRetrying] = useState(false);
  // A refusal is shown only while the launch is still in the state it happened in; once the launch moves on, it is stale.
  const [refusal, setRefusal] = useState<{ readonly message: string; readonly during: string } | null>(null);
  const started = useRef<string | null>(null);
  const stateKey = launchStateKey(launch);
  const error = refusal !== null && refusal.during === stateKey ? refusal.message : null;

  // `startLaunch` is idempotent and never retries a failure, so a reload is safe.
  useEffect(() => {
    if (started.current === projectId) return;
    started.current = projectId;
    startLaunch({ projectId }).catch((caught: unknown) =>
      setRefusal({ message: launchErrorMessage(caught), during: "not_started" }));
  }, [projectId, startLaunch]);

  const run = (action: () => Promise<LaunchView>) => {
    // The state the founder clicked in: a refusal stays shown only while the launch is still there.
    const during = stateKey;
    setRetrying(true);
    setRefusal(null);
    action()
      .catch((caught: unknown) => setRefusal({ message: launchErrorMessage(caught), during }))
      .finally(() => setRetrying(false));
  };

  return (
    <MeetCofounder
      answers={answers}
      business={business}
      ideaTitle={ideaTitle}
      headingRef={headingRef}
      launch={launch}
      retrying={retrying}
      error={error}
      onStart={() => run(() => startLaunch({ projectId }))}
      onRetry={() => run(() => retryLaunch({ projectId }))}
      meanwhile={<LiveMeanwhile projectId={projectId} />}
    />
  );
}

/** The live Meet screen for the wizard; a read that fails (AI switched off, say) keeps the hero and the way in. */
export function LiveMeetCofounder(props: MeetBase) {
  return (
    <QuietErrorBoundary fallback={<MeetCofounder {...props} launch={undefined} unavailable />}>
      <LiveMeet {...props} />
    </QuietErrorBoundary>
  );
}
