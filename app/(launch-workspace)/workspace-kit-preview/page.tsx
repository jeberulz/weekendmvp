import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WorkspaceFrame } from "@/components/workspace/shell";
import { newsreaderEditorial } from "@/lib/fonts";
import { KitPreviewClient } from "./KitPreviewClient";

/**
 * WP72-S4 dev-only preview of the workspace kit and shell, so the browser
 * accessibility check has something to drive. Mock data only: no Convex, no
 * auth, no network. It sits outside `/dashboard` so the middleware does not
 * redirect it to login, and answers 404 everywhere except `next dev`.
 */
export const metadata: Metadata = {
  title: "Workspace kit preview",
  robots: { index: false, follow: false, noarchive: true, nocache: true },
};

const PROJECT_ID = "kit-preview";
const BUSINESSES = [{ id: PROJECT_ID, name: "HydroTrail" }] as const;
const CREDITS = { balance: 48, max: 50, plan: "free" } as const;

export default function WorkspaceKitPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();

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
