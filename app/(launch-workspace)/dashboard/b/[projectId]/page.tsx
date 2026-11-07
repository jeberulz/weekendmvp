import type { Metadata } from "next";
import { DashboardPanel } from "@/components/workspace/dashboard/DashboardPanel";
import { requireWorkspaceAccess } from "@/lib/workspace/access";
import { routeMetadata } from "./_scaffold/placeholder";

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  return routeMetadata("");
}

/**
 * The workspace Dashboard: the business name as the h1, the launch banner, the
 * team strip, the reviews waiting on you and what is ready. The header is drawn
 * by the panel because its summary comes from live data. The gate 404s with the
 * workspace flag off, like every workspace route; the Wren chat is the layout's
 * right-hand column.
 */
export default async function DashboardPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await requireWorkspaceAccess(projectId);
  return <DashboardPanel projectId={project._id} businessName={project.name} partnerName={project.partnerName} />;
}
