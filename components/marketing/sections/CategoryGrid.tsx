import * as React from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import {
  type Accent,
  type Theme,
  tokensFor,
} from "@/components/marketing/section-theme";
import { SectionHeading } from "./SectionHeading";

export type CategoryGridItem = {
  label: string;
  href: string;
  icon?: React.ReactNode;
  /** Optional count chip (e.g. "12 ideas"). */
  count?: number;
};

export type CategoryGridProps = {
  theme?: Theme;
  accent?: Accent;
  eyebrow?: string;
  title?: React.ReactNode;
  sub?: React.ReactNode;
  items: CategoryGridItem[];
  className?: string;
};

/**
 * "Browse by category" tile grid. Each tile is a Link with an optional
 * icon + count badge. Theme + accent control the resting color.
 */
export function CategoryGrid({
  theme = "dark",
  accent = "orange",
  eyebrow,
  title,
  sub,
  items,
  className,
}: CategoryGridProps) {
  const t = tokensFor(theme, accent);
  const headingId = React.useId();
  const labelled = Boolean(title);

  return (
    <section
      className={cn("relative w-full px-5 md:px-8 py-16 md:py-24", className)}
      aria-labelledby={labelled ? headingId : undefined}
    >
      <div className="max-w-7xl mx-auto">
        {title || eyebrow ? (
          <div className="mb-10">
            <SectionHeading
              eyebrow={eyebrow}
              title={title ?? ""}
              sub={sub}
              theme={theme}
              accent={accent}
              id={labelled ? headingId : undefined}
            />
          </div>
        ) : null}

        <ul
          className={cn(
            "grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
          )}
        >
          {items.map((item, index) => (
            <li key={`${item.label}-${index}`}>
              <Link
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 rounded-2xl p-4 border transition-colors",
                  t.surface,
                  t.divider,
                  "hover:border-current focus:outline-none focus:ring-2 focus:ring-offset-0",
                  t.ring,
                )}
              >
                {item.icon ? (
                  <span
                    className={cn(
                      "shrink-0 w-10 h-10 rounded-xl flex items-center justify-center",
                      t.bg10,
                      t.text,
                    )}
                    aria-hidden="true"
                  >
                    {item.icon}
                  </span>
                ) : null}
                <span className="flex-1 min-w-0">
                  <span
                    className={cn(
                      "block text-sm md:text-base font-medium truncate",
                      t.textPrimary,
                    )}
                  >
                    {item.label}
                  </span>
                  {typeof item.count === "number" ? (
                    <span
                      className={cn(
                        "block text-xs mt-0.5",
                        t.textMuted,
                      )}
                    >
                      {item.count} ideas
                    </span>
                  ) : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
