import type { Metadata } from "next";
import { WrenMemoryPanel } from "@/components/workspace/files/WrenMemoryPanel";
import { requireWorkspaceAccess } from "@/lib/workspace/access";
import { workspaceRoute } from "@/lib/workspace/routes";
import { routeMetadata } from "../_scaffold/placeholder";

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  return routeMetadata("files");
}

/**
 * WP77-S5: Files shows "What Wren knows" (Wren's memory: a summary and facts
 * the founder can edit or delete). Uploaded business files (`business_files`)
 * are a later story. The gate 404s with the workspace flag off, like every
 * workspace route.
 */
export default async function FilesPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await requireWorkspaceAccess(projectId);
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-home-ink-3">{project.name}</p>
        <h1 className="font-editorial text-[34px] font-normal leading-[1.05] tracking-[-0.025em] text-home-ink sm:text-[42px]">
          {workspaceRoute("files").label}
        </h1>
      </header>
      <WrenMemoryPanel projectId={project._id} />
    </div>
  );
}
