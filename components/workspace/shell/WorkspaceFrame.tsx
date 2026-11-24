import type { ReactNode } from "react";
import { WhenConvexReady } from "@/components/platform/client-gates";
import { ErrorReporterMount } from "@/components/workspace/feedback/ErrorReporterMount";
import { FeedbackControl } from "@/components/workspace/feedback/FeedbackControl";
import { WorkspaceFunnel } from "@/components/workspace/feedback/WorkspaceFunnel";
import { WorkspacePageBoundary } from "@/components/workspace/feedback/WorkspacePageBoundary";
import type { Id } from "@/convex/_generated/dataModel";
import { FOCUS } from "@/components/workspace/kit/styles";
import { BusinessSwitcher } from "@/components/workspace/shell/BusinessSwitcher";
import { WorkspaceSidebar } from "@/components/workspace/shell/WorkspaceSidebar";
import type { WorkspaceBusiness } from "@/lib/workspace/businesses";
import type { CreditsSummary } from "@/lib/workspace/credits";

export const MAIN_ID = "workspace-main";

/**
 * Launch-workspace frame: skip link, left nav (disclosure on small screens),
 * business switcher and the credits-card Billing link, the page `children`,
 * and the right-hand chat column (`chat`). Three regions, as on the Dashboard
 * board: nav 240, page canvas (flex), chat 360-380 from `xl` up.
 * Synchronous on purpose: the layout awaits the access gate and the data
 * seams, then hands plain values (and slot elements) in. `children` must be
 * the page's single `<main id="workspace-main">`, which the layout owns. The
 * `chat` slot is mounted once here, so it persists across page navigation.
 * A page sizes itself to the canvas only: it never reserves room for the chat.
 */
export function WorkspaceFrame({
  projectId,
  businesses,
  credits,
  weekendActive = true,
  switcherSubline,
  teamBadge,
  userRow,
  chat,
  children,
}: {
  projectId: string;
  businesses: readonly WorkspaceBusiness[];
  credits: CreditsSummary;
  weekendActive?: boolean;
  /** The current business's switcher sub-line. */
  switcherSubline?: string;
  /** "N need you" inside the Team HQ nav row. */
  teamBadge?: ReactNode;
  /** The footer user row with sign out. */
  userRow?: ReactNode;
  /** The right-hand Wren chat column (its own complementary landmark, which also holds its mobile toggle). */
  chat?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <a
        href={`#${MAIN_ID}`}
        className={`sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-full focus:bg-home-ink focus:px-4 focus:py-2 focus:text-[13px] focus:font-medium focus:text-home-card ${FOCUS}`}
      >
        Skip to main content
      </a>
      <div className="flex min-h-dvh flex-col lg:flex-row">
        <WorkspaceSidebar
          projectId={projectId}
          weekendActive={weekendActive}
          switcher={<BusinessSwitcher currentId={projectId} businesses={businesses} subline={switcherSubline} unlimited={credits.unlimited} />}
          credits={credits}
          teamBadge={teamBadge}
          feedback={<FeedbackControl surface="workspace" projectId={projectId} />}
          userRow={userRow}
        />
        <div className="min-w-0 flex-1">
          <WorkspacePageBoundary>{children}</WorkspacePageBoundary>
        </div>
        {chat}
      </div>
      <WhenConvexReady>
        <ErrorReporterMount />
        <WorkspaceFunnel projectId={projectId as Id<"projects">} />
      </WhenConvexReady>
    </>
  );
}
