import type { Metadata } from "next";
import { TENANT_FONTS } from "@/components/tenant-site/fonts";
import { BrandKitPanel } from "@/components/workspace/brand/BrandKitPanel";
import { WorkspacePageHeader } from "@/components/workspace/kit";
import { requireWorkspaceAccess } from "@/lib/workspace/access";
import { routeMetadata } from "../_scaffold/placeholder";

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  return routeMetadata("brand");
}

/**
 * L1 Brand kit page: the review first, then the brand board and the Brand Book.
 * The header is server-rendered from the project name, so it does not wait on the client query.
 * The tenant font map is read here, on the server: next/font loaders cannot run in a client module.
 * The gate 404s with the workspace flag off, like every workspace route.
 */
export default async function BrandKitPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await requireWorkspaceAccess(projectId);
  return (
    <div className="flex min-w-0 flex-col gap-8">
      <WorkspacePageHeader eyebrow="Brand kit" lead={`${project.name},`} tail="dressed for launch." />
      <BrandKitPanel projectId={project._id} fonts={TENANT_FONTS} />
    </div>
  );
}
