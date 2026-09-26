"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import { STAGES, currentStage, nextStepLabel, progress } from "@/convex/platform/weekendSteps";
import { categoryName, toolName } from "@/components/ideas/idea-meta";
import { CopyPrompt } from "@/components/platform/builds/CopyPrompt";
import { PlanLink } from "@/components/platform/builds/PlanLink";
import { ExportPromptPack } from "@/components/platform/hub/ExportPromptPack";
import {
  STAGE_STATUS_LABEL,
  dayName,
  displayUrl,
  finishedRecently,
  planHref,
  progressLine,
  shortDate,
  stageStatus,
} from "@/components/platform/builds/plan-copy";
import { usePlanPrompts } from "@/components/platform/builds/usePlanPrompts";
import { promptForStage } from "@/lib/dashboard/weekend-prompts";
import { trackDashboardEvent } from "@/lib/track";
import { cn } from "@/lib/utils";
import { ModuleSkeleton, PersonalModule } from "./module-states";
import { SaveIdeaButton } from "./SaveIdeaButton";
import { SetupForm } from "./SetupForm";
import { nextStep, viewedState } from "./home-copy";

type HomeState = FunctionReturnType<typeof api.platform.dashboard.home>;
type PlanSummary = NonNullable<HomeState["activePlan"]>;
type WeeklyRef = { slug: string; title: string } | null;

const CARD = "flex flex-col gap-4 rounded-[14px] border border-home-rule bg-home-card p-5 sm:p-6";
const EYEBROW = "font-mono text-[11px] uppercase tracking-[0.08em] text-home-ink-3";
const TITLE = "font-editorial text-[24px] font-normal leading-[1.15] tracking-[-0.015em] text-home-ink sm:text-[26px]";
const LINK =
  "inline-flex h-11 items-center gap-2 rounded-[9px] px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink";

function SetupCard({ onDone }: { onDone: (message: string) => void }) {
  const skipSetup = useMutation(api.platform.preferences.skipSetup);
  const [skipping, setSkipping] = useState(false);

  async function skip() {
    setSkipping(true);
    try {
      await skipSetup({});
      trackDashboardEvent({ name: "setup_skipped", props: {} });
      onDone("Skipped. You can answer any time in Settings.");
    } catch (error) {
      console.error("Skipping setup failed", error);
      setSkipping(false);
    }
  }

  return (
    <section aria-labelledby="setup-title" className={CARD}>
      <div className="flex items-baseline justify-between gap-3">
        <p className={EYEBROW}>Start here</p>
        <p className={EYEBROW}>3 questions, all optional</p>
      </div>
      <h2 id="setup-title" className={TITLE}>
        Tell us how you build, and we will pick ideas that fit.
      </h2>
      <SetupForm
        initial={{ tools: [], weeklyHours: null, goal: null }}
        submitLabel="Show my ideas"
        onSaved={() => onDone("Saved your answers. Picked for you now uses them.")}
        secondary={
          <button
            type="button"
            onClick={skip}
            disabled={skipping}
            className={`${LINK} px-2.5 text-home-ink-2 hover:text-home-ink disabled:cursor-wait disabled:opacity-60`}
          >
            Skip for now
          </button>
        }
      />
    </section>
  );
}

