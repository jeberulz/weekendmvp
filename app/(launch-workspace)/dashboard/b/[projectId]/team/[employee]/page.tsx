import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmployeeHeader } from "@/components/workspace/team/employee/EmployeeHeader";
import { EmployeePanel } from "@/components/workspace/team/employee/EmployeePanel";
import { EmployeeResponsibilities } from "@/components/workspace/team/employee/EmployeeResponsibilities";
import { requireWorkspaceAccess } from "@/lib/workspace/access";
import { employeeProfile } from "@/lib/workspace/employeePage";
import { isSpecialistRoleKey } from "@/lib/workspace/employees";
import { workspaceEmployee } from "@/lib/workspace/routes";
import { workspacePageMetadata } from "../../_scaffold/placeholder";

type Params = Promise<{ projectId: string; employee: string }>;

export const instant = false;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const employee = workspaceEmployee((await params).employee);
  return workspacePageMetadata(employee ? `${employee.employeeName} · ${employee.label}` : "Team HQ");
}

/**
 * WP67 employee page (`docs/wp/employee-pages/BRIEF.md`). The header and "the
 * job, in full" are server-rendered from the role catalogue; status, reviews,
 * launch steps, drafts and the activity trail are live and owner-scoped. Unknown
 * role keys, and the Crew Lead (who is the chat, not a page), are a 404. The
 * gate 404s with the workspace flag off, like every workspace route.
 */
export default async function EmployeePage({ params }: { params: Params }) {
  const { projectId, employee: employeeKey } = await params;
  const project = await requireWorkspaceAccess(projectId);
  if (!isSpecialistRoleKey(employeeKey) || workspaceEmployee(employeeKey) === null) notFound();
  const profile = employeeProfile(employeeKey);
  // The same name the layout gives the Wren chat column.
  const lead = project.partnerName ?? "Wren";
  return (
    <div className="flex flex-col gap-8">
      <EmployeeHeader projectId={project._id} businessName={project.name} lead={lead} profile={profile} />
      <EmployeePanel
        projectId={project._id}
        role={employeeKey}
        businessName={project.name}
        lead={lead}
        job={<EmployeeResponsibilities profile={profile} lead={lead} />}
      />
    </div>
  );
}
