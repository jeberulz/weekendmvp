import type { Metadata } from "next";
import { FilesRail } from "@/components/workspace/files/FilesRail";
import { WrenMemoryPanel } from "@/components/workspace/files/WrenMemoryPanel";
import { WorkspacePageHeader } from "@/components/workspace/kit";
import { requireWorkspaceAccess } from "@/lib/workspace/access";
import { routeMetadata } from "../_scaffold/placeholder";

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  return routeMetadata("files");
}

/**
 * WP77-S5 / L1: Files shows "What Wren knows" (Wren's memory: a summary and facts the founder can edit or
 * delete) in a two-pane browser. The rail lists only real entries. Uploaded business files are a later story.
 * The gate 404s with the workspace flag off, like every workspace route.
 */
export default async function FilesPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await requireWorkspaceAccess(projectId);
  const name = project.partnerName ?? "Wren";
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <WorkspacePageHeader
        eyebrow="Files"
        lead={`What ${name} knows,`}
        tail="in plain text you can edit."
        summary={`${name} keeps a short summary and a few facts about your business so each chat stays focused. They are notes in plain text, never instructions. Edit or delete anything that is wrong or out of date.`}
      />
      <div className="flex min-w-0 flex-col gap-5 min-[900px]:flex-row min-[900px]:items-start">
        <FilesRail projectId={project._id} name={name} />
        <WrenMemoryPanel projectId={project._id} name={name} />
      </div>
    </div>
  );
}
