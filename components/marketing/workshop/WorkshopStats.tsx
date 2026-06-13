import * as React from "react";

export type WorkshopStatItem = {
  /** Lead number / text (e.g. "10", "400"). */
  value: React.ReactNode;
  /** Italic accent suffix (e.g. " shipped", "+"). Optional. */
  suffix?: React.ReactNode;
  /** Right-aligned uppercase label. */
  label: React.ReactNode;
  /** Optional reveal class (shipable uses "reveal", dare uses "reveal-fade"). */
  revealClass?: string;
};

export type WorkshopStatsProps = {
  /** Eyebrow inside the rounded pill (e.g. "Why listen to me"). */
  eyebrow: string;
  /** Stat rows. */
  items: WorkshopStatItem[];
  /** Tailwind color class for the italic suffix accent. */
  italicClass: string;
};

/**
 * The dark "Why listen to me" stats band. Rendered as a <dl> with
 * divide-y rows. Shared by shipable + dare.
 */
export function WorkshopStats({ eyebrow, items, italicClass }: WorkshopStatsProps) {
  return (
    <section className="px-5 py-16 md:py-24 bg-[#1a1a1a] text-white">
      <div className="max-w-5xl mx-auto">
        <div className="inline-flex items-center rounded-full border border-white/15 px-4 py-1.5 mb-12">
          <span className="font-mono-eyebrow text-[11px] uppercase text-neutral-300">
            {eyebrow}
          </span>
        </div>
        <dl className="divide-y divide-white/10">
          {items.map((item, i) => (
            <div
              key={i}
              className={`flex items-baseline justify-between py-6 ${item.revealClass ?? "reveal"}`}
            >
              <dt className="text-4xl md:text-5xl font-semibold tracking-tight">
                {item.value}
                {item.suffix ? (
                  <span className={`accent-italic ${italicClass} text-3xl`}>
                    {item.suffix}
                  </span>
                ) : null}
              </dt>
              <dd className="font-mono-eyebrow text-[10px] md:text-xs uppercase text-neutral-300 text-right">
                {item.label}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
