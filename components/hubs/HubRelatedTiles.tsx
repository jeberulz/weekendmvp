import * as React from "react";
import Link from "next/link";

import { Container } from "@/components/home/ui";
import { cn } from "@/lib/utils";

/**
 * "Browse other X" tile grid: an icon and a serif label on a paper card,
 * linking to the sibling hub. The "All ideas" trailing tile is opt-in via
 * `allHref` + `allLabel`.
 */

export type HubRelatedTile = {
  slug: string;
  label: string;
  href: string;
  icon: React.ComponentType<{
    size?: number;
    className?: string;
    "aria-hidden"?: boolean | "true" | "false";
  }>;
  /** Kept for callers that still pass a colour; tiles draw in ink. */
  iconClassName?: string;
};

type HubRelatedTilesProps = {
  /** Section heading. */
  title: string;
  /** Optional override for the heading id (defaults to a stable slug). */
  headingId?: string;
  /** Tiles to render. Excluded by callers that need to filter the current slug. */
  items: HubRelatedTile[];
  /** Optional trailing "all" tile (e.g. /startup-ideas). */
  allHref?: string;
  allLabel?: string;
  /** Tailwind cols class for the lg breakpoint. Defaults to lg:grid-cols-6. */
  columnsLgClassName?: string;
  className?: string;
};

const TILE =
  "group flex h-full flex-col gap-3 rounded-2xl border border-home-rule bg-home-card p-4 text-home-ink transition-colors duration-200 hover:border-home-ink motion-reduce:transition-none " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink";

const TILE_LABEL = "font-editorial text-lg leading-[1.15]";

export function HubRelatedTiles({
  title,
  headingId,
  items,
  allHref,
  allLabel = "All Ideas",
  columnsLgClassName = "lg:grid-cols-6",
  className,
}: HubRelatedTilesProps) {
  const id = headingId ?? "hub-related-tiles-heading";
  return (
    <section className={cn("py-14 lg:py-20", className)} aria-labelledby={id}>
      <Container className="flex flex-col gap-6">
        <h2 id={id} className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-home-ink-3 md:text-xs">
          {title}
        </h2>
        <ul className={cn("grid grid-cols-2 gap-3 md:grid-cols-3", columnsLgClassName)}>
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.slug}>
                <Link href={item.href} className={TILE}>
                  <Icon size={24} aria-hidden="true" />
                  <span className={TILE_LABEL}>{item.label}</span>
                </Link>
              </li>
            );
          })}
          {allHref ? (
            <li>
              <Link href={allHref} className={TILE}>
                <AllIcon />
                <span className={TILE_LABEL}>{allLabel}</span>
              </Link>
            </li>
          ) : null}
        </ul>
      </Container>
    </section>
  );
}

function AllIcon() {
  // Inline svg so callers don't need to pick a "grid" icon from lucide.
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  );
}
