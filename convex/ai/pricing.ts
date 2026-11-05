/**
 * WP71-S1. Dated rate cards for the AI crew's providers, in integer micro-USD.
 *
 * One module so the gateway's reservation (worst case), its settle (actual
 * usage) and the cost audit trail price a call the same way. Modelled on
 * `lib/engine/providers/pricing.ts`: every rate is dated, so a silent rate
 * change shows up in `git blame` instead of a wrong estimate.
 *
 * Maths: a token count times a USD-per-million-tokens rate is micro-USD, so
 * no division happens. Totals round up (an under-stated cost is the only
 * rounding error that can overspend). The worst-case and media helpers reuse
 * C-METER (`worstCaseReservation`, `mediaReservation`), not
 * `lib/engine/cost.ts`: the engine module imports the engine's own rate cards
 * and pipeline steps, which must stay out of the Convex bundle (C-METER keeps
 * its own `toMicroUsd` copy for the same reason).
 *
 * Plain helpers only: no Convex function, no env read, no side effect.
 */

import {
  mediaReservation,
  worstCaseReservation,
  type RatePerMTok,
} from "../../lib/workspace/contracts/metering";
import {
  maxInputTokensForSpec,
  modelForSpec,
  type PromptModel,
  type PromptSpec,
} from "../../lib/workspace/contracts/prompts";

/**
 * Rounds a non-negative micro-USD amount up to an integer, ignoring float
 * noise below a thousandth of a micro-dollar (so 0.1 × 1000 is 100, not 101).
 * The same rule as C-METER's private `ceilMicroUsd`.
 */
export function ceilMicroUsd(amount: number): number {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new RangeError(`micro-USD amount must be a non-negative finite number, got ${amount}`);
  }
  return Math.ceil(Math.round(amount * 1_000) / 1_000);
}

// ---------------------------------------------------------------------------
// Anthropic (Claude 5.5 tiers)
// ---------------------------------------------------------------------------

/**
 * Source: the `claude-api` skill reference (Current Models table, cached
 * 2026-10-06; `shared/models.md`, `shared/prompt-caching.md` § Economics and
 * `shared/model-migration.md` → Migrating to Claude Haiku 5.5), read on
 * 2026-11-05 for WP71-S1. Cache writes are the 5-minute rate (1.25× input);
 * we never write the 1-hour cache (C-PROMPT `PromptCacheLayout.ttl`).
 * Re-check against the live pricing page before any live spend.
 */
export const ANTHROPIC_RATES_EFFECTIVE_FROM = "2026-10-06";

/** USD per million tokens. */
export type AnthropicTokenRates = {
  readonly input: number;
  readonly output: number;
  /** 5-minute cache write. */
  readonly cacheWrite5m: number;
  readonly cacheRead: number;
};

export type AnthropicRateCard = {
  readonly effectiveFrom: string;
  readonly standard: AnthropicTokenRates;
  /**
   * Haiku 5.5 prices a prompt over `thresholdTokens` (input + cache read +
   * cache write) on a second card, for the whole request.
   */
  readonly longContext?: { readonly thresholdTokens: number; readonly rates: AnthropicTokenRates };
};

export const ANTHROPIC_RATE_CARDS = {
  // $0.10 / $0.50 up to 100K prompt tokens, $0.50 / $2.50 above; cache reads
  // 0.1× input, 5-minute writes 1.25× input.
  "claude-haiku-5-5": {
    effectiveFrom: ANTHROPIC_RATES_EFFECTIVE_FROM,
    standard: { input: 0.1, output: 0.5, cacheWrite5m: 0.125, cacheRead: 0.01 },
    longContext: {
      thresholdTokens: 100_000,
      rates: { input: 0.5, output: 2.5, cacheWrite5m: 0.625, cacheRead: 0.05 },
    },
  },
  // $2 / $10; cache reads $0.20 (0.1×); 5-minute writes 1.25× input.
  // The WP69 spike's rate card has Sonnet 5.5 cache reads at $0.10. We keep the
  // skill's $0.20, which can only over-charge. Check it against the live
  // pricing page before live spend.
  "claude-sonnet-5-5": {
    effectiveFrom: ANTHROPIC_RATES_EFFECTIVE_FROM,
    standard: { input: 2, output: 10, cacheWrite5m: 2.5, cacheRead: 0.2 },
  },
  // $4 / $20; cache reads $0.20 (0.05×, not 0.1×); 5-minute writes 1.25× input.
  "claude-opus-5-5": {
    effectiveFrom: ANTHROPIC_RATES_EFFECTIVE_FROM,
    standard: { input: 4, output: 20, cacheWrite5m: 5, cacheRead: 0.2 },
  },
} as const satisfies Record<PromptModel, AnthropicRateCard>;

/** Message Batches: 50% off every token, cache reads and writes included. */
export const ANTHROPIC_BATCH_MULTIPLIER = 0.5;

