import Link from "next/link";
import type { ReactNode } from "react";
import { isEngineDraftSlug, publicIdeaPath } from "@/lib/engine-drafts";
import { cn } from "@/lib/utils";

/**
 * WP46-S5 (review F3). An engine draft left the catalogue and its research
 * page answers 404, but a member's saves, notes, collections and plans can
 * still hold one. Those views keep the idea, say in text (not colour alone)
 * that its research was retired, and never link to the withheld page or
 * offer a new weekend plan for it.
 */
export function isResearchWithheld(slug: string): boolean {
  return isEngineDraftSlug(slug);
}

export const RETIRED_RESEARCH_LABEL = "Research retired";

/** Small label next to the idea's title. 7.8:1 contrast on its fill. */
export function RetiredTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full bg-home-sunk px-2 font-mono text-[10.5px] uppercase tracking-[0.08em] text-home-ink-2",
        className,
      )}
    >
      {RETIRED_RESEARCH_LABEL}
    </span>
  );
}

/**
 * The idea's title, linking to its public research page only when that page
 * exists. Otherwise plain text with `textClassName`, so a retired title has
 * no hover or focus affordance that promises a link.
 */
export function ResearchTitle({
  slug,
  className,
  textClassName,
  children,
}: {
  slug: string;
  /** Classes for the link. */
  className: string;
  /** Classes for the plain-text title of a retired idea, if it needs its own. */
  textClassName?: string;
  children: ReactNode;
}) {
  const href = publicIdeaPath(slug);
  if (href === null) return <span className={textClassName}>{children}</span>;
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
