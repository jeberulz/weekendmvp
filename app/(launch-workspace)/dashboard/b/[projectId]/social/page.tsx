import type { Metadata } from "next";
import { WorkspacePageHeader } from "@/components/workspace/kit";
import { SocialPackPanel } from "@/components/workspace/social/SocialPackPanel";
import { requireWorkspaceAccess } from "@/lib/workspace/access";
import { SOCIAL_HEADER } from "@/lib/workspace/socialPage";
import { routeMetadata } from "../_scaffold/placeholder";

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  return routeMetadata("social");
}

/**
 * WP76-S2b: Social shows the crew's seven-post pack, lets the founder copy each
 * post for the platform they use, and approve the pack or ask for changes.
 * Nothing posts or schedules here. The gate 404s with the workspace flag off,
 * like every workspace route.
 */
export default async function SocialPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await requireWorkspaceAccess(projectId);
  return (
    <div className="flex flex-col gap-7">
      <WorkspacePageHeader eyebrow="Social" lead={SOCIAL_HEADER.lead} tail={SOCIAL_HEADER.tail} />
      <SocialPackPanel projectId={project._id} />
    </div>
  );
}
