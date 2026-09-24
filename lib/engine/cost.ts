/**
 * Cost-cap math for the idea-engine pipeline (Mode A2 phase 5).
 *
 * Lifted from codex/wp26-v1.1-engine @ c99351b `cost.ts` — only the pure
 * micro-USD helpers and assertWithinCap. Do not lift recordProviderCost
 * (writes Convex audit_events) or VALIDATION_REPORT_CREDITS.
 */

import type { StepBudget } from "./pipeline-steps";
import {
  estimateKeywordUsd,
  estimateSearchUsd,
  estimateSynthesisUsd,
  REPORT_COST_CAP_USD,
} from "./providers/pricing";

/** Cap in whole millionths of a dollar. Floats are never compared to the cap. */
export const CAP_MICRO_USD = Math.round(REPORT_COST_CAP_USD * 1_000_000);

/** Rounds up: an under-stated cost is the only rounding error that can overspend. */
export function toMicroUsd(usd: number): number {
  if (!Number.isFinite(usd) || usd < 0) {
    throw new Error(`cost must be a non-negative finite number, got ${usd}`);
  }
  return Math.ceil(usd * 1_000_000);
}

export function fromMicroUsd(microUsd: number): number {
  return microUsd / 1_000_000;
}

/**
 * The most one attempt at this step can cost, from the declared budget.
 */
export function worstCaseMicroUsd(budget: StepBudget): number {
  switch (budget.role) {
    case "synthesis":
      return toMicroUsd(
        estimateSynthesisUsd({
          inputTokens: budget.maxInputTokens,
          cachedInputTokens: 0,
          outputTokens: budget.maxOutputTokens,
        }),
      );
    case "search":
      return toMicroUsd(
        estimateSearchUsd({
          inputTokens: budget.maxInputTokens,
          outputTokens: budget.maxOutputTokens,
          requests: budget.requests,
          searchContextSize: budget.searchContextSize,
        }),
      );
    case "keywordData":
      return toMicroUsd(
        estimateKeywordUsd({ tasks: budget.tasks, items: budget.maxItems }),
      );
    case null:
      return 0;
  }
}

export class CostCapExceededError extends Error {
  readonly code = "COST_CAP_EXCEEDED" as const;

  constructor(
    readonly spentMicroUsd: number,
    readonly stepWorstCaseMicroUsd: number,
  ) {
    super(
      `reservation of ${stepWorstCaseMicroUsd}µ$ on top of ${spentMicroUsd}µ$ spent would exceed the ${CAP_MICRO_USD}µ$ cap`,
    );
    this.name = "CostCapExceededError";
  }
}

/**
 * Pre-call reservation: spent + worst-case for this call vs the $4.00 cap.
 */
export function assertWithinCap(args: {
  spentMicroUsd: number;
  worstCaseMicroUsd: number;
}): void {
  if (args.spentMicroUsd + args.worstCaseMicroUsd > CAP_MICRO_USD) {
    throw new CostCapExceededError(
      args.spentMicroUsd,
      args.worstCaseMicroUsd,
    );
  }
}