function StartHere({
  weekly,
  total,
  focusOnMount,
}: {
  weekly: WeeklyRef;
  total: number | null;
  focusOnMount: boolean;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  // After setup the questions give way to this card. Move focus with them.
  useEffect(() => {
    if (focusOnMount) heading.current?.focus();
  }, [focusOnMount]);

  return (
    <section aria-labelledby="next-step-title" className={CARD}>
      <p className={EYEBROW}>Start here</p>
      <h2 id="next-step-title" ref={heading} tabIndex={-1} className={`${TITLE} outline-none`}>
        Save the ideas you could build this weekend.
      </h2>
      <p className="max-w-[560px] text-[15px] leading-[1.55] text-home-ink-2">
        Saved ideas line up here side by side, so choosing one gets easy.
        {weekly && " This week’s pick is a good place to start."}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {weekly && (
          <SaveIdeaButton
            slug={weekly.slug}
            title={weekly.title}
            label="Save this week’s pick"
            variant="primary"
          />
        )}
        <Link
          href="/dashboard/explore"
          className={`${LINK} border border-home-rule bg-home-card text-home-ink hover:border-home-ink-3`}
        >
          {total ? `Browse ${total} ideas` : "Browse ideas"}
        </Link>
      </div>
    </section>
  );
}

function Shortlist({ home }: { home: HomeState }) {
  const rows = home.saved.latest.slice(0, 3);
  const count = `${home.saved.count}${home.saved.capped ? "+" : ""}`;
  return (
    <section aria-labelledby="next-step-title" className={CARD}>
      <div className="flex items-baseline justify-between gap-3">
        <p className={EYEBROW}>Your shortlist</p>
        <p className={EYEBROW}>{count} saved</p>
      </div>
      <h2 id="next-step-title" className={TITLE}>
        Pick one idea to build this weekend.
      </h2>
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">Your latest saved ideas, compared</caption>
        <thead>
          <tr className="border-b border-home-ink font-mono text-[11px] uppercase tracking-[0.08em] text-home-ink-3">
            <th scope="col" className="py-2 pr-3 font-normal">Idea</th>
            <th scope="col" className="w-16 py-2 pr-3 font-normal">Hours</th>
            <th scope="col" className="w-16 py-2 pr-3 font-normal">Score</th>
            <th scope="col" className="hidden w-[180px] py-2 pr-3 font-normal sm:table-cell">Tools</th>
            <th scope="col" className="w-11 py-2 font-normal">
              <span className="sr-only">Plan</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((idea) => (
            <tr key={idea.ideaId} className="border-b border-home-rule align-top">
              <th scope="row" className="py-3 pr-3 font-normal">
                <Link
                  href={`/ideas/${idea.slug}`}
                  className="text-[15px] font-medium text-home-ink underline-offset-4 hover:text-home-orange-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink"
                >
                  {idea.title}
                </Link>
                <span className="mt-0.5 block text-[13px] text-home-ink-3">{categoryName(idea.category)}</span>
              </th>
              <td className="py-3 pr-3 font-mono text-[13px] text-home-ink">{idea.buildTime}</td>
              <td className="py-3 pr-3 font-mono text-[13px] text-home-ink">
                {idea.score === null ? (
                  <>
                    <span aria-hidden>–</span>
                    <span className="sr-only">Not scored</span>
                  </>
                ) : (
                  <>
                    {idea.score}
                    <span className="text-home-ink-3">/10</span>
                  </>
                )}
              </td>
              <td className="hidden py-3 pr-3 text-[13px] text-home-ink-2 sm:table-cell">
                {idea.tools.length > 0 ? idea.tools.slice(0, 3).map(toolName).join(", ") : "None listed"}
              </td>
              <td className="py-1">
                <PlanLink slug={idea.slug} title={idea.title} source="home" variant="icon" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/dashboard/saved" className={`${LINK} bg-home-ink text-home-card hover:bg-home-panel`}>
          See all saved
        </Link>
        <Link href="/dashboard/explore" className={`${LINK} text-home-ink-2 hover:text-home-ink`}>
          Find more ideas
        </Link>
      </div>
    </section>
  );
}

const STAGE_BAR = {
  done: "bg-home-sage-ink",
  current: "bg-home-orange",
  upcoming: "bg-home-sunk",
} as const;

/** Building (PRD 6.2): progress by day, the next step, and today's prompt. */
function BuildingCard({ plan }: { plan: PlanSummary }) {
  const stage = currentStage(plan.doneKeys);
  const next = nextStepLabel(plan.doneKeys);
  // Friday and Monday have no prompts, so there is nothing to fetch.
  const prompts = usePlanPrompts(stage === "sat" || stage === "sun" ? plan.slug : null);
  const prompt = prompts.status === "ready" ? promptForStage(prompts.prompts, stage) : null;

  return (
    <section aria-labelledby="next-step-title" className={CARD}>
      <div className="flex items-baseline justify-between gap-3">
        <p className={EYEBROW}>Building now</p>
        <p className={EYEBROW}>{progressLine(progress(plan.doneKeys))}</p>
      </div>
      <h2 id="next-step-title" className={TITLE}>
        {plan.title}
      </h2>
      <ol aria-label="Your weekend" className="grid grid-cols-4 gap-2">
        {STAGES.map((s) => {
          const status = stageStatus(s.id, plan.doneKeys);
          return (
            <li key={s.id} className="flex flex-col gap-1.5">
              <span aria-hidden className={cn("h-1.5 rounded-full", STAGE_BAR[status])} />
              <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-home-ink">
                <span aria-hidden>{s.id}</span>
                <span className="sr-only">{dayName(s.id)}:</span>
              </span>
              <span className={cn("text-[12px]", status === "current" ? "font-medium text-home-ink" : "text-home-ink-3")}>
                {STAGE_STATUS_LABEL[status]}
              </span>
            </li>
          );
        })}
      </ol>
      {next && (
        <div className="flex flex-col gap-0.5">
          <p className="text-[15px] leading-[1.55] text-home-ink-2">
            <span className="font-medium text-home-ink">Next: </span>
            {next}.
          </p>
          {prompt && <p className="text-sm text-home-ink-3">Today’s prompt: {prompt.title}</p>}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {prompt && <CopyPrompt prompt={prompt} surface="home" variant="primary" />}
        <Link
          href={planHref(plan.planId)}
          className={cn(
            LINK,
            prompt
              ? "border border-home-rule bg-home-card text-home-ink hover:border-home-ink-3"
              : "bg-home-ink text-home-card hover:bg-home-panel",
          )}
        >
          Open plan
        </Link>
      </div>
      {/* PRD 7.2: "Export prompt pack" next to Copy prompt. Flag on only. */}
      <ExportPromptPack slug={plan.slug} title={plan.title} />
    </section>
  );
}

/** Finished (PRD 6.2): "You shipped." with the live link, for a week. */
function FinishedCard({ plan }: { plan: PlanSummary }) {
  return (
    <section aria-labelledby="next-step-title" className={CARD}>
      <p className={EYEBROW}>Finished{plan.completedAt ? ` ${shortDate(plan.completedAt)}` : ""}</p>
      <h2 id="next-step-title" className={TITLE}>
        You shipped.
      </h2>
      <p className="text-[15px] leading-[1.55] text-home-ink-2">
        {plan.title}
        {plan.liveUrl ? (
          <>
            {" is live at "}
            <a
              href={plan.liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-home-orange-ink underline underline-offset-4 hover:text-home-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink"
            >
              {displayUrl(plan.liveUrl)}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
            .
          </>
        ) : (
          " is done."
        )}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/dashboard/saved" className={`${LINK} bg-home-ink text-home-card hover:bg-home-panel`}>
          Pick the next idea
        </Link>
        <Link href={planHref(plan.planId)} className={`${LINK} text-home-ink-2 hover:text-home-ink`}>
          See the plan
        </Link>
      </div>
    </section>
  );
}

function LiveNextStep({ weekly, total }: { weekly: WeeklyRef; total: number | null }) {
  const home = useQuery(api.platform.dashboard.home);
  const viewed = useRef(false);
  const [justSetUp, setJustSetUp] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  // Browser-only (behind PersonalModule), so the local clock is safe to read.
  const [now] = useState(() => Date.now());
  const input = home
    ? {
        savedCount: home.saved.count,
        setupDone: home.setupDone,
        setupSkipped: home.setupSkipped,
        building: home.activePlan !== null,
        finishedRecently: finishedRecently(home.lastFinished?.completedAt, now),
      }
    : null;
  const state = input ? viewedState(input) : null;

  useEffect(() => {
    if (!home || !state || viewed.current) return;
    viewed.current = true;
    trackDashboardEvent({ name: "dashboard_viewed", props: { state, plan: home.plan } });
  }, [home, state]);

  if (home === undefined || input === null) {
    return <ModuleSkeleton label="Loading your next step" className="h-[260px]" />;
  }
  const step = nextStep(input);
  return (
    <>
      {step === "building" && home.activePlan ? (
        <BuildingCard plan={home.activePlan} />
      ) : step === "finished" && home.lastFinished ? (
        <FinishedCard plan={home.lastFinished} />
      ) : step === "choosing" ? (
        <Shortlist home={home} />
      ) : step === "setup" ? (
        <SetupCard
          onDone={(message) => {
            setJustSetUp(true);
            setAnnouncement(message);
          }}
        />
      ) : (
        <StartHere weekly={weekly} total={total} focusOnMount={justSetUp} />
      )}
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </>
  );
}

/** Module 1. Changes with the member's state (PRD 6.2). */
export function NextStepCard({ weekly, total }: { weekly: WeeklyRef; total: number | null }) {
  return (
    <PersonalModule skeleton={<ModuleSkeleton label="Loading your next step" className="h-[260px]" />}>
      <LiveNextStep weekly={weekly} total={total} />
    </PersonalModule>
  );
}
