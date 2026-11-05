import "server-only";

import type { WorkspacePlanId } from "@/lib/workspace/contracts/jobs";

/** The shape `CreditMeter` takes, and the shape WP73's `creditsSummary` will return to the shell. */
export type CreditsSummary = {
  readonly balance: number;
  readonly max: number;
  readonly plan: WorkspacePlanId;
};

const MOCK_CREDITS_SUMMARY: CreditsSummary = Object.freeze({ balance: 48, max: 50, plan: "free" });

/**
 * WP73 replaces this with creditsSummary.
 *
 * Fixed mock: it ignores the project and never calls Convex, so the shell
 * shows the same Free-plan meter for every business until the metering query
 * lands. Keep the async signature so the swap changes no caller.
 */
export async function getCreditsSummary(projectId: string): Promise<CreditsSummary> {
  void projectId;
  return MOCK_CREDITS_SUMMARY;
}
