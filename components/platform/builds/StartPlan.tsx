"use client";

import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { STAGES } from "@/convex/platform/weekendSteps";
import { ModuleSkeleton, PersonalModule } from "@/components/platform/home/module-states";
import { trackDashboardEvent, type DashboardSource } from "@/lib/track";
import { cn } from "@/lib/utils";
import { STAGE_COPY, dayName, planHref } from "./plan-copy";

const CARD = "flex flex-col gap-5 rounded-[14px] border border-home-rule bg-home-card p-5 sm:p-6";
const EYEBROW = "font-mono text-[11px] uppercase tracking-[0.08em] text-home-ink-3";
const TITLE = "font-editorial text-[26px] font-normal leading-[1.15] tracking-[-0.015em] text-home-ink sm:text-[30px]";
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink";
const BUTTON = cn("inline-flex h-11 items-center gap-2 rounded-[9px] px-4 text-sm font-medium transition-colors", FOCUS);
const PRIMARY = cn(BUTTON, "bg-home-ink text-home-card hover:bg-home-panel disabled:cursor-wait disabled:opacity-60");
const SECONDARY = cn(BUTTON, "border border-home-rule bg-home-card text-home-ink hover:border-home-ink-3");

function StageOverview() {
  return (
    <ol className="grid gap-px overflow-hidden rounded-[10px] border border-home-rule bg-home-rule sm:grid-cols-4">
      {STAGES.map((stage) => (
        <li key={stage.id} className="flex flex-col gap-1 bg-home-paper px-4 py-3">
          <span className={EYEBROW}>{dayName(stage.id)}</span>
          <span className="text-[15px] font-medium text-home-ink">{STAGE_COPY[stage.id].title}</span>
          {STAGE_COPY[stage.id].hours > 0 && (
            <span className="text-[13px] text-home-ink-3">{STAGE_COPY[stage.id].hours} hrs</span>
          )}
        </li>
      ))}
    </ol>
  );
}

function LiveStart({ slug, source }: { slug: string; source: DashboardSource }) {
  const preview = useQuery(api.platform.weekendPlans.startPreview, { slug });
  const start = useMutation(api.platform.weekendPlans.start);
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  if (preview === undefined) return <ModuleSkeleton label="Loading your plan" className="h-[320px]" />;

  const { idea, active } = preview;
  if (idea === null) {
    return (
      <div className={CARD}>
        <h2 className={TITLE}>We can’t find that idea.</h2>
        <p className="text-[15px] text-home-ink-2">It may have moved. Pick one from your shortlist instead.</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/saved" className={PRIMARY}>
            Go to Saved
          </Link>
          <Link href="/dashboard/explore" className={SECONDARY}>
            Browse ideas
          </Link>
        </div>
      </div>
    );
  }

  async function begin(replaceActive: boolean) {
    setPending(true);
    setError("");
    try {
      const result = await start({ slug, replaceActive });
      if (result.created) trackDashboardEvent({ name: "weekend_plan_started", props: { source } });
      router.push(planHref(result.planId));
    } catch (caught) {
      setPending(false);
      // The limit shows as its own card once the preview updates.
      if (caught instanceof ConvexError && (caught.data as { code?: string })?.code === "ACTIVE_PLAN_LIMIT") return;
      console.error("Starting the plan failed", caught);
      setError("We could not start the plan. Try again.");
    }
  }

  if (active && active.slug === idea.slug) {
    return (
      <div className={CARD}>
        <p className={EYEBROW}>Building now</p>
        <h2 className={TITLE}>You are already building {idea.title}.</h2>
        <div className="flex flex-wrap gap-2">
          <Link href={planHref(active.planId)} className={PRIMARY}>
            Open your plan
          </Link>
        </div>
      </div>
    );
  }

  if (active) {
    // Ruling R2: one active plan on the free plan. Archiving is the free way forward.
    return (
      <div className={CARD}>
        <p className={EYEBROW}>One plan at a time</p>
        <h2 className={TITLE}>You are building {active.title} right now.</h2>
        <p className="max-w-[600px] text-[15px] leading-[1.55] text-home-ink-2">
          The free plan runs one weekend plan at a time. Finish it first, or archive it and start {idea.title}{" "}
          instead. An archived plan leaves Builds.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href={planHref(active.planId)} className={PRIMARY}>
            Keep my current plan
          </Link>
          <button
            type="button"
            onClick={() => begin(true)}
            disabled={pending}
            className={cn(SECONDARY, "disabled:cursor-wait disabled:opacity-60")}
          >
            Archive it and start this idea
          </button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-home-clay-ink">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={CARD}>
      <p className={EYEBROW}>Your weekend plan</p>
      <h2 className={TITLE}>{idea.title}</h2>
      <p className="max-w-[600px] text-[15px] leading-[1.55] text-home-ink-2">
        Four stages, from Friday night to Monday. Each has a short checklist and the prompts from the research.
        {idea.buildTime > 0 && ` The research puts the build at about ${idea.buildTime} hours.`}
      </p>
      <StageOverview />
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => begin(false)} disabled={pending} className={PRIMARY}>
          {pending ? "Starting…" : "Start my weekend plan"}
        </button>
        <Link href={`/ideas/${idea.slug}`} className={cn(BUTTON, "text-home-ink-2 hover:text-home-ink")}>
          Read the research
        </Link>
      </div>
      {error && (
        <p role="alert" className="text-sm text-home-clay-ink">
          {error}
        </p>
      )}
    </div>
  );
}

/** The one place a plan starts (FR-15, FR-19). Every "Plan my weekend" link lands here. */
export function StartPlan({ slug, source }: { slug: string; source: DashboardSource }) {
  return (
    <PersonalModule skeleton={<ModuleSkeleton label="Loading your plan" className="h-[320px]" />}>
      <LiveStart slug={slug} source={source} />
    </PersonalModule>
  );
}
