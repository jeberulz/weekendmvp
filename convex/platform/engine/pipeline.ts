import type { ProviderRole } from "./providers/types";
import type { StepType } from "../validators";

/**
 * WP26-S3. The seven-step Validation Report pipeline (plan §4.5).
 *
 * **Why `position` is the real step identity.** `STEP_TYPE_VALUES` is frozen at
 * five coarse values (`research | generate | review | render | publish`) and the
 * pipeline has seven steps, four of which are all `research`. `task_steps` has
 * no name/slug column, so `type` cannot identify a step and `position` is the
 * only discriminator the frozen schema offers. Everything that must address one
 * specific step — the idempotency key, resume, reconciliation — keys off
 * `position`, never off `type`.
 *
 * Positions are therefore a persisted contract, not a presentation order:
 * renumbering them re-points the idempotency keys of in-flight runs at the wrong
 * steps. Append new steps at the end; never insert or reorder.
 */

export const PIPELINE_VERSION = 1;

/** Stable per-step identifiers. Persisted only inside idempotency keys. */
export const PIPELINE_STEP_IDS = [
  "brief_normalization",
  "market_stats",
  "competitors",
  "community_signals",
  "keywords_demand",
  "synthesis_scoring",
  "report_render",
] as const;

export type PipelineStepId = (typeof PIPELINE_STEP_IDS)[number];

/**
 * The worst-case unit budget a step is allowed to consume.
 *
 * `S4` reserves against these numbers before the call, so they are a ceiling
 * the step must actually respect — not a guess. A step that sent more input
 * than it reserved would spend money the cap check never saw, which is why the
 * synthesis steps cap their input and fail closed rather than truncating.
 */
export type StepBudget =
  | {
      readonly role: "synthesis";
      readonly maxInputTokens: number;
      readonly maxOutputTokens: number;
    }
  | {
      readonly role: "search";
      readonly maxInputTokens: number;
      readonly maxOutputTokens: number;
      readonly requests: number;
      readonly searchContextSize: "low" | "medium" | "high";
    }
  | { readonly role: "keywordData"; readonly tasks: number; readonly maxItems: number }
  | { readonly role: null };

export type PipelineStep = {
  /** Frozen-schema position. Also the step's identity. See module doc. */
  readonly position: number;
  readonly id: PipelineStepId;
  /** Coarse frozen `task_steps.type`. Not unique across the pipeline. */
  readonly type: StepType;
  /**
   * The provider this step pays. `null` marks a step that spends no money and
   * so needs neither reconciliation nor a cost reservation.
   */
  readonly role: ProviderRole | null;
  readonly timeoutMs: number;
  readonly budget: StepBudget;
};

/**
 * Per-step wall-clock ceiling. A step that exceeds it fails closed rather than
 * hanging, which is what makes the run eligible for `S4`'s refund path instead
 * of sitting in `running` forever.
 */
const SEARCH_TIMEOUT_MS = 90_000;
const SYNTHESIS_TIMEOUT_MS = 180_000;
const KEYWORD_TIMEOUT_MS = 60_000;
const LOCAL_TIMEOUT_MS = 30_000;

export const PIPELINE: readonly PipelineStep[] = [
  {
    position: 0,
    id: "brief_normalization",
    type: "generate",
    role: "synthesis",
    timeoutMs: SYNTHESIS_TIMEOUT_MS,
    budget: { role: "synthesis", maxInputTokens: 4_000, maxOutputTokens: 800 },
  },
  {
    position: 1,
    id: "market_stats",
    type: "research",
    role: "search",
    timeoutMs: SEARCH_TIMEOUT_MS,
    budget: {
      role: "search",
      maxInputTokens: 2_000,
      maxOutputTokens: 2_000,
      requests: 1,
      searchContextSize: "high",
    },
  },
  {
    position: 2,
    id: "competitors",
    type: "research",
    role: "search",
    timeoutMs: SEARCH_TIMEOUT_MS,
    budget: {
      role: "search",
      maxInputTokens: 2_000,
      maxOutputTokens: 2_000,
      requests: 1,
      searchContextSize: "high",
    },
  },
  {
    position: 3,
    id: "community_signals",
    type: "research",
    role: "search",
    timeoutMs: SEARCH_TIMEOUT_MS,
    budget: {
      role: "search",
      maxInputTokens: 2_000,
      maxOutputTokens: 2_000,
      requests: 1,
      searchContextSize: "medium",
    },
  },
  {
    position: 4,
    id: "keywords_demand",
    type: "research",
    role: "keywordData",
    timeoutMs: KEYWORD_TIMEOUT_MS,
    budget: { role: "keywordData", tasks: 1, maxItems: 50 },
  },
  {
    position: 5,
    id: "synthesis_scoring",
    type: "generate",
    role: "synthesis",
    timeoutMs: SYNTHESIS_TIMEOUT_MS,
    budget: { role: "synthesis", maxInputTokens: 60_000, maxOutputTokens: 4_000 },
  },
  {
    position: 6,
    id: "report_render",
    type: "render",
    role: null,
    timeoutMs: LOCAL_TIMEOUT_MS,
    budget: { role: null },
  },
] as const;

/**
 * Total-run ceiling. Deliberately below the sum of the per-step ceilings: a run
 * where every step crawls to just under its own limit is a degraded run, and
 * the total ceiling is what stops it rather than letting it accumulate.
 */
export const TOTAL_TIMEOUT_MS = 600_000;

export function stepAt(position: number): PipelineStep {
  const step = PIPELINE[position];
  if (step === undefined) {
    throw new Error(`no pipeline step at position ${position}`);
  }
  return step;
}

/**
 * The step's idempotency key.
 *
 * Derived entirely from server-held state — the task's own stored
 * `idempotencyKey` and the step position — so it is byte-identical across a
 * crash, a redeploy, and a retry. No caller supplies any part of it.
 */
export function stepIdempotencyKey(
  taskIdempotencyKey: string,
  position: number,
): string {
  return `${taskIdempotencyKey}:step:${position}`;
}
