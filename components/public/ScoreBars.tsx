import type { PublicScores } from "./types";

const SCORES = [
  ["Opportunity", "opportunity"],
  ["Pain", "pain"],
  ["Timing", "timing"],
  ["Buildable", "builder_confidence"],
] as const;

/**
 * The four research scores on a public card. The numbers are text; the bars
 * repeat them in orange (owner edit on the approved canvas) and are hidden
 * from assistive technology.
 */
export function ScoreBars({ scores }: { scores: PublicScores }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
      {SCORES.map(([label, key]) => {
        const value = scores[key];
        return (
          <div key={key} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-y-1 text-[12px]">
            <dt className="truncate text-home-ink-3">{label}</dt>
            <dd className="font-semibold text-home-ink">
              {value}
              <span className="sr-only"> out of 10</span>
            </dd>
            <dd aria-hidden className="col-span-2 h-1 overflow-hidden rounded-full bg-home-rule">
              <div className="h-full bg-home-orange" style={{ width: `${Math.max(0, Math.min(value, 10)) * 10}%` }} />
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

const SHORT: Record<keyof PublicScores, string> = {
  opportunity: "Opp.",
  pain: "Pain",
  timing: "Timing",
  builder_confidence: "Build",
};

/** Four boxed scores for the larger featured cards. Short visible labels; full names for screen readers. */
export function ScoreCells({ scores }: { scores: PublicScores }) {
  return (
    <dl className="grid grid-cols-4 gap-2">
      {SCORES.map(([label, key]) => (
        <div key={key} className="flex min-w-0 flex-col gap-0.5 rounded-[10px] bg-home-paper px-2.5 py-2.5">
          <dt className="truncate font-mono text-[10px] uppercase tracking-[0.06em] text-home-ink-3">
            <span aria-hidden>{SHORT[key]}</span>
            <span className="sr-only">{label}</span>
          </dt>
          <dd className="font-mono text-base font-medium text-home-ink">
            {scores[key]}
            <span className="text-xs text-home-ink-3">/10</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
