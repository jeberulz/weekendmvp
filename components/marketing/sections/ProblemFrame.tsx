import * as React from "react";

import { cn } from "@/lib/utils";
import {
  type Accent,
  type Theme,
  tokensFor,
} from "@/components/marketing/section-theme";
import { SectionHeading } from "./SectionHeading";

export type ProblemStat = { stat: string; label?: string };

export type ProblemFrameProps = {
  theme?: Theme;
  accent?: Accent;
  eyebrow?: string;
  title: React.ReactNode;
  intro?: React.ReactNode;
  /** Optional supporting stat strip rendered below the intro. */
  stats?: ProblemStat[];
  className?: string;
};

/**
 * Frames a problem statement at the top of a page (used by /solve/* and
 * the workshop pages). Generalized from the legacy solve hub layout.
 */
export function ProblemFrame({
  theme = "dark",
  accent = "orange",
  eyebrow,
  title,
  intro,
  stats,
  className,
}: ProblemFrameProps) {
  const t = tokensFor(theme, accent);
  const headingId = React.useId();

  return (
    <section
      aria-labelledby={headingId}
      className={cn("relative w-full px-5 md:px-8 py-16 md:py-24", className)}
    >
      <div className="max-w-4xl mx-auto">
        <SectionHeading
          eyebrow={eyebrow}
          title={title}
          sub={intro}
          theme={theme}
          accent={accent}
          id={headingId}
        />

        {stats && stats.length > 0 ? (
          <dl className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-10">
            {stats.map((item, index) => (
              <div
                key={`${item.stat}-${index}`}
                className={cn(
                  "rounded-2xl p-5 border",
                  t.surface,
                  t.divider,
                )}
              >
                <dt
                  className={cn(
                    "text-2xl md:text-3xl font-semibold tracking-tight",
                    t.text,
                  )}
                >
                  {item.stat}
                </dt>
                {item.label ? (
                  <dd className={cn("mt-1 text-sm", t.textSecondary)}>
                    {item.label}
                  </dd>
                ) : null}
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </section>
  );
}
