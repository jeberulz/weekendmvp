"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { api } from "@/convex/_generated/api";
import { categoryName, toolName } from "@/components/ideas/idea-meta";
import { trackDashboardEvent } from "@/lib/track";
import { ModuleSkeleton, PersonalModule } from "./module-states";
import { SaveIdeaButton } from "./SaveIdeaButton";
import { nextStepState } from "./home-copy";

type HomeState = FunctionReturnType<typeof api.platform.dashboard.home>;
type WeeklyRef = { slug: string; title: string } | null;

const CARD = "flex flex-col gap-4 rounded-[14px] border border-home-rule bg-home-card p-5 sm:p-6";
const EYEBROW = "font-mono text-[11px] uppercase tracking-[0.08em] text-home-ink-3";
const TITLE = "font-editorial text-[24px] font-normal leading-[1.15] tracking-[-0.015em] text-home-ink sm:text-[26px]";
const LINK =
  "inline-flex h-11 items-center gap-2 rounded-[9px] px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink";

function StartHere({ weekly, total }: { weekly: WeeklyRef; total: number | null }) {
  return (
    <section aria-labelledby="next-step-title" className={CARD}>
      <p className={EYEBROW}>Start here</p>
      <h2 id="next-step-title" className={TITLE}>
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
            <th scope="col" className="hidden w-[180px] py-2 font-normal sm:table-cell">Tools</th>
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
              <td className="hidden py-3 text-[13px] text-home-ink-2 sm:table-cell">
                {idea.tools.length > 0 ? idea.tools.slice(0, 3).map(toolName).join(", ") : "None listed"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/dashboard/explore?view=saved" className={`${LINK} bg-home-ink text-home-card hover:bg-home-panel`}>
          See all saved
        </Link>
        <Link href="/dashboard/explore" className={`${LINK} text-home-ink-2 hover:text-home-ink`}>
          Find more ideas
        </Link>
      </div>
    </section>
  );
}

function LiveNextStep({ weekly, total }: { weekly: WeeklyRef; total: number | null }) {
  const home = useQuery(api.platform.dashboard.home);
  const viewed = useRef(false);
  const state = home ? nextStepState(home.saved.count) : null;

  useEffect(() => {
    if (!home || !state || viewed.current) return;
    viewed.current = true;
    trackDashboardEvent({ name: "dashboard_viewed", props: { state, plan: home.plan } });
  }, [home, state]);

  if (home === undefined) return <ModuleSkeleton label="Loading your next step" className="h-[260px]" />;
  return state === "choosing" ? <Shortlist home={home} /> : <StartHere weekly={weekly} total={total} />;
}

/** Module 1. Changes with the member's state (PRD 6.2). */
export function NextStepCard({ weekly, total }: { weekly: WeeklyRef; total: number | null }) {
  return (
    <PersonalModule skeleton={<ModuleSkeleton label="Loading your next step" className="h-[260px]" />}>
      <LiveNextStep weekly={weekly} total={total} />
    </PersonalModule>
  );
}
