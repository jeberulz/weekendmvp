import Link from "next/link";
import { Clock, Sparkles } from "lucide-react";

import type { IdeaDoc } from "@/components/hubs/hub-data";
import { categoryColor, categoryLabel } from "@/components/hubs/hub-theme";
import { cn } from "@/lib/utils";

/**
 * Editorial "start here" set for a hub page.
 *
 * The Convex tag filters are broad by design (almost every idea is tagged
 * `claude`), so the full grid carries no signal about where to begin. Hubs
 * pass a hand-picked slug list (hardcoded in the route's TS config, matching
 * the rest of the programmatic-hub pattern), resolved upstream by
 * `fetchIdeasBySlugs` so curation doesn't depend on the hub query's 30-cap.
 *
 * Cards are rendered here rather than through the shared IdeaCard primitive
 * for two reasons: the curated set needs its own numbered, higher-emphasis
 * treatment, and IdeaCard's `text-neutral-500` body copy falls below the
 * WCAG AA 4.5:1 threshold on translucent surfaces.
 *
 * Server component — the cards stay crawlable.
 */

function FeaturedIdeaCard({
  idea,
  position,
}: {
  idea: IdeaDoc;
  position: number;
}) {
  const color = categoryColor(idea.category);
  return (
    <Link
      href={`/ideas/${idea.slug}`}
      className="group flex h-full flex-col gap-3 p-6 rounded-2xl bg-white/[0.04] border border-white/10 hover:border-white/25 hover:bg-white/[0.08] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505]"
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={cn(
            "inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-semibold",
            color.bg20,
            color.text,
          )}
          aria-hidden="true"
        >
          {position}
        </span>
        <span
          className={cn(
            "px-2 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider",
            color.badge,
          )}
        >
          {categoryLabel(idea.category)}
        </span>
      </div>
      <h3 className="text-lg font-medium text-white group-hover:text-neutral-200 transition-colors">
        {idea.title}
      </h3>
      <p className="text-sm leading-relaxed text-neutral-300 line-clamp-3">
        {idea.description}
      </p>
      <p className="mt-auto flex items-center gap-2 text-xs text-neutral-400">
        <Clock size={13} aria-hidden="true" />
        <span>~{idea.buildTime || 8} hours to build</span>
      </p>
    </Link>
  );
}

export function HubFeaturedIdeas({
  id = "start-here",
  headingId = "start-here-heading",
  eyebrow = "Hand-picked",
  heading,
  intro,
  ideas,
  panelClassName,
  eyebrowClassName,
}: {
  id?: string;
  headingId?: string;
  eyebrow?: string;
  heading: string;
  intro: string;
  ideas: IdeaDoc[];
  /** Accent border override (literal Tailwind classes). */
  panelClassName?: string;
  /** Accent color for the eyebrow row (literal Tailwind classes). */
  eyebrowClassName?: string;
}) {
  // Degrade gracefully: no resolved slugs → no section at all.
  if (ideas.length === 0) return null;

  return (
    <section id={id} className="mb-16 scroll-mt-28" aria-labelledby={headingId}>
      <div
        className={cn(
          "p-6 md:p-10 rounded-3xl border border-white/15 bg-white/[0.02]",
          panelClassName,
        )}
      >
        <p
          className={cn(
            "inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-neutral-300",
            eyebrowClassName,
          )}
        >
          <Sparkles size={14} aria-hidden="true" />
          {eyebrow}
        </p>
        <h2
          id={headingId}
          className="mt-4 text-2xl md:text-3xl font-medium text-white tracking-tight"
        >
          {heading}
        </h2>
        <p className="mt-3 max-w-2xl text-neutral-300 leading-relaxed">
          {intro}
        </p>
        <ol className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ideas.map((idea, index) => (
            <li key={idea.slug} className="h-full">
              <FeaturedIdeaCard idea={idea} position={index + 1} />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
