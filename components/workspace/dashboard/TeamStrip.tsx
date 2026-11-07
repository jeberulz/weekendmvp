import Link from "next/link";
import { EmployeeAvatar } from "@/components/workspace/kit/EmployeeAvatar";
import { EmptyState } from "@/components/workspace/kit/states";
import { FOCUS } from "@/components/workspace/kit/styles";
import { cn } from "@/lib/utils";
import { teamCounts, teamHeadingTail, type DashHired, type DashReview } from "@/lib/workspace/dashboard";
import { workspacePath } from "@/lib/workspace/routes";

/**
 * "Your team · 9 on it, 4 need you": the hired roles from `launchStatus`. The
 * chips are not links (a specialist page is Coming soon) and carry no status
 * (the backend gives none per person); the link goes to Team HQ.
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
            <li
              key={member.role}
              className="flex min-h-10 items-center gap-2 rounded-full border border-home-rule bg-home-paper py-1 pl-1 pr-3"
            >
              <EmployeeAvatar name={member.name} role={member.role} size="md" />
              <span className="text-[13px] font-medium text-home-ink">{member.roleLabel}</span>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState>{message ?? "Your team will show here once it is written."}</EmptyState>
      )}
    </section>
  );
}
