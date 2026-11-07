import type { Metadata } from "next";
import { TeamHqPanel } from "@/components/workspace/team/TeamHqPanel";
import { requireWorkspaceAccess } from "@/lib/workspace/access";
import { workspaceRoute } from "@/lib/workspace/routes";
import { routeMetadata } from "../_scaffold/placeholder";

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  return routeMetadata("team");
}

/**
 * L1-C6: Team HQ lists every review waiting on the founder and shows the
 * blueprint to review. The gate 404s with the workspace flag off, like every
 * workspace route.
 */
export default async function TeamHqPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await requireWorkspaceAccess(projectId);
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-home-ink-3">{project.name}</p>
        <h1 className="font-editorial text-[34px] font-normal leading-[1.05] tracking-[-0.025em] text-home-ink sm:text-[42px]">
          {workspaceRoute("team").label}
        </h1>
      </header>
      <TeamHqPanel projectId={project._id} />
    </div>
  );
}
