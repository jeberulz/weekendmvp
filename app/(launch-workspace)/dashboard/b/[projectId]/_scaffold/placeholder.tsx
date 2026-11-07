import type { Metadata } from "next";
import { WorkspacePageHeader } from "@/components/workspace/kit/WorkspacePageHeader";
import { COMING_SOON_TAG } from "@/components/workspace/kit/styles";
import { requireWorkspaceAccess } from "@/lib/workspace/access";
import { COMING_SOON_LABEL, workspaceRoute, type WorkspaceRouteSlug } from "@/lib/workspace/routes";

/**
 * WP72-S1 placeholder pages, made honest by L1-C2. A page that is not built
 * for the L1 beta (`comingSoon` in the route manifest) says "Coming soon" in
 * words and one plain sentence on what it will do. A page that ships but is
 * still a placeholder says what it will show. Neither ever claims a state the
 * page does not check (that it is empty, or that no review is waiting). The page that owns
 * each screen replaces its placeholder later (extract §9.10).
 */

/** What each unbuilt area will do, in one plain sentence. */
export const COMING_SOON_LINES: Partial<Record<WorkspaceRouteSlug, string>> = {
  launch: "The launch plan will lay out your launch week, day by day.",
  "build-pack": "The build pack will give you the prompts to build your product with your own AI coding tool.",
  tasks: "Tasks will list what you and your team are working on.",
  ads: "Ads will draft campaigns for your own ad account, and nothing will spend without your OK.",
  studio: "Studio will make images and short videos in your brand.",
  outbound: "Outbound will draft emails to a list you upload, and nothing will send without your OK.",
  settings: "Settings will let you choose what Wren may do without asking first.",
  billing: "Billing will show your plan and credits, and let you change plan.",
};

/**
 * Pages that ship for L1 but still render this placeholder until their story
 * lands. None today: Team HQ and Brand kit (L1-C6, L1-C1) are real pages like
 * Social, Email, Files and the dashboard.
 */
export const PENDING_PAGE_LINES: Partial<Record<WorkspaceRouteSlug, string>> = {};

/** The coming-soon sentence for a slug. */
export function comingSoonLine(slug: WorkspaceRouteSlug): string {
  return COMING_SOON_LINES[slug] ?? `${workspaceRoute(slug).label} is not ready yet.`;
}

/** Same private policy as the layout, restated so a page never depends on merge order. */
export const WORKSPACE_ROBOTS: NonNullable<Metadata["robots"]> = {
  index: false,
  follow: false,
  noarchive: true,
  nocache: true,
  googleBot: { index: false, follow: false, noarchive: true, noimageindex: true },
};

export function workspacePageMetadata(title: string): Metadata {
  return { title, robots: WORKSPACE_ROBOTS };
}

export function routeMetadata(slug: WorkspaceRouteSlug): Metadata {
  return workspacePageMetadata(workspaceRoute(slug).label);
}

export function PlaceholderBody({
  eyebrow,
  eyebrowSuffix,
  heading,
  headingTail,
  emptyState,
  comingSoon = false,
}: {
  /** The route name (ember eyebrow). */
  eyebrow: string;
  eyebrowSuffix?: string;
  /** The h1 sentence. */
  heading: string;
  /** Optional italic tail of the h1. */
  headingTail?: string;
  emptyState: string;
  /** Shows "Coming soon" in words above the line. */
  comingSoon?: boolean;
}) {
  return (
    <div className="flex flex-col gap-6">
      <WorkspacePageHeader
        eyebrow={eyebrow}
        eyebrowSuffix={eyebrowSuffix}
        lead={heading}
        tail={headingTail}
      />
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-home-d2 px-6 py-8 text-center text-sm text-home-ink-2">
        {comingSoon ? <p className={COMING_SOON_TAG}>{COMING_SOON_LABEL}</p> : null}
        <p>{emptyState}</p>
      </div>
    </div>
  );
}

/** Gate, then render the nav label and the page's coming-soon or pending line. */
export async function RoutePlaceholder({
  params,
  slug,
}: {
  params: Promise<{ projectId: string }>;
  slug: WorkspaceRouteSlug;
}) {
  const { projectId } = await params;
  const project = await requireWorkspaceAccess(projectId);
  const route = workspaceRoute(slug);
  const pendingLine = route.comingSoon ? undefined : PENDING_PAGE_LINES[slug];
  // A page with no pending line of its own is not ready: it says so, like a coming-soon page.
  const comingSoon = pendingLine === undefined;
  return (
    <PlaceholderBody
      eyebrow={route.label}
      eyebrowSuffix={project.name}
      heading={route.label}
      headingTail={comingSoon ? "coming soon." : undefined}
      comingSoon={comingSoon}
      emptyState={pendingLine ?? comingSoonLine(slug)}
    />
  );
}
