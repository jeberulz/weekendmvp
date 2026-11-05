import type { Metadata } from "next";
import { requireWorkspaceAccess } from "@/lib/workspace/access";
import { workspaceRoute, type WorkspaceRouteSlug } from "@/lib/workspace/routes";

/**
 * WP72-S1 placeholder pages. Each workspace page renders its nav label and
 * one empty-state line from the canvas copy deck (extract §4 and §5). The page
 * that owns each screen replaces its placeholder later (extract §9.10).
 */

/** Lines from the copy deck that read as a neutral empty state with no fixture facts. */
const EMPTY_STATES: Partial<Record<WorkspaceRouteSlug, string>> = {
  team: "Nobody needs you right now. Wren will bring the next decision here.",
  launch: "Ask Wren to fill gaps.",
  "build-pack": "Every prompt ends with Do not build and Done when.",
  email: "No emails yet.",
  ads: "Nothing sends, posts or spends without your OK.",
  studio: "Make unlocks once a logo is uploaded.",
  outbound: "Three touches: Intro, Value, Last note.",
  social: "No account yet? Personal mode gives you copy-ready posts.",
  files: "What Wren knows, in plain text you can edit.",
  settings: "Autopilot off: Wren drafts everything and asks first.",
  billing: "Credits pay for compute-heavy extras.",
};

const DEFAULT_EMPTY_STATE = "Nothing here yet.";

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
  heading,
  emptyState,
}: {
  eyebrow: string;
  heading: string;
  emptyState: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-home-ink-3">{eyebrow}</p>
        <h1 className="font-editorial text-[34px] font-normal leading-[1.05] tracking-[-0.025em] text-home-ink sm:text-[42px]">
          {heading}
        </h1>
      </header>
      <p className="rounded-xl border border-dashed border-home-d2 px-6 py-8 text-center text-sm text-home-ink-2">
        {emptyState}
      </p>
    </div>
  );
}

/** Gate, then render the nav label and the page's empty state. */
export async function RoutePlaceholder({
  params,
  slug,
}: {
  params: Promise<{ projectId: string }>;
  slug: WorkspaceRouteSlug;
}) {
  const { projectId } = await params;
  const project = await requireWorkspaceAccess(projectId);
  return (
    <PlaceholderBody
      eyebrow={project.name}
      heading={workspaceRoute(slug).label}
      emptyState={EMPTY_STATES[slug] ?? DEFAULT_EMPTY_STATE}
    />
  );
}
