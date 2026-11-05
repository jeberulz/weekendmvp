import type { ReactNode } from "react";
import { FOCUS } from "@/components/workspace/kit/styles";
import { BusinessSwitcher } from "@/components/workspace/shell/BusinessSwitcher";
import { WorkspaceSidebar } from "@/components/workspace/shell/WorkspaceSidebar";
import type { WorkspaceBusiness } from "@/lib/workspace/businesses";
import type { CreditsSummary } from "@/lib/workspace/credits";

export const MAIN_ID = "workspace-main";

/**
 * WP72-S2 launch-workspace frame: skip link, left nav (disclosure on small
 * screens), business switcher and the credits-card Billing link around the page `children`.
 * Synchronous on purpose: the layout awaits the access gate and the data
 * seams, then hands plain values in. `children` must be the page's single
 * `<main id="workspace-main">`, which the layout owns.
 */
export function WorkspaceFrame({
  projectId,
  businesses,
  credits,
  weekendActive = true,
  children,
}: {
  projectId: string;
  businesses: readonly WorkspaceBusiness[];
  credits: CreditsSummary;
  weekendActive?: boolean;
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
          switcher={<BusinessSwitcher currentId={projectId} businesses={businesses} />}
          credits={credits}
        />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </>
  );
}
