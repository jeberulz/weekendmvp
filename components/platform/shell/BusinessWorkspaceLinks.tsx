"use client";

import { useQuery } from "convex/react";
import type { ReactNode } from "react";
import { api } from "@/convex/_generated/api";
import { workspacePath } from "@/lib/workspace/routes";
import { QuietErrorBoundary, WhenConvexReady } from "../client-gates";

/** One link into a business workspace, for the desk nav. */
export type BusinessWorkspaceLink = {
  readonly projectId: string;
  readonly href: string;
  /** Visible text, e.g. "Your business: PostureUp". */
  readonly label: string;
};

export function businessLinkLabel(name: string): string {
  return `Your business: ${name}`;
}

export function businessWorkspaceLinks(
  businesses: readonly { readonly projectId: string; readonly name: string }[],
): BusinessWorkspaceLink[] {
  return businesses.map((business) => ({
    projectId: business.projectId,
    href: workspacePath(business.projectId),
    label: businessLinkLabel(business.name),
  }));
}

function Links({ children }: { children: (links: readonly BusinessWorkspaceLink[]) => ReactNode }) {
  const businesses = useQuery(api.workspace.access.myBusinesses, {});
  if (businesses === undefined || businesses.length === 0) return null;
  return <>{children(businessWorkspaceLinks(businesses))}</>;
}

/**
 * L1-C5b — the desk's way back into each business workspace
 * (`/dashboard/b/{projectId}`). Dormant-safe: `myBusinesses` reads `[]` when
 * the workspace is off for the caller, signed out or with no business, and
 * then nothing renders. Absent while loading and on error (a nav extra must
 * never take the page down). The caller renders the rows in its own nav style.
 */
export function BusinessWorkspaceLinks({ children }: { children: (links: readonly BusinessWorkspaceLink[]) => ReactNode }) {
  return (
    <WhenConvexReady>
      <QuietErrorBoundary>
        <Links>{children}</Links>
      </QuietErrorBoundary>
    </WhenConvexReady>
  );
}
