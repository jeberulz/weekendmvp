"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { currentStage, nextStepLabel, progress } from "@/convex/platform/weekendSteps";
import { ModuleSkeleton, PersonalModule } from "@/components/platform/home/module-states";
import { cn } from "@/lib/utils";
import { dayName, displayUrl, planHref, progressLine, shortDate } from "./plan-copy";

type Summary = FunctionReturnType<typeof api.platform.weekendPlans.list>["finished"][number];

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink";
const EYEBROW = "font-mono text-[11px] uppercase tracking-[0.08em] text-home-ink-3";
const CARD = "flex flex-col gap-4 rounded-[14px] border border-home-rule bg-home-card p-5 sm:p-6";
const BUTTON = cn("inline-flex h-11 items-center gap-2 rounded-[9px] px-4 text-sm font-medium transition-colors", FOCUS);
const LINK = cn("font-medium text-home-orange-ink underline underline-offset-4 hover:text-home-ink", FOCUS);

function ActivePlan({ plan }: { plan: Summary }) {
  const count = progress(plan.doneKeys);
  const next = nextStepLabel(plan.doneKeys);
  const headingId = `active-plan-${plan.planId}`;
  return (
    <section aria-labelledby={headingId} className={cn(CARD, "border-home-ink")}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className={EYEBROW}>Building now · {dayName(currentStage(plan.doneKeys))}</p>
        <p className={EYEBROW}>Started {shortDate(plan.startedAt)}</p>
      </div>
      <h2
        id={headingId}
        className="font-editorial text-[26px] font-normal leading-[1.15] tracking-[-0.015em] text-home-ink"
      >
        {plan.title}
      </h2>
      <div className="flex max-w-[520px] items-center gap-3">
        <div aria-hidden className="h-1.5 flex-1 overflow-hidden rounded-full bg-home-sunk">
          <div className="h-full rounded-full bg-home-orange" style={{ width: `${(count.done / count.total) * 100}%` }} />
        </div>
        <p className="shrink-0 font-mono text-[12px] text-home-ink-2">{progressLine(count)}</p>
      </div>
      {next && (
        <p className="text-[15px] text-home-ink-2">
          <span className="font-medium text-home-ink">Next: </span>
          {next}
        </p>
      )}
      <div>
        <Link href={planHref(plan.planId)} className={cn(BUTTON, "bg-home-ink text-home-card hover:bg-home-panel")}>
          Continue your plan<span className="sr-only"> for {plan.title}</span>
        </Link>
      </div>
    </section>
  );
}

function NoActivePlan() {
  return (
    <section aria-labelledby="active-plan" className={cn(CARD, "border-dashed")}>
      <h2 id="active-plan" className="font-editorial text-[24px] font-normal leading-[1.15] text-home-ink">
        No weekend plan running.
      </h2>
      <p className="max-w-[560px] text-[15px] leading-[1.55] text-home-ink-2">
        Pick an idea from your shortlist and plan your weekend: four stages, a short checklist, and the prompts from
        the research.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link href="/dashboard/saved" className={cn(BUTTON, "bg-home-ink text-home-card hover:bg-home-panel")}>
          Go to Saved
        </Link>
        <Link
          href="/dashboard/explore"
          className={cn(BUTTON, "border border-home-rule bg-home-card text-home-ink hover:border-home-ink-3")}
        >
          Browse ideas
        </Link>
      </div>
    </section>
  );
}

function Finished({ plans }: { plans: Summary[] }) {
  return (
    <section aria-labelledby="finished-plans" className="flex flex-col gap-3">
      <h2
        id="finished-plans"
        className="font-editorial text-[24px] font-normal leading-[1.15] tracking-[-0.015em] text-home-ink"
      >
        Finished
      </h2>
      {plans.length === 0 ? (
        <p className="text-[15px] text-home-ink-2">Plans you finish show up here with their live links.</p>
      ) : (
        <ul className="divide-y divide-home-rule border-y border-home-ink">
          {plans.map((plan) => (
            <li key={plan.planId} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:gap-4">
              <div className="min-w-0 flex-1">
                <Link
                  href={planHref(plan.planId)}
                  className={cn(
                    "text-[15px] font-medium text-home-ink underline-offset-4 hover:text-home-orange-ink hover:underline",
                    FOCUS,
                  )}
                >
                  {plan.title}
                </Link>
                <span className="mt-0.5 block text-[12px] text-home-ink-3">
                  {plan.completedAt ? `Finished ${shortDate(plan.completedAt)}` : "Finished"}
                </span>
              </div>
              {plan.liveUrl ? (
                <a
                  href={plan.liveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn("inline-flex min-h-11 items-center gap-1.5 text-sm", LINK)}
                >
                  {displayUrl(plan.liveUrl)}
                  <ExternalLink aria-hidden className="size-3.5 shrink-0" />
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              ) : (
                <span className="text-sm text-home-ink-3">No live link saved</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function LiveBuilds() {
  const data = useQuery(api.platform.weekendPlans.list);
  if (data === undefined) return <ModuleSkeleton label="Loading your builds" className="h-[360px]" />;
  return (
    <div className="flex flex-col gap-8">
      {data.active.length > 0 ? (
        <div className="flex flex-col gap-4">
          {data.active.map((plan) => (
            <ActivePlan key={plan.planId} plan={plan} />
          ))}
        </div>
      ) : (
        <NoActivePlan />
      )}
      <Finished plans={data.finished} />
    </div>
  );
}

/**
 * Builds (PRD 6.3): active plans on top (one on Free, any number on
 * Builder's Hub), finished plans below. Site projects are parked (R5).
 */
export function BuildsList() {
  return (
    <PersonalModule skeleton={<ModuleSkeleton label="Loading your builds" className="h-[360px]" />}>
      <LiveBuilds />
    </PersonalModule>
  );
}
