"use client";

import { useState } from "react";

import { formatUsd } from "@/lib/admin/ai-costs/money";
import type { PoolDay } from "@/lib/admin/ai-costs/aggregate";

/*
 * WP93 charts, per the dataviz skill: one axis, thin marks (≤ 24px bars,
 * 4px rounded data end, square at the baseline), a 2px surface gap between
 * stacked segments, a legend for two series, recessive hairline grid, text
 * in text tokens, a hover tooltip, and a table view beside every chart.
 * Geometry is SVG attributes, never inline styles.
 */

const W = 720;

/** Rounds only the top corners: the data end. */
function topRoundedBar(x: number, y: number, w: number, h: number, r: number): string {
  if (h <= 0) return "";
  const rr = Math.min(r, h, w / 2);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

function niceMax(value: number): number {
  if (value <= 0) return 1;
  const exp = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 2.5, 5, 10]) if (step * exp >= value) return step * exp;
  return 10 * exp;
}

function Tooltip({ x, y, lines, chartWidth }: { x: number; y: number; lines: string[]; chartWidth: number }) {
  const width = Math.max(...lines.map((line) => line.length)) * 7 + 16;
  const height = lines.length * 16 + 10;
  const left = Math.min(Math.max(4, x - width / 2), chartWidth - width - 4);
  const top = Math.max(2, y - height - 8);
  return (
    <g pointerEvents="none">
      <rect x={left} y={top} width={width} height={height} rx={4} className="fill-(--viz-tooltip-bg)" />
      {lines.map((line, index) => (
        <text key={line} x={left + 8} y={top + 18 + index * 16} className="fill-(--viz-tooltip-text) text-[12px]">
          {line}
        </text>
      ))}
    </g>
  );
}

