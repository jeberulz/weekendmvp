import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { EmployeeAvatar } from "@/components/workspace/kit/EmployeeAvatar";
import { EYEBROW_EMBER, FOCUS } from "@/components/workspace/kit/styles";
import { WORKSPACE_HEADING_ID } from "@/components/workspace/kit/WorkspacePageHeader";
import { cn } from "@/lib/utils";
import type { EmployeeProfile } from "@/lib/workspace/employeePage";
import { workspacePath } from "@/lib/workspace/routes";

/**
 * WP67 employee page header, server-rendered: the crumb back to Team HQ, the
 * avatar, "Iris · Brand" as the page's one h1, what they do and who they
 * report to. Everything here is static (the role catalogue and the lead's
 * name), so it renders before any live data.
 */
export function EmployeeHeader({
  projectId,
  businessName,
  lead,
  profile,
}: {
  projectId: string;
  businessName: string;
  lead: string;
  profile: EmployeeProfile;
}) {
  return (
    <header className="flex flex-col gap-4">
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1 text-[13px] text-home-ink-2">
          <li>
            <Link
              href={workspacePath(projectId, "team")}
              className={cn("inline-flex min-h-6 items-center underline underline-offset-2 hover:text-home-ink", FOCUS)}
            >
              Team HQ
            </Link>
          </li>
          <li aria-hidden="true">
            <ChevronRight className="size-3.5" />
          </li>
          <li>
            <span aria-current="page">
              {profile.name} · {profile.roleLabel}
            </span>
          </li>
        </ol>
      </nav>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <EmployeeAvatar name={profile.name} role={profile.role} size="xl" showAiBadge />
        <div className="min-w-0 flex-1 basis-[18rem]">
          <p className={cn(EYEBROW_EMBER, "mb-1.5")}>AI employee · {businessName}</p>
          <h1
            id={WORKSPACE_HEADING_ID}
            className="font-editorial text-[34px] font-normal leading-[1.1] tracking-[-0.02em] text-home-ink sm:text-[40px]"
          >
            {profile.name} · <em className="italic">{profile.roleLabel}</em>
          </h1>
        </div>
      </div>
      <div className="flex max-w-[640px] flex-col gap-1 text-[15px] text-home-ink-2">
        <p>{profile.does}</p>
        <p className="text-[13px]">
          Reports to <strong className="font-semibold text-home-ink">{lead}, Crew Lead</strong>, who routes every
          review to you.
        </p>
      </div>
    </header>
  );
}
