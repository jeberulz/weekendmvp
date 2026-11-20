import type { Metadata } from "next";
import { Suspense } from "react";

import { DailySpendChart, LaunchCostStrip } from "@/components/admin/ai-costs/charts";
import { ConsoleFallback, ConsoleShell } from "@/components/admin/ai-costs/ConsoleShell";
import { BudgetMeter } from "@/components/admin/ai-costs/figures";
import { RangeNotices } from "@/components/admin/ai-costs/RangeNotices";
import {
  Card,
  Notice,
  PageTitle,
  Section,
  StatGrid,
  StatTile,
  StatusBadge,
  TableRegion,
  td,
  tdNum,
  th,
  thNum,
} from "@/components/admin/ai-costs/primitives";
import { formatCount, formatPercent, formatUsd } from "@/lib/admin/ai-costs/money";
import { RANGE_LABELS, parseRange } from "@/lib/admin/ai-costs/ranges";
import { loadRangeView } from "@/lib/admin/ai-costs/server";
import { assertEditorialRoutesEnabled } from "@/lib/editorial/runtime/route-guard";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata(): Promise<Metadata> {
  assertEditorialRoutesEnabled();
  return { title: { absolute: "Overview — AI costs" } };
}

export default function AiCostsOverviewPage({ searchParams }: { searchParams: SearchParams }) {
  assertEditorialRoutesEnabled();
  return (
    <Suspense fallback={<ConsoleFallback />}>
      <Overview searchParams={searchParams} />
    </Suspense>
  );
}

const ALARM_LABELS = [
  ["free80", "Free pool 80%"],
  ["free100", "Free pool 100%"],
  ["paid80", "Paid pool 80%"],
  ["paid100", "Paid pool 100%"],
] as const;

