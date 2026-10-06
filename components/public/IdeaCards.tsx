import Link from "next/link";

import { IdeaArt } from "@/components/home/IdeaArt";
import { Icon } from "@/components/home/icons";
import { CategoryTag, WeekendMeter, categoryTintClass } from "@/components/home/ui";
import { CATEGORY_META } from "@/components/ideas/idea-meta";
import { GOAL_LABEL } from "@/lib/home/labels";
import { cn } from "@/lib/utils";
import { ScoreBars, ScoreCells } from "./ScoreBars";
import type { PublicIdea } from "./types";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink";

export const libraryNo = (n: number | null) => (n ? `N°${String(n).padStart(3, "0")}` : null);

/** Tinted band standing in for art that is not generated yet. Decorative. */
function ArtBand({ idea, className }: { idea: PublicIdea; className: string }) {
  if (idea.art) {
    return <IdeaArt src={idea.art} sizes="(min-width: 1280px) 380px, (min-width: 768px) 45vw, 100vw" className={cn("w-full bg-home-sunk", className)} />;
  }
  const CategoryIcon = CATEGORY_META[idea.category]?.icon;
  return (
    <div aria-hidden className={cn("flex items-center justify-center", categoryTintClass(idea.category), className)}>
      {CategoryIcon && <CategoryIcon className="size-8 opacity-70" strokeWidth={1.5} />}
    </div>
  );
}

/**
 * The dashboard explore card on a public page: art band, category, serif
 * title (the only link), pitch, the four scores, hours and tools. The whole
 * card shows a hover border; the title link carries the focus ring.
 */
export function PublicIdeaCard({ idea, headingLevel: H = "h3" }: { idea: PublicIdea; headingLevel?: "h2" | "h3" }) {
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-[14px] border border-home-rule bg-home-card transition-colors duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] hover:border-home-ink">
      <ArtBand idea={idea} className="h-28" />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-2">
          {idea.category ? <CategoryTag slug={idea.category} name={idea.categoryName} /> : <span />}
          {idea.libraryNo && (
            <span className="font-mono text-[11px] tracking-[0.06em] text-home-ink-3">{libraryNo(idea.libraryNo)}</span>
          )}
        </div>
        <H className="font-editorial text-[20px] font-normal leading-[1.2] text-home-ink">
          <Link
            href={`/ideas/${idea.slug}`}
            className={cn("underline-offset-4 after:absolute after:inset-0 hover:text-home-orange-ink hover:underline", FOCUS)}
          >
            {idea.title}
          </Link>
        </H>
        <p className="line-clamp-2 text-sm leading-[1.5] text-home-ink-2">{idea.description}</p>
        {idea.scores ? <ScoreBars scores={idea.scores} /> : <p className="text-[12px] text-home-ink-3">Not scored yet</p>}
        <p className="mt-auto truncate border-t border-home-rule pt-2.5 text-[12px] text-home-ink-2">
          {idea.buildTime > 0 && (
            <span className="font-mono text-[11px] tracking-[0.08em] text-home-ink">{idea.buildTime} HRS</span>
          )}
          {idea.buildTime > 0 && idea.tools.length > 0 && " · "}
          {idea.tools.join(", ")}
        </p>
      </div>
    </article>
  );
}

/** Larger "Start here" card: taller art, weekend meter and boxed scores. */
export function FeaturedIdeaCard({ idea }: { idea: PublicIdea }) {
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-home-rule bg-home-card transition-colors duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] hover:border-home-ink">
      <ArtBand idea={idea} className="h-44" />
      <div className="flex flex-1 flex-col gap-3.5 p-[22px]">
        <div className="flex items-center justify-between gap-2">
          {idea.category ? <CategoryTag slug={idea.category} name={idea.categoryName} /> : <span />}
          {idea.libraryNo && (
            <span className="font-mono text-[11px] tracking-[0.06em] text-home-ink-3">{libraryNo(idea.libraryNo)}</span>
          )}
        </div>
        <h3 className="font-editorial text-[24px] font-normal leading-[1.12] tracking-[-0.01em] text-home-ink md:text-[26px]">
          <Link href={`/ideas/${idea.slug}`} className={cn("after:absolute after:inset-0", FOCUS)}>
            {idea.title}
          </Link>
        </h3>
        <p className="text-[15px] leading-[1.5] text-home-ink-2">{idea.description}</p>
        {idea.buildTime > 0 && <WeekendMeter hours={idea.buildTime} className="pt-1" />}
        {idea.scores && <ScoreCells scores={idea.scores} />}
        <span
          aria-hidden
          className="mt-auto inline-flex items-center gap-2 pt-1 text-[15px] font-medium text-home-orange-ink underline-offset-4 group-hover:underline"
        >
          Read the breakdown
          <Icon name="arrow" size={16} strokeWidth={1.75} />
        </span>
      </div>
    </article>
  );
}

