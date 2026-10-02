/**
 * Step table for PIPELINE_VERSION 2 (WP54, evidence contract §2).
 *
 * Evidence is accepted before any editorial writing:
 *
 *   0 brief_normalization  paid synthesis
 *   1 market_stats         paid search
 *   2 competitors          paid search
 *   3 community_signals    paid search (primary + optional supplement)
 *     (source acquisition: unpaid, bounded reads of every citation)
 *   4 evidence_extraction  paid synthesis, schema-only candidates
 *     (evidence acceptance: unpaid, deterministic; minimums stop the run)
 *   5 keywords_demand      paid keyword data (fail closed)
 *   6 editorial_synthesis  paid synthesis from the accepted bundle only
 *   7 provenance_parse     unpaid record assembly and v2 parse
 *
 * `maxAttempts` bounds the billable attempts of a step for a whole run,
 * provider retries and regenerations included; the runner refuses an attempt
 * past it. Every attempt reserves its budget's worst case first, so the sum
 * of `maxAttempts × worst case` (worstCaseRunMicroUsd in cost.ts) is the most
 * a run can spend, and it stays under REPORT_COST_CAP_USD.
 */

import { PIPELINE_VERSION_V2 } from "./evidence/contract.ts";
import type { ProviderRole } from "./providers/types.ts";

export const PIPELINE_VERSION = PIPELINE_VERSION_V2;

export const PIPELINE_STEP_IDS = [
  "brief_normalization",
  "market_stats",
  "competitors",
  "community_signals",
  "evidence_extraction",
  "keywords_demand",
  "editorial_synthesis",
  "provenance_parse",
] as const;

export type PipelineStepId = (typeof PIPELINE_STEP_IDS)[number];

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
      /** Search requests one attempt sends (each attempt is one request). */
      readonly requests: number;
      readonly searchContextSize: "low" | "medium" | "high";
    }
  | {
      readonly role: "keywordData";
      readonly tasks: number;
      readonly maxItems: number;
    }
  | { readonly role: null };

export type PipelineStep = {
  readonly position: number;
  readonly id: PipelineStepId;
  readonly role: ProviderRole | null;
  readonly budget: StepBudget;
  /** Billable attempts this step may make in one run (0 for unpaid steps). */
  readonly maxAttempts: number;
};

export const PIPELINE: readonly PipelineStep[] = [
  {
    position: 0,
    id: "brief_normalization",
    role: "synthesis",
    budget: { role: "synthesis", maxInputTokens: 4_000, maxOutputTokens: 800 },
    // One call plus one provider retry.
    maxAttempts: 2,
  },
  {
    position: 1,
    id: "market_stats",
    role: "search",
    budget: {
      role: "search",
      maxInputTokens: 2_000,
      maxOutputTokens: 2_000,
      requests: 1,
      searchContextSize: "high",
    },
    maxAttempts: 2,
  },
  {
    position: 2,
    id: "competitors",
    role: "search",
    budget: {
      role: "search",
      maxInputTokens: 2_000,
      maxOutputTokens: 2_000,
      requests: 1,
      searchContextSize: "high",
    },
    maxAttempts: 2,
  },
  {
    position: 3,
    id: "community_signals",
    role: "search",
    budget: {
      role: "search",
      maxInputTokens: 2_000,
      maxOutputTokens: 2_000,
      requests: 1,
      searchContextSize: "medium",
    },
    // Primary search and the optional non-Reddit supplement, each with one
    // provider retry.
    maxAttempts: 4,
  },
  {
    position: 4,
    id: "evidence_extraction",
    role: "synthesis",
    budget: {
      role: "synthesis",
      // Brief context plus bounded page excerpts (buildExtractionSources fits
      // them into this budget).
      maxInputTokens: 48_000,
      // JSON for up to 40 candidates per kind, plus reasoning headroom.
      maxOutputTokens: 16_000,
    },
    // In total: a provider retry or one re-ask after an unparseable reply.
    maxAttempts: 2,
  },
  {
    position: 5,
    id: "keywords_demand",
    role: "keywordData",
    budget: { role: "keywordData", tasks: 1, maxItems: 50 },
    maxAttempts: 2,
  },
  {
    position: 6,
    id: "editorial_synthesis",
    role: "synthesis",
    budget: {
      role: "synthesis",
      // Brief context, the bounded accepted-evidence bundle, provider keyword
      // rows and (on a regeneration) the bounded issue list.
      maxInputTokens: 72_000,
      // Narratives, tiers, yearOne, dataModel and brandBrief, with headroom
      // for reasoning (as before WP54).
      maxOutputTokens: 10_000,
    },
    // In total (ruling R13): provider retries and up to two regenerations
    // after validation failure share these three attempts, each with the
    // same instructions plus the latest issue list.
    maxAttempts: 3,
  },
  {
    position: 7,
    id: "provenance_parse",
    role: null,
    budget: { role: null },
    maxAttempts: 0,
  },
] as const;

export function stepAt(position: number): PipelineStep {
  const step = PIPELINE[position];
  if (step === undefined) {
    throw new Error(`no pipeline step at position ${position}`);
  }
  return step;
}

export function stepById(id: PipelineStepId): PipelineStep {
  const step = PIPELINE.find((s) => s.id === id);
  if (step === undefined) throw new Error(`no pipeline step ${id}`);
  return step;
}
