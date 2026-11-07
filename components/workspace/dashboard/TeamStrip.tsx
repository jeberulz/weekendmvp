import Link from "next/link";
import { EmployeeLink } from "@/components/workspace/kit/EmployeeLink";
import { EmptyState } from "@/components/workspace/kit/states";
import { FOCUS } from "@/components/workspace/kit/styles";
import { cn } from "@/lib/utils";
import { employeeHref } from "@/lib/workspace/employeePage";
import { teamCounts, teamHeadingTail, type DashHired, type DashReview } from "@/lib/workspace/dashboard";
import { workspacePath } from "@/lib/workspace/routes";

/**
 * "Your team · 9 on it, 4 need you": the hired roles from `launchStatus`. Each
 * specialist's chip is one link to their page (WP67); the Crew Lead's chip
 * stays plain (no page). The chips carry no status; Team HQ has it.
 */
export function TeamStrip({
  projectId,
  hired,
  reviews,
  message,
}: {
  projectId: string;
  hired: readonly DashHired[];
  reviews: readonly Pick<DashReview, "kind">[];
  /** When there is no team to show, why (not started, assembling, failed). */
  message?: string;
}) {
  const counts = teamCounts(hired, reviews);
  return (
    <section aria-labelledby="team-h" className="flex flex-col gap-3 rounded-[10px] border border-home-rule bg-home-card px-4 py-4 @md:px-[18px]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="team-h" className="font-editorial text-[22px] font-normal text-home-ink">
          Your team
          {hired.length > 0 ? (
            <>
              {" "}
              <em className="italic">· {teamHeadingTail(counts)}</em>
            </>
          ) : null}
        </h2>
        <Link
          href={workspacePath(projectId, "team")}
          className={cn("inline-flex min-h-6 items-center text-[13px] text-home-orange-ink underline underline-offset-2 hover:text-home-ink", FOCUS)}
        >
          Open Team HQ
        </Link>
      </div>
      {hired.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {hired.map((member) => (
            <li key={member.role}>
              <EmployeeLink
                href={employeeHref(projectId, member.role)}
                name={member.name}
                role={member.role}
                size="md"
                linkComponent={Link}
                className="min-h-10 gap-2 rounded-full border border-home-rule bg-home-paper py-1 pl-1 pr-3"
              >
                <span className="text-[13px] font-medium text-home-ink">
                  <span className="sr-only">{member.name}, </span>
                  {member.roleLabel}
                </span>
              </EmployeeLink>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState>{message ?? "Your team will show here once it is written."}</EmptyState>
      )}
    </section>
  );
}
