/**
 * WP93. What-if model swap: re-price the tokens each prompt really used at
 * another Claude model's rates, with the dated rate cards in
 * `convex/ai/pricing.ts` (the same cards the gateway reserves and settles
 * with). An estimate only: a different model would use a different number
 * of tokens, and no live call is made.
 *
 * Both sides are re-priced from tokens, so the delta compares like with like
 * even where a stored charge was estimated or rounded.
 */

import {
  ANTHROPIC_RATE_CARDS,
  anthropicCostMicroUsd,
} from "@/convex/ai/pricing";
import type { PromptModel } from "@/lib/workspace/contracts/prompts";
import { addMicroUsd, chargedMicroUsd } from "./money";
import type { UsageRow } from "./types";

export const WHAT_IF_MODELS = Object.keys(ANTHROPIC_RATE_CARDS) as PromptModel[];

export const MODEL_LABELS: Readonly<Record<PromptModel, string>> = {
  "claude-haiku-5-5": "Haiku 5.5",
  "claude-sonnet-5-5": "Sonnet 5.5",
  "claude-opus-5-5": "Opus 5.5",
};

export function isPricedModel(model: string): model is PromptModel {
  return Object.hasOwn(ANTHROPIC_RATE_CARDS, model);
}

function usageOf(row: UsageRow) {
  return {
    inputTokens: row.inputTokens,
    cacheReadTokens: row.cacheReadTokens,
    cacheWriteTokens: row.cacheWriteTokens,
    outputTokens: row.outputTokens,
  };
}

/** A settled Claude row's tokens at `model`'s rates (batch discount kept), or null for other rows. */
export function repriceRow(row: UsageRow, model: PromptModel, options: { readonly batch?: boolean } = {}): number | null {
  if (row.status !== "settled" || row.provider !== "anthropic" || !isPricedModel(row.model)) return null;
  return anthropicCostMicroUsd(model, usageOf(row), { batch: options.batch ?? row.batch });
}

/** The row's own model at standard (non-batch) rates: what a batch row would have cost in real time. */
export function standardPrice(row: UsageRow): number | null {
  if (!isPricedModel(row.model)) return null;
  return repriceRow(row, row.model, { batch: false });
}

export type WhatIfPrompt = {
  readonly promptRef: string;
  /** Models the prompt ran on in the range. */
  readonly currentModels: readonly string[];
  readonly calls: number;
  readonly batchCalls: number;
  readonly chargedMicroUsd: number;
  /** The same tokens re-priced at the model each call ran on. */
  readonly baselineMicroUsd: number;
  /** The same tokens at each model's rates. */
  readonly byModel: Readonly<Record<PromptModel, number>>;
};

/** One entry per prompt with settled Claude calls, biggest spend first. */
export function whatIf(rows: readonly UsageRow[]): WhatIfPrompt[] {
  type Acc = {
    models: Set<string>; calls: number; batchCalls: number; charged: number; baseline: number;
    byModel: Record<PromptModel, number>;
  };
  const groups = new Map<string, Acc>();
  for (const row of rows) {
    if (row.status !== "settled" || row.provider !== "anthropic" || !isPricedModel(row.model)) continue;
    const group = groups.get(row.promptRef) ?? {
      models: new Set<string>(), calls: 0, batchCalls: 0, charged: 0, baseline: 0,
      byModel: Object.fromEntries(WHAT_IF_MODELS.map((model) => [model, 0])) as Record<PromptModel, number>,
    };
    group.models.add(row.model);
    group.calls += 1;
    if (row.batch) group.batchCalls += 1;
    group.charged = addMicroUsd(group.charged, chargedMicroUsd(row));
    group.baseline = addMicroUsd(group.baseline, repriceRow(row, row.model) ?? 0);
    for (const model of WHAT_IF_MODELS) {
      group.byModel[model] = addMicroUsd(group.byModel[model], repriceRow(row, model) ?? 0);
    }
    groups.set(row.promptRef, group);
  }
  return [...groups].map(([promptRef, group]) => ({
    promptRef,
    currentModels: [...group.models].sort(),
    calls: group.calls,
    batchCalls: group.batchCalls,
    chargedMicroUsd: group.charged,
    baselineMicroUsd: group.baseline,
    byModel: group.byModel,
  })).sort((a, b) => b.chargedMicroUsd - a.chargedMicroUsd || a.promptRef.localeCompare(b.promptRef));
}
