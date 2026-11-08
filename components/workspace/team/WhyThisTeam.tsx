"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FOCUS, PILL_BASE } from "@/components/workspace/kit/styles";
import { cn } from "@/lib/utils";
import { employeeHref } from "@/lib/workspace/employeePage";
import { whyRows, type TeamHired, type TeamSkipped, type WhyDecision } from "@/lib/workspace/teamHq";

export const WHY_THIS_TEAM_ID = "why-this-team";

const DECISION_STYLES: Readonly<Record<WhyDecision, string>> = {
  core: "border-home-sage-ink/30 bg-home-sage text-home-sage-ink",
  lead: "border-home-orange-ink/30 bg-home-ember-soft text-home-orange-ink",
  added: "border-home-orange-ink/30 bg-home-ember-soft text-home-orange-ink",
  skipped: "border-home-rule bg-home-sunk text-home-ink-2",
};

/** The role, linked to its page (WP67) unless it is the Crew Lead, who has none. */
function RoleName({ href, label }: { href: string | null; label: string }) {
  if (href === null) return <>{label}</>;
  return <Link href={href} className={cn("underline underline-offset-2", FOCUS)}>{label}</Link>;
}

/**
 * "Why this team?": every role the lead decided on, hired or skipped, with its
 * reason, from the roster. It is a disclosure (`details`). The header's link
 * (`#why-this-team`) opens it, whether the hash changes or the same link is
 * clicked again.
 */
export function WhyThisTeam({ projectId, hired, skipped }: { projectId: string; hired: readonly TeamHired[]; skipped: readonly TeamSkipped[] }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const openIfTargeted = () => {
      if (window.location.hash === `#${WHY_THIS_TEAM_ID}`) setOpen(true);
    };
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest(`a[href="#${WHY_THIS_TEAM_ID}"]`) !== null) setOpen(true);
    };
    openIfTargeted();
    window.addEventListener("hashchange", openIfTargeted);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("hashchange", openIfTargeted);
      document.removeEventListener("click", onClick);
    };
  }, []);

  const rows = whyRows(hired, skipped);
  return (
    <details
      id={WHY_THIS_TEAM_ID}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="scroll-mt-6 rounded-xl border border-home-rule bg-home-card"
    >
      <summary className="min-h-11 cursor-pointer px-5 py-3 font-editorial text-xl text-home-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink">
        Why this team?
      </summary>
      <div className="px-5 pb-5">
        <table className="w-full table-fixed border-collapse text-left text-[13px]">
          <caption className="sr-only">Each role, whether it was hired or skipped, and why</caption>
          <thead>
            <tr className="text-[11px] uppercase tracking-[0.14em] text-home-ink-3">
              <th scope="col" className="w-[28%] py-2 pr-2 font-medium">Role</th>
              <th scope="col" className="w-[28%] py-2 pr-2 font-medium">Decision</th>
              <th scope="col" className="py-2 font-medium">Why</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.role} className="border-t border-home-rule align-top">
                <th scope="row" className="break-words py-2.5 pr-2 font-medium text-home-ink">
                  <RoleName href={employeeHref(projectId, row.role)} label={row.roleLabel} />
                </th>
                <td className="py-2.5 pr-2">
                  <span className={cn(PILL_BASE, "border", DECISION_STYLES[row.decision])}>{row.label}</span>
                </td>
                <td className="break-words py-2.5 text-home-ink-2">{row.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
