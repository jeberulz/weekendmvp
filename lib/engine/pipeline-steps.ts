/**
 * Seven-step pipeline table (Mode A2 phase 5).
 *
 * Step order lifted from codex/wp26-v1.1-engine @ c99351b `pipeline.ts`.
 * Position 6 is provenance + parse (not a Convex documents insert).
 */

import type { ProviderRole } from "./providers/types.ts";

export const PIPELINE_VERSION = 1;

export const PIPELINE_STEP_IDS = [
  "brief_normalization",
  "market_stats",
  "competitors",
  "community_signals",
  "keywords_demand",
  "synthesis_scoring",
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
};

export const PIPELINE: readonly PipelineStep[] = [
  {
    position: 0,
    id: "brief_normalization",
    role: "synthesis",
    budget: { role: "synthesis", maxInputTokens: 4_000, maxOutputTokens: 800 },
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
  },
  {
    position: 4,
    id: "keywords_demand",
    role: "keywordData",
    budget: { role: "keywordData", tasks: 1, maxItems: 50 },
  },
  {
    position: 5,
    id: "synthesis_scoring",
    role: "synthesis",
    budget: {
      role: "synthesis",
      maxInputTokens: 60_000,
      maxOutputTokens: 8_000,
    },
  },
  {
    position: 6,
    id: "provenance_parse",
    role: null,
    budget: { role: null },
  },
] as const;

export function stepAt(position: number): PipelineStep {
  const step = PIPELINE[position];
  if (step === undefined) {
    throw new Error(`no pipeline step at position ${position}`);
  }
  return step;
}
