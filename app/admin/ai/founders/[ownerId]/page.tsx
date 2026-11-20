import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AI_COSTS_BASE, ConsoleFallback, ConsoleShell, focusRing } from "@/components/admin/ai-costs/ConsoleShell";
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
import { PLAN_LABELS, formatUtc } from "@/lib/admin/ai-costs/labels";
import { chargedMicroUsd, formatCount, formatTokens, formatUsd } from "@/lib/admin/ai-costs/money";
import { requireAiCostSource } from "@/lib/admin/ai-costs/server";
import type { OwnerSummary, TimelineRow } from "@/lib/admin/ai-costs/types";
import { assertEditorialRoutesEnabled } from "@/lib/editorial/runtime/route-guard";
import { cn } from "@/lib/utils";

type Params = Promise<{ ownerId: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata(): Promise<Metadata> {
  assertEditorialRoutesEnabled();
  // Generic: never an email in the tab title or history.
  return { title: { absolute: "Founder calls — AI costs" } };
}

export default function FounderTimelinePage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  assertEditorialRoutesEnabled();
  return (
    <Suspense fallback={<ConsoleFallback />}>
      <Timeline params={params} searchParams={searchParams} />
    </Suspense>
  );
}

const ID_PATTERN = /^[a-z0-9-]{1,64}$/;
const CURSOR_MAX = 4_096;

function StatusCell({ row }: { row: TimelineRow }) {
  if (row.status === "settled") return <StatusBadge tone="good">Settled</StatusBadge>;
  if (row.status === "reserved") return <StatusBadge tone="info">In flight</StatusBadge>;
  return <StatusBadge tone="critical">Failed</StatusBadge>;
}

function flagsOf(row: TimelineRow): string[] {
  const flags: string[] = [];
  if (row.batch) flags.push("batch");
  if (row.reask) flags.push("re-ask");
  if (row.escalation) flags.push("escalation");
  if (row.creditFunded) flags.push("credit-funded");
  if (row.stopReason === "max_tokens") flags.push("hit max_tokens");
  if (row.swept) flags.push("swept");
  if (row.estimated) flags.push("estimated cost");
  return flags;
}

