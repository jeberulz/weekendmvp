import * as React from "react";

import { cn } from "@/lib/utils";
import {
  type Accent,
  type Theme,
  tokensFor,
} from "@/components/marketing/section-theme";
import { SectionHeading } from "./SectionHeading";

export type FeatureGridItem = {
  icon?: React.ReactNode;
  title: string;
  body: React.ReactNode;
};

export type FeatureGridProps = {
  theme?: Theme;
  accent?: Accent;
  eyebrow?: string;
  title?: React.ReactNode;
  sub?: React.ReactNode;
  items: FeatureGridItem[];
  /** Default 3 columns on lg+. */
  columns?: 2 | 3 | 4;
  className?: string;
};

const COLUMN_CLASS: Record<NonNullable<FeatureGridProps["columns"]>, string> = {
  2: "md:grid-cols-2",
  3: "md:grid-cols-2 lg:grid-cols-3",
  4: "md:grid-cols-2 lg:grid-cols-4",
};

/**
 * Uniform N-up feature grid (icon + title + body per cell). Use BentoGrid
 * when items need variable spans.
 */
export function FeatureGrid({
  theme = "dark",
  accent = "orange",
  eyebrow,
  title,
  sub,
  items,
  columns = 3,
  className,
}: FeatureGridProps) {
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

        <div className={cn("grid grid-cols-1 gap-6", COLUMN_CLASS[columns])}>
          {items.map((item, index) => (
            <article
              key={`${item.title}-${index}`}
              className={cn(
                "rounded-2xl p-6 border",
                t.surface,
                t.divider,
              )}
            >
              {item.icon ? (
                <div
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center mb-4",
                    t.bg10,
                    t.text,
                  )}
                  aria-hidden="true"
                >
                  {item.icon}
                </div>
              ) : null}
              <h3
                className={cn(
                  "text-lg md:text-xl font-medium tracking-tight mb-2",
                  t.textPrimary,
                )}
              >
                {item.title}
              </h3>
              <div className={cn("text-sm md:text-base", t.textSecondary)}>
                {item.body}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
