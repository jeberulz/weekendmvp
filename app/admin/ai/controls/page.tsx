import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";

import { AuthPlatformProvider } from "@/app/AuthPlatformProvider";
import { ConsoleFallback, ConsoleShell } from "@/components/admin/ai-costs/ConsoleShell";
import { AddToCohort, CohortTable, SpendControlsForm } from "@/components/admin/ai-costs/controls";
import { Card, Notice, PageTitle, Section } from "@/components/admin/ai-costs/primitives";
import { StepUpProvider } from "@/components/admin/editorial/common/StepUpContext";
import { SWITCH_KEYS, SWITCH_LABELS, type SwitchKey } from "@/lib/admin/ai-costs/controls";
import { resolveControlsBackend, type RecentChange } from "@/lib/admin/ai-costs/controls-server";
import { formatUtc } from "@/lib/admin/ai-costs/labels";
import { formatUsd } from "@/lib/admin/ai-costs/money";
import { assertEditorialRoutesEnabled } from "@/lib/editorial/runtime/route-guard";

export async function generateMetadata(): Promise<Metadata> {
  assertEditorialRoutesEnabled();
  return { title: { absolute: "Controls — AI costs" } };
}

export default function AiControlsPage() {
  assertEditorialRoutesEnabled();
  return (
    <Suspense fallback={<ConsoleFallback />}>
      <Controls />
    </Suspense>
  );
}

const ACTION_LABELS: Record<string, string> = {
  "ops.settings.changed": "Controls changed",
  "ops.cohort.added": "Added to cohort",
  "ops.cohort.removed": "Removed from cohort",
};

function parseMetadata(metadata: string | null): Record<string, unknown> {
  if (metadata === null) return {};
  try {
    const value: unknown = JSON.parse(metadata);
    return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** One readable line per audit row. Never more than the row itself recorded. */
function describeChange(change: RecentChange, emails: ReadonlyMap<string, string>): string {
  const data = parseMetadata(change.metadata);
  if (change.action === "ops.settings.changed") {
    const parts: string[] = [];
    const free = Number(data.globalDailyBudgetMicroUsd);
    const paid = Number(data.paidGlobalDailyBudgetMicroUsd);
    if (Number.isFinite(free)) parts.push(`free ${formatUsd(free)}`);
    if (Number.isFinite(paid)) parts.push(`paid ${formatUsd(paid)}`);
    const switches = data.killSwitches;
    if (switches !== null && typeof switches === "object") {
      const off = SWITCH_KEYS.filter((key: SwitchKey) => (switches as Record<string, unknown>)[key] === true).map((key) => SWITCH_LABELS[key]);
      parts.push(off.length === 0 ? "every feature on" : `off: ${off.join(", ")}`);
    }
    if (data.risky === true) parts.push("confirmed with a recent sign-in");
    if (data.via !== "ai-console") parts.push("changed outside the console");
    return parts.join(" · ");
  }
  const who = emails.get(change.subjectId) ?? "an account";
  const reason = typeof data.reason === "string" ? ` · reason: ${data.reason}` : "";
  return `${who}${reason}`;
}

function StepUpBoundary({ live, stepUp, children }: { live: boolean; stepUp: { method: "google" | "email" | null; email: string | null } | null; children: ReactNode }) {
  if (!live || stepUp === null) return children;
  // The live console signs in again with the account's own method (the editorial step-up).
  return (
    <AuthPlatformProvider fallbackClassName="bg-(--ed-canvas)">
      <StepUpProvider value={stepUp}>{children}</StepUpProvider>
    </AuthPlatformProvider>
  );
}

async function Controls() {
  await connection();
  const backend = await resolveControlsBackend();
  if (backend === null) notFound();
  const view = await backend.view();
  const { control } = view;
  const emails = new Map(view.cohort.filter((member) => member.email !== null).map((member) => [member.ownerId, member.email as string]));

  return (
    <StepUpBoundary live={view.mode === "live"} stepUp={view.stepUp}>
      <ConsoleShell mode={view.mode} active="controls" range={null}>
        <PageTitle
          title="Controls"
          description="Pool budgets, feature switches and the beta cohort. Every change is checked by the server and written to the audit log."
        />
        {view.mode === "fixture" ? (
          <Notice tone="info">Local fixtures: changes here stay in this dev server&apos;s memory and the sign-in step is simulated.</Notice>
        ) : null}
        {!control.configured ? <Notice tone="warning">No ops settings row exists yet: every budget is $0 and every feature is off. Saving here creates it.</Notice> : null}

        <Section
          id="spend"
          title="Spend controls"
          description="Turning something off or lowering a budget is one click. Turning a feature back on, or raising a budget from $0 or above twice today's spend, needs a sign-in from the last 10 minutes and a typed confirmation."
        >
          <Card>
            <SpendControlsForm
                key={view.version ?? "none"}
                version={view.version}
                current={{ freeBudgetMicroUsd: control.freeBudgetMicroUsd, paidBudgetMicroUsd: control.paidBudgetMicroUsd, killSwitches: control.killSwitches }}
                spentToday={{ free: control.free.spentMicroUsd, paid: control.paid.spentMicroUsd }}
                signedInRecently={view.signedInRecently}
              />
          </Card>
          <p className="mt-2 text-xs text-(--ed-text-2)">
            The workspace switch, cohort mode and free sign-ups are not changed here. Today&apos;s spend is from the meter&apos;s pool counters for {control.dayKey} (UTC).
          </p>
        </Section>

        <Section
          id="cohort"
          title="Beta cohort"
          description={control.cohortMode === "open"
            ? "The cohort is open to everyone right now, so this list does not limit access. It still applies if the cohort goes back to allowlist."
            : "Only accounts on this list can use the workspace. Find an account by its email to add it; removing one needs a reason."}
        >
          <Card className="mb-3">
            <h3 className="mb-2 text-sm font-semibold">Add a tester</h3>
            <AddToCohort />
          </Card>
          <CohortTable members={view.cohort} labelledBy="cohort" />
          {view.cohortTruncated ? <p className="mt-2 text-xs text-(--ed-text-2)">Showing the newest 200 members.</p> : null}
        </Section>

        <Section id="recent" title="Recent changes" description="The latest control changes from the audit log, newest first.">
          {view.recent.length === 0 ? (
            <p className="text-sm text-(--ed-text-2)">No control changes yet.</p>
          ) : (
            <ol className="flex flex-col divide-y divide-(--ed-border) rounded-lg border border-(--ed-border) bg-(--ed-surface)">
              {view.recent.map((change) => (
                <li key={change.id} className="flex flex-col gap-0.5 px-3 py-2 text-sm sm:flex-row sm:gap-3">
                  <span className="shrink-0 tabular-nums text-(--ed-text-2)">{formatUtc(change.createdAt)}</span>
                  <span className="font-medium">{ACTION_LABELS[change.action] ?? change.action}</span>
                  <span className="min-w-0 break-words text-(--ed-text-2)">{describeChange(change, emails)}</span>
                </li>
              ))}
            </ol>
          )}
        </Section>
      </ConsoleShell>
    </StepUpBoundary>
  );
}
