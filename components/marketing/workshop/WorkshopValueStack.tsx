import * as React from "react";
import { ArrowRight } from "lucide-react";

export type WorkshopValueItem = {
  number: string;
  title: React.ReactNode;
  body: React.ReactNode;
  /** Optional value chip text (omit for items with no chip, e.g. dare row 07). */
  value?: React.ReactNode;
  /** Render the bonus chip next to the title. */
  bonus?: boolean;
  /** Cream row variant (bg-[#fcfaf7]). */
  creamRow?: boolean;
  /** Whether this row gets a bottom border. */
  border?: boolean;
};

export type WorkshopValueStackProps = {
  /** Eyebrow ("What's included"). */
  eyebrow: string;
  /** Eyebrow text color (shipable=neutral-700, dare=neutral-600). */
  eyebrowColorClass: string;
  /** The h2 heading. */
  heading: React.ReactNode;
  items: WorkshopValueItem[];
  /** Total value display ("$738", "$502"). */
  totalValue: string;
  /** "You pay today" display value ($9, $29). */
  payValue: React.ReactNode;
  /** Bonus pill border + text class. */
  bonusPillClass: string;
  /** Strike decoration class on the total value. */
  strikeDecorationClass: string;
  /** CTA href. */
  ctaHref: string;
  /** CTA label (e.g. "Save my seat · $9"). */
  ctaLabel: React.ReactNode;
  /** Optional preamble paragraph rendered above the total (dare uses this). */
  totalPreamble?: React.ReactNode;
  /** Heading weight. */
  headingWeight?: "bold" | "semibold";
  /** Body text color for item paragraph (shipable=neutral-700, dare=neutral-600). */
  itemBodyColorClass?: string;
  /** Value chip text color (shipable=neutral-700, dare=neutral-500). */
  valueChipColorClass?: string;
  /** Heading color (shipable explicit). */
  headingColorClass?: string;
};

/**
 * The cream "What's included" value stack: rounded card with numbered
 * rows, optional Bonus chips, value chips, and a dark total footer with
 * a CTA. Shared by shipable + dare.
 */
export function WorkshopValueStack({
  eyebrow,
  eyebrowColorClass,
  heading,
  items,
  totalValue,
  payValue,
  bonusPillClass,
  strikeDecorationClass,
  ctaHref,
  ctaLabel,
  totalPreamble,
  headingWeight = "bold",
  itemBodyColorClass = "text-neutral-700",
  valueChipColorClass = "text-neutral-700",
  headingColorClass = "",
}: WorkshopValueStackProps) {
  const weight = headingWeight === "bold" ? "font-bold" : "font-semibold";
  const hColor = headingColorClass ? ` ${headingColorClass}` : "";
  return (
    <section className="px-5 py-20 md:py-28 bg-[#f5f2ed]">
      <div className="max-w-4xl mx-auto">
        <div className="inline-flex items-center rounded-full border border-black/10 px-4 py-1.5 mb-8">
          <span
            className={`font-mono-eyebrow text-[11px] uppercase ${eyebrowColorClass}`}
          >
            {eyebrow}
          </span>
        </div>
        <h2
          className={`text-4xl md:text-6xl ${weight} tracking-tight leading-[1.02] mb-12${hColor}`}
        >
          {heading}
        </h2>

        <div className="rounded-3xl bg-white border border-black/10 overflow-hidden">
          {items.map((item) => (
            <div
              key={item.number}
              className={`flex items-start gap-5 p-6 md:p-8${
                item.border ? " border-b border-black/10" : ""
              }${item.creamRow ? " bg-[#fcfaf7]" : ""}`}
            >
              <span className="text-3xl font-semibold text-neutral-200 leading-none">
                {item.number}
              </span>
              <div className="flex-1">
                {item.bonus ? (
                  <div className="flex items-center gap-3 flex-wrap">
                    {item.title}
                    <span
                      className={`rounded-full border ${bonusPillClass} px-2.5 py-0.5 font-mono-eyebrow text-[9px] uppercase`}
                    >
                      Bonus · Live only
                    </span>
                  </div>
                ) : (
                  item.title
                )}
                <p className={`mt-1 ${itemBodyColorClass}`}>{item.body}</p>
                {item.value !== undefined ? (
                  <span
                    className={`mt-3 inline-block rounded-full bg-[#f5f2ed] px-3 py-1 font-mono-eyebrow text-[10px] uppercase ${valueChipColorClass}`}
                  >
                    {item.value}
                  </span>
                ) : null}
              </div>
            </div>
          ))}

          {/* Total */}
          <div className="bg-[#1a1a1a] text-white p-8 md:p-10">
            {totalPreamble ? (
              <p className="text-neutral-300 mb-6 max-w-xl">{totalPreamble}</p>
            ) : null}
            <div className="flex items-center justify-between mb-6">
              <div>
                <span className="font-mono-eyebrow text-[10px] uppercase text-neutral-300 block mb-1">
                  Total value
                </span>
                <span
                  className={`text-3xl font-semibold text-neutral-400 line-through ${strikeDecorationClass}`}
                >
                  {totalValue}
                </span>
              </div>
              <div className="text-right">
                <span className="font-mono-eyebrow text-[10px] uppercase text-neutral-300 block mb-1">
                  You pay today
                </span>
                <span className="text-4xl font-semibold">{payValue}</span>
              </div>
            </div>
            <a
              href={ctaHref}
              className="group flex items-center justify-center gap-2 w-full rounded-xl bg-white text-[#1a1a1a] px-6 py-4 text-base font-semibold hover:bg-neutral-200 transition-all focus:outline-none focus:ring-2 focus:ring-white/40 active:scale-[0.99]"
            >
              <span>{ctaLabel}</span>
              <ArrowRight
                size={18}
                className="transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
