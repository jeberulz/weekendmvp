import type { Metadata } from "next";

import { ProjectWorkspace } from "@/components/platform/projects/ProjectWorkspace";

export const metadata: Metadata = {
  title: "Project | Workspace",
  robots: { index: false, follow: false },
};

// Project identity is runtime-only. Blocking here keeps global consent/auth
// client hooks out of static prerendering for arbitrary project IDs.
export const instant = false;

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return (
    <section aria-label="Project workspace" className="min-h-full px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
      <ProjectWorkspace projectId={projectId} />
    </section>
  );
}
