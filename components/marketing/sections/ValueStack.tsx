import * as React from "react";
import { Check, X } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  type Accent,
  type Theme,
  tokensFor,
} from "@/components/marketing/section-theme";
import { SectionHeading } from "./SectionHeading";

export type ValueStackItem = {
  title: string;
  body: React.ReactNode;
  /** If false, render as a struck-through "not included" row. Defaults true. */
  included?: boolean;
};

export type ValueStackProps = {
  theme?: Theme;
  accent?: Accent;
  eyebrow?: string;
  title?: React.ReactNode;
  sub?: React.ReactNode;
  items: ValueStackItem[];
  className?: string;
};

/**
 * "What you get" list with check icons. Used by workshop pages to lay out
 * the bundle contents.
 */
export function ValueStack({
  theme = "dark",
  accent = "orange",
  eyebrow,
  title,
  sub,
  items,
  className,
}: ValueStackProps) {
  const t = tokensFor(theme, accent);
  const headingId = React.useId();
  const labelled = Boolean(title);

  return (
    <section
      className={cn("relative w-full px-5 md:px-8 py-16 md:py-24", className)}
      aria-labelledby={labelled ? headingId : undefined}
    >
      <div className="max-w-4xl mx-auto">
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

        <ul className="space-y-4">
          {items.map((item, index) => {
            const included = item.included !== false;
            return (
              <li
                key={`${item.title}-${index}`}
                className={cn(
                  "flex items-start gap-4 rounded-2xl p-5 border",
                  t.surface,
                  t.divider,
                )}
              >
                <span
                  className={cn(
                    "shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
                    included ? t.bg10 : t.surfaceMuted,
                    included ? t.text : t.textMuted,
                  )}
                  aria-hidden="true"
                >
                  {included ? <Check size={16} /> : <X size={16} />}
                </span>
                <div>
                  <div
                    className={cn(
                      "font-medium",
                      included ? t.textPrimary : t.textMuted,
                    )}
                  >
                    {item.title}
                  </div>
                  <div className={cn("text-sm mt-1", t.textSecondary)}>
                    {item.body}
                  </div>
                </div>
                <span className="sr-only">
                  {included ? "Included" : "Not included"}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
