import * as React from "react";

import { cn } from "@/lib/utils";
import {
  type Accent,
  type Theme,
  tokensFor,
} from "@/components/marketing/section-theme";
import { SectionHeading } from "./SectionHeading";

export type BentoItem = {
  title: string;
  body?: React.ReactNode;
  icon?: React.ReactNode;
  /** Column span on md+ screens (out of 12). Defaults to 4. */
  span?: 1 | 2 | 3;
  mediaSlot?: React.ReactNode;
};

export type BentoGridProps = {
  theme?: Theme;
  accent?: Accent;
  eyebrow?: string;
  title?: React.ReactNode;
  sub?: React.ReactNode;
  items: BentoItem[];
  className?: string;
};

/** Convert the 1-3 span scale into a literal md:col-span-* class. */
function spanClass(span: BentoItem["span"]): string {
  switch (span) {
    case 1:
      return "md:col-span-4";
    case 2:
      return "md:col-span-8";
    case 3:
      return "md:col-span-12";
    default:
      return "md:col-span-4";
  }
}

/**
 * Flexible bento grid. Each item picks a 1/2/3-wide span to break the
 * monotonous N-up grid rhythm.
 */
export function BentoGrid({
  theme = "dark",
  accent = "orange",
  eyebrow,
  title,
  sub,
  items,
  className,
}: BentoGridProps) {
  const t = tokensFor(theme, accent);

  return (
    <section className={cn("relative w-full px-5 md:px-8 py-16 md:py-24", className)}>
      <div className="max-w-7xl mx-auto">
        {title || eyebrow ? (
          <div className="mb-10">
            <SectionHeading
              eyebrow={eyebrow}
              title={title ?? ""}
              sub={sub}
              theme={theme}
              accent={accent}
            />
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {items.map((item, index) => (
            <article
              key={`${item.title}-${index}`}
              className={cn(
                spanClass(item.span),
                "rounded-3xl p-8 border",
                t.surface,
                t.divider,
              )}
            >
              {item.icon ? (
                <div
                  className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center mb-6",
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
                  "text-xl md:text-2xl font-medium tracking-tight mb-2",
                  t.textPrimary,
                )}
              >
                {item.title}
              </h3>
              {item.body ? (
                <div className={cn("text-sm md:text-base", t.textSecondary)}>
                  {item.body}
                </div>
              ) : null}
              {item.mediaSlot ? <div className="mt-6">{item.mediaSlot}</div> : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