async function Overview({ searchParams }: { searchParams: SearchParams }) {
  const rangeId = parseRange((await searchParams).range);
  const view = await loadRangeView(rangeId);
  const { control, overview, unit, range } = view;
  const days = range.days;
  const launches = unit.launches;
  const medianTone = launches.medianMicroUsd === null ? "info" : launches.medianMicroUsd > launches.targetMicroUsd ? "critical" : "good";
  const alarms = control.spendAlarmState;

  return (
    <ConsoleShell mode={view.mode} active="overview" range={rangeId}>
      <PageTitle
        title="AI costs"
        description={<>What the live AI costs, who spends it and how efficiently. Usage metadata only: no prompt, reply or chat text. Range: {RANGE_LABELS[rangeId].toLowerCase()} of UTC days ({range.dayKeys[0]} to {range.dayKeys.at(-1)}).</>}
      />
      <RangeNotices view={view} />

      <Section
        id="today"
        title="Pools today"
        description={<>Read from the meter&apos;s own counters for {control.dayKey} (UTC), so these match the budget gate exactly.</>}
      >
        {!control.configured ? <Notice tone="warning">No ops settings row exists, so every pool budget is $0 and AI is off.</Notice> : null}
        <div className="grid gap-3 md:grid-cols-2">
          <Card>
            <BudgetMeter label="Free pool" usedMicroUsd={control.free.spentMicroUsd} inFlightMicroUsd={control.free.inFlightMicroUsd} budgetMicroUsd={control.freeBudgetMicroUsd} />
          </Card>
          <Card>
            <BudgetMeter label="Paid pool" usedMicroUsd={control.paid.spentMicroUsd} inFlightMicroUsd={control.paid.inFlightMicroUsd} budgetMicroUsd={control.paidBudgetMicroUsd} />
          </Card>
        </div>
        {control.uncappedOwner.spentMicroUsd + control.uncappedOwner.inFlightMicroUsd > 0 ? (
          <p className="mt-3 text-sm text-(--ed-text-2)">
            Plus {formatUsd(control.uncappedOwner.spentMicroUsd)} of the platform owner&apos;s own uncapped use today
            ({formatUsd(control.uncappedOwner.inFlightMicroUsd)} in flight). The meter keeps it on separate counters, outside both pool budgets.
          </p>
        ) : null}
        <Card className="mt-3">
          <h3 className="text-sm font-semibold">Spend alarm and switches</h3>
          <ul className="mt-2 flex flex-wrap gap-2" aria-label="Spend alarm thresholds today">
            {ALARM_LABELS.map(([key, label]) => (
              <li key={key}>
                {alarms?.[key]
                  ? <StatusBadge tone={key.endsWith("100") ? "critical" : "warning"}>{label} raised</StatusBadge>
                  : <StatusBadge tone="good">{label} not raised</StatusBadge>}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-(--ed-text-2)">
            Workspace {control.workspaceEnabled ? "on" : "off"} · AI switch {control.killSwitches.ai ? "off (kill switch set)" : "on"} ·
            cohort {control.cohortMode === "open" ? "open to everyone" : `allowlist of ${formatCount(control.cohortSize)}${control.cohortSizeTruncated ? "+" : ""}`}
            {alarms === null ? " · no alarm has run for today yet" : ""}
          </p>
        </Card>
      </Section>

      <Section id="range" title={`In the last ${RANGE_LABELS[rangeId].toLowerCase()}`} description="Settled and failed calls are charged by the meter's rule. Reserved spend is shown apart: it is locked, not yet spent.">
        <div className="mb-3 grid gap-3 md:grid-cols-2">
          <Card>
            <BudgetMeter label={`Free pool, ${days} day${days === 1 ? "" : "s"}`} usedMicroUsd={overview.pools.free.chargedMicroUsd} inFlightMicroUsd={overview.pools.free.inFlightMicroUsd} budgetMicroUsd={control.freeBudgetMicroUsd * days} />
          </Card>
          <Card>
            <BudgetMeter label={`Paid pool, ${days} day${days === 1 ? "" : "s"}`} usedMicroUsd={overview.pools.paid.chargedMicroUsd} inFlightMicroUsd={overview.pools.paid.inFlightMicroUsd} budgetMicroUsd={control.paidBudgetMicroUsd * days} />
          </Card>
        </div>
        <p className="mb-3 text-xs text-(--ed-text-2)">
          Range budgets are today&apos;s daily budgets times the number of days; past days may have run on other budgets.
          {overview.uncappedOwner.calls > 0
            ? ` The platform owner's uncapped use (${formatUsd(overview.uncappedOwner.chargedMicroUsd)}, ${formatCount(overview.uncappedOwner.calls)} calls) is outside both pools but inside the totals below.`
            : ""}
        </p>
        <StatGrid label="Range totals">
          <StatTile label="Spend (settled + failed)" value={formatUsd(overview.totals.chargedMicroUsd)} detail={`${formatUsd(overview.totals.chargedMicroUsd - overview.totals.failedMicroUsd)} on calls that succeeded`} />
          <StatTile label="Calls" value={formatCount(overview.totals.calls)} detail={`${formatCount(overview.totals.settled)} settled · ${formatCount(overview.totals.reserved)} in flight`} />
          <StatTile label="Failed calls" value={formatCount(overview.totals.failed)} detail={`${formatPercent(overview.totals.failed / Math.max(1, overview.totals.settled + overview.totals.failed), 1)} of finished calls`} />
          <StatTile label="Spend on failed calls" value={formatUsd(overview.totals.failedMicroUsd)} detail="Charged even though the call failed (billed or possibly billed)" />
        </StatGrid>
      </Section>

      <Section id="daily" title="Spend by day and pool" description="Charged spend per UTC day, by the pool it counted against. The platform owner's uncapped use is not in either pool; it is in the table.">
        <Card>
          <DailySpendChart days={overview.byDay} dailyBudgetMicroUsd={control.freeBudgetMicroUsd + control.paidBudgetMicroUsd} title="Charged spend per UTC day, free pool and paid pool stacked" />
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-medium">Show the table</summary>
            <div className="mt-2">
              <TableRegion labelledBy="daily">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th scope="col" className={th}>Day (UTC)</th>
                      <th scope="col" className={thNum}>Free pool</th>
                      <th scope="col" className={thNum}>Paid pool</th>
                      <th scope="col" className={thNum}>Owner, uncapped</th>
                      <th scope="col" className={thNum}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.byDay.map((day) => (
                      <tr key={day.dayKey}>
                        <th scope="row" className={`${td} text-left font-normal`}>{day.dayKey}</th>
                        <td className={tdNum}>{formatUsd(day.free)}</td>
                        <td className={tdNum}>{formatUsd(day.paid)}</td>
                        <td className={tdNum}>{formatUsd(day.uncappedOwner)}</td>
                        <td className={tdNum}>{formatUsd(day.free + day.paid + day.uncappedOwner)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableRegion>
            </div>
          </details>
        </Card>
      </Section>

      <Section
        id="unit"
        title="Unit economics"
        description="A launch is every non-Wren call on one business, read in full from its first call. Launches counted here started in the range."
      >
        <StatGrid label="Unit costs">
          <StatTile
            label="Median launch"
            value={formatUsd(launches.medianMicroUsd)}
            detail={
              <span className="flex flex-wrap items-center gap-1.5">
                {medianTone === "critical" ? <StatusBadge tone="critical">Over the $0.75 target</StatusBadge> : medianTone === "good" ? <StatusBadge tone="good">Within the $0.75 target</StatusBadge> : <span>No launch yet</span>}
                <span>{formatCount(launches.count)} launches</span>
              </span>
            }
          />
          <StatTile label="p90 launch" value={formatUsd(launches.p90MicroUsd)} detail={`${formatCount(launches.overTarget)} of ${formatCount(launches.count)} over $0.75 · mean ${formatUsd(launches.meanMicroUsd)}`} />
          <StatTile label="Per Wren message" value={formatUsd(unit.wren.perMessageMicroUsd)} detail={`${formatCount(unit.wren.messages)} messages · ${formatUsd(unit.wren.chargedMicroUsd)} incl. failed attempts`} />
          <StatTile label="Per seed" value={formatUsd(unit.seeds.perSeedMicroUsd)} detail={`${formatCount(unit.seeds.seeds)} seeds · ${formatUsd(unit.seeds.chargedMicroUsd)}`} />
          <StatTile label="Per active founder a day" value={formatUsd(unit.founders.perFounderDayMicroUsd)} detail={`${formatCount(unit.founders.activeFounders)} founders · ${formatCount(unit.founders.founderDays)} founder-days`} />
          <StatTile label="Platform work" value={formatUsd(unit.platformMicroUsd)} detail="Ownerless calls (seeds, evals); free pool" />
        </StatGrid>
        {launches.truncated > 0 ? (
          <Notice tone="warning">{formatCount(launches.truncated)} launch{launches.truncated === 1 ? " has" : "es have"} more calls than one read takes, so {launches.truncated === 1 ? "its" : "their"} cost is a floor.</Notice>
        ) : null}
        {launches.count > 0 ? (
          <Card className="mt-3">
            <h3 className="text-sm font-semibold">Cost of each launch</h3>
            <LaunchCostStrip costs={launches.costs} targetMicroUsd={launches.targetMicroUsd} medianMicroUsd={launches.medianMicroUsd} p90MicroUsd={launches.p90MicroUsd} />
          </Card>
        ) : null}
      </Section>
    </ConsoleShell>
  );
}
