import * as React from "react";
import Link from "next/link";
import { Clock } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Idea card primitive. Replaces idea-card markup previously duplicated
 * across HubIdeasGrid, RelatedIdeas, IdeasExplorer, and homepage Featured
 * Ideas.
 *
 * Variants:
 *   - default:  full card with category badge + meta chips + build time
 *               (hubs, homepage Featured Ideas, generic listings)
 *   - compact:  tight card with category eyebrow + title only
 *               (RelatedIdeas, dense sidebars)
 *   - featured: hero card with optional accent border + larger type
 *               (homepage Featured Ideas hero, top-of-grid emphasis)
 *
 * Themes:
 *   - dark (default): #050505 / #0A0A0A surface, neutral-500 body text
 *   - cream:          neutral-100 surface, neutral-900 title
 */

export type IdeaCardData = {
  slug: string;
  title: string;
  description?: string;
  category?: string | null;
  /** Display label for the category badge (humanized). */
  categoryLabel?: string | null;
  /** Hours to build (string from manifest or number). */
  buildTime?: string | number | null;
  /** Pre-formatted meta chip text (e.g. "8 hours"). Bypasses the buildTime fallback. */
  buildTimeLabel?: string | null;
  /** "deep" | "summary" -- drives the Deep Research / Quick Idea chip. */
  researchLevel?: "deep" | "summary" | string | null;
  /**
   * Per-category badge tint classes (hubs + homepage Featured Ideas).
   * Overrides the default `.idea-badge` orange. Pass full class strings.
   */
  badgeClass?: string | null;
};

export type IdeaCardVariant = "default" | "compact" | "featured";
export type IdeaCardTheme = "dark" | "cream";
/**
 * Surface treatment.
 *   - elevated:    bg-[#0A0A0A] / bg-neutral-100 (IdeasExplorer, RelatedIdeas)
 *   - translucent: bg-white/5 (hubs, homepage Featured Ideas)
 */
export type IdeaCardSurface = "elevated" | "translucent";

type IdeaCardProps = {
  idea: IdeaCardData;
  variant?: IdeaCardVariant;
  theme?: IdeaCardTheme;
  surface?: IdeaCardSurface;
  /** Override the link target. Defaults to /ideas/{slug}. */
  href?: string;
  /** Hide the card from layout while keeping it in the DOM (filter UIs). */
  hidden?: boolean;
  /** Append additional classes (animate-enter, layout overrides, etc.). */
  className?: string;
};

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

const SURFACE: Record<IdeaCardTheme, Record<IdeaCardSurface, string>> = {
  dark: {
    elevated: "bg-[#0A0A0A] border border-white/5 hover:border-white/10",
    translucent:
      "bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/[0.07]",
  },
  cream: {
    elevated:
      "bg-neutral-100 border border-neutral-200 hover:border-neutral-300",
    translucent: "bg-white/60 border border-black/10 hover:border-black/20",
  },
};

const TITLE: Record<IdeaCardTheme, string> = {
  dark: "text-white group-hover:text-neutral-200",
  cream: "text-neutral-900 group-hover:text-black",
};

const BODY: Record<IdeaCardTheme, string> = {
  dark: "text-neutral-500",
  cream: "text-neutral-600",
};

const META: Record<IdeaCardTheme, string> = {
  dark: "text-neutral-600",
  cream: "text-neutral-500",
};

const CATEGORY_EYEBROW: Record<IdeaCardTheme, string> = {
  dark: "text-neutral-400",
  cream: "text-neutral-400",
};

