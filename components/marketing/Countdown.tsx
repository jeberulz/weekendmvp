"use client";

import { useEffect, useState } from "react";

/**
 * Workshop countdown, ported from the inline countdown script shared by
 * shipable.html and dare.html. All time math runs in useEffect (Cache
 * Components: no Date.now() during render) — the initial server/client
 * render shows the legacy static placeholders ("00" cells / "Seats open
 * now") so hydration never mismatches.
 *
 * Draft pages ship a literal "[[WORKSHOP_DATE_ISO]]" deadline; like the
 * legacy script (`raw.startsWith('[[')`), that keeps the placeholders.
 */

type CountdownParts = {
  days: string;
  hours: string;
  minutes: string;
  seconds: string;
  expired: boolean;
};

const pad = (n: number) => String(n).padStart(2, "0");

function parseDeadline(raw: string): number {
  if (!raw || raw.startsWith("[[")) return NaN;
  return new Date(raw).getTime();
}

function useCountdown(deadlineIso: string): CountdownParts | null {
  const [parts, setParts] = useState<CountdownParts | null>(null);

  useEffect(() => {
    const deadline = parseDeadline(deadlineIso);
    if (Number.isNaN(deadline)) return;

    const tick = () => {
      let diff = Math.max(0, deadline - Date.now());
      const days = Math.floor(diff / 86400000);
      diff -= days * 86400000;
      const hours = Math.floor(diff / 3600000);
      diff -= hours * 3600000;
      const minutes = Math.floor(diff / 60000);
      diff -= minutes * 60000;
      const seconds = Math.floor(diff / 1000);
      setParts({
        days: pad(days),
        hours: pad(hours),
        minutes: pad(minutes),
        seconds: pad(seconds),
        expired: deadline - Date.now() <= 0,
      });
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadlineIso]);

  return parts;
}

/** The 4-cell Days/Hrs/Min/Sec grid inside the dark date card. */
export function CountdownGrid({ deadline }: { deadline: string }) {
  const parts = useCountdown(deadline);
  const cells = [
    { label: "Days", value: parts?.days ?? "00" },
    { label: "Hrs", value: parts?.hours ?? "00" },
    { label: "Min", value: parts?.minutes ?? "00" },
    { label: "Sec", value: parts?.seconds ?? "00" },
  ];

  return (
    <div
      className="mt-6 grid grid-cols-4 gap-3 max-w-sm"
      role="timer"
      aria-label="Time remaining until the workshop"
    >
      {cells.map((cell) => (
        <div
          key={cell.label}
          className="rounded-xl bg-white/5 border border-white/10 px-2 py-3 text-center"
        >
          <span className="block text-2xl font-semibold tabular-nums">
            {cell.value}
          </span>
          <span className="font-mono-eyebrow text-[9px] uppercase text-neutral-300">
            {cell.label}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * The text label inside the sticky bottom CTA bar:
 * "Seats open now" → "XXd XXh XXm XXs left" → "Starting now".
 */
export function StickyCountdownLabel({
  deadline,
  className,
}: {
  deadline: string;
  className?: string;
}) {
  const parts = useCountdown(deadline);
  const text = parts
    ? parts.expired
      ? "Starting now"
      : `${parts.days}d ${parts.hours}h ${parts.minutes}m ${parts.seconds}s left`
    : "Seats open now";

  return <span className={className}>{text}</span>;
}
