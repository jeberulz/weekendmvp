/**
 * WP71-S3. The model router (`02` §5.2).
 *
 * The model comes from the spec's tier alone, through C-PROMPT's
 * `TIER_MODELS`; the input ceiling comes from the tier and mode, through
 * `TIER_MAX_INPUT_TOKENS`. Effort, thinking and max tokens are the spec's own
 * explicit (and already validated) settings. There is no caller-supplied model
 * override: `routeSpec` takes the spec and nothing else, and it reads no other
 * field, so a plan, an owner or an extra `model` property on the object cannot
 * change the model. "Paying founders get more work, not a pricier model for the
 * same work."
 *
 * Every crew text call goes to Anthropic. Images (OpenAI, Recraft) are not
 * prompt specs and are not routed here.
 */

import {
  maxInputTokensForSpec,
  PROMPT_MODES,
  PROMPT_TIERS,
  PromptSpecError,
  TIER_MODELS,
  type PromptEffort,
  type PromptMode,
  type PromptModel,
  type PromptSpec,
  type PromptThinking,
  type PromptTier,
} from "../../lib/workspace/contracts/prompts.ts";

export type TextProvider = "anthropic";

export type PromptRoute = {
  readonly provider: TextProvider;
  readonly model: PromptModel;
  readonly effort: PromptEffort;
  readonly thinking: PromptThinking;
  /** Output plus thinking, from the spec. The reservation is sized from it. */
  readonly maxTokens: number;
  /** The lane ceiling for this tier and mode (`TIER_MAX_INPUT_TOKENS`). */
  readonly maxInputTokens: number;
  readonly mode: PromptMode;
};

export type RoutableSpec = Pick<
  PromptSpec<never, unknown>,
  "id" | "tier" | "effort" | "thinking" | "maxTokens" | "mode"
>;

function isTier(value: unknown): value is PromptTier {
  return typeof value === "string" && (PROMPT_TIERS as readonly string[]).includes(value);
}

function isMode(value: unknown): value is PromptMode {
  return typeof value === "string" && (PROMPT_MODES as readonly string[]).includes(value);
}

/**
 * The provider call settings for a spec. Throws `PromptSpecError`
 * (`INVALID_TIER` / `INVALID_MODE`) on a tier or mode outside C-PROMPT, which
 * only a spec built without `definePromptSpec` can carry.
 */
export function routeSpec(spec: RoutableSpec): PromptRoute {
  const tier: unknown = spec.tier;
  if (!isTier(tier)) {
    throw new PromptSpecError("INVALID_TIER", `${String(spec.id)}: unknown tier ${JSON.stringify(tier)}`);
  }
  const mode: unknown = spec.mode;
  if (!isMode(mode)) {
    throw new PromptSpecError("INVALID_MODE", `${String(spec.id)}: unknown mode ${JSON.stringify(mode)}`);
  }
  return Object.freeze({
    provider: "anthropic",
    model: TIER_MODELS[tier],
    effort: spec.effort,
    thinking: Object.freeze({ ...spec.thinking }),
    maxTokens: spec.maxTokens,
    maxInputTokens: maxInputTokensForSpec({ tier, mode }),
    mode,
  });
}
