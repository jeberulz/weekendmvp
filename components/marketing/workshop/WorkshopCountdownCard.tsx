import * as React from "react";
import { CountdownGrid } from "@/components/marketing/Countdown";

export type WorkshopCountdownCardProps = {
  deadline: string;
  /** Eyebrow on the left (e.g. "Workshop starts in", "DARE Live starts in"). */
  eyebrow: string;
  /** Eyebrow on the right (timezone label, e.g. "BST" or "[[TZ]]"). */
  timezone: string;
  /** The big date line (left fragment). */
  dateLabel: React.ReactNode;
  /** Italic time fragment shown after the date label. */
  timeLabel: React.ReactNode;
  /** The italic accent color class (e.g. text-[#e9a06a]). */
  italicClass: string;
  /** Sub-line under the date (e.g. "90 minutes live · Q&A after"). */
  meta: string;
  /** Optional footnote rendered after the countdown grid (dare uses this). */
  footnote?: string;
  /** Optional extra section-level padding (shipable uses pt-12 pb-16; dare uses pb-16 only). */
  sectionClass?: string;
};

/**
 * The dark rounded "starts in" card: eyebrow row, big date/time line,
 * meta, the 4-cell countdown grid, optional footnote.
 *
 * Shared by shipable + dare. Markup is byte-equivalent to the legacy
 * inline section so the prerender parity script passes.
 */
export function WorkshopCountdownCard({
  deadline,
  eyebrow,
  timezone,
  dateLabel,
  timeLabel,
  italicClass,
  meta,
  footnote,
  sectionClass = "px-5 pt-12 pb-16 md:pt-16 md:pb-20 max-w-5xl mx-auto",
}: WorkshopCountdownCardProps) {
  return (
    <section className={sectionClass}>
      <div className="rounded-3xl bg-[#1a1a1a] text-white p-8 md:p-10 max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <span className="font-mono-eyebrow text-[10px] uppercase text-neutral-300">
            {eyebrow}
          </span>
          <span className="font-mono-eyebrow text-[10px] uppercase text-neutral-300">
            {timezone}
          </span>
        </div>
        <p className="text-3xl md:text-4xl font-semibold tracking-tight">
          {dateLabel}{" "}
          <span className={`accent-italic ${italicClass}`}>{timeLabel}</span>
        </p>
        <p className="mt-2 text-sm text-neutral-300">{meta}</p>
        <CountdownGrid deadline={deadline} />
        {footnote ? (
          <p className="mt-6 text-sm text-neutral-400">{footnote}</p>
        ) : null}
      </div>
    </section>
  );
}
