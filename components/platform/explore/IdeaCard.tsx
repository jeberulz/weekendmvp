import type { FunctionReturnType } from "convex/server";
import Link from "next/link";
import type { ReactNode } from "react";
import type { api } from "@/convex/_generated/api";
import { IdeaArt } from "@/components/home/IdeaArt";
import { CategoryTag, categoryTintClass } from "@/components/home/ui";
import {
  CATEGORY_META,
  categoryName,
  normalizeCategorySlug,
  toolName,
} from "@/components/ideas/idea-meta";
import { cn } from "@/lib/utils";
import { BuildingBadge, PlanLink } from "@/components/platform/builds/PlanLink";
import { SaveIdeaButton } from "@/components/platform/home/SaveIdeaButton";
import { ogArtPath } from "@/lib/home/library";
import type { DashboardSource } from "@/lib/track";
import { ReasonLine } from "./ReasonLine";
import { ScoreMeters } from "./ScoreMeters";

export type IdeaCardData = FunctionReturnType<typeof api.platform.ideas.library>["items"][number];

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink";

function Category({ raw, building = false }: { raw: string; building?: boolean }) {
  const slug = normalizeCategorySlug(raw);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <CategoryTag slug={slug} name={categoryName(slug)} />
      {building && <BuildingBadge />}
    </div>
  );
}

/** Stand-in band while an idea's cover art is not generated yet. Decorative. */
function NoArt({ raw }: { raw: string }) {
  const slug = normalizeCategorySlug(raw);
  const Icon = CATEGORY_META[slug]?.icon;
  return (
    <div aria-hidden className={cn("flex h-28 items-center justify-center", categoryTintClass(slug))}>
      {Icon && <Icon className="size-8 opacity-70" strokeWidth={1.5} />}
    </div>
  );
}

function toolList(tools: string[], max = 3) {
  return tools.slice(0, max).map(toolName).join(", ");
}

/** Grid card: art band, category, title, pitch, four scores, hours, tools, Save. */
export function IdeaCard({ idea, source }: { idea: IdeaCardData; source: DashboardSource }) {
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-[14px] border border-home-rule bg-home-card">
      {idea.hasArt ? (
        <IdeaArt
          src={ogArtPath(idea.slug)}
          sizes="(min-width: 1280px) 380px, (min-width: 768px) 45vw, 100vw"
          className="h-28 w-full bg-home-sunk"
        />
      ) : (
        <NoArt raw={idea.category} />
      )}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <Category raw={idea.category} building={idea.building} />
        <ReasonLine reason={idea.reason} />
        <h3 className="font-editorial text-[20px] font-normal leading-[1.2] text-home-ink">
          <Link
            href={`/ideas/${idea.slug}`}
            className={`underline-offset-4 hover:text-home-orange-ink hover:underline ${FOCUS}`}
          >
            {idea.title}
          </Link>
        </h3>
        <p className="line-clamp-2 text-sm leading-[1.5] text-home-ink-2">{idea.description}</p>
        {idea.scores ? (
          <ScoreMeters scores={idea.scores} size="sm" />
        ) : (
          <p className="text-[12px] text-home-ink-3">Not scored yet</p>
        )}
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-home-rule pt-2">
          <p className="min-w-0 truncate text-[12px] text-home-ink-2">
            {idea.buildTime > 0 && (
              <span className="font-mono text-[11px] tracking-[0.08em] text-home-ink">{idea.buildTime} HRS</span>
            )}
            {idea.buildTime > 0 && idea.tools.length > 0 && " · "}
            {toolList(idea.tools)}
          </p>
          <div className="-my-1.5 -mr-2 flex shrink-0 items-center">
            <PlanLink slug={idea.slug} title={idea.title} source={source} building={idea.building} variant="icon" />
            <SaveIdeaButton slug={idea.slug} title={idea.title} variant="icon" saved={idea.saved} source={source} />
          </div>
        </div>
      </div>
    </article>
  );
}

/** Dense row for scanning: title, category, hours, score, tools, Save. */
export function IdeaRow({
  idea,
  source,
  meta,
  actions,
  below,
}: {
  idea: IdeaCardData;
  source: DashboardSource;
  /** Extra line under the title, for example when it was saved. */
  meta?: string;
  /** Builder's Hub row tools (S11): collections, note, compare. Before Plan and Save. */
  actions?: ReactNode;
  /** Full-width content under the row, such as a private note. */
  below?: ReactNode;
}) {
  return (
    <div className="py-2.5">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1 md:grid md:grid-cols-[minmax(0,1fr)_150px_64px_56px_150px] md:items-center md:gap-4">
          <div className="min-w-0">
            <Link
              href={`/ideas/${idea.slug}`}
              className={`block text-[15px] font-medium leading-snug text-home-ink underline-offset-4 hover:text-home-orange-ink hover:underline ${FOCUS}`}
            >
              {idea.title}
            </Link>
            {meta && <span className="mt-0.5 block text-[12px] text-home-ink-3">{meta}</span>}
            {idea.building && (
              <div className="mt-1 flex">
                <BuildingBadge />
              </div>
            )}
            {idea.reason && (
              <div className="mt-1">
                <ReasonLine reason={idea.reason} />
              </div>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 md:contents">
            <Category raw={idea.category} />
            <span className="font-mono text-[11px] tracking-[0.08em] text-home-ink-2">
              {idea.buildTime > 0 ? `${idea.buildTime} HRS` : "–"}
            </span>
            <span className="font-mono text-[12px] text-home-ink">
              {idea.score === null ? (
                <>
                  <span aria-hidden>–</span>
                  <span className="sr-only">Not scored</span>
                </>
              ) : (
                <>
                  <span className="sr-only">Score </span>
                  {idea.score}
                  <span className="text-home-ink-3">/10</span>
                </>
              )}
            </span>
            <span className="truncate text-[12px] text-home-ink-2 max-md:hidden">{toolList(idea.tools)}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end">
          {actions}
          <PlanLink slug={idea.slug} title={idea.title} source={source} building={idea.building} variant="icon" />
          <SaveIdeaButton slug={idea.slug} title={idea.title} variant="icon" saved={idea.saved} source={source} />
        </div>
      </div>
      {below}
    </div>
  );
}
