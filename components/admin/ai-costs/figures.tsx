import { formatPercent, formatUsd } from "@/lib/admin/ai-costs/money";
import { StatusBadge } from "./primitives";

/** Spend against a budget: the fill carries severity, the track is a lighter step; the badge says it in words. */
export function BudgetMeter({
  label,
  usedMicroUsd,
  inFlightMicroUsd,
  budgetMicroUsd,
}: {
  label: string;
  usedMicroUsd: number;
  inFlightMicroUsd: number;
  budgetMicroUsd: number;
}) {
  const W = 400;
  const rate = budgetMicroUsd > 0 ? usedMicroUsd / budgetMicroUsd : null;
  const withFlight = budgetMicroUsd > 0 ? (usedMicroUsd + inFlightMicroUsd) / budgetMicroUsd : null;
  const fill = Math.min(1, rate ?? 0) * W;
  const flight = Math.max(0, Math.min(1, withFlight ?? 0) * W - fill);
  const level = withFlight === null ? null : withFlight >= 1 ? "critical" : withFlight >= 0.8 ? "warning" : "good";
  const fillClass = level === "critical" ? "fill-(--viz-critical)" : level === "warning" ? "fill-(--viz-warning)" : "fill-(--viz-free)";
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold">{label}</p>
        {level === null ? (
          <StatusBadge tone="info">No budget set</StatusBadge>
        ) : level === "critical" ? (
          <StatusBadge tone="critical">At or over budget</StatusBadge>
        ) : level === "warning" ? (
          <StatusBadge tone="warning">Past 80%</StatusBadge>
        ) : (
          <StatusBadge tone="good">Under 80%</StatusBadge>
        )}
      </div>
      <p className="mt-1 text-2xl font-semibold tabular-nums">
        {formatUsd(usedMicroUsd)}
        <span className="text-sm font-normal text-(--ed-text-2)"> settled of {formatUsd(budgetMicroUsd)}</span>
      </p>
      <svg viewBox={`0 0 ${W} 10`} preserveAspectRatio="none" aria-hidden="true" className="mt-2 h-2.5 w-full">
        <rect x={0} y={0} width={W} height={10} rx={4} className="fill-(--viz-track)" />
        {fill > 0 ? <rect x={0} y={0} width={fill} height={10} rx={4} className={fillClass} /> : null}
        {flight > 0 ? <rect x={fill + (fill > 0 ? 2 : 0)} y={0} width={Math.max(0, flight - 2)} height={10} rx={2} className="fill-(--viz-paid) opacity-60" /> : null}
      </svg>
      <p className="mt-1 text-xs text-(--ed-text-2)">
        {formatPercent(rate)} used · {formatUsd(inFlightMicroUsd)} reserved in flight (shown apart, not yet spent)
      </p>
    </div>
  );
}

/** A ranked single-series bar list: value at the tip, one hue, no legend (the heading names it). */
export function ShareBars({ items }: { items: ReadonlyArray<{ label: string; share: number | null; microUsd: number }> }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.label} className="grid grid-cols-[minmax(0,12rem)_1fr] items-center gap-3 text-sm sm:grid-cols-[minmax(0,16rem)_1fr]">
          <span className="truncate font-mono text-xs" title={item.label}>{item.label}</span>
          <span className="flex items-center gap-2">
            <svg viewBox="0 0 100 12" preserveAspectRatio="none" aria-hidden="true" className="h-3 flex-1">
              <rect x={0} y={0} width={Math.max(0.5, (item.share ?? 0) * 100)} height={12} rx={2} className="fill-(--viz-free)" />
            </svg>
            <span className="w-28 shrink-0 text-right text-xs tabular-nums">
              {formatUsd(item.microUsd)} · {formatPercent(item.share)}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
