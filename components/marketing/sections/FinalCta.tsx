import * as React from "react";

import { cn } from "@/lib/utils";
import {
  type Accent,
  type Theme,
  tokensFor,
} from "@/components/marketing/section-theme";

export type FinalCtaProps = {
  theme?: Theme;
  accent?: Accent;
  eyebrow?: string;
  headline: React.ReactNode;
  body?: React.ReactNode;
  /** Required CTA island (button, SignupCta, BeehiivSubscribeForm, etc). */
  ctaSlot: React.ReactNode;
  className?: string;
};

/**
 * Full-bleed closing CTA band. Pages compose <SignupCta> around this when
 * the conversion intent needs the modal flow.
 */
export function FinalCta({
  theme = "dark",
  accent = "orange",
  eyebrow,
  headline,
  body,
  ctaSlot,
  className,
}: FinalCtaProps) {
  const t = tokensFor(theme, accent);
  const headingId = React.useId();

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "relative w-full px-5 md:px-8 py-20 md:py-28",
        t.pageBg,
        className,
      )}
    >
      <div className="max-w-4xl mx-auto text-center">
        {eyebrow ? (
          <div
            className={cn(
              "text-xs font-semibold uppercase tracking-wider mb-4",
              t.text,
            )}
          >
            {eyebrow}
          </div>
        ) : null}

        <h2
          id={headingId}
          className={cn(
            "text-3xl md:text-4xl lg:text-5xl font-medium tracking-tight leading-[1.1]",
            t.textPrimary,
          )}
        >
          {headline}
        </h2>

        {body ? (
          <p
            className={cn(
              "mt-6 text-base md:text-lg font-light leading-relaxed max-w-2xl mx-auto",
              t.textSecondary,
            )}
          >
            {body}
          </p>
        ) : null}

        <div className="mt-10 flex flex-col items-center gap-4">{ctaSlot}</div>
      </div>
    </section>
  );
}
