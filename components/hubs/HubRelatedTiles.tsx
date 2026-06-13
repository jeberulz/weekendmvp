import * as React from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * "Browse other X" tile grid extracted from /ideas-for/[audience],
 * /solve/[problem], /build-with/[tool], and /ideas/[slug]/collection
 * which previously inlined this markup four times.
 *
 * Each tile renders an icon + label inside a cream-on-dark tile linking
 * to the sibling hub. The "All ideas" trailing tile is opt-in via
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
  /**
   * Tailwind cols class for the lg breakpoint. Defaults to lg:grid-cols-6
   * (matches /ideas-for). /solve uses 5, /build-with uses 5, collection uses 4.
   */
  columnsLgClassName?: string;
  className?: string;
};

const TILE =
  "group p-4 bg-white/5 border border-white/10 rounded-xl hover:border-white/20 hover:bg-white/[0.07] transition-all text-center";

const TILE_LABEL =
  "text-white text-sm font-medium group-hover:text-neutral-200 transition-colors";

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
    <section
      className={cn("mt-24", className)}
      aria-labelledby={id}
    >
      <h2 id={id} className="text-2xl font-medium text-white mb-8">
        {title}
      </h2>
      <div
        className={cn(
          "grid grid-cols-2 md:grid-cols-3 gap-4",
          columnsLgClassName,
        )}
      >
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.slug} href={item.href} className={TILE}>
              <Icon
                size={24}
                className={cn("mb-2 mx-auto", item.iconClassName)}
                aria-hidden="true"
              />
              <p className={TILE_LABEL}>{item.label}</p>
            </Link>
          );
        })}
        {allHref ? (
          <Link href={allHref} className={TILE}>
            <AllIcon />
            <p className={TILE_LABEL}>{allLabel}</p>
          </Link>
        ) : null}
      </div>
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
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-neutral-400 mb-2 mx-auto"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  );
}
