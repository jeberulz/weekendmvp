import * as React from "react";
import { ArrowRight } from "lucide-react";

export type WorkshopTicketLine = {
  label: React.ReactNode;
  value: React.ReactNode;
  /** Optional row color class (used for bonus rows, e.g. text-[#A03D00]). */
  rowColorClass?: string;
};

export type WorkshopTicketDetail = {
  label: React.ReactNode;
  value: React.ReactNode;
};

export type WorkshopTicketProps = {
  /** Eyebrow inside the rounded pill ("Here's your ticket"). */
  eyebrow: string;
  eyebrowColorClass: string;
  /** The h2 heading. */
  heading: React.ReactNode;
  headingWeight?: "bold" | "semibold";
  headingColorClass?: string;
  /** Header strip text (e.g. "Admission · Workshop №01"). */
  stubLabel: string;
  /** Header strip right side (e.g. "WMVP·26·S0001"). */
  stubCode: string;
  /** Body brand display (e.g. "ship·able." or "D·A·R·E."). */
  brandDisplay: React.ReactNode;
  /** Body subtitle paragraph after the brand display. */
  brandSub: React.ReactNode;
  brandSubColorClass: string;
  /** 4-cell detail grid. */
  details: WorkshopTicketDetail[];
  /** Detail dt color class (shipable=neutral-700, dare=neutral-500). */
  detailLabelColorClass: string;
  /** Detail dd color class (shipable explicit, dare inherits). */
  detailValueColorClass?: string;
  /** Included list eyebrow ("What's included" / "Value"). */
  includedEyebrowColorClass: string;
  includedLines: WorkshopTicketLine[];
  /** Included list ul color (shipable=text-[#1a1a1a], dare inherits). */
  includedListColorClass?: string;
  /** Footer eyebrow text (default "One-time · Seat"). */
  footerEyebrow?: string;
  /** Footer price display (e.g. <><span>$</span>9</>). */
  footerPrice: React.ReactNode;
  /** Footer below-price label (e.g. "$738 value · 2 bonuses (live)"). */
  footerValueLabel: React.ReactNode;
  /** Optional footer paragraph above CTA (dare uses this). */
  footerNote?: React.ReactNode;
  /** Footer CTA href + label. */
  ctaHref: string;
  ctaLabel: React.ReactNode;
  /** Footer fine print after CTA (e.g. ticket code · note). */
  fineprint: string;
};

/**
 * Admission-stub ticket card. Both shipable and dare share this markup
 * exactly; the variant props swap the brand glyphs, copy, and accent
 * colors while preserving the byte-equivalent HTML structure.
 */
export function WorkshopTicket({
  eyebrow,
  eyebrowColorClass,
  heading,
  headingWeight = "bold",
  headingColorClass = "",
  stubLabel,
  stubCode,
  brandDisplay,
  brandSub,
  brandSubColorClass,
  details,
  detailLabelColorClass,
  detailValueColorClass = "",
  includedEyebrowColorClass,
  includedLines,
  includedListColorClass = "",
  footerEyebrow = "One-time · Seat",
  footerPrice,
  footerValueLabel,
  footerNote,
  ctaHref,
  ctaLabel,
  fineprint,
}: WorkshopTicketProps) {
  const weight = headingWeight === "bold" ? "font-bold" : "font-semibold";
  const hColor = headingColorClass ? ` ${headingColorClass}` : "";
  const ddColor = detailValueColorClass ? ` ${detailValueColorClass}` : "";
  const ulColor = includedListColorClass ? ` ${includedListColorClass}` : "";
  return (
    <section className="px-5 py-20 md:py-28 bg-[#f5f2ed]">
      <div className="max-w-2xl mx-auto">
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

        <div className="rounded-3xl overflow-hidden border border-black/10 shadow-sm">
          {/* Stub header */}
          <div className="bg-[#1a1a1a] text-white px-6 md:px-8 py-4 flex items-center justify-between">
            <span className="font-mono-eyebrow text-[10px] uppercase text-neutral-300">
              {stubLabel}
            </span>
            <span className="font-mono-eyebrow text-[10px] uppercase text-neutral-300">
              {stubCode}
            </span>
          </div>
          {/* Body */}
          <div className="bg-white px-6 md:px-8 py-8">
            <p
              className={`text-4xl font-semibold tracking-tight${
                headingColorClass ? ` ${headingColorClass}` : ""
              }`}
            >
              {brandDisplay}
            </p>
            <p className={`mt-2 ${brandSubColorClass}`}>{brandSub}</p>

            <dl className="grid grid-cols-2 gap-y-6 mt-8 pt-8 border-t border-black/10">
              {details.map((d, i) => (
                <div key={i}>
                  <dt
                    className={`font-mono-eyebrow text-[10px] uppercase ${detailLabelColorClass}`}
                  >
                    {d.label}
                  </dt>
                  <dd className={`mt-1 font-semibold${ddColor}`}>{d.value}</dd>
                </div>
              ))}
            </dl>

            <div className="ticket-perf my-8"></div>

            <div className="flex items-center justify-between text-sm">
              <span
                className={`font-mono-eyebrow text-[10px] uppercase ${includedEyebrowColorClass}`}
              >
                What&apos;s included
              </span>
              <span
                className={`font-mono-eyebrow text-[10px] uppercase ${includedEyebrowColorClass}`}
              >
                Value
              </span>
            </div>
            <ul className={`mt-3 space-y-2 text-sm${ulColor}`}>
              {includedLines.map((line, i) => (
                <li
                  key={i}
                  className={`flex justify-between${
                    line.rowColorClass ? ` ${line.rowColorClass}` : ""
                  }`}
                >
                  <span>{line.label}</span>
                  <span className="font-semibold">{line.value}</span>
                </li>
              ))}
            </ul>
          </div>
          {/* Stub footer */}
          <div className="bg-[#1a1a1a] text-white px-6 md:px-8 py-8 text-center">
            <span className="font-mono-eyebrow text-[10px] uppercase text-neutral-300 block mb-2">
              {footerEyebrow}
            </span>
            <p className="text-5xl font-semibold tracking-tight">{footerPrice}</p>
            <p
              className={`font-mono-eyebrow text-[10px] uppercase text-neutral-300 mt-2${
                footerNote ? "" : " mb-6"
              }`}
            >
              {footerValueLabel}
            </p>
            {footerNote ? (
              <p className="text-sm text-neutral-300 mt-3 mb-6">{footerNote}</p>
            ) : null}
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
            <p className="font-mono-eyebrow text-[9px] uppercase text-neutral-400 mt-5">
              {fineprint}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
