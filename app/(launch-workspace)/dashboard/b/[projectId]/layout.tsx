import type { Metadata } from "next";
import { AuthPlatformProvider } from "@/app/AuthPlatformProvider";
import { newsreaderEditorial } from "@/lib/fonts";
import { requireWorkspaceAccess } from "@/lib/workspace/access";

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
 * S2 replaces the bare main landmark below with the new shell.
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
  await requireWorkspaceAccess(projectId);

  return (
    <AuthPlatformProvider fallbackClassName="bg-home-paper">
      <div className={`${newsreaderEditorial.variable} theme-desk min-h-dvh bg-home-paper text-home-ink`}>
        <main id="workspace-main" className="mx-auto w-full max-w-[1080px] px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
          {children}
        </main>
      </div>
    </AuthPlatformProvider>
  );
}
