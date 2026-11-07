"use client";

import Link from "next/link";
import { useState } from "react";
import { EmployeeCard } from "@/components/workspace/kit/EmployeeCard";
import { EmptyState } from "@/components/workspace/kit/states";
import { FOCUS } from "@/components/workspace/kit/styles";
import { SectionHeading } from "@/components/workspace/team/SectionHeading";
import { cn } from "@/lib/utils";
import { employeeHref } from "@/lib/workspace/employeePage";
import {
  applyFilter,
  FILTER_LABELS,
  filterEmptyCopy,
  filterStatusLine,
  headCounts,
  roleSpecialty,
  visibleFilters,
  workstreamFor,
  type EmployeeStatusEntry,
  type TeamFilter,
} from "@/lib/workspace/teamHq";

/**
 * "The team, by status." One card per specialist (the lead has its own card),
 * filterable by status. The filter is a group of toggle buttons (`aria-pressed`,
 * one on at a time); the count line is a polite live region. The grid sizes its
 * columns from the space it has, so it fits the narrower column beside the chat.
 */
export function TeamGrid({
  projectId,
  businessName,
  lead,
  specialists,
}: {
  projectId: string;
  businessName: string;
  lead: string;
  specialists: readonly EmployeeStatusEntry[];
}) {
  const [filter, setFilter] = useState<TeamFilter>("all");
  const counts = headCounts(specialists);
  const filters = visibleFilters(counts);
  // If the chosen filter's group empties (a status changed), show everyone rather than a dead filter.
  const active: TeamFilter = filters.includes(filter) ? filter : "all";
  const shown = applyFilter(specialists, active);
  return (
    <section aria-labelledby="team-h" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionHeading
          id="team-h"
          eyebrow={`${specialists.length} ${specialists.length === 1 ? "specialist" : "specialists"} · hired for ${businessName}`}
          lead="The team,"
          tail="by status."
        />
        <div role="group" aria-label="Filter specialists by status" className="flex flex-wrap gap-1.5">
          {filters.map((key) => {
            const on = key === active;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={on}
                onClick={() => setFilter(key)}
                className={cn(
                  "inline-flex min-h-[38px] items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium",
                  FOCUS,
                  on
                    ? "border-home-ink bg-home-ink text-home-card"
                    : "border-home-rule bg-home-card text-home-ink hover:bg-home-sunk",
                )}
              >
                {FILTER_LABELS[key]}
                <span className="font-mono font-normal">{counts[key === "all" ? "all" : key]}</span>
              </button>
            );
          })}
        </div>
      </div>
      <p role="status" className="text-[13px] text-home-ink-3">
        {filterStatusLine(shown.length, specialists.length, active)}
      </p>
      {shown.length === 0 ? (
        <EmptyState className="border-dashed">{filterEmptyCopy(active, lead)}</EmptyState>
      ) : (
        <ul
          aria-label="Specialists"
          className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,236px),1fr))] gap-3.5"
        >
          {shown.map((entry) => (
            <EmployeeCard
              key={entry.role}
              employee={{
                id: entry.role,
                name: entry.name,
                role: entry.role,
                specialty: roleSpecialty(entry.role),
                status: entry.status,
                statusDetail: entry.detail,
                blocker: entry.blocker,
              }}
              workstream={workstreamFor(entry.role, projectId)}
              profileHref={employeeHref(projectId, entry.role)}
              autopilot={null}
              linkComponent={Link}
            />
          ))}
        </ul>
      )}
      <p className="rounded-[10px] bg-home-sunk px-3.5 py-2.5 text-[13px] text-home-ink-2">
        <strong className="font-semibold text-home-ink">Specialists draft; you decide.</strong> Nothing sends, posts or
        spends without your OK.
      </p>
    </section>
  );
}
