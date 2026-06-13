import * as React from "react";
import { Check } from "lucide-react";

export type WorkshopTldrItem = {
  /** The bold lead phrase, e.g. "It's $9." Wraps a <strong>. */
  lead: React.ReactNode;
  /** Trailing prose after the lead. */
  rest: React.ReactNode;
};

export type WorkshopTldrProps = {
  /** Heading (renders inside h2). */
  heading: React.ReactNode;
  items: WorkshopTldrItem[];
  /** Accent color for the check icon. */
  checkColorClass: string;
  /** Heading weight (shipable=bold, dare=semibold). */
  headingWeight?: "bold" | "semibold";
  /** Body text color (shipable=neutral-800, dare=neutral-700). */
  textColorClass?: string;
  /** Optional headline color (shipable explicit). */
  headingColorClass?: string;
};

/**
 * The cream banded "Everything you need to know, in ten seconds." block.
 * 5-7 check rows, each with a bold lead phrase plus trailing prose.
 */
export function WorkshopTldr({
  heading,
  items,
  checkColorClass,
  headingWeight = "bold",
  textColorClass = "text-neutral-800",
  headingColorClass = "",
}: WorkshopTldrProps) {
  const weight = headingWeight === "bold" ? "font-bold" : "font-semibold";
  const color = headingColorClass ? ` ${headingColorClass}` : "";
  return (
    <section className="px-5 py-16 bg-[#f5f2ed]">
      <div className="max-w-3xl mx-auto">
        <h2
          className={`text-4xl md:text-5xl ${weight} tracking-tight mb-10${color}`}
        >
          {heading}
        </h2>
        <ul className="space-y-6">
          {items.map((item, i) => (
            <li key={i} className="flex gap-4">
              <Check
                size={22}
                className={`${checkColorClass} mt-0.5 shrink-0`}
                aria-hidden="true"
              />
              <p className={`text-lg ${textColorClass}`}>
                <strong className="font-semibold text-[#1a1a1a]">
                  {item.lead}
                </strong>{" "}
                {item.rest}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
