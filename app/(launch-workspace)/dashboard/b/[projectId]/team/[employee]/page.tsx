import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireWorkspaceAccess } from "@/lib/workspace/access";
import { workspaceEmployee } from "@/lib/workspace/routes";
import { PlaceholderBody, workspacePageMetadata } from "../../_scaffold/placeholder";

type Params = Promise<{ projectId: string; employee: string }>;

export const instant = false;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const employee = workspaceEmployee((await params).employee);
  return workspacePageMetadata(employee ? `${employee.employeeName} · ${employee.label}` : "Team HQ");
}

/**
 * One specialist's workstream (extract §4 WorkstreamPanel). Unknown role keys
 * are a 404. L1-C2: Team pages beyond the roster are coming soon.
 */
export default async function EmployeeWorkstreamPage({ params }: { params: Params }) {
  const { projectId, employee: employeeKey } = await params;
  const project = await requireWorkspaceAccess(projectId);
  const employee = workspaceEmployee(employeeKey);
  if (employee === null) notFound();
  return (
    <PlaceholderBody
      eyebrow={`AI employee · ${project.name} workstream`}
      heading={`${employee.employeeName} · ${employee.label}`}
      comingSoon
      emptyState={`This page will show ${employee.employeeName}'s work for your business.`}
    />
  );
}
