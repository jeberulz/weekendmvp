import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AI_COSTS_BASE, ConsoleFallback, ConsoleShell, focusRing } from "@/components/admin/ai-costs/ConsoleShell";
import { CsvButton } from "@/components/admin/ai-costs/interactive";
import { RangeNotices } from "@/components/admin/ai-costs/RangeNotices";
import { PageTitle, Section, StatusBadge, TableRegion, td, tdNum, th, thNum } from "@/components/admin/ai-costs/primitives";
import { readCapOverrides } from "@/lib/admin/ai-costs/controls-server";
import { foundersCsv } from "@/lib/admin/ai-costs/exports";
import { formatCount, formatUsd } from "@/lib/admin/ai-costs/money";
import { PLAN_LABELS, formatUtc } from "@/lib/admin/ai-costs/labels";
import { parseRange } from "@/lib/admin/ai-costs/ranges";
import { loadRangeView } from "@/lib/admin/ai-costs/server";
import { assertEditorialRoutesEnabled } from "@/lib/editorial/runtime/route-guard";
import { cn } from "@/lib/utils";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata(): Promise<Metadata> {
  assertEditorialRoutesEnabled();
  return { title: { absolute: "Founders — AI costs" } };
}

export default function AiCostsFoundersPage({ searchParams }: { searchParams: SearchParams }) {
  assertEditorialRoutesEnabled();
  return (
    <Suspense fallback={<ConsoleFallback />}>
      <Founders searchParams={searchParams} />
    </Suspense>
  );
}

function capTone(spent: number, cap: number): "good" | "warning" | "critical" {
  if (cap <= 0) return "critical";
  const rate = spent / cap;
  return rate >= 1 ? "critical" : rate >= 0.8 ? "warning" : "good";
}

async function Founders({ searchParams }: { searchParams: SearchParams }) {
  const rangeId = parseRange((await searchParams).range);
  const view = await loadRangeView(rangeId);
  const rows = view.founders;
  const day = view.range.dayKeys.at(-1);
  // Phase 3: founders whose daily cap is raised right now.
  const { caps } = await readCapOverrides(view.mode, rows.flatMap((row) => (row.ownerId === null ? [] : [row.ownerId])));
  const raised = new Map(caps.overrides.map((override) => [override.ownerId, override]));

  return (
    <ConsoleShell mode={view.mode} active="founders" range={rangeId}>
      <PageTitle
        title="Founders"
        description="One row per founder who used AI in the range, biggest spender first, plus ownerless platform work. Emails are shown to the super admin only. Open a founder for their call timeline (metadata only)."
      />
      <RangeNotices view={view} />
      <Section
        id="founders-table"
        title="Spend per founder"
        description="Today and lifetime figures come from the meter's own budget row for each founder."
        actions={<CsvButton filename={`ai-costs-founders-${rangeId}-${day}.csv`} csv={foundersCsv(rows)} label="Export CSV" />}
      >
        {rows.length === 0 ? <p className="text-sm text-(--ed-text-2)">No AI calls in this range.</p> : (
          <TableRegion labelledBy="founders-table">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th scope="col" className={th}>Founder</th>
                  <th scope="col" className={th}>Plan</th>
                  <th scope="col" className={thNum}>Spend in range</th>
                  <th scope="col" className={th}>Today vs daily cap</th>
                  <th scope="col" className={th}>Lifetime free vs $1.50</th>
                  <th scope="col" className={thNum}>Businesses</th>
                  <th scope="col" className={thNum}>Launches</th>
                  <th scope="col" className={thNum}>Wren messages</th>
                  <th scope="col" className={thNum}>Failures</th>
                  <th scope="col" className={th}>Last active</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const summary = row.summary;
                  const href = `${AI_COSTS_BASE}/founders/${row.ownerId ?? "platform"}`;
                  const name = row.ownerId === null ? "Platform (ownerless work)" : summary?.email ?? "No email on account";
                  const override = row.ownerId === null ? undefined : raised.get(row.ownerId);
                  const cap = override?.capMicroUsd ?? summary?.dayCapMicroUsd ?? 0;
                  return (
                    <tr key={row.ownerId ?? "platform"}>
                      <th scope="row" className={`${td} text-left font-normal`}>
                        <Link href={href} className={cn("font-medium underline underline-offset-2", focusRing)}>
                          {name}
                          <span className="sr-only">: open the call timeline</span>
                        </Link>
                        {summary && !summary.inCohort ? <span className="block text-xs text-(--ed-text-2)">Not in the beta cohort</span> : null}
                      </th>
                      <td className={td}>{PLAN_LABELS[row.plan]}</td>
                      <td className={tdNum}>{formatUsd(row.chargedMicroUsd)}</td>
                      <td className={td}>
                        {summary ? (<>
                          <span className="flex items-center gap-2 tabular-nums">
                            {formatUsd(summary.daySpentMicroUsd)} of {formatUsd(cap)}
                            {capTone(summary.daySpentMicroUsd, cap) === "critical"
                              ? <StatusBadge tone="critical">At cap</StatusBadge>
                              : capTone(summary.daySpentMicroUsd, cap) === "warning"
                                ? <StatusBadge tone="warning">Past 80%</StatusBadge>
                                : null}
                          </span>
                          {override ? (
                            <span className="block text-xs text-(--ed-text-2)">
                              Raised until {formatUtc(override.expiresAt)} (plan cap {formatUsd(summary.dayCapMicroUsd)})
                            </span>
                          ) : null}
                        </>) : <span className="text-(--ed-text-2)">—</span>}
                      </td>
                      <td className={td}>
                        {summary && summary.plan === "free" ? (
                          <span className="flex items-center gap-2 tabular-nums">
                            {formatUsd(summary.freeLifetimeSpentMicroUsd)} of {formatUsd(summary.freeLifetimeCeilingMicroUsd)}
                            {capTone(summary.freeLifetimeSpentMicroUsd, summary.freeLifetimeCeilingMicroUsd) === "critical"
                              ? <StatusBadge tone="critical">Ceiling reached</StatusBadge>
                              : capTone(summary.freeLifetimeSpentMicroUsd, summary.freeLifetimeCeilingMicroUsd) === "warning"
                                ? <StatusBadge tone="warning">Past 80%</StatusBadge>
                                : null}
                          </span>
                        ) : <span className="text-(--ed-text-2)">{summary ? "Paid plan" : "—"}</span>}
                      </td>
                      <td className={tdNum}>{summary ? `${formatCount(summary.businesses)}${summary.businessesTruncated ? "+" : ""}` : "—"}</td>
                      <td className={tdNum}>{summary ? formatCount(summary.launches) : "—"}</td>
                      <td className={tdNum}>{formatCount(row.wrenMessages)}</td>
                      <td className={tdNum}>{formatCount(row.failed)}<span className="block text-xs text-(--ed-text-2)">of {formatCount(row.calls)}</span></td>
                      <td className={td}>{formatUtc(summary?.lastActiveAt ?? row.lastCallAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableRegion>
        )}
      </Section>
    </ConsoleShell>
  );
}
