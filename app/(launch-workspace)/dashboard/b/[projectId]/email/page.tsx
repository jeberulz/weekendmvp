import type { Metadata } from "next";
import { EmailSequencePanel } from "@/components/workspace/email/EmailSequencePanel";
import { WorkspacePageHeader } from "@/components/workspace/kit";
import { requireWorkspaceAccess } from "@/lib/workspace/access";
import { EMAIL_HEADER } from "@/lib/workspace/emailPage";
import { routeMetadata } from "../_scaffold/placeholder";

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  return routeMetadata("email");
}

/**
 * WP76-S1b: Email shows the crew's four-email sequence draft and lets the
 * founder approve it or ask for changes. Nothing sends here (WP79 activates
 * sending). The gate 404s with the workspace flag off, like every workspace route.
 */
export default async function EmailPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await requireWorkspaceAccess(projectId);
  return (
    <div className="flex flex-col gap-7">
      <WorkspacePageHeader eyebrow="Email" lead={EMAIL_HEADER.lead} tail={EMAIL_HEADER.tail} />
      <EmailSequencePanel projectId={project._id} />
    </div>
  );
}
