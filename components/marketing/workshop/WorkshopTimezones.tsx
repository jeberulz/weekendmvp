import * as React from "react";

export type WorkshopTimezoneRow = {
  city: React.ReactNode;
  /** Sub-row text (e.g. "Sat Jun 27 · EDT"). */
  date: React.ReactNode;
  /** Big time on the right (e.g. "7:00 AM"). */
  time: React.ReactNode;
};

export type WorkshopTimezonesProps = {
  heading: React.ReactNode;
  /** Intro paragraph. */
  intro: React.ReactNode;
  rows: WorkshopTimezoneRow[];
  /** City row eyebrow text color (shipable=#A03D00, dare=#1E40AF). */
  cityColorClass: string;
  /** Date sub-row color (shipable=neutral-700, dare=neutral-500). */
  dateColorClass: string;
  /** Intro paragraph color (shipable=neutral-700, dare=neutral-600). */
  introColorClass: string;
  /** Optional headline weight + color overrides. */
  headingWeight?: "bold" | "semibold";
  headingColorClass?: string;
  /** Optional time value color (shipable explicit text-[#0a0a0a]). */
  timeValueColorClass?: string;
  /** Reveal class. */
  revealClass?: string;
};

/**
 * Timezones lookup card with N rows of (city, date, time).
 */
export function WorkshopTimezones({
  heading,
  intro,
  rows,
  cityColorClass,
  dateColorClass,
  introColorClass,
  headingWeight = "bold",
  headingColorClass = "",
  timeValueColorClass = "",
  revealClass = "reveal",
}: WorkshopTimezonesProps) {
  const weight = headingWeight === "bold" ? "font-bold" : "font-semibold";
  const hColor = headingColorClass ? ` ${headingColorClass}` : "";
  const tvColor = timeValueColorClass ? ` ${timeValueColorClass}` : "";
  return (
    <section className={`px-5 py-20 md:py-24 max-w-3xl mx-auto ${revealClass}`}>
      <h2
        className={`text-4xl md:text-5xl ${weight} tracking-tight leading-[1.04] mb-6${hColor}`}
      >
        {heading}
      </h2>
      <p className={`text-lg ${introColorClass} mb-10`}>{intro}</p>
      <div className="rounded-3xl border border-black/10 overflow-hidden divide-y divide-black/10">
        {rows.map((row, i) => (
          <div
            key={i}
            className="flex items-center justify-between px-6 py-5 bg-white"
          >
            <div>
              <p
                className={`font-mono-eyebrow text-[11px] uppercase ${cityColorClass}`}
              >
                {row.city}
              </p>
              <p
                className={`font-mono-eyebrow text-[10px] uppercase ${dateColorClass} mt-1`}
              >
                {row.date}
              </p>
            </div>
            <p
              className={`text-3xl font-semibold tracking-tight${tvColor}`}
            >
              {row.time}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
