import * as React from "react";

import { cn } from "@/lib/utils";
import {
  type Accent,
  type Theme,
  tokensFor,
} from "@/components/marketing/section-theme";

export type SectionHeadingProps = {
  /** Optional kicker rendered above the title. */
  eyebrow?: string;
  /** Main heading text. */
  title: React.ReactNode;
  /** Optional supporting paragraph below the title. */
  sub?: React.ReactNode;
  /** Theme variant; defaults to `dark`. */
  theme?: Theme;
  /** Accent variant; defaults to `orange`. */
  accent?: Accent;
  /** Render as h2 (default) or h3. */
  level?: "h2" | "h3";
  /** Text alignment. Defaults to `left`. */
  align?: "left" | "center";
  /** Optional dom id for the heading (used by `aria-labelledby`). */
  id?: string;
  className?: string;
};

/**
 * eyebrow + h2/h3 + lede primitive that every other section composes when
 * it needs a labeled header. Reads theme + accent tokens but never paints
 * a section background of its own; sections own that.
 */
export function SectionHeading({
  eyebrow,
  title,
  sub,
  theme = "dark",
  accent = "orange",
  level = "h2",
  align = "left",
  id,
  className,
}: SectionHeadingProps) {
  const t = tokensFor(theme, accent);
  const Heading = level;
  const alignClass = align === "center" ? "text-center mx-auto" : "text-left";

  return (
    <div className={cn("max-w-3xl", alignClass, className)}>
      {eyebrow ? (
        <div
          className={cn(
            "text-xs font-semibold uppercase tracking-wider mb-3",
            t.text,
          )}
        >
          {eyebrow}
        </div>
      ) : null}
      <Heading
        id={id}
        className={cn(
          level === "h2"
            ? "text-3xl md:text-4xl lg:text-5xl font-medium tracking-tight leading-[1.1]"
            : "text-2xl md:text-3xl font-medium tracking-tight leading-[1.15]",
          t.textPrimary,
        )}
      >
        {title}
      </Heading>
      {sub ? (
        <p
          className={cn(
            "mt-4 text-base md:text-lg font-light leading-relaxed",
            t.textSecondary,
          )}
        >
          {sub}
        </p>
      ) : null}
    </div>
  );
}