export function IdeaCard({
  idea,
  variant = "default",
  theme = "dark",
  surface = "elevated",
  href,
  hidden = false,
  className,
}: IdeaCardProps) {
  const target = href ?? `/ideas/${idea.slug}`;
  const surfaceClass = SURFACE[theme][surface];
  const buildTimeText =
    idea.buildTimeLabel ??
    (idea.buildTime != null ? `${idea.buildTime} hours` : null);

  if (variant === "compact") {
    return (
      <Link
        href={target}
        className={cn(
          "idea-card group block p-4 rounded-2xl transition-all",
          surfaceClass,
          hidden && "hidden",
          className,
        )}
        data-category={idea.category ?? undefined}
      >
        {idea.categoryLabel ? (
          <span
            className={cn(
              "text-[10px] font-bold uppercase tracking-widest",
              CATEGORY_EYEBROW[theme],
            )}
          >
            {idea.categoryLabel}
          </span>
        ) : null}
        <h4
          className={cn(
            "idea-title text-sm font-medium transition-colors mt-1",
            TITLE[theme],
          )}
        >
          {idea.title}
        </h4>
      </Link>
    );
  }

  if (variant === "featured") {
    return (
      <Link
        href={target}
        className={cn(
          "idea-card group block p-8 rounded-3xl transition-all",
          surfaceClass,
          hidden && "hidden",
          className,
        )}
        data-category={idea.category ?? undefined}
      >
        {idea.categoryLabel || buildTimeText ? (
          <div className="flex items-center gap-3 mb-5">
            {idea.categoryLabel ? (
              <span
                className={cn(
                  "px-2 py-1 text-[10px] font-semibold uppercase tracking-wider",
                  idea.badgeClass ?? "idea-badge rounded-md",
                  !idea.badgeClass && "rounded-md",
                )}
              >
                {idea.categoryLabel}
              </span>
            ) : null}
            {buildTimeText ? (
              <span className={cn("text-xs", META[theme])}>
                {idea.buildTimeLabel ? buildTimeText : `~${buildTimeText}`}
              </span>
            ) : null}
          </div>
        ) : null}
        <h3
          className={cn(
            "idea-title text-2xl font-medium mb-3 transition-colors tracking-tight",
            TITLE[theme],
          )}
        >
          {idea.title}
        </h3>
        {idea.description ? (
          <p className={cn("text-sm leading-relaxed", BODY[theme])}>
            {truncate(idea.description, 180)}
          </p>
        ) : null}
      </Link>
    );
  }

  // default
  return (
    <Link
      href={target}
      className={cn(
        "idea-card group block p-6 rounded-2xl transition-all",
        surfaceClass,
        hidden && "hidden",
        className,
      )}
      data-category={idea.category ?? undefined}
    >
      {idea.categoryLabel || idea.researchLevel || buildTimeText ? (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {idea.categoryLabel ? (
            <span
              className={cn(
                "px-2 py-1 text-[10px] font-semibold uppercase tracking-wider",
                idea.badgeClass ?? "idea-badge rounded-md",
                !idea.badgeClass && "rounded-md",
              )}
            >
              {idea.categoryLabel}
            </span>
          ) : null}
          {idea.buildTimeLabel && surface === "translucent" ? (
            <span className={cn("text-xs", META[theme])}>
              {idea.buildTimeLabel}
            </span>
          ) : null}
          {idea.researchLevel === "deep" ? (
            <span className="px-2 py-1 rounded-md text-[10px] font-medium uppercase tracking-wider bg-sky-500/10 text-sky-300/70 border border-sky-500/20">
              Deep Research
            </span>
          ) : idea.researchLevel ? (
            <span className="px-2 py-1 rounded-md text-[10px] font-medium uppercase tracking-wider bg-white/5 text-neutral-500 border border-white/10">
              Quick Idea
            </span>
          ) : null}
        </div>
      ) : null}
      <h3
        className={cn(
          "idea-title text-lg font-medium mb-2 transition-colors",
          TITLE[theme],
        )}
      >
        {idea.title}
      </h3>
      {idea.description ? (
        <p
          className={cn(
            "text-sm leading-relaxed mb-4",
            surface === "translucent" && "line-clamp-2",
            BODY[theme],
          )}
        >
          {surface === "translucent"
            ? truncate(idea.description, 120)
            : truncate(idea.description, 160)}
        </p>
      ) : null}
      {idea.buildTime && surface === "elevated" ? (
        <div className={cn("flex items-center gap-2 text-xs", META[theme])}>
          <Clock size={14} aria-hidden="true" />
          <span>~{idea.buildTime} hours to build</span>
        </div>
      ) : null}
    </Link>
  );
}
