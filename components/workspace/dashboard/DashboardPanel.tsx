"use client";

import { useQuery } from "convex/react";
import type { ReactNode } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { WhenConvexReady } from "@/components/platform/client-gates";
import { ErrorState } from "@/components/workspace/kit/states";
import { WorkspacePageHeader } from "@/components/workspace/kit/WorkspacePageHeader";
import { DashboardBoundary } from "@/components/workspace/dashboard/DashboardBoundary";
import { LaunchBanner } from "@/components/workspace/dashboard/LaunchBanner";
import { PendingApprovals } from "@/components/workspace/dashboard/PendingApprovals";
import { SetupChecklist } from "@/components/workspace/dashboard/SetupChecklist";
import { TeamStrip } from "@/components/workspace/dashboard/TeamStrip";
import { useNow } from "@/components/workspace/dashboard/useNow";
import {
  bannerCopy,
  checklistRows,
  DASHBOARD_ERROR_COPY,
  DASHBOARD_TAIL,
  dashboardErrorCopy,
  dashboardSummary,
  hiredTeam,
  openReviews,
  segments,
} from "@/lib/workspace/dashboard";
import { TEAM_NOT_STARTED_COPY, TEAM_PARTNER_NAME, TEAM_UNAVAILABLE_COPY } from "@/lib/workspace/reviewPages";

/**
 * The workspace Dashboard: the business name as the h1, the launch banner, the
 * team strip, the reviews waiting on you and a checklist of what is ready. The
 * Wren chat is the workspace's right-hand column, so the dashboard draws none.
 * Every figure comes from `launchStatus`, `launchProgress` and
 * `pendingReviews`; the board's live site, inbox, numbers, dates and credits
 * have no data in L1 and are left out.
 *
 * The page sits in a narrower column beside the chat, so layouts size from the
 * space they have (container queries, wrapping rows), not the viewport.
 */

const SHELL = "@container flex flex-col gap-7";

function Header({ businessName, summary }: { businessName: string; summary: ReactNode }) {
  return <WorkspacePageHeader eyebrow="Dashboard" eyebrowTone="ember" lead={businessName} tail={DASHBOARD_TAIL} summary={summary} />;
}

function Skeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-7">
      <div className="h-36 animate-pulse rounded-[10px] bg-home-sunk motion-reduce:animate-none" />
      <div className="h-24 animate-pulse rounded-[10px] bg-home-sunk motion-reduce:animate-none" />
      <div className="grid gap-6 @2xl:grid-cols-2">
        <div className="h-40 animate-pulse rounded-lg bg-home-sunk motion-reduce:animate-none" />
        <div className="h-40 animate-pulse rounded-lg bg-home-sunk motion-reduce:animate-none" />
      </div>
    </div>
  );
}

function Loading({ businessName }: { businessName: string }) {
  return (
    <div className={SHELL} aria-busy="true">
      <Header businessName={businessName} summary="Loading your launch…" />
      <p role="status" className="sr-only">Loading your launch…</p>
      <Skeleton />
    </div>
  );
}

function Live({ projectId, businessName, partnerName }: { projectId: Id<"projects">; businessName: string; partnerName?: string }) {
  const launch = useQuery(api.crew.roster.launchStatus, { projectId });
  const progress = useQuery(api.crew.launch.launchProgress, { projectId });
  const reviews = useQuery(api.workspace.reviews.pendingReviews, { projectId });
  const now = useNow();

  if (launch === undefined || progress === undefined || reviews === undefined) return <Loading businessName={businessName} />;

  const hired = hiredTeam(launch);
  const lead = hired.find((entry) => entry.role === "lead")?.name ?? partnerName ?? TEAM_PARTNER_NAME;
  const open = openReviews(reviews, now);
  const banner = bannerCopy({ launch, started: progress.started, steps: progress.steps, reviews: open, lead });
  const teamMessage =
    launch.state === "not_started"
      ? TEAM_NOT_STARTED_COPY
      : launch.state === "assembling"
        ? "Your team is being put together."
        : launch.state === "failed"
          ? TEAM_UNAVAILABLE_COPY
          : undefined;

  return (
    <div className={SHELL}>
      <Header businessName={businessName} summary={dashboardSummary({ launch, lead })} />
      <LaunchBanner
        projectId={projectId}
        copy={banner}
        segments={banner.variant === "ready" ? segments(progress.steps, open) : []}
        firstReview={open[0]}
      />
      <TeamStrip projectId={projectId} hired={hired} reviews={open} message={teamMessage} />
      <div className="grid gap-6 @2xl:grid-cols-2">
        <PendingApprovals reviews={open} hired={hired} now={now} />
        {banner.variant === "not_started" ? null : (
          <SetupChecklist rows={checklistRows({ projectId, launch, steps: progress.steps, reviews: open })} />
        )}
      </div>
    </div>
  );
}

/** The reviews alone, for when the launch read fails but the reviews can still load. */
function ReviewsOnly({ projectId }: { projectId: Id<"projects"> }) {
  const reviews = useQuery(api.workspace.reviews.pendingReviews, { projectId });
  const now = useNow();
  if (reviews === undefined) return null;
  return <PendingApprovals reviews={openReviews(reviews, now)} hired={[]} now={now} />;
}

function Unavailable({ projectId, businessName, message }: { projectId?: Id<"projects">; businessName: string; message: string }) {
  return (
    <div className={SHELL}>
      <Header businessName={businessName} summary={message} />
      <ErrorState message={message} />
      {projectId === undefined ? null : (
        <DashboardBoundary fallback={() => null}>
          <ReviewsOnly projectId={projectId} />
        </DashboardBoundary>
      )}
    </div>
  );
}

export function DashboardPanel({
  projectId,
  businessName,
  partnerName,
}: {
  projectId: Id<"projects">;
  businessName: string;
  partnerName?: string;
}) {
  return (
    <WhenConvexReady
      fallback={<Loading businessName={businessName} />}
      unavailable={<Unavailable businessName={businessName} message={DASHBOARD_ERROR_COPY} />}
    >
      <DashboardBoundary
        fallback={(error) => <Unavailable projectId={projectId} businessName={businessName} message={dashboardErrorCopy(error)} />}
      >
        <Live projectId={projectId} businessName={businessName} partnerName={partnerName} />
      </DashboardBoundary>
    </WhenConvexReady>
  );
}
