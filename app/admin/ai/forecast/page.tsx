import type { Metadata } from "next";
import { Suspense } from "react";

import { ConsoleFallback, ConsoleShell } from "@/components/admin/ai-costs/ConsoleShell";
import { ForecastPanel } from "@/components/admin/ai-costs/interactive";
import { RangeNotices } from "@/components/admin/ai-costs/RangeNotices";
import { Card, Notice, PageTitle, Section, StatGrid, StatTile } from "@/components/admin/ai-costs/primitives";
import type { ForecastUnits } from "@/lib/admin/ai-costs/forecast";
import { BUILDERS_HUB_MONTHLY_MICRO_USD } from "@/lib/admin/ai-costs/forecast";
import { formatCount, formatUsd } from "@/lib/admin/ai-costs/money";
import { RANGE_LABELS, parseRange } from "@/lib/admin/ai-costs/ranges";
import { loadRangeView } from "@/lib/admin/ai-costs/server";
import { assertEditorialRoutesEnabled } from "@/lib/editorial/runtime/route-guard";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata(): Promise<Metadata> {
  assertEditorialRoutesEnabled();
  return { title: { absolute: "Forecast — AI costs" } };
}

export default function AiCostsForecastPage({ searchParams }: { searchParams: SearchParams }) {
  assertEditorialRoutesEnabled();
  return (
    <Suspense fallback={<ConsoleFallback />}>
      <Forecast searchParams={searchParams} />
    </Suspense>
  );
}

async function Forecast({ searchParams }: { searchParams: SearchParams }) {
  const rangeId = parseRange((await searchParams).range);
  const view = await loadRangeView(rangeId);
  const { unit, range } = view;
  const units: ForecastUnits = {
    launchMicroUsd: unit.launches.meanMicroUsd,
    wrenMessageMicroUsd: unit.wren.perMessageMicroUsd,
    platformPerDayMicroUsd: Math.ceil(unit.platformMicroUsd / range.days),
  };
  // Launches with more calls than one read takes have a cost that is a floor; so is any mean that includes them.
  const launchFloor = unit.launches.truncated > 0;
  const sample = rangeId === "today" ? "today" : `the last ${RANGE_LABELS[rangeId]}`;

  return (
    <ConsoleShell mode={view.mode} active="forecast" range={rangeId}>
      <PageTitle
        title="Forecast"
        description="An estimate, not a bill: this range's measured unit costs multiplied by your assumptions. Change the range to use a different sample."
      />
      <RangeNotices view={view} />
      {launchFloor ? (
        <Notice tone="warning">
          {formatCount(unit.launches.truncated)} of {formatCount(unit.launches.count)} launches have more calls than one read takes, so
          their cost is a floor. The launch mean and every launch figure in this forecast are lower bounds.
        </Notice>
      ) : null}
      <Section id="units" title="Measured unit costs" description={`Measured over ${sample}. These are means, so a few costly launches move them.`}>
        <StatGrid label="Measured unit costs">
          <StatTile
            label={launchFloor ? "Cost per launch (mean, at least)" : "Cost per launch (mean)"}
            value={units.launchMicroUsd === null ? "No launches" : `${launchFloor ? "≥ " : ""}${formatUsd(units.launchMicroUsd)}`}
            detail={`${formatCount(unit.launches.count)} launches started in the range${launchFloor ? ` · ${formatCount(unit.launches.truncated)} cut off` : ""}`}
          />
          <StatTile
            label="Cost per Wren message"
            value={units.wrenMessageMicroUsd === null ? "No messages" : formatUsd(units.wrenMessageMicroUsd)}
            detail={`${formatCount(unit.wren.messages)} messages`}
          />
          <StatTile
            label="Platform work per day"
            value={formatUsd(units.platformPerDayMicroUsd)}
            detail="Seeds, evals and other ownerless calls"
          />
          <StatTile
            label="Builder's Hub price"
            value={`${formatUsd(BUILDERS_HUB_MONTHLY_MICRO_USD)}/mo`}
            detail="From the pricing in code. Growth has no price yet, so it is not counted."
          />
        </StatGrid>
      </Section>
      <Section
        id="model"
        title="Monthly AI cost"
        description={launchFloor
          ? "Change any input; the estimate updates as you type. Launch costs here are lower bounds (see the warning above)."
          : "Change any input; the estimate updates as you type."}
      >
        <Card>
          <ForecastPanel units={units} />
        </Card>
      </Section>
    </ConsoleShell>
  );
}
