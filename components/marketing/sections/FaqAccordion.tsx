import * as React from "react";

import { cn } from "@/lib/utils";
import {
  type Accent,
  type Theme,
  tokensFor,
} from "@/components/marketing/section-theme";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SectionHeading } from "./SectionHeading";

export type FaqItem = { q: string; a: React.ReactNode };

export type FaqAccordionProps = {
  theme?: Theme;
  accent?: Accent;
  eyebrow?: string;
  title?: React.ReactNode;
  sub?: React.ReactNode;
  items: FaqItem[];
  /**
   * `grid` renders a static two-column card grid (legacy homepage style).
   * `accordion` renders the shadcn Accordion (interactive).
   */
  variant?: "grid" | "accordion";
  className?: string;
};

/**
 * FAQ section with two presentation modes. The grid mode stays a server
 * component; the accordion mode delegates interactivity to the shadcn
 * primitive (which is itself a client component).
 */
export function FaqAccordion({
  theme = "dark",
  accent = "orange",
  eyebrow,
  title,
  sub,
  items,
  variant = "grid",
  className,
}: FaqAccordionProps) {
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

        {variant === "accordion" ? (
          <Accordion type="single" collapsible className="w-full">
            {items.map((item, index) => (
              <AccordionItem
                key={`${item.q}-${index}`}
                value={`item-${index}`}
                className={cn(t.divider)}
              >
                <AccordionTrigger className={cn("text-left", t.textPrimary)}>
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className={cn(t.textSecondary)}>
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        ) : (
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {items.map((item, index) => (
              <div
                key={`${item.q}-${index}`}
                className={cn(
                  "rounded-2xl p-6 border",
                  t.surface,
                  t.divider,
                )}
              >
                <dt
                  className={cn(
                    "text-base md:text-lg font-medium mb-2",
                    t.textPrimary,
                  )}
                >
                  {item.q}
                </dt>
                <dd className={cn("text-sm md:text-base", t.textSecondary)}>
                  {item.a}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  );
}
