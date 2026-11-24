/** WP93. Display labels for the AI cost console. */

import type { UsagePlan } from "./types";

export const PLAN_LABELS: Readonly<Record<UsagePlan | "platform", string>> = {
  free: "Free",
  builders_hub: "Builder’s Hub",
  growth: "Growth",
  platform: "Platform",
};

/** `2026-11-20 14:03 UTC`, or "—". Always UTC, like the meter's days. */
export function formatUtc(ms: number | null): string {
  if (ms === null) return "—";
  return `${new Date(ms).toISOString().replace("T", " ").slice(0, 16)} UTC`;
}