const COLS = "lg:grid-cols-[84px_minmax(0,1fr)_150px_236px_72px_24px]";

/** One idea as a ledger row (the homepage index grammar, on paper). */
export function PublicIdeaRow({ idea }: { idea: PublicIdea }) {
  const goal = GOAL_LABEL[idea.revenueGoal] ?? "";
  const label = [
    idea.title,
    idea.categoryName,
    idea.buildTime > 0 ? `${idea.buildTime} hours` : "",
    idea.score !== null ? `score ${idea.score} out of 10` : "not scored",
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <li className="border-b border-home-rule">
      <Link
        href={`/ideas/${idea.slug}`}
        aria-label={label}
        className={cn(
          "group flex flex-col gap-2 py-[18px] transition-colors duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] lg:grid lg:items-center lg:gap-4 lg:rounded-[10px] lg:px-4 lg:hover:bg-home-card",
          COLS,
          FOCUS,
        )}
      >
        <span className="flex justify-between font-mono text-[11px] tracking-[0.06em] text-home-ink-3 lg:block lg:text-[13px] lg:tracking-normal">
          <span>
            {libraryNo(idea.libraryNo)}
            <span className="lg:hidden">
              {idea.libraryNo && idea.categoryName ? " · " : ""}
              {idea.categoryName.toUpperCase()}
            </span>
          </span>
          <span className="text-home-ink-2 lg:hidden">
            {[idea.buildTime > 0 ? `${idea.buildTime} HRS` : "", idea.score !== null ? `${idea.score}/10` : ""]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
        <span className="flex min-w-0 items-start justify-between gap-4 lg:block">
          <span className="flex min-w-0 flex-col gap-1">
            <span className="font-editorial text-[22px] leading-[1.15] tracking-[-0.01em] text-home-ink lg:text-[23px]">
              {idea.title}
            </span>
            <span className="hidden truncate text-sm leading-[1.45] text-home-ink-3 lg:block">{idea.description}</span>
          </span>
          <Icon name="arrow" size={20} strokeWidth={1.75} className="mt-1 shrink-0 text-home-ink lg:hidden" />
        </span>
        <span className="hidden lg:block">{idea.category && <CategoryTag slug={idea.category} name={idea.categoryName} />}</span>
        <span className="hidden items-center gap-3 lg:flex">
          {idea.buildTime > 0 ? (
            <>
              <WeekendMeter hours={idea.buildTime} cell={8} showNote={false} />
              <span className="whitespace-nowrap font-mono text-[13px] font-medium text-home-ink">{idea.buildTime} HRS</span>
            </>
          ) : (
            <span className="font-mono text-[13px] text-home-ink-3">–</span>
          )}
        </span>
        <span className="hidden font-mono text-[13px] text-home-ink lg:block">
          {idea.score !== null ? (
            <>
              {idea.score}
              <span className="text-home-ink-3">/10</span>
            </>
          ) : (
            <span className="text-home-ink-3">–</span>
          )}
          {goal && <span className="sr-only">, {goal} goal</span>}
        </span>
        <Icon name="arrow" size={20} strokeWidth={1.75} className="hidden text-home-ink lg:block" />
      </Link>
    </li>
  );
}

export function IdeaRowsHead() {
  return (
    <div
      aria-hidden
      className={cn(
        "hidden border-b border-home-ink px-4 pb-3 font-mono text-[11px] tracking-[0.08em] text-home-ink-3 lg:grid lg:gap-4",
        COLS,
      )}
    >
      <span>NO.</span>
      <span>IDEA</span>
      <span>CATEGORY</span>
      <span>BUILD TIME</span>
      <span>SCORE</span>
      <span />
    </div>
  );
}

