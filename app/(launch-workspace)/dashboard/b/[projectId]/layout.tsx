import type { Metadata } from "next";
import { AuthPlatformProvider } from "@/app/AuthPlatformProvider";
import { WorkspaceFrame } from "@/components/workspace/shell";
import { newsreaderEditorial } from "@/lib/fonts";
import { requireWorkspaceAccess } from "@/lib/workspace/access";
import { listBusinesses } from "@/lib/workspace/businesses";
import { getCreditsSummary } from "@/lib/workspace/credits";

/**
 * WP72 launch-workspace layout for `/dashboard/b/[projectId]/*`.
 *
 * It lives in the `(launch-workspace)` route group, so the URL stays
 * `/dashboard/b/...` while the legacy `app/dashboard/layout.tsx` (and its
 * `WorkspaceShell`) does not wrap these pages. That layout is therefore not an
 * ancestor here, so this one restates its private robots policy.
 *
 * Dormant: `requireWorkspaceAccess` answers 404 unless the workspace flag is
 * on for the caller's cohort and the caller owns the business. Layouts render
 * in parallel with pages, so every page calls the same (request-cached) gate.
 * S2 mounts the shell (nav, switcher, credit meter) after the gate; the page
 * main landmark stays here so there is exactly one.
 */
export const metadata: Metadata = {
  title: { template: "%s | Workspace", default: "Workspace" },
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noarchive: true,
      noimageindex: true,
    },
  },
};

export const instant = false;

export default async function LaunchWorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = await requireWorkspaceAccess(projectId);
  const credits = await getCreditsSummary(project._id);
  const businesses = listBusinesses({ id: project._id, name: project.name });

  return (
    <AuthPlatformProvider fallbackClassName="bg-home-paper">
      <div className={`${newsreaderEditorial.variable} theme-desk min-h-dvh bg-home-paper text-home-ink`}>
        <WorkspaceFrame projectId={project._id} businesses={businesses} credits={credits}>
          <main
            id="workspace-main"
            tabIndex={-1}
            className="mx-auto w-full max-w-[1080px] px-5 py-8 focus:outline-none sm:px-8 lg:px-10 lg:py-10"
          >
            {children}
          </main>
        </WorkspaceFrame>
      </div>
    </AuthPlatformProvider>
  );
}
