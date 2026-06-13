import * as React from "react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  type Accent,
  type Theme,
  tokensFor,
} from "@/components/marketing/section-theme";

export type TicketProps = {
  /** Defaults to cream since workshop pages are cream-themed. */
  theme?: Theme;
  accent?: Accent;
  eyebrow?: string;
  headline?: React.ReactNode;
  /** Display price (formatted string, e.g. "$9"). */
  price: string;
  /** Optional suffix shown next to the price (e.g. "USD"). */
  priceSuffix?: string;
  /** Currency code, surfaced to screen readers (e.g. "USD"). */
  currency?: string;
  /** Bullet perks rendered with check icons. */
  perks: string[];
  /** Form / checkout island (required). */
  formSlot: React.ReactNode;
  /** Optional countdown island rendered above the perks. */
  countdownSlot?: React.ReactNode;
  /** Optional footnote rendered below the form. */
  footnote?: React.ReactNode;
  className?: string;
};

/**
 * Workshop seat-price card. Pairs a prominent price + perks list with a
 * required `formSlot` for the checkout/waitlist component.
 */
export function Ticket({
  theme = "cream",
  accent = "orange",
  eyebrow,
  headline,
  price,
  priceSuffix,
  currency,
  perks,
  formSlot,
  countdownSlot,
  footnote,
  className,
}: TicketProps) {
  const t = tokensFor(theme, accent);

  return (
    <section
      className={cn("relative w-full px-5 md:px-8 py-16 md:py-24", className)}
    >
      <div
        className={cn(
          "max-w-3xl mx-auto rounded-3xl p-8 md:p-10 border",
          t.surface,
          t.divider,
        )}
      >
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

        {headline ? (
          <h2
            className={cn(
              "text-2xl md:text-3xl font-medium tracking-tight mb-6",
              t.textPrimary,
            )}
          >
            {headline}
          </h2>
        ) : null}

        <div className="flex items-baseline gap-2 mb-6">
          <span
            className={cn(
              "text-5xl md:text-6xl font-semibold tracking-tight",
              t.textPrimary,
            )}
          >
            {price}
          </span>
          {priceSuffix ? (
            <span className={cn("text-base font-medium", t.textMuted)}>
              {priceSuffix}
            </span>
          ) : null}
          {currency ? <span className="sr-only">{currency}</span> : null}
        </div>

        {countdownSlot ? <div className="mb-6">{countdownSlot}</div> : null}

        {perks.length > 0 ? (
          <ul className="space-y-3 mb-8">
            {perks.map((perk, index) => (
              <li key={`${perk}-${index}`} className="flex items-start gap-3">
                <span
                  className={cn(
                    "shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5",
                    t.bg10,
                    t.text,
                  )}
                  aria-hidden="true"
                >
                  <Check size={14} />
                </span>
                <span className={cn("text-sm md:text-base", t.textSecondary)}>
                  {perk}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        <div>{formSlot}</div>

        {footnote ? (
          <p className={cn("text-xs mt-4", t.textMuted)}>{footnote}</p>
        ) : null}
      </div>
    </section>
  );
}
