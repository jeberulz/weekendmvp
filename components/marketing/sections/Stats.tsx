import * as React from "react";

import { cn } from "@/lib/utils";
import {
  type Accent,
  type Theme,
  tokensFor,
} from "@/components/marketing/section-theme";

export type StatsItem = {
  /** Headline number / value (e.g. "128", "48 hrs"). */
  stat: string;
  /** Optional supporting label (e.g. "Builders shipped"). */
  label?: string;
};

export type StatsProps = {
  theme?: Theme;
  accent?: Accent;
  items: StatsItem[];
  /** Default 3-up. */
  columns?: 2 | 3 | 4;
  eyebrow?: string;
  className?: string;
};

const COLUMN_CLASS: Record<NonNullable<StatsProps["columns"]>, string> = {
  2: "grid-cols-2",
  3: "grid-cols-2 md:grid-cols-3",
  4: "grid-cols-2 md:grid-cols-4",
};

/**
 * Banded stat row. Large numbers in the accent color, short labels below.
 */
export function Stats({
  theme = "dark",
  accent = "orange",
  items,
  columns = 3,
  eyebrow,
  className,
}: StatsProps) {
  const t = tokensFor(theme, accent);

  return (
    <section
      className={cn("relative w-full px-5 md:px-8 py-12 md:py-16", className)}
    >
      <div className="max-w-6xl mx-auto">
        {eyebrow ? (
          <div
            className={cn(
              "text-xs font-semibold uppercase tracking-wider mb-6 text-center",
              t.text,
            )}
          >
            {eyebrow}
          </div>
        ) : null}

        <dl className={cn("grid gap-6 md:gap-10", COLUMN_CLASS[columns])}>
          {items.map((item, index) => (
            <div
              key={`${item.stat}-${index}`}
              className={cn(
                "rounded-2xl p-6 border text-center",
                t.surface,
                t.divider,
              )}
            >
              <dt
                className={cn(
                  "text-4xl md:text-5xl font-semibold tracking-tight",
                  t.text,
                )}
              >
                {item.stat}
              </dt>
              {item.label ? (
                <dd
                  className={cn(
                    "mt-2 text-xs md:text-sm font-medium uppercase tracking-wider",
                    t.textMuted,
                  )}
                >
                  {item.label}
                </dd>
              ) : null}
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
