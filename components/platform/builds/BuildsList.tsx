"use client";

import { useMutation, usePaginatedQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState } from "react";
import { ConvexError } from "convex/values";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { currentStage, nextStepLabel, progress } from "@/convex/platform/weekendSteps";
import { ModuleErrorBoundary } from "@/components/platform/home/module-states";
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

/**
 * Ruling R4: "Bring your own idea" is parked, but existing drafts stay
 * reachable from Builds. Own-idea briefs still in progress link back to the
 * intake route, which stays open by URL. Nothing here links to the parked
 * project cockpit (R5). Absent when there are no drafts.
 */
export function Drafts() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.platform.projects.listOwned,
    {},
    { initialNumItems: 20 },
  );
  const drafts = results.filter((project) => project.source === "own_idea" && project.nextAction === "resume_brief");
  const [checkedMore, setCheckedMore] = useState(false);
  const checking = status === "LoadingFirstPage" || status === "LoadingMore";
  const draftStatus = checking ? "Checking your existing drafts…" : status === "Exhausted"
    ? (drafts.length ? "All projects checked for drafts." : "All projects checked. No existing idea drafts found.")
    : drafts.length ? `${drafts.length} existing idea ${drafts.length === 1 ? "draft found" : "drafts found"}; more projects remain to check.`
    : "No drafts in the projects checked so far.";
  return (
    <section aria-label="Existing idea drafts" className="flex flex-col gap-3">
      {drafts.length > 0 && <>
      <h2
        id="draft-plans"
        className="font-editorial text-[24px] font-normal leading-[1.15] tracking-[-0.015em] text-home-ink"
      >
        Your idea drafts
      </h2>
      <p className="text-[15px] text-home-ink-2">
        Bringing your own idea is paused until idea reports are ready. Your drafts are kept here.
      </p>
      </>}
      {drafts.length > 0 && <ul className="divide-y divide-home-rule border-y border-home-ink">
        {drafts.map((draft) => (
          <li key={draft.projectId} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-medium text-home-ink">{draft.title}</p>
              <span className="mt-0.5 block text-[12px] text-home-ink-3">Updated {shortDate(draft.updatedAt)}</span>
            </div>
            <Link href={`/dashboard/new?project=${draft.projectId}`} className={cn("inline-flex min-h-11 items-center text-sm", LINK)}>
              Resume brief<span className="sr-only"> for {draft.title}</span>
            </Link>
          </li>
        ))}
      </ul>}
      <p role="status" className={drafts.length === 0 && !checkedMore && (status === "LoadingFirstPage" || status === "Exhausted") ? "sr-only" : "text-sm text-home-ink-2"}>{draftStatus}</p>
      {(checkedMore || status === "CanLoadMore" || status === "LoadingMore") && (
        <div>
          <button
            type="button"
            onClick={() => { if (status === "CanLoadMore") { setCheckedMore(true); loadMore(20); } }}
            aria-disabled={status !== "CanLoadMore"}
            className={cn(BUTTON, "border border-home-rule bg-home-card text-home-ink hover:border-home-ink-3")}
          >
            {status === "Exhausted" ? "All projects checked" : status === "LoadingMore" ? "Loading…" : "Check more projects for drafts"}
          </button>
        </div>
      )}
    </section>
  );
}

function ArchivedPlan({ plan }: { plan: Summary }) {
  const restore = useMutation(api.platform.weekendPlans.restore);
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return <li className="flex flex-wrap items-center justify-between gap-3 py-3">
    <Link href={planHref(plan.planId)} className={cn("text-sm", LINK)}>{plan.title}</Link>
    <button type="button" disabled={pending} className={cn(BUTTON, "border border-home-rule")}
      onClick={async () => {
        setPending(true); setError("");
        try { await restore({ planId: plan.planId }); router.push(planHref(plan.planId)); }
        catch (caught) {
          const code = caught instanceof ConvexError ? (caught.data as { code?: string }).code : null;
          setError(code === "UPGRADE_REQUIRED" || code === "PLAN_LIMIT"
            ? "Your active plan limit is reached. Finish or archive a plan first; nothing has been changed."
            : code === "PLAN_ALREADY_ACTIVE"
              ? "This idea already has an active plan. Continue it in Building now; archive that plan first if you want to restore this one."
              : "We could not restore this plan. Try again.");
        } finally { setPending(false); }
      }}>{pending ? "Restoring…" : "Restore plan"}<span className="sr-only"> {plan.title}</span></button>
    {error && <p role="alert" className="basis-full text-sm text-home-clay-ink">{error}</p>}
  </li>;
}

function PlanHistory({ kind }: { kind: "active" | "done" | "archived" }) {
  const { results, status, loadMore } = usePaginatedQuery(api.platform.weekendPlans.history, { status: kind }, { initialNumItems: 20 });
  if (status === "LoadingFirstPage") return <ModuleSkeleton label={`Loading ${kind} plans`} className="h-32" />;
  return <div className="flex flex-col gap-3">
    {kind === "active" ? (results.length ? results.map(plan => <ActivePlan key={plan.planId} plan={plan} />) : status === "Exhausted" ? <NoActivePlan /> : null)
      : kind === "done" ? <Finished plans={results} />
      : <section aria-labelledby="archived-plans" className="flex flex-col gap-3">
          <h2 id="archived-plans" className="font-editorial text-2xl text-home-ink">Archived</h2>
          <p className="text-sm text-home-ink-2">Archived plans keep your progress. Restore one when your plan has room; your other plans stay as they are.</p>
          {results.length ? <ul className="divide-y divide-home-rule">{results.map(plan => <ArchivedPlan key={plan.planId} plan={plan} />)}</ul> : status === "Exhausted" && <p className="text-sm text-home-ink-3">No archived plans.</p>}
        </section>}
    {status !== "Exhausted" && <button type="button" disabled={status !== "CanLoadMore"} onClick={() => loadMore(20)}
      className={cn(BUTTON, "self-start border border-home-rule bg-home-card text-home-ink")}>
      {status === "LoadingMore" ? "Loading…" : `Show more ${kind === "done" ? "finished" : kind} plans`}
    </button>}
  </div>;
}

function LiveBuilds() {
  return <div className="flex flex-col gap-8">
    <PlanHistory kind="active" />
    <PlanHistory kind="done" />
    <PlanHistory kind="archived" />
    <ModuleErrorBoundary><Drafts /></ModuleErrorBoundary>
  </div>;
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
