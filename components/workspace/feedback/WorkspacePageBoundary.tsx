"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ReportingBoundary } from "@/components/workspace/feedback/ReportingBoundary";
import { WorkspaceCrash } from "@/components/workspace/feedback/WorkspaceCrash";

/**
 * The page area's error boundary (WP95-S3). A crashed page is reported, then
 * replaced by `WorkspaceCrash` inside the shell; moving to another page clears it.
 */
export function WorkspacePageBoundary({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <ReportingBoundary resetKey={pathname} fallback={(reset) => <WorkspaceCrash reset={reset} />}>
      {children}
    </ReportingBoundary>
  );
}