async function Timeline({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const [{ ownerId: rawId }, query] = await Promise.all([params, searchParams]);
  if (!ID_PATTERN.test(rawId)) notFound();
  const rawCursor = Array.isArray(query.cursor) ? query.cursor[0] : query.cursor;
  const cursor = typeof rawCursor === "string" && rawCursor.length > 0 && rawCursor.length <= CURSOR_MAX ? rawCursor : null;
  const source = await requireAiCostSource();
  const ownerId = rawId === "platform" ? null : rawId;

  let summary: OwnerSummary | null = null;
  let page: Awaited<ReturnType<typeof source.timeline>>;
  try {
    if (ownerId !== null) summary = (await source.ownerSummaries([ownerId])).summaries[0] ?? null;
    page = await source.timeline(ownerId, cursor);
  } catch {
    // A malformed id or cursor is refused by Convex validation: a missing page, like any other.
    notFound();
  }
  if (ownerId !== null && summary === null) notFound();

  const title = ownerId === null ? "Platform (ownerless work)" : summary?.email ?? "Founder without an email";
  const pageCharged = page.page.reduce((sum, row) => sum + chargedMicroUsd(row), 0);

  return (
    <ConsoleShell mode={source.mode} active="founders" range={null}>
      <p className="mb-3 text-sm">
        <Link href={`${AI_COSTS_BASE}/founders`} className={cn("underline underline-offset-2", focusRing)}>← All founders</Link>
      </p>
      <PageTitle
        title={title}
        description={ownerId === null
          ? "Per-idea seeds, evals and other platform work. These calls have no owner and count against the free pool (D22)."
          : "Every AI call for this founder, newest first. Metadata only: no prompt, reply or chat text is stored or shown."}
      />
      {summary ? (
        <Section id="founder-facts" title="Budgets and activity">
          <StatGrid label="Founder facts">
            <StatTile label="Plan" value={PLAN_LABELS[summary.plan]} detail={summary.inCohort ? "In the beta cohort" : "Not in the beta cohort"} />
            <StatTile label="Today vs daily cap" value={formatUsd(summary.daySpentMicroUsd)} detail={`of ${formatUsd(summary.dayCapMicroUsd)} · ${formatUsd(summary.reservedMicroUsd)} reserved now`} />
            <StatTile
              label="Lifetime free spend"
              value={summary.plan === "free" ? formatUsd(summary.freeLifetimeSpentMicroUsd) : "Paid plan"}
              detail={summary.plan === "free" ? `of the ${formatUsd(summary.freeLifetimeCeilingMicroUsd)} ceiling` : "The free ceiling does not apply"}
            />
            <StatTile label="Businesses" value={`${formatCount(summary.businesses)}${summary.businessesTruncated ? "+" : ""}`} detail={`${formatCount(summary.launches)} launched · last active ${formatUtc(summary.lastActiveAt)}`} />
          </StatGrid>
        </Section>
      ) : null}

      <Section id="timeline" title="Call timeline" description={`${formatCount(page.page.length)} calls on this page · ${formatUsd(pageCharged)} charged.`}>
        {page.page.length === 0 ? (
          <Card><p className="text-sm text-(--ed-text-2)">No calls{cursor ? " past this point" : ""}.</p></Card>
        ) : (
          <TableRegion labelledBy="timeline">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th scope="col" className={th}>Time (UTC)</th>
                  <th scope="col" className={th}>Prompt</th>
                  <th scope="col" className={th}>Model</th>
                  <th scope="col" className={thNum}>Input</th>
                  <th scope="col" className={thNum}>Cache read / write</th>
                  <th scope="col" className={thNum}>Output</th>
                  <th scope="col" className={thNum}>Cost</th>
                  <th scope="col" className={th}>Status</th>
                  <th scope="col" className={th}>Error</th>
                  <th scope="col" className={th}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {page.page.map((row) => (
                  <tr key={row.id}>
                    <th scope="row" className={`${td} text-left font-normal tabular-nums`}>{formatUtc(row.createdAt).replace(" UTC", "")}</th>
                    <td className={`${td} font-mono text-xs`}>{row.promptRef}</td>
                    <td className={td}>{row.model}<span className="block text-xs text-(--ed-text-2)">{row.tier}</span></td>
                    <td className={tdNum}>{formatTokens(row.inputTokens)}</td>
                    <td className={tdNum}>{formatTokens(row.cacheReadTokens)} / {formatTokens(row.cacheWriteTokens)}</td>
                    <td className={tdNum}>{formatTokens(row.outputTokens)}</td>
                    <td className={tdNum}>
                      {row.status === "reserved" ? <span className="text-(--ed-text-2)">{formatUsd(row.reservedMicroUsd)} reserved</span> : formatUsd(chargedMicroUsd(row))}
                    </td>
                    <td className={td}><StatusCell row={row} /></td>
                    <td className={`${td} max-w-xs whitespace-normal`}>
                      {row.status === "failed" ? (
                        <>
                          <span>{row.errorClass?.replace("_", " ") ?? "unknown"}</span>
                          {row.billed ? <span className="block text-xs text-(--ed-text-2)">billed: {row.billed}</span> : null}
                          {row.errorKind ? <span className="block text-xs">{row.errorKind}</span> : null}
                          {row.errorDetail ? <span className="block break-words text-xs text-(--ed-text-2)">{row.errorDetail}</span> : null}
                        </>
                      ) : <span className="text-(--ed-text-2)">—</span>}
                    </td>
                    <td className={`${td} text-xs text-(--ed-text-2)`}>{flagsOf(row).join(", ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableRegion>
        )}
        <nav aria-label="Timeline pages" className="mt-3 flex gap-4 text-sm">
          {cursor ? (
            <Link href={`${AI_COSTS_BASE}/founders/${rawId}`} className={cn("underline underline-offset-2", focusRing)}>Newest calls</Link>
          ) : null}
          {page.continueCursor ? (
            <Link href={`${AI_COSTS_BASE}/founders/${rawId}?cursor=${encodeURIComponent(page.continueCursor)}`} className={cn("underline underline-offset-2", focusRing)}>
              Older calls
            </Link>
          ) : null}
        </nav>
      </Section>
    </ConsoleShell>
  );
}
