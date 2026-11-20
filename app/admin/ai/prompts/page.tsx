import type { Metadata } from "next";
import { Suspense } from "react";

import { ConsoleFallback, ConsoleShell } from "@/components/admin/ai-costs/ConsoleShell";
import { ShareBars } from "@/components/admin/ai-costs/figures";
import { CsvButton, WhatIfPanel } from "@/components/admin/ai-costs/interactive";
import { RangeNotices } from "@/components/admin/ai-costs/RangeNotices";
import {
  Card,
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
import type { Breakdown } from "@/lib/admin/ai-costs/aggregate";
import { breakdownCsv } from "@/lib/admin/ai-costs/exports";
import { formatCount, formatPercent, formatTokens, formatUsd } from "@/lib/admin/ai-costs/money";
import { parseRange } from "@/lib/admin/ai-costs/ranges";
import { loadRangeView } from "@/lib/admin/ai-costs/server";
import { assertEditorialRoutesEnabled } from "@/lib/editorial/runtime/route-guard";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata(): Promise<Metadata> {
  assertEditorialRoutesEnabled();
  return { title: { absolute: "Prompts and models — AI costs" } };
}

export default function AiCostsPromptsPage({ searchParams }: { searchParams: SearchParams }) {
  assertEditorialRoutesEnabled();
  return (
    <Suspense fallback={<ConsoleFallback />}>
      <Prompts searchParams={searchParams} />
    </Suspense>
  );
}

function BreakdownTable({ rows, labelledBy, keyHeader, mono }: { rows: readonly Breakdown[]; labelledBy: string; keyHeader: string; mono: boolean }) {
  if (rows.length === 0) return <p className="text-sm text-(--ed-text-2)">No calls in this range.</p>;
  return (
    <TableRegion labelledBy={labelledBy}>
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th scope="col" className={th}>{keyHeader}</th>
            <th scope="col" className={thNum}>Calls</th>
            <th scope="col" className={thNum}>Input</th>
            <th scope="col" className={thNum}>Output <span className="font-normal">(incl. thinking)</span></th>
            <th scope="col" className={thNum}>Cache read</th>
            <th scope="col" className={thNum}>Cache write</th>
            <th scope="col" className={thNum}>Cost</th>
            <th scope="col" className={thNum}>Share</th>
            <th scope="col" className={thNum}>Failure rate</th>
            <th scope="col" className={thNum}>Avg per call</th>
            <th scope="col" className={thNum}>Cache hit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <th scope="row" className={`${td} text-left font-normal`}>
                <span className={mono ? "font-mono text-xs" : undefined}>{row.label}</span>
                {mono ? <span className="block text-xs text-(--ed-text-2)">{row.models.join(", ")}</span> : null}
              </th>
              <td className={tdNum}>{formatCount(row.calls)}{row.reserved > 0 ? <span className="block text-xs text-(--ed-text-2)">{formatCount(row.reserved)} in flight</span> : null}</td>
              <td className={tdNum}>{formatTokens(row.inputTokens)}</td>
              <td className={tdNum}>{formatTokens(row.outputTokens)}</td>
              <td className={tdNum}>{formatTokens(row.cacheReadTokens)}</td>
              <td className={tdNum}>{formatTokens(row.cacheWriteTokens)}</td>
              <td className={tdNum}>{formatUsd(row.chargedMicroUsd)}</td>
              <td className={tdNum}>{formatPercent(row.share, 1)}</td>
              <td className={tdNum}>{formatPercent(row.failureRate, 1)}{row.failed > 0 ? <span className="block text-xs text-(--ed-text-2)">{formatCount(row.failed)} failed</span> : null}</td>
              <td className={tdNum}>{formatUsd(row.avgCostMicroUsd)}</td>
              <td className={tdNum}>{formatPercent(row.cacheHitRate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableRegion>
  );
}

async function Prompts({ searchParams }: { searchParams: SearchParams }) {
  const rangeId = parseRange((await searchParams).range);
  const view = await loadRangeView(rangeId);
  const { prompts, models, efficiency: e } = view;
  const day = view.range.dayKeys.at(-1);

  return (
    <ConsoleShell mode={view.mode} active="prompts" range={rangeId}>
      <PageTitle
        title="Prompts and models"
        description="Where the money goes, by prompt version and by model tier, and how efficiently each one runs. Thinking is billed as output and is not stored apart."
      />
      <RangeNotices view={view} />

      <Section id="share" title="Share of spend by prompt" description="Top eight prompt versions by charged spend.">
        <Card>
          <ShareBars items={prompts.slice(0, 8).map((row) => ({ label: row.key, share: row.share, microUsd: row.chargedMicroUsd }))} />
        </Card>
      </Section>

      <Section
        id="by-prompt"
        title="By prompt"
        description="One row per prompt version (id@version). Failure rate is failed ÷ finished calls."
        actions={<CsvButton filename={`ai-costs-prompts-${rangeId}-${day}.csv`} csv={breakdownCsv(prompts, "prompt_ref")} label="Export CSV" />}
      >
        <BreakdownTable rows={prompts} labelledBy="by-prompt" keyHeader="Prompt" mono />
      </Section>

      <Section
        id="by-model"
        title="By model and tier"
        actions={<CsvButton filename={`ai-costs-models-${rangeId}-${day}.csv`} csv={breakdownCsv(models, "tier_model")} label="Export CSV" />}
      >
        <BreakdownTable rows={models} labelledBy="by-model" keyHeader="Tier · model" mono={false} />
      </Section>

      <Section id="efficiency" title="Efficiency signals" description="Where spend leaks: cache misses, retries, failures and money locked in reservations.">
        <StatGrid label="Efficiency signals">
          <StatTile label="Cache hit rate" value={formatPercent(e.cache.hitRate)} detail={`${formatTokens(e.cache.cacheReadTokens)} of ${formatTokens(e.cache.promptTokens)} prompt tokens read from cache (Claude calls)`} />
          <StatTile label="Batch share" value={formatPercent(e.batch.share)} detail={`${formatCount(e.batch.calls)} batch calls · ${formatUsd(e.batch.chargedMicroUsd)} · saved ${formatUsd(e.batch.savedMicroUsd)} vs real-time rates`} />
          <StatTile label="Re-asks" value={formatCount(e.reasks.calls)} detail={`${formatUsd(e.reasks.chargedMicroUsd)} spent asking again after a bad answer`} />
          <StatTile label="Invalid output (schema)" value={formatCount(e.schemaInvalid.calls)} detail={`${formatUsd(e.schemaInvalid.chargedMicroUsd)} on calls whose output failed validation`} />
          <StatTile label="Escalations" value={formatCount(e.escalations.calls)} detail={`${formatUsd(e.escalations.chargedMicroUsd)} on deep-tier escalations`} />
          <StatTile label="Hit max_tokens" value={formatCount(e.maxTokens.calls)} detail={`${formatUsd(e.maxTokens.chargedMicroUsd)} on answers cut off at the token cap`} />
          <StatTile
            label="Reserved vs settled"
            value={formatPercent(e.reservation.usedRate)}
            detail={`of what was reserved was charged: ${formatUsd(e.reservation.chargedMicroUsd)} of ${formatUsd(e.reservation.reservedMicroUsd)} (${formatUsd(e.reservation.gapMicroUsd)} locked up while in flight) · ${formatUsd(e.reservation.inFlightMicroUsd)} reserved now`}
          />
          <StatTile
            label="Spend on failed calls"
            value={formatUsd(e.failed.chargedMicroUsd)}
            detail={`${formatCount(e.failed.calls)} failed · ${formatCount(e.failed.possiblyBilled)} possibly billed · ${formatCount(e.failed.swept)} finished by the sweep`}
          />
        </StatGrid>
        <div className="mt-3 flex flex-wrap gap-2">
          {e.refusalOrSchemaAlarm
            ? <StatusBadge tone="critical">Refusals and schema failures at {formatPercent(e.refusalOrSchemaRate, 1)}, over the 5% alarm</StatusBadge>
            : <StatusBadge tone="good">Refusals and schema failures at {formatPercent(e.refusalOrSchemaRate, 1)}, under the 5% alarm</StatusBadge>}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div>
            <h3 id="cache-by-prompt" className="mb-2 text-sm font-semibold">Cache hit rate by prompt</h3>
            <TableRegion labelledBy="cache-by-prompt">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th scope="col" className={th}>Prompt</th>
                    <th scope="col" className={thNum}>Calls a day</th>
                    <th scope="col" className={thNum}>Cache hit</th>
                    <th scope="col" className={th}>Signal</th>
                  </tr>
                </thead>
                <tbody>
                  {e.cache.prompts.map((row) => (
                    <tr key={row.promptRef}>
                      <th scope="row" className={`${td} text-left font-mono text-xs font-normal`}>{row.promptRef}</th>
                      <td className={tdNum}>{row.callsPerDay.toLocaleString("en-US", { maximumFractionDigits: 1 })}</td>
                      <td className={tdNum}>{formatPercent(row.hitRate)}</td>
                      <td className={td}>
                        {row.alarm ? <StatusBadge tone="warning">Under 50% at volume</StatusBadge> : <span className="text-xs text-(--ed-text-2)">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableRegion>
            <p className="mt-1 text-xs text-(--ed-text-2)">The meter&apos;s alarm: under 50% on a prompt with more than 100 calls a day.</p>
          </div>
          <div>
            <h3 id="failure-classes" className="mb-2 text-sm font-semibold">Failed calls by error class</h3>
            {e.failed.byClass.length === 0 ? <p className="text-sm text-(--ed-text-2)">No failed calls in this range.</p> : (
              <TableRegion labelledBy="failure-classes">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th scope="col" className={th}>Error class</th>
                      <th scope="col" className={thNum}>Calls</th>
                      <th scope="col" className={thNum}>Charged</th>
                    </tr>
                  </thead>
                  <tbody>
                    {e.failed.byClass.map((row) => (
                      <tr key={row.errorClass}>
                        <th scope="row" className={`${td} text-left font-normal`}>{row.errorClass.replace("_", " ")}</th>
                        <td className={tdNum}>{formatCount(row.calls)}</td>
                        <td className={tdNum}>{formatUsd(row.chargedMicroUsd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableRegion>
            )}
          </div>
        </div>
      </Section>

      <Section
        id="what-if"
        title="What if a prompt ran on another model?"
        description="Re-prices this range's real token usage at another Claude model's rates. For example: wren-chat on Haiku against Sonnet."
      >
        <WhatIfPanel prompts={view.whatIf} />
      </Section>
    </ConsoleShell>
  );
}
