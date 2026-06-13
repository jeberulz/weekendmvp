import * as React from "react";

import { cn } from "@/lib/utils";
import {
  type Accent,
  type Theme,
  tokensFor,
} from "@/components/marketing/section-theme";

export type HeroProps = {
  theme?: Theme;
  accent?: Accent;
  /** Optional kicker rendered above the title. */
  eyebrow?: string;
  /** Main hero headline. */
  title: React.ReactNode;
  /** Optional supporting paragraph below the title. */
  sub?: React.ReactNode;
  /**
   * Form island slot (e.g. <BeehiivSubscribeForm /> or <ShipableCheckoutForm />).
   * Renders below `sub` in the primary column.
   */
  formSlot?: React.ReactNode;
  /**
   * CTA slot rendered in the primary column when there's no form.
   * Use a button or button-shaped Link. Ignored when `formSlot` is set.
   */
  ctaSlot?: React.ReactNode;
  /**
   * Visual / illustration slot rendered in the secondary column when
   * `layout === "split"`. Ignored on `centered`.
   */
  mediaSlot?: React.ReactNode;
  /** Default `split`; `centered` removes the second column. */
  layout?: "split" | "centered";
  /**
   * Bump headline scale for 3-5 word heroes. `large` opts into the
   * 6-7xl size range matching the homepage hero.
   */
  headlineSize?: "default" | "large";
  className?: string;
};

/**
 * Hero section. Prop shape intentionally caps the text-element count at
 * eyebrow + title + sub (plus a form or CTA slot) so callers cannot stack
 * a fifth element into the hero stack. Mirrors HubHero's variant +
 * slot pattern.
 */
export function Hero({
  theme = "dark",
  accent = "orange",
  eyebrow,
  title,
  sub,
  formSlot,
  ctaSlot,
  mediaSlot,
  layout = "split",
  headlineSize = "default",
  className,
}: HeroProps) {
  const t = tokensFor(theme, accent);
  const headingId = React.useId();

  const headlineClass =
    headlineSize === "large"
      ? "text-5xl md:text-6xl lg:text-7xl"
      : "text-4xl md:text-5xl lg:text-6xl";

  const showMedia = layout === "split" && mediaSlot;
  const centered = layout === "centered";

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "relative w-full",
        "px-5 md:px-8 py-16 md:py-24",
        className,
      )}
    >
      <div
        className={cn(
          "max-w-7xl mx-auto",
          centered
            ? "flex flex-col items-center text-center"
            : showMedia
              ? "grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-12 items-center"
              : "max-w-4xl",
        )}
      >
        <div
          className={cn(
            centered
              ? "max-w-3xl"
              : showMedia
                ? "md:col-span-7"
                : "max-w-3xl",
          )}
        >
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

          <h1
            id={headingId}
            className={cn(
              headlineClass,
              "font-medium tracking-tight leading-[1.1]",
              t.textPrimary,
            )}
          >
            {title}
          </h1>

          {sub ? (
            <p
              className={cn(
                "mt-6 text-lg md:text-xl font-light leading-relaxed max-w-2xl",
                centered ? "mx-auto" : "",
                t.textSecondary,
              )}
            >
              {sub}
            </p>
          ) : null}

          {formSlot ? (
            <div className={cn("mt-8", centered ? "mx-auto max-w-sm" : "")}>
              {formSlot}
            </div>
          ) : ctaSlot ? (
            <div className={cn("mt-8")}>{ctaSlot}</div>
          ) : null}
        </div>

        {showMedia ? (
          <div className="md:col-span-5">{mediaSlot}</div>
        ) : null}
      </div>
    </section>
  );
}
