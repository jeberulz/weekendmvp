import type { Metadata } from "next";
import { LandingPanel } from "@/components/workspace/landing/LandingPanel";
import { requireWorkspaceAccess } from "@/lib/workspace/access";
import { routeMetadata } from "../_scaffold/placeholder";

export const instant = false;
export async function generateMetadata(): Promise<Metadata> {
  return routeMetadata("landing");
}

export default async function LandingPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await requireWorkspaceAccess(projectId);
  return (
    <div className="flex flex-col gap-7">
      <header>
        <h1 className="text-balance font-editorial text-4xl tracking-tight text-home-ink sm:text-5xl">Landing page</h1>
      </header>
      <LandingPanel projectId={project._id} />
    </div>
  );
}