export function DailySpendChart({
  days,
  dailyBudgetMicroUsd,
  title,
}: {
  days: readonly PoolDay[];
  /** Free + paid pool budget per day; drawn as a reference line when set. */
  dailyBudgetMicroUsd: number;
  title: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const H = 240;
  const pad = { top: 16, right: 12, bottom: 28, left: 56 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;
  const peak = Math.max(dailyBudgetMicroUsd, ...days.map((day) => day.free + day.paid));
  const max = niceMax(peak);
  const band = plotW / Math.max(1, days.length);
  const barW = Math.max(2, Math.min(24, band * 0.6));
  const y = (value: number) => pad.top + plotH - (value / max) * plotH;
  const ticks = [0, max / 4, max / 2, (3 * max) / 4, max];
  const labelEvery = days.length > 14 ? 5 : days.length > 7 ? 2 : 1;

  return (
    <figure className="m-0">
      <ul aria-label="Legend" className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-(--ed-text-2)">
        <li className="flex items-center gap-1.5"><span aria-hidden="true" className="inline-block size-2.5 rounded-sm bg-(--viz-free)" />Free pool</li>
        <li className="flex items-center gap-1.5"><span aria-hidden="true" className="inline-block size-2.5 rounded-sm bg-(--viz-paid)" />Paid pool</li>
        {dailyBudgetMicroUsd > 0 ? (
          <li className="flex items-center gap-1.5"><span aria-hidden="true" className="inline-block h-0.5 w-4 bg-(--viz-target)" />Daily budget, both pools</li>
        ) : null}
      </ul>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}. The same figures are in the table below.`} className="h-auto w-full" onMouseLeave={() => setHover(null)}>
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={pad.left} x2={W - pad.right} y1={y(tick)} y2={y(tick)} className="stroke-(--viz-grid)" strokeWidth={1} />
            <text x={pad.left - 8} y={y(tick) + 4} textAnchor="end" className="fill-(--viz-axis) text-[11px] tabular-nums">
              {formatUsd(tick)}
            </text>
          </g>
        ))}
        {days.map((day, index) => {
          const cx = pad.left + band * index + band / 2;
          const x = cx - barW / 2;
          const freeH = (day.free / max) * plotH;
          const paidH = (day.paid / max) * plotH;
          const gap = freeH > 0 && paidH > 0 ? 2 : 0;
          const freeTop = pad.top + plotH - freeH;
          return (
            <g key={day.dayKey}>
              {/* Free sits on the baseline (square); paid stacks above with the rounded data end. */}
              {freeH > 0 ? (
                paidH > 0
                  ? <rect x={x} y={freeTop} width={barW} height={freeH} className="fill-(--viz-free)" />
                  : <path d={topRoundedBar(x, freeTop, barW, freeH, 4)} className="fill-(--viz-free)" />
              ) : null}
              {paidH > 0 ? (
                <path d={topRoundedBar(x, freeTop - gap - paidH, barW, Math.max(0, paidH), 4)} className="fill-(--viz-paid)" />
              ) : null}
              {index % labelEvery === 0 || index === days.length - 1 ? (
                <text x={cx} y={H - 10} textAnchor="middle" className="fill-(--viz-axis) text-[11px]">{day.dayKey.slice(5)}</text>
              ) : null}
              <rect
                x={pad.left + band * index}
                y={pad.top}
                width={band}
                height={plotH}
                fill="transparent"
                aria-hidden="true"
                onMouseEnter={() => setHover(index)}
              />
            </g>
          );
        })}
        {dailyBudgetMicroUsd > 0 ? (
          <g pointerEvents="none">
            <line x1={pad.left} x2={W - pad.right} y1={y(dailyBudgetMicroUsd)} y2={y(dailyBudgetMicroUsd)} className="stroke-(--viz-target)" strokeWidth={2} />
            <text x={W - pad.right} y={y(dailyBudgetMicroUsd) - 6} textAnchor="end" className="fill-(--ed-text) text-[11px] font-semibold">
              Budget {formatUsd(dailyBudgetMicroUsd)} a day
            </text>
          </g>
        ) : null}
        <line x1={pad.left} x2={W - pad.right} y1={pad.top + plotH} y2={pad.top + plotH} className="stroke-(--viz-axis)" strokeWidth={1} />
        {hover !== null && days[hover] ? (
          <Tooltip
            x={pad.left + band * hover + band / 2}
            y={y(days[hover].free + days[hover].paid)}
            chartWidth={W}
            lines={[
              days[hover].dayKey,
              `Free ${formatUsd(days[hover].free)}`,
              `Paid ${formatUsd(days[hover].paid)}`,
              `Total ${formatUsd(days[hover].free + days[hover].paid)}`,
            ]}
          />
        ) : null}
      </svg>
    </figure>
  );
}

export function LaunchCostStrip({
  costs,
  targetMicroUsd,
  medianMicroUsd,
  p90MicroUsd,
}: {
  costs: readonly number[];
  targetMicroUsd: number;
  medianMicroUsd: number | null;
  p90MicroUsd: number | null;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const H = 150;
  const pad = { top: 34, right: 16, bottom: 30, left: 16 };
  const plotW = W - pad.left - pad.right;
  const max = niceMax(Math.max(targetMicroUsd * 1.4, ...costs));
  const x = (value: number) => pad.left + (value / max) * plotW;
  // Stack dots that would overlap into rows (a simple dot plot).
  const placed: { cx: number; cy: number; cost: number }[] = [];
  const baseY = H - pad.bottom - 10;
  for (const cost of costs) {
    const cx = x(cost);
    let row = 0;
    while (placed.some((dot) => Math.abs(dot.cx - cx) < 11 && dot.cy === baseY - row * 11)) row += 1;
    placed.push({ cx, cy: baseY - Math.min(row, 7) * 11, cost });
  }
  const ticks = [0, max / 4, max / 2, (3 * max) / 4, max];

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Full cost of each launch that started in this range, one dot per launch, against the $0.75 target. The figures are summarised beside the chart." className="h-auto w-full" onMouseLeave={() => setHover(null)}>
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={x(tick)} x2={x(tick)} y1={pad.top} y2={H - pad.bottom} className="stroke-(--viz-grid)" strokeWidth={1} />
            <text x={x(tick)} y={H - 10} textAnchor="middle" className="fill-(--viz-axis) text-[11px] tabular-nums">{formatUsd(tick)}</text>
          </g>
        ))}
        <line x1={x(targetMicroUsd)} x2={x(targetMicroUsd)} y1={pad.top - 14} y2={H - pad.bottom} className="stroke-(--viz-target)" strokeWidth={2} />
        <text x={x(targetMicroUsd) + 6} y={pad.top - 4} className="fill-(--ed-text) text-[11px] font-semibold">Target {formatUsd(targetMicroUsd)}</text>
        {medianMicroUsd !== null ? (
          <text x={x(medianMicroUsd)} y={14} textAnchor="middle" className="fill-(--ed-text-2) text-[11px]">▼ median {formatUsd(medianMicroUsd)}</text>
        ) : null}
        {p90MicroUsd !== null && p90MicroUsd !== medianMicroUsd ? (
          <text x={x(p90MicroUsd)} y={26} textAnchor="middle" className="fill-(--ed-text-2) text-[11px]">▼ p90 {formatUsd(p90MicroUsd)}</text>
        ) : null}
        {placed.map((dot, index) => (
          <circle
            key={index}
            cx={dot.cx}
            cy={dot.cy}
            r={hover === index ? 6 : 5}
            strokeWidth={2}
            className="fill-(--viz-free) stroke-(--viz-surface)"
            onMouseEnter={() => setHover(index)}
          />
        ))}
        {hover !== null && placed[hover] ? (
          <Tooltip x={placed[hover].cx} y={placed[hover].cy} chartWidth={W} lines={[`Launch ${formatUsd(placed[hover].cost)}`]} />
        ) : null}
      </svg>
    </figure>
  );
}
