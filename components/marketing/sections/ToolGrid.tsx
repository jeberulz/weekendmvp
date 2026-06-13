import * as React from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import {
  type Accent,
  type Theme,
  tokensFor,
} from "@/components/marketing/section-theme";
import { SectionHeading } from "./SectionHeading";

export type ToolGridItem = {
  label: string;
  href: string;
  /** Required tool icon (brand mark). */
  icon: React.ReactNode;
  /** Optional one-line description. */
  tagline?: string;
};

export type ToolGridProps = {
  theme?: Theme;
  accent?: Accent;
  eyebrow?: string;
  title?: React.ReactNode;
  sub?: React.ReactNode;
  items: ToolGridItem[];
  className?: string;
};

/**
 * "Build with" tile grid. Larger tiles than CategoryGrid because each
 * tool card carries a tagline.
 */
export function ToolGrid({
  theme = "dark",
  accent = "orange",
  eyebrow,
  title,
  sub,
  items,
  className,
}: ToolGridProps) {
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

        <ul className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item, index) => (
            <li key={`${item.label}-${index}`}>
              <Link
                href={item.href}
                className={cn(
                  "group block rounded-2xl p-6 border transition-colors",
                  t.surface,
                  t.divider,
                  "hover:border-current focus:outline-none focus:ring-2 focus:ring-offset-0",
                  t.ring,
                )}
              >
                <div
                  className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center mb-4",
                    t.bg10,
                    t.text,
                  )}
                  aria-hidden="true"
                >
                  {item.icon}
                </div>
                <div
                  className={cn(
                    "text-base md:text-lg font-medium",
                    t.textPrimary,
                  )}
                >
                  {item.label}
                </div>
                {item.tagline ? (
                  <p className={cn("mt-2 text-sm", t.textSecondary)}>
                    {item.tagline}
                  </p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
