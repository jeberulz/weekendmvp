import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WorkspaceFrame } from "@/components/workspace/shell";
import { newsreaderEditorial } from "@/lib/fonts";

/**
 * WP72-S4 dev-only preview of the workspace kit and shell, so the browser
 * accessibility check has something to drive. The page itself uses mock data
 * only: no Convex, no auth, no network (the root layout still mounts its own
 * providers and scripts). It sits outside `/dashboard` so the middleware does
 * not redirect it to login, and answers 404 everywhere except `next dev`.
 *
 * The client preview and its fixtures are imported dynamically inside the
 * development branch only, so the inlined production `NODE_ENV` removes them
 * from the production build, and the production metadata is neutral.
 */
export function generateMetadata(): Metadata {
  const robots = { index: false, follow: false, noarchive: true, nocache: true };
  if (process.env.NODE_ENV === "development") {
    return { title: "Workspace kit preview", robots };
  }
  return { robots };
}

const PROJECT_ID = "kit-preview";
const BUSINESSES = [{ id: PROJECT_ID, name: "HydroTrail" }] as const;
const CREDITS = { balance: 48, max: 50, plan: "free" } as const;

export default async function WorkspaceKitPreviewPage() {
  if (process.env.NODE_ENV === "development") {
    const { KitPreviewClient } = await import("./KitPreviewClient");
    return (
      <div className={`${newsreaderEditorial.variable} theme-desk min-h-dvh bg-home-paper text-home-ink`}>
        <WorkspaceFrame projectId={PROJECT_ID} businesses={BUSINESSES} credits={CREDITS}>
          <main
            id="workspace-main"
            tabIndex={-1}
            className="mx-auto w-full max-w-[1080px] px-5 py-8 focus:outline-none sm:px-8 lg:px-10 lg:py-10"
          >
            <KitPreviewClient />
          </main>
        </WorkspaceFrame>
      </div>
    );
  }
  notFound();
}