export type AnthropicUsageForCost = {
  readonly inputTokens: number;
  readonly cacheReadTokens: number;
  readonly cacheWriteTokens: number;
  readonly outputTokens: number;
};

function assertTokenCount(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a safe non-negative integer, got ${value}`);
  }
}

export function anthropicRateCard(model: PromptModel): AnthropicRateCard {
  const card: AnthropicRateCard | undefined = (ANTHROPIC_RATE_CARDS as Record<string, AnthropicRateCard>)[model];
  if (!card) throw new RangeError(`no Anthropic rate card for model ${String(model)}`);
  return card;
}

/** The rates that apply to a request with this many prompt tokens, batch-discounted when asked. */
export function anthropicRatesFor(
  model: PromptModel,
  promptTokens: number,
  options: { readonly batch?: boolean } = {},
): AnthropicTokenRates {
  assertTokenCount("promptTokens", promptTokens);
  const card = anthropicRateCard(model);
  const rates =
    card.longContext && promptTokens > card.longContext.thresholdTokens ? card.longContext.rates : card.standard;
  if (!options.batch) return rates;
  const m = ANTHROPIC_BATCH_MULTIPLIER;
  return {
    input: rates.input * m,
    output: rates.output * m,
    cacheWrite5m: rates.cacheWrite5m * m,
    cacheRead: rates.cacheRead * m,
  };
}

/** Actual cost of one Claude call in micro-USD, rounded up. Zero tokens cost zero. */
export function anthropicCostMicroUsd(
  model: PromptModel,
  usage: AnthropicUsageForCost,
  options: { readonly batch?: boolean } = {},
): number {
  assertTokenCount("inputTokens", usage.inputTokens);
  assertTokenCount("cacheReadTokens", usage.cacheReadTokens);
  assertTokenCount("cacheWriteTokens", usage.cacheWriteTokens);
  assertTokenCount("outputTokens", usage.outputTokens);
  const promptTokens = usage.inputTokens + usage.cacheReadTokens + usage.cacheWriteTokens;
  const rates = anthropicRatesFor(model, promptTokens, options);
  return ceilMicroUsd(
    usage.inputTokens * rates.input +
      usage.cacheReadTokens * rates.cacheRead +
      usage.cacheWriteTokens * rates.cacheWrite5m +
      usage.outputTokens * rates.output,
  );
}

/**
 * The most one Claude call can cost, for the gateway's reservation: every
 * input token at the cache-write rate (the dearer one) plus `maxTokens` of
 * output (thinking bills as output and is inside `maxTokens`). Delegates to
 * C-METER `worstCaseReservation`, which also refuses an input estimate over
 * `maxInputTokens`. Haiku's long-context card is chosen from the larger of
 * `inputTokens` and `maxInputTokens`: if the lane allows a prompt over the
 * threshold, the dearer card applies even when this estimate is under it.
 */
export function anthropicWorstCaseMicroUsd(args: {
  readonly model: PromptModel;
  readonly inputTokens: number;
  readonly maxTokens: number;
  readonly batch?: boolean;
  /** The lane ceiling (C-PROMPT `maxInputTokensForSpec`); refuses a larger `inputTokens`. */
  readonly maxInputTokens?: number;
}): number {
  const bound = Math.max(args.inputTokens, args.maxInputTokens ?? 0);
  const rates = anthropicRatesFor(args.model, bound, { batch: args.batch });
  const ratePerMTok: RatePerMTok = { input: rates.input, output: rates.output, cacheWrite: rates.cacheWrite5m };
  return worstCaseReservation({
    inputTokensEstimate: args.inputTokens,
    maxTokens: args.maxTokens,
    ratePerMTok,
    maxInputTokens: args.maxInputTokens,
  });
}

/** The worst case for a spec at its lane's input ceiling: the largest reservation it may ever make. */
export function specWorstCaseMicroUsd(
  spec: Pick<PromptSpec<unknown, unknown>, "tier" | "mode" | "maxTokens">,
): number {
  const maxInputTokens = maxInputTokensForSpec(spec);
  return anthropicWorstCaseMicroUsd({
    model: modelForSpec(spec),
    inputTokens: maxInputTokens,
    maxTokens: spec.maxTokens,
    batch: spec.mode === "batch",
    maxInputTokens,
  });
}

// ---------------------------------------------------------------------------
// OpenAI Images (gpt-image-2) — photo-style offer and post images (D11)
// ---------------------------------------------------------------------------

/** Measured in the WP69-S4 spike (`docs/wp/wp69-spike-results.md`), 2026-11-05. */
export const OPENAI_IMAGE_RATES_EFFECTIVE_FROM = "2026-11-05";

export const OPENAI_IMAGE_MODEL = "gpt-image-2";

/**
 * Per-image cost at `medium` quality, micro-USD: $0.041 for 1536×1024 (the
 * hero) and $0.053 for 1024×1024 (measured on the logo marks). These are
 * OpenAI's documented per-image figures (the cost table). Only these two sizes
 * and this one quality are priced, so only they are accepted.
 */
export const OPENAI_IMAGE_PRICES_MICRO_USD = {
  medium: {
    "1536x1024": 41_000,
    "1024x1024": 53_000,
  },
} as const;

/**
 * gpt-image-2 is billed per token: text in $5 / MTok, image out $30 / MTok
 * (WP69 spike rate card, read 2026-11-05, from OpenAI's image-generation
 * guide). Confirm on the live pricing page before live spend.
 */
export const OPENAI_IMAGE_TOKEN_RATES = {
  effectiveFrom: "2026-11-05",
  /** USD per million text input tokens (the prompt). */
  textInput: 5,
  /** USD per million image output tokens. */
  imageOutput: 30,
} as const;

export type OpenAiImageQuality = keyof typeof OPENAI_IMAGE_PRICES_MICRO_USD;
export type OpenAiImageSize = keyof (typeof OPENAI_IMAGE_PRICES_MICRO_USD)["medium"];
export const OPENAI_IMAGE_QUALITIES = Object.keys(OPENAI_IMAGE_PRICES_MICRO_USD) as readonly OpenAiImageQuality[];
export const OPENAI_IMAGE_SIZES = Object.keys(OPENAI_IMAGE_PRICES_MICRO_USD.medium) as readonly OpenAiImageSize[];

/** The flat table price of one image, micro-USD. */
export function openAiImageTableMicroUsd(args: {
  readonly quality: OpenAiImageQuality;
  readonly size: OpenAiImageSize;
}): number {
  const unit = OPENAI_IMAGE_PRICES_MICRO_USD[args.quality]?.[args.size];
  if (unit === undefined) throw new RangeError(`no gpt-image-2 price for ${args.quality} ${args.size}`);
  return unit;
}

/**
 * The reservation for one gpt-image-2 call, micro-USD: the table price plus
 * the prompt at the text-input rate, counting one token per UTF-8 byte (a
 * token is never shorter than a byte, so this is an upper bound on the prompt).
 */
export function openAiImageCostMicroUsd(args: {
  readonly quality: OpenAiImageQuality;
  readonly size: OpenAiImageSize;
  readonly promptBytes: number;
  readonly count?: number;
}): number {
  assertTokenCount("promptBytes", args.promptBytes);
  const unit = openAiImageTableMicroUsd(args) + args.promptBytes * OPENAI_IMAGE_TOKEN_RATES.textInput;
  return mediaReservation({ kind: "image", unitMicroUsd: unit, count: args.count ?? 1 });
}

/**
 * The settled cost of one gpt-image-2 call, micro-USD: the larger of the
 * table price and the reported tokens × rates, so a token count above the
 * table never under-charges. Without usage, the caller settles at the table
 * price and marks the cost estimated.
 */
export function openAiImageSettleMicroUsd(args: {
  readonly quality: OpenAiImageQuality;
  readonly size: OpenAiImageSize;
  readonly inputTokens: number;
  readonly outputTokens: number;
}): number {
  assertTokenCount("inputTokens", args.inputTokens);
  assertTokenCount("outputTokens", args.outputTokens);
  const tokens = ceilMicroUsd(
    args.inputTokens * OPENAI_IMAGE_TOKEN_RATES.textInput + args.outputTokens * OPENAI_IMAGE_TOKEN_RATES.imageOutput,
  );
  return Math.max(openAiImageTableMicroUsd(args), tokens);
}

// ---------------------------------------------------------------------------
// Recraft V4.1 — logo marks and brand-consistent work (D11)
// ---------------------------------------------------------------------------

/** List price quoted in the WP69-S4 spike results, 2026-11-05 (not yet measured). */
export const RECRAFT_RATES_EFFECTIVE_FROM = "2026-11-05";

/**
 * The model id sent to Recraft: the id the WP69 spike priced
 * (`recraftv4_1`, Recraft's API pricing page, read 2026-11-05).
 */
export const RECRAFT_MODEL = "recraftv4_1";

/**
 * Per-image list price, micro-USD: $0.035 for a raster image. Only 1024×1024
 * is exposed: logo marks are square, and V4.1 rejects 1536×1024 (the spike
 * bug). Vector output is not priced, so it is not offered.
 */
export const RECRAFT_PRICES_MICRO_USD = {
  "1024x1024": 35_000,
} as const;

export type RecraftSize = keyof typeof RECRAFT_PRICES_MICRO_USD;
export const RECRAFT_SIZES = Object.keys(RECRAFT_PRICES_MICRO_USD) as readonly RecraftSize[];

export function recraftCostMicroUsd(args: { readonly size: RecraftSize; readonly count?: number }): number {
  const unit = RECRAFT_PRICES_MICRO_USD[args.size];
  if (unit === undefined) throw new RangeError(`no Recraft price for ${String(args.size)}`);
  return mediaReservation({ kind: "image", unitMicroUsd: unit, count: args.count ?? 1 });
}
