import Link from "next/link";
import { IdeaArt } from "@/components/home/IdeaArt";
import { CategoryTag } from "@/components/home/ui";
import { toolName } from "@/components/ideas/idea-meta";
import { GOAL_LABEL } from "@/lib/home/labels";
import { clamp } from "@/lib/home/text";
import type { SpotlightIdea } from "@/lib/home/types";
import { SaveIdeaButton } from "./SaveIdeaButton";

const SCORES = [
  ["Opportunity", "opportunity"],
  ["Pain", "pain"],
  ["Timing", "timing"],
  ["Builder confidence", "builder_confidence"],
] as const;

/**
 * Module 2. The homepage's idea of the week, rendered on the server from the
 * same hourly cache, so it matches `/` and shows even when Convex is down.
 */
export function WeeklyPick({ idea, weekLabel }: { idea: SpotlightIdea; weekLabel: string }) {
  const goal = GOAL_LABEL[idea.revenueGoal];
  return (
    <section aria-labelledby="weekly-pick-heading" className="flex flex-col gap-3">
      <h2
        id="weekly-pick-heading"
        className="font-mono text-[11px] font-normal uppercase tracking-[0.08em] text-home-ink-3"
      >
        Idea of the week · {weekLabel}
      </h2>
      <article
        aria-labelledby="weekly-pick-title"
        className="overflow-hidden rounded-[14px] border border-home-rule bg-home-card"
      >
        {/* IdeaArt fills the width only while the band is wider than tall and
            no more than about 3.7 times as wide, so the height follows the width. */}
        <IdeaArt src={idea.art} sizes="(min-width: 1280px) 820px, 100vw" className="aspect-[2.4/1] w-full bg-home-sunk sm:aspect-[3.6/1]" />
        <div className="flex flex-col gap-4 p-5 sm:p-6">
          <div className="flex">
            <CategoryTag slug={idea.category} name={idea.categoryName} />
          </div>
          <h3
            id="weekly-pick-title"
            className="font-editorial text-[26px] font-normal leading-[1.1] tracking-[-0.02em] text-home-ink sm:text-[28px]"
          >
            {idea.title}
          </h3>
          <p className="max-w-[640px] text-[15px] leading-[1.55] text-home-ink-2">{clamp(idea.description, 220)}</p>
          <dl className="grid grid-cols-1 gap-x-5 gap-y-3 sm:grid-cols-2">
            {SCORES.map(([label, key]) => {
              const value = idea.scores[key];
              return (
                <div key={key} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-y-1.5 text-[13px]">
                  <dt className="text-home-ink-3">{label}</dt>
                  <dd className="font-semibold text-home-ink">
                    {value}
                    <span className="sr-only"> out of 10</span>
                  </dd>
                  <dd aria-hidden className="col-span-2 h-1.5 overflow-hidden rounded-full bg-home-rule">
                    <div className="h-full bg-home-ink" style={{ width: `${Math.max(0, Math.min(value, 10)) * 10}%` }} />
                  </dd>
                </div>
              );
            })}
          </dl>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-home-ink-2">
            <span className="font-mono text-[11px] tracking-[0.08em] text-home-ink">{idea.buildTime} HRS</span>
            {goal && <span>{goal} goal</span>}
            {idea.sources > 0 && <span>{idea.sources} cited sources</span>}
            {idea.tools.length > 0 && (
              <ul aria-label="Build tools" className="flex flex-wrap gap-1.5">
                {idea.tools.slice(0, 4).map((tool) => (
                  <li
                    key={tool}
                    className="rounded-[5px] border border-home-rule px-[7px] py-0.5 font-mono text-[11px] text-home-ink-2"
                  >
                    {toolName(tool)}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/ideas/${idea.slug}`}
              className="inline-flex h-11 items-center gap-2 rounded-[9px] bg-home-ink px-4 text-sm font-medium text-home-card transition-colors hover:bg-home-panel focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink"
            >
              Read the research
              <span className="sr-only">: {idea.title}</span>
            </Link>
            <SaveIdeaButton slug={idea.slug} title={idea.title} />
          </div>
        </div>
      </article>
    </section>
  );
}
