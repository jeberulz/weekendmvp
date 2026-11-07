"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Clock, MessageSquare } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { EmployeeActivity } from "@/convex/workspace/employees";
import { QuietErrorBoundary, WhenConvexReady } from "@/components/platform/client-gates";
import { EmptyState, ErrorState } from "@/components/workspace/kit/states";
import { StatusPill } from "@/components/workspace/kit/StatusPill";
import { BTN_PRIMARY, BTN_SECONDARY, CARD, COMING_SOON_TAG, FOCUS } from "@/components/workspace/kit/styles";
import { useNow } from "@/components/workspace/kit/useNow";
import { SectionHeading } from "@/components/workspace/team/SectionHeading";
import { SkeletonBlock } from "@/components/workspace/team/TeamSkeleton";
import { cn } from "@/lib/utils";
import {
  askLeadPrompt,
  availability,
  deliverableCounts,
  deliverableRows,
  employeePageState,
  employeeProfile,
  formatWhen,
  handsOffTo,
  myLaunchSteps,
  startsWhenCopy,
  teamPendingCopy,
  trailEntries,
  waitingOn,
  type Availability,
  type EmployeeProfile,
  type TrailEntry,
} from "@/lib/workspace/employeePage";
import type { SpecialistRoleKey } from "@/lib/workspace/employees";
import { openReviews } from "@/lib/workspace/needsYou";
import { changeRoundNote, expiresInWords, TEAM_UNAVAILABLE_COPY, WAITING_EMPTY_COPY } from "@/lib/workspace/reviewPages";
import { workspacePath } from "@/lib/workspace/routes";
import {
  employeeStatus,
  readyRoster,
  REVIEW_OWNER,
  stepPillStatus,
  workstreamFor,
  type TeamHired,
  type TeamStep,
} from "@/lib/workspace/teamHq";
import { askWren } from "@/lib/workspace/wrenPrefill";

/**
 * WP67 employee page, the live part (`docs/wp/employee-pages/BRIEF.md`). It
 * reads the queries Team HQ reads (`launchStatus`, `launchProgress`,
 * `pendingReviews`), so status and "waiting on you" agree with Team HQ, plus
 * `employeeActivity` for this employee's jobs and drafts. The server-rendered
 * "job, in full" arrives as `job` and is placed between the record and the
 * voice. An employee whose work is coming soon, or who was not hired, gets
 * the profile and says so in words: no section is shown that could only be
 * empty or invented.
 */

type PendingReview = FunctionReturnType<typeof api.workspace.reviews.pendingReviews>[number];

const SHELL = "@container flex flex-col gap-8";
const BOX = cn(CARD, "flex flex-col gap-2.5 px-4 py-4 @md:px-5");
const TEXT_LINK = cn("inline-flex min-h-6 items-center text-[13px] font-medium text-home-ink underline underline-offset-2 hover:text-home-orange-ink", FOCUS);

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

function StatusBox({ children, label }: { children: ReactNode; label: string }) {
  return (
    <section aria-label={label} className={cn(BOX, "border-home-ink")}>
      {children}
    </section>
  );
}

function HiredStatus({
  profile,
  lead,
  reason,
  steps,
  open,
  activity,
  reach,
}: {
  profile: EmployeeProfile;
  lead: string;
  reason: string;
  steps: readonly TeamStep[];
  open: readonly PendingReview[];
  activity: EmployeeActivity;
  reach: Availability;
}) {
  const status = reach.kind === "available"
    ? employeeStatus({ role: profile.role, name: profile.name }, steps, open)
    : { status: "coming_soon" as const, detail: startsWhenCopy(profile.name, reach), blocker: undefined };
  const mine = open.filter((review) => REVIEW_OWNER[review.kind] === profile.role);
  const counts = deliverableCounts(activity.deliverables);
  return (
    <StatusBox label={`${profile.name}'s status`}>
      <p className="flex flex-wrap items-center gap-2 text-sm text-home-ink">
        <StatusPill set="employee" status={status.status} />
        <span>
          <span className="sr-only">Status detail: </span>
          {status.detail}
        </span>
      </p>
      {status.blocker === undefined ? null : (
        <p className="flex items-start gap-1.5 text-[13px] text-home-ochre-ink">
          <Clock aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          <strong className="font-semibold">{status.blocker.label}</strong>
        </p>
      )}
      <p className="text-[13px] text-home-ink-2">
        <strong className="font-semibold text-home-ink">Why {lead} hired {profile.name}:</strong> {reason}
      </p>
      <p className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] text-home-ink-3">
        {activity.member === null ? null : <span>On the team since {formatWhen(activity.member.hiredAt)}</span>}
        {reach.kind === "available" ? (
          <span>
            {counts.drafts} {counts.drafts === 1 ? "draft" : "drafts"} · {mine.length} waiting on you · {counts.approved} approved
          </span>
        ) : null}
      </p>
    </StatusBox>
  );
}

