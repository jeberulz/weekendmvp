import { cn } from "@/lib/utils";

type Scores = {
  opportunity: number;
  pain: number;
  timing: number;
  builder_confidence: number;
};

const SCORES = [
  ["Opportunity", "opportunity"],
  ["Pain", "pain"],
  ["Timing", "timing"],
  ["Builder confidence", "builder_confidence"],
] as const;

/**
 * The four research scores as labelled bars. The numbers are text. The bars
 * repeat them and are hidden from assistive technology.
 */
export function ScoreMeters({ scores, size = "md", className }: { scores: Scores; size?: "md" | "sm"; className?: string }) {
  const small = size === "sm";
  return (
    <dl className={cn("grid grid-cols-2", small ? "gap-x-4 gap-y-2" : "gap-x-5 gap-y-3 max-sm:grid-cols-1", className)}>
      {SCORES.map(([label, key]) => {
        const value = scores[key];
        return (
          <div
            key={key}
            className={cn(
              "grid grid-cols-[minmax(0,1fr)_auto] items-baseline",
              small ? "gap-y-1 text-[12px]" : "gap-y-1.5 text-[13px]",
            )}
          >
            <dt className="truncate text-home-ink-3">{small && key === "builder_confidence" ? "Buildable" : label}</dt>
            <dd className="font-semibold text-home-ink">
              {value}
              <span className="sr-only"> out of 10</span>
            </dd>
            <dd aria-hidden className={cn("col-span-2 overflow-hidden rounded-full bg-home-rule", small ? "h-1" : "h-1.5")}>
              <div className="h-full bg-home-ink" style={{ width: `${Math.max(0, Math.min(value, 10)) * 10}%` }} />
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
