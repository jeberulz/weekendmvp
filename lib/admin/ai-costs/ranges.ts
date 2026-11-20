/**
 * WP93. The console's time ranges, in UTC days, matching the meter.
 *
 * The meter books every call to the UTC day it was reserved (`ai_usage.dayKey`,
 * and the global counters keyed by it). A range is a set of whole UTC days, and
 * rows are kept by `dayKey`, so "today" here is exactly the meter's today.
 */

export const RANGE_IDS = ["today", "7d", "30d"] as const;
export type RangeId = (typeof RANGE_IDS)[number];

export const RANGE_LABELS: Readonly<Record<RangeId, string>> = {
  today: "Today",
  "7d": "7 days",
  "30d": "30 days",
};

const RANGE_DAYS: Readonly<Record<RangeId, number>> = { today: 1, "7d": 7, "30d": 30 };

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Rows are read a little past each edge, then kept by `dayKey`. */
export const RANGE_EDGE_PADDING_MS = 60_000;

export function parseRange(value: string | string[] | undefined): RangeId {
  const raw = Array.isArray(value) ? value[0] : value;
  return (RANGE_IDS as readonly string[]).includes(raw ?? "") ? (raw as RangeId) : "7d";
}

export function utcDayKeyOf(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 10);
}

export function utcDayStart(dayKey: string): number {
  return Date.parse(`${dayKey}T00:00:00.000Z`);
}

export type ResolvedRange = {
  readonly id: RangeId;
  readonly days: number;
  /** Oldest first. The last one is today. */
  readonly dayKeys: readonly string[];
  readonly startMs: number;
  readonly endMs: number;
};

export function resolveRange(id: RangeId, nowMs: number): ResolvedRange {
  const days = RANGE_DAYS[id];
  const todayStart = utcDayStart(utcDayKeyOf(nowMs));
  const dayKeys: string[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) dayKeys.push(utcDayKeyOf(todayStart - offset * DAY_MS));
  const startMs = utcDayStart(dayKeys[0]);
  return { id, days, dayKeys, startMs, endMs: todayStart + DAY_MS };
}