// ---------------------------------------------------------------------------
// Waiting on you
// ---------------------------------------------------------------------------

function WaitingOnYou({ profile, reviews, now }: { profile: EmployeeProfile; reviews: readonly PendingReview[]; now: number }) {
  const mine = reviews.filter((review) => REVIEW_OWNER[review.kind] === profile.role);
  return (
    <section aria-labelledby="emp-waiting-h" className="flex flex-col gap-3">
      <SectionHeading id="emp-waiting-h" eyebrow="Needs your call" lead="Waiting on" tail="you." />
      {mine.length === 0 ? (
        <EmptyState>{WAITING_EMPTY_COPY}</EmptyState>
      ) : (
        <ul aria-labelledby="emp-waiting-h" className={cn(CARD, "overflow-hidden")}>
          {mine.map((review) => {
            const round = changeRoundNote(Number(review.changeRound));
            return (
              <li key={review.approvalId} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-home-sunk px-4 py-3 last:border-b-0">
                <span className="flex min-w-0 flex-[1_1_200px] flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-home-ink">{review.title}</span>
                    <StatusPill set="output" status="ready" label="Waiting on you" />
                    {round === null ? null : <span className="text-[13px] text-home-ink-2">{round}</span>}
                  </span>
                  <span className="text-[13px] text-home-ink-3">Closes {expiresInWords(review.expiresAt, now)}.</span>
                </span>
                <Link href={review.href} className={cn(BTN_PRIMARY, "shrink-0")}>
                  Review<span className="sr-only"> {review.title}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-[13px] text-home-ink-2">
        You decide on the review card. Approve it as it is, or ask {profile.name} for changes with a note.
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Now and next
// ---------------------------------------------------------------------------

function NowAndNext({
  profile,
  lead,
  steps,
  hired,
  reach,
}: {
  profile: EmployeeProfile;
  lead: string;
  steps: readonly TeamStep[];
  hired: readonly TeamHired[];
  reach: Availability;
}) {
  const mine = myLaunchSteps(profile.role, steps);
  const blockers = waitingOn(profile.role, steps, hired, lead);
  const after = handsOffTo(profile.role, hired);
  const later = reach.kind === "available" ? startsWhenCopy(profile.name, reach) : "";
  return (
    <section aria-labelledby="emp-now-h" className="flex flex-col gap-3">
      <SectionHeading id="emp-now-h" eyebrow="This launch" lead="Now" tail="and next." />
      {mine.length === 0 ? (
        <EmptyState>Your launch hasn&apos;t reached {profile.name}&apos;s steps yet.</EmptyState>
      ) : (
        <ol aria-label={`${profile.name}'s launch steps`} className="flex flex-col gap-2">
          {mine.map((step) => (
            <li
              key={step.key}
              className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1.5 rounded-[10px] border border-home-rule bg-home-card px-3.5 py-2.5"
            >
              <span className="flex min-w-0 flex-[1_1_180px] flex-col gap-0.5">
                <span className="text-sm font-medium text-home-ink">{step.title}</span>
                {step.reason === undefined ? null : <span className="text-xs text-home-ink-3">{step.reason}</span>}
              </span>
              <StatusPill set="step" status={stepPillStatus(step)} />
            </li>
          ))}
        </ol>
      )}
      {blockers.length === 0 ? null : (
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold text-home-ink">{profile.name} is waiting on</h3>
          <ul className="flex flex-col gap-1 text-sm text-home-ink">
            {blockers.map((entry) => (
              <li key={entry.title}>
                <strong className="font-semibold">{entry.who}</strong> · {entry.title}
              </li>
            ))}
          </ul>
        </div>
      )}
      {after.length === 0 ? null : (
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold text-home-ink">Then these start</h3>
          <ul className="flex flex-col gap-1 text-sm text-home-ink">
            {after.map((entry) => (
              <li key={`${entry.role}-${entry.title}`}>
                <strong className="font-semibold">{entry.name}</strong> · {entry.title}
              </li>
            ))}
          </ul>
        </div>
      )}
      {later === "" ? null : <p className="text-[13px] text-home-ink-2">{later}</p>}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Deliverables
// ---------------------------------------------------------------------------

const REVIEW_PILL = {
  ready: { status: "ready", label: "Waiting on you" },
  approved: { status: "approved", label: "Approved" },
  changes_requested: { status: "changes_requested", label: "Changes asked" },
  draft: { status: "draft", label: "No decision" },
} as const;

function Deliverables({ projectId, profile, activity }: { projectId: string; profile: EmployeeProfile; activity: EmployeeActivity }) {
  const rows = deliverableRows(activity.deliverables);
  const page = workstreamFor(profile.role, projectId);
  return (
    <section aria-labelledby="emp-drafts-h" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <SectionHeading id="emp-drafts-h" eyebrow={`What ${profile.name} has written`} lead="Deliverables," tail="newest first." />
        {page === null ? null : (
          <Link href={page.href} className={TEXT_LINK}>
            {page.label}
          </Link>
        )}
      </div>
      {rows.length === 0 ? (
        <EmptyState>{profile.name} hasn&apos;t written a draft for this business yet.</EmptyState>
      ) : (
        <ul className={cn(CARD, "overflow-hidden")}>
          {rows.map((row) => {
            const pill = REVIEW_PILL[row.reviewTone];
            return (
              <li key={row.key} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-home-sunk px-4 py-3 last:border-b-0">
                <span className="flex min-w-0 flex-[1_1_200px] flex-col gap-0.5">
                  <span className="text-sm font-medium text-home-ink">{row.title}</span>
                  <span className="text-[13px] text-home-ink-2">
                    {row.label} · written {formatWhen(row.at)}
                  </span>
                  <span className="text-[13px] text-home-ink-3">{row.review}</span>
                </span>
                <StatusPill set="output" status={pill.status} label={pill.label} />
              </li>
            );
          })}
        </ul>
      )}
      {activity.deliverablesTruncated ? (
        <p className={COMING_SOON_TAG}>Showing the most recent drafts.</p>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Activity
// ---------------------------------------------------------------------------

const TONE_DOT: Readonly<Record<TrailEntry["tone"], string>> = {
  done: "bg-home-sage-ink",
  working: "bg-home-sky-ink",
  paused: "bg-home-ochre-ink",
  failed: "bg-home-clay-ink",
  stopped: "bg-home-ink-3",
};

function Activity({ profile, activity }: { profile: EmployeeProfile; activity: EmployeeActivity }) {
  const entries = trailEntries(activity.tasks);
  return (
    <section aria-labelledby="emp-trail-h" className="flex flex-col gap-3">
      <SectionHeading id="emp-trail-h" eyebrow={`Every job ${profile.name} ran`} lead="Activity," tail="as it happened." />
      {entries.length === 0 ? (
        <EmptyState>No jobs yet. {profile.name}&apos;s work shows here as it starts.</EmptyState>
      ) : (
        <ol aria-label={`${profile.name}'s jobs, newest first`} className="flex flex-col">
          {entries.map((entry) => (
            <li key={entry.key} className="relative flex gap-3 pb-4 pl-1 last:pb-0">
              <span aria-hidden="true" className="relative flex w-3 shrink-0 justify-center">
                <span className={cn("mt-1.5 size-2.5 rounded-full", TONE_DOT[entry.tone])} />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5 border-b border-home-sunk pb-3">
                <p className="flex flex-wrap items-baseline gap-x-2 text-sm text-home-ink">
                  <span className="font-medium">{entry.headline}</span>
                  <span className="text-home-ink-2">· {entry.outcome}</span>
                </p>
                <p className="font-mono text-[11px] text-home-ink-3">
                  <time dateTime={new Date(entry.at).toISOString()}>{formatWhen(entry.at)}</time>
                </p>
                {entry.details.map((line) => (
                  <p key={line} className="text-[13px] text-home-ink-2">{line}</p>
                ))}
              </div>
            </li>
          ))}
        </ol>
      )}
      {activity.tasksTruncated ? <p className={COMING_SOON_TAG}>Showing the most recent work.</p> : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Working style (the brand voice)
// ---------------------------------------------------------------------------

function VoiceLive({ projectId, profile }: { projectId: Id<"projects">; profile: EmployeeProfile }) {
  const view = useQuery(api.growth.drafts.brandKit.brandKitDraft, { projectId });
  if (view === undefined) return <SkeletonBlock label="Loading the brand voice…" />;
  if (view.state !== "ready") {
    return (
      <EmptyState>
        {profile.role === "brand"
          ? `${profile.name} sets the voice in the brand kit. It shows here once the kit is written.`
          : `${profile.name} writes in the voice from Iris's brand kit. It shows here once the kit is written.`}
      </EmptyState>
    );
  }
  const voice = view.kit.voice;
  return (
    <div className={cn(BOX)}>
      <ul aria-label="Voice traits" className="flex flex-wrap gap-1.5">
        {voice.traits.map((trait) => (
          <li key={trait} className="rounded-full border border-home-rule bg-home-paper px-2.5 py-0.5 text-xs font-medium text-home-ink">{trait}</li>
        ))}
      </ul>
      <p className="text-sm text-home-ink"><strong className="font-semibold">Say:</strong> “{voice.say}”</p>
      <p className="text-sm text-home-ink"><strong className="font-semibold">Don&apos;t say:</strong> “{voice.dontSay}” {voice.dontSayWhy}</p>
    </div>
  );
}

function WorkingStyle({ projectId, profile }: { projectId: Id<"projects">; profile: EmployeeProfile }) {
  return (
    <section aria-labelledby="emp-voice-h" className="flex flex-col gap-3">
      <SectionHeading
        id="emp-voice-h"
        eyebrow="Working style"
        lead={profile.role === "brand" ? "The voice" : "Writes in"}
        tail={profile.role === "brand" ? `${profile.name} set.` : "your brand's voice."}
      />
      <QuietErrorBoundary fallback={<EmptyState>The brand voice can&apos;t be shown right now.</EmptyState>}>
        <VoiceLive projectId={projectId} profile={profile} />
      </QuietErrorBoundary>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Ask Wren
// ---------------------------------------------------------------------------

function AskLead({ profile, lead, question }: { profile: EmployeeProfile; lead: string; question: string }) {
  const [message, setMessage] = useState("");
  return (
    <section aria-labelledby="emp-ask-h" className="flex flex-col gap-2.5 rounded-xl bg-home-sunk px-4 py-4 @md:px-5">
      <h2 id="emp-ask-h" className="flex items-center gap-2 font-editorial text-[22px] font-normal text-home-ink">
        <MessageSquare aria-hidden="true" className="size-5 shrink-0" />
        Questions about {profile.name}?
      </h2>
      <p className="text-sm text-home-ink-2">
        The chat is {lead}, your Crew Lead, only. {profile.name} doesn&apos;t chat: ask {lead}, who brings in the
        right specialist.
      </p>
      <div>
        <button
          type="button"
          className={BTN_SECONDARY}
          onClick={() => {
            askWren(question);
            setMessage(`Your question is in the chat with ${lead}. Edit it, then press Enter to send.`);
          }}
        >
          Ask {lead} about {profile.name}
        </button>
      </div>
      <p role="status" aria-live="polite" className="min-h-5 text-[13px] text-home-ink-2">{message}</p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// The page body
// ---------------------------------------------------------------------------

function Live({
  projectId,
  role,
  businessName,
  lead,
  job,
}: {
  projectId: Id<"projects">;
  role: SpecialistRoleKey;
  businessName: string;
  lead: string;
  job: ReactNode;
}) {
  const profile = employeeProfile(role);
  const launch = useQuery(api.crew.roster.launchStatus, { projectId });
  const progress = useQuery(api.crew.launch.launchProgress, { projectId });
  const reviews = useQuery(api.workspace.reviews.pendingReviews, { projectId });
  const activity = useQuery(api.workspace.employees.employeeActivity, { projectId, roleKey: role });
  const now = useNow();

  if (launch === undefined || progress === undefined || reviews === undefined || activity === undefined) {
    return (
      <div className={SHELL}>
        <SkeletonBlock label={`Loading ${profile.name}'s work…`} />
        {job}
      </div>
    );
  }

  const roster = launch.state === "ready" ? readyRoster(launch) : { hired: [], skipped: [] };
  const state = employeePageState(role, launch, roster.hired, roster.skipped);
  const ask = <AskLead profile={profile} lead={lead} question={askLeadPrompt(profile.name, profile.roleLabel)} />;

  if (state.kind === "team_pending") {
    return (
      <div className={SHELL}>
        <StatusBox label={`${profile.name}'s status`}>
          <p className="text-sm text-home-ink">{teamPendingCopy(state.launch, lead)}</p>
          <p>
            <Link href={workspacePath(projectId, "team")} className={TEXT_LINK}>Open Team HQ</Link>
          </p>
        </StatusBox>
        {job}
      </div>
    );
  }

  if (state.kind === "not_hired") {
    return (
      <div className={SHELL}>
        <section aria-labelledby="emp-skipped-h" className={cn(BOX, "border-dashed border-home-d2")}>
          <h2 id="emp-skipped-h" className="font-editorial text-[22px] font-normal text-home-ink">
            Not on {businessName}&apos;s team
          </h2>
          <p className="rounded-md bg-home-clay px-2.5 py-1.5 text-[13px] text-home-clay-ink">
            <strong className="font-semibold">Skipped</strong> · {state.reason}
          </p>
          <p className="text-[13px] text-home-ink-2">
            {lead} left {profile.name} out when putting your team together, so {profile.name} has no work here. Hiring a
            skipped role is coming soon.
          </p>
        </section>
        {job}
        <AskLead
          profile={profile}
          lead={lead}
          question={`Why did you leave ${profile.name} (${profile.roleLabel}) off the team for ${businessName}?`}
        />
      </div>
    );
  }

  const steps: TeamStep[] = progress.steps;
  const open = openReviews(reviews, now);
  const reach = availability(role);
  const statusBox = (
    <HiredStatus profile={profile} lead={lead} reason={state.reason} steps={steps} open={open} activity={activity} reach={reach} />
  );

  if (reach.kind !== "available") {
    return (
      <div className={SHELL}>
        {statusBox}
        {reach.kind === "coming_soon" ? (
          <NowAndNext profile={profile} lead={lead} steps={steps} hired={roster.hired} reach={reach} />
        ) : null}
        {job}
        {ask}
      </div>
    );
  }

  return (
    <div className={SHELL}>
      {statusBox}
      <WaitingOnYou profile={profile} reviews={open} now={now} />
      <NowAndNext profile={profile} lead={lead} steps={steps} hired={roster.hired} reach={reach} />
      <Deliverables projectId={projectId} profile={profile} activity={activity} />
      <Activity profile={profile} activity={activity} />
      {job}
      {profile.usesBrandVoice ? <WorkingStyle projectId={projectId} profile={profile} /> : null}
      {ask}
    </div>
  );
}

export function EmployeePanel({
  projectId,
  role,
  businessName,
  lead,
  job,
}: {
  projectId: Id<"projects">;
  role: SpecialistRoleKey;
  businessName: string;
  lead: string;
  /** The server-rendered "job, in full" section. */
  job: ReactNode;
}) {
  const profile = employeeProfile(role);
  const unavailable = (
    <div className={SHELL}>
      <ErrorState message={TEAM_UNAVAILABLE_COPY} />
      {job}
    </div>
  );
  return (
    <WhenConvexReady
      fallback={
        <div className={SHELL}>
          <SkeletonBlock label={`Loading ${profile.name}'s work…`} />
          {job}
        </div>
      }
      unavailable={unavailable}
    >
      <QuietErrorBoundary fallback={unavailable}>
        <Live projectId={projectId} role={role} businessName={businessName} lead={lead} job={job} />
      </QuietErrorBoundary>
    </WhenConvexReady>
  );
}
