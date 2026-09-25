import type { DashboardSource } from "../../../lib/track";

/**
 * WP44-S9 plan URLs. Kept apart from plan-copy so the public idea page can
 * link to the start page without bundling the plan copy.
 */
export const BUILDS_PATH = "/dashboard/builds";

/** Every "Plan my weekend" link goes through the start page. */
export function startPlanHref(slug: string, source: DashboardSource): string {
  return `${BUILDS_PATH}/new?idea=${encodeURIComponent(slug)}&from=${source}`;
}

export function planHref(planId: string): string {
  return `${BUILDS_PATH}/${planId}`;
}
