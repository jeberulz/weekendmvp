import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { EditorialShell, EditorialShellFallback } from "@/components/admin/editorial/shell/EditorialShell";
import { assertEditorialRoutesEnabled } from "@/lib/editorial/runtime/route-guard";
import { getEditorialWorkspace } from "@/lib/editorial/runtime/workspace";

export async function generateMetadata(): Promise<Metadata> {
  assertEditorialRoutesEnabled();
  return {
    // Generic titles only: draft titles never reach the tab title or analytics.
    title: { absolute: "Editorial — Weekend MVP" },
    robots: {
      index: false,
      follow: false,
      noarchive: true,
      nocache: true,
      googleBot: { index: false, follow: false, noarchive: true, noimageindex: true },
    },
    referrer: "no-referrer",
  };
}

export default function EditorialLayout({ children }: { children: ReactNode }) {
  // No live adapter yet (WP46-E4): production answers like any missing page.
  assertEditorialRoutesEnabled();
  return (
    <Suspense fallback={<EditorialShellFallback />}>
      <WorkspaceShell>{children}</WorkspaceShell>
    </Suspense>
  );
}

async function WorkspaceShell({ children }: { children: ReactNode }) {
  // Pages re-check access themselves: a layout never protects its pages alone.
  const workspace = await getEditorialWorkspace();
  if (workspace.status !== "fixture") notFound();
  const [summary, settings] = await Promise.all([
    workspace.repository.getQueueSummary(),
    workspace.repository.getSettings(),
  ]);
  return (
    <EditorialShell
      environment={{
        mode: "fixture",
        connection: "In-memory fixture adapter",
        accountLabel: settings.ok ? `${settings.value.principal.label} (simulated)` : "Unknown account",
      }}
      counts={summary.ok ? { queue: summary.value.needReview, releases: summary.value.releasesNeedingAttention } : null}
    >
      {children}
    </EditorialShell>
  );
}
