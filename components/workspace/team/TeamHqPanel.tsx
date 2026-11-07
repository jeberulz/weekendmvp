"use client";

import { useQuery } from "convex/react";
import type { ReactNode } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { QuietErrorBoundary, WhenConvexReady } from "@/components/platform/client-gates";
import { EmptyState, ErrorState } from "@/components/workspace/kit/states";
import { FOCUS } from "@/components/workspace/kit/styles";
import { WorkspacePageHeader } from "@/components/workspace/kit/WorkspacePageHeader";
import { BlueprintView } from "@/components/workspace/team/BlueprintView";
import { LeadCard } from "@/components/workspace/team/LeadCard";
import { PlanByOwner } from "@/components/workspace/team/PlanByOwner";
import { SkippedRoles } from "@/components/workspace/team/SkippedRoles";
import { TeamGrid } from "@/components/workspace/team/TeamGrid";
import { SkeletonBlock, TeamSkeleton } from "@/components/workspace/team/TeamSkeleton";
import { useNow } from "@/components/workspace/kit/useNow";
import { WhyThisTeam, WHY_THIS_TEAM_ID } from "@/components/workspace/team/WhyThisTeam";
import { cn } from "@/lib/utils";
import { openReviews } from "@/lib/workspace/needsYou";
import { TEAM_PARTNER_NAME, TEAM_UNAVAILABLE_COPY } from "@/lib/workspace/reviewPages";
import {
  employeeStatuses,
  leadName,
  readyRoster,
  teamHeaderCopy,
  type TeamHeaderCopy,
  type TeamStep,
} from "@/lib/workspace/teamHq";

/**
 * Team HQ: the page header with its counts, the Crew Lead card (with the
 * reviews it routes), the team by status, the blueprint, the launch steps by
 * owner, the skipped roles and "Why this team?". The Wren chat is the
 * workspace's right-hand column, so Team HQ draws none. One query set feeds
 * the header, lead card, grid and steps so their counts always agree; the
 * blueprint reads its own query and keeps its own states.
 *
 * The page sits in a narrower column beside the chat, so layouts size from the
 * space they have (auto-fit grids, wrapping rows) rather than the viewport.
 */

const WHY_LINK = cn(
  "inline-flex min-h-11 items-center rounded-full border border-home-rule bg-home-card px-4 text-sm text-home-ink hover:bg-home-sunk",
  FOCUS,
);

function Header({ businessName, copy }: { businessName: string; copy: TeamHeaderCopy }) {
  return (
    <WorkspacePageHeader
      eyebrow="Team HQ"
      eyebrowTone="ember"
      eyebrowSuffix={businessName}
      lead={copy.lead}
      tail={copy.tail}
      summary={copy.summary}
      actions={copy.showWhy ? <a href={`#${WHY_THIS_TEAM_ID}`} className={WHY_LINK}>Why this team?</a> : undefined}
    />
  );
}

const SHELL = "@container flex flex-col gap-8";

/** Header plus a state, for loading and for failures: the page always has its h1. */
function Shell({ businessName, summary, children }: { businessName: string; summary: string; children: ReactNode }) {
  return (
    <div className={SHELL}>
      <Header businessName={businessName} copy={{ lead: "Team HQ", summary, showWhy: false }} />
      {children}
    </div>
  );
}

function Live({ projectId, businessName, partnerName }: { projectId: Id<"projects">; businessName: string; partnerName?: string }) {
  const launch = useQuery(api.crew.roster.launchStatus, { projectId });
  const progress = useQuery(api.crew.launch.launchProgress, { projectId });
  const reviews = useQuery(api.workspace.reviews.pendingReviews, { projectId });
  const now = useNow();

  if (launch === undefined || progress === undefined || reviews === undefined) {
    return (
      <Shell businessName={businessName} summary="Loading your team…">
        <p role="status" className="sr-only">Loading your team…</p>
        <TeamSkeleton />
        <SkeletonBlock label="Loading your launch steps…" />
      </Shell>
    );
  }

  const open = openReviews(reviews, now);
  const lead = leadName(launch, partnerName);
  const steps: TeamStep[] = progress.steps;
  const roster = launch.state === "ready" ? readyRoster(launch) : { hired: [], skipped: [] };
  const statuses = employeeStatuses(roster.hired, steps, open);
  const copy = teamHeaderCopy({ launch, lead, statuses, reviewCount: open.length });
  const specialists = statuses.filter((entry) => entry.role !== "lead");

  return (
    <div className={SHELL}>
      <Header businessName={businessName} copy={copy} />
      {launch.state === "not_started" ? (
        <EmptyState>{copy.summary}</EmptyState>
      ) : (
        <LeadCard projectId={projectId} launch={launch} lead={lead} roster={roster.hired} reviews={open} now={now} />
      )}
      {launch.state === "ready" ? (
        <TeamGrid projectId={projectId} businessName={businessName} lead={lead} specialists={specialists} />
      ) : launch.state === "assembling" ? (
        <section aria-labelledby="assembling-h" className="flex flex-col gap-3">
          <h2 id="assembling-h" className="sr-only">Your team</h2>
          <p role="status" className="text-sm text-home-ink-2">{lead} is putting your team together…</p>
          <TeamSkeleton />
        </section>
      ) : null}
      <BlueprintView projectId={projectId} leadName={lead} />
      <PlanByOwner projectId={projectId} started={progress.started} steps={steps} roster={roster.hired} />
      {launch.state === "ready" ? (
        <>
          <SkippedRoles projectId={projectId} businessName={businessName} lead={lead} skipped={roster.skipped} />
          <WhyThisTeam projectId={projectId} hired={roster.hired} skipped={roster.skipped} />
        </>
      ) : null}
    </div>
  );
}

function Unavailable({
  projectId,
  businessName,
  partnerName,
  message,
}: {
  projectId?: Id<"projects">;
  businessName: string;
  partnerName?: string;
  message: string;
}) {
  return (
    <Shell businessName={businessName} summary={message}>
      <ErrorState message={message} />
      {projectId === undefined ? null : <BlueprintView projectId={projectId} leadName={partnerName ?? TEAM_PARTNER_NAME} />}
    </Shell>
  );
}

/** `partnerName` is the name the founder chose; it names the lead until the team is written. */
export function TeamHqPanel({ projectId, businessName, partnerName }: { projectId: Id<"projects">; businessName: string; partnerName?: string }) {
  return (
    <WhenConvexReady
      fallback={
        <Shell businessName={businessName} summary="Loading your team…">
          <p role="status" className="sr-only">Loading your team…</p>
          <TeamSkeleton />
        </Shell>
      }
      unavailable={<Unavailable businessName={businessName} partnerName={partnerName} message="Your team couldn't load right now. Reload the page to try again." />}
    >
      <QuietErrorBoundary
        fallback={<Unavailable projectId={projectId} businessName={businessName} partnerName={partnerName} message={TEAM_UNAVAILABLE_COPY} />}
      >
        <Live projectId={projectId} businessName={businessName} partnerName={partnerName} />
      </QuietErrorBoundary>
    </WhenConvexReady>
  );
}
