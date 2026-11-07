import type { Metadata } from "next";
import { TeamHqPanel } from "@/components/workspace/team/TeamHqPanel";
import { requireWorkspaceAccess } from "@/lib/workspace/access";
import { routeMetadata } from "../_scaffold/placeholder";

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  return routeMetadata("team");
}

/**
 * Team HQ: the board header (with real counts), the Crew Lead card and its
 * reviews, the team by status, the blueprint, the launch steps by owner, the
 * skipped roles and "Why this team?". The header is drawn by the panel because
 * its counts come from live data. The gate 404s with the workspace flag off,
 * like every workspace route; the Wren chat is the layout's right-hand column.
 */
export default async function TeamHqPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await requireWorkspaceAccess(projectId);
  return <TeamHqPanel projectId={project._id} businessName={project.name} partnerName={project.partnerName} />;
}
