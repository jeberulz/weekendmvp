/**
 * WP93. The console's CSV exports: per-founder and per-prompt tables for the
 * chosen range. Money in dollars with six decimals (exact micro-USD).
 */

import type { Breakdown, FounderRow } from "./aggregate";
import { csvUsd, toCsv } from "./csv";

const iso = (ms: number | null) => (ms === null ? null : new Date(ms).toISOString());
const rate = (value: number | null) => (value === null ? null : Number(value.toFixed(4)));

export function foundersCsv(rows: readonly FounderRow[]): string {
  return toCsv(
    [
      "owner_id", "email", "plan", "in_cohort", "spend_in_range_usd", "today_spend_usd", "daily_cap_usd",
      "free_lifetime_spend_usd", "free_lifetime_ceiling_usd", "reserved_now_usd", "businesses", "launches",
      "wren_messages", "calls", "failed_calls", "last_call_in_range", "last_active",
    ],
    rows.map((row) => [
      row.ownerId ?? "platform",
      row.summary?.email ?? null,
      row.plan,
      row.summary ? row.summary.inCohort : null,
      csvUsd(row.chargedMicroUsd),
      csvUsd(row.summary?.daySpentMicroUsd ?? null),
      csvUsd(row.summary?.dayCapMicroUsd ?? null),
      csvUsd(row.summary?.freeLifetimeSpentMicroUsd ?? null),
      csvUsd(row.summary ? row.summary.freeLifetimeCeilingMicroUsd : null),
      csvUsd(row.summary?.reservedMicroUsd ?? null),
      row.summary?.businesses ?? null,
      row.summary?.launches ?? null,
      row.wrenMessages,
      row.calls,
      row.failed,
      iso(row.lastCallAt),
      iso(row.summary?.lastActiveAt ?? null),
    ]),
  );
}

export function breakdownCsv(rows: readonly Breakdown[], keyName: string): string {
  return toCsv(
    [
      keyName, "models", "tiers", "calls", "settled", "failed", "in_flight", "input_tokens", "output_tokens_incl_thinking",
      "cache_read_tokens", "cache_write_tokens", "charged_usd", "failed_spend_usd", "share_of_spend", "failure_rate",
      "avg_cost_per_call_usd", "cache_hit_rate", "reasks",
    ],
    rows.map((row) => [
      row.key, row.models.join(" "), row.tiers.join(" "), row.calls, row.settled, row.failed, row.reserved,
      row.inputTokens, row.outputTokens, row.cacheReadTokens, row.cacheWriteTokens,
      csvUsd(row.chargedMicroUsd), csvUsd(row.failedMicroUsd), rate(row.share), rate(row.failureRate),
      csvUsd(row.avgCostMicroUsd), rate(row.cacheHitRate), row.reasks,
    ]),
  );
}
