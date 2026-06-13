import * as React from "react";

import { cn } from "@/lib/utils";
import {
  type Accent,
  type Theme,
  tokensFor,
} from "@/components/marketing/section-theme";
import { SectionHeading } from "./SectionHeading";

export type ProcessStep = {
  title: string;
  body: React.ReactNode;
  mediaSlot?: React.ReactNode;
};

export type ProcessStepsProps = {
  theme?: Theme;
  accent?: Accent;
  eyebrow?: string;
  title?: React.ReactNode;
  sub?: React.ReactNode;
  steps: ProcessStep[];
  /** Show numbered badges on each step. Defaults true. */
  numbered?: boolean;
  className?: string;
};

/**
 * Vertical numbered step list. Use `numbered={false}` for starter-kit-style
 * pillared content where the order is conveyed by layout, not numerals.
 */
export function ProcessSteps({
  theme = "dark",
  accent = "orange",
  eyebrow,
  title,
  sub,
  steps,
  numbered = true,
  className,
}: ProcessStepsProps) {
  const t = tokensFor(theme, accent);
  const headingId = React.useId();
  const labelled = Boolean(title);

  return (
    <section
      className={cn("relative w-full px-5 md:px-8 py-16 md:py-24", className)}
      aria-labelledby={labelled ? headingId : undefined}
    >
      <div className="max-w-5xl mx-auto">
        {title || eyebrow ? (
          <div className="mb-12">
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

        <ol className="space-y-10">
          {steps.map((step, index) => (
            <li
              key={`${step.title}-${index}`}
              className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-10 items-start"
            >
              <div className="md:col-span-2 flex md:justify-start">
                {numbered ? (
                  <div
                    className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center font-semibold",
                      t.bg10,
                      t.text,
                    )}
                    aria-hidden="true"
                  >
                    {String(index + 1).padStart(2, "0")}
                  </div>
                ) : (
                  <div
                    className={cn("h-1 w-12 rounded-full", t.bg20)}
                    aria-hidden="true"
                  />
                )}
              </div>
              <div className="md:col-span-10">
                <h3
                  className={cn(
                    "text-xl md:text-2xl font-medium tracking-tight mb-2",
                    t.textPrimary,
                  )}
                >
                  {step.title}
                </h3>
                <div className={cn("text-base", t.textSecondary)}>
                  {step.body}
                </div>
                {step.mediaSlot ? (
                  <div className="mt-6">{step.mediaSlot}</div>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
