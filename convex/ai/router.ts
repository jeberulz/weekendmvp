/**
 * WP71-S3. The model router (`02` §5.2).
 *
 * The model comes from the spec's tier alone, through C-PROMPT's
 * `TIER_MODELS`; the input ceiling comes from the tier and mode, through
 * `TIER_MAX_INPUT_TOKENS`. Effort, thinking and max tokens are the spec's own
 * explicit settings.
 *
 * `routeSpec` re-validates every spec it is given: it snapshots the spec to
 * plain data (each field read once, unknown fields dropped) and runs
 * `definePromptSpec` on that copy, then routes the copy. A hand-built spec
 * therefore cannot carry an over-cap `maxTokens`, a missing effort, or
 * thinking extras such as `budget_tokens` past the router.
 *
 * There is no caller-supplied model override: `routeSpec` takes the spec and
 * nothing else, so a plan, an owner or an extra `model` property cannot change
 * the model. "Paying founders get more work, not a pricier model for the same
 * work."
 *
 * Every crew text call goes to Anthropic. Images (OpenAI, Recraft) are not
 * prompt specs and are not routed here.
 */

import {
  maxInputTokensForSpec,
  TIER_MODELS,
  type PromptEffort,
  type PromptMode,
  type PromptModel,
  type PromptSpec,
  type PromptThinking,
} from "../../lib/workspace/contracts/prompts.ts";
import { validatedSpec } from "./prompts/entry.ts";

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

/** Any C-PROMPT spec; its input and output types do not matter for routing. */
export type RoutableSpec = Readonly<PromptSpec<never, unknown>>;

/**
 * The provider call settings for a spec. Throws `PromptSpecError` for any spec
 * `definePromptSpec` rejects: an unknown tier (`INVALID_TIER`) or mode
 * (`INVALID_MODE`), thinking extras (`INVALID_THINKING`), an over-cap
 * `maxTokens` (`MAX_TOKENS_OVER_CAP`), and the rest.
 */
export function routeSpec(spec: RoutableSpec): PromptRoute {
  const safe = validatedSpec(spec);
  return Object.freeze({
    provider: "anthropic",
    model: TIER_MODELS[safe.tier],
    effort: safe.effort,
    thinking: safe.thinking,
    maxTokens: safe.maxTokens,
    maxInputTokens: maxInputTokensForSpec(safe),
    mode: safe.mode,
  });
}
