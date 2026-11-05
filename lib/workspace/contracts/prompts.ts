/**
 * C-PROMPT — prompt spec shape, tiers and validation (WP69-S2).
 *
 * Consumers: the WP71 gateway (`convex/ai/gateway.ts`), the prompt registry
 * (`convex/ai/prompts/<id>.ts`) and the crew evals. Sources: `02-architecture.md`
 * §5.2 (router), §5.3 (registry), §5.4 (caching layout); `03-ai-cost-model.md` §3.
 *
 * Types, constants and pure helpers only. No prompt text lives here, no
 * provider call, no env read, no side effect at import.
 *
 * API shape (Claude 5.5 models, checked against the claude-api reference
 * 2026-11-05): effort is `output_config.effort` with levels
 * `low | medium | high | xhigh | max`; thinking is `thinking: { type: "adaptive" }`
 * on all three tiers. `budget_tokens` is rejected on every 5.5 model.
 * - Haiku 5.5 (`fast`): adaptive by default; `{ type: "disabled" }` only at effort
 *   `high` or below. Effort defaults to `medium` when unset.
 * - Sonnet 5.5 (`draft`): `{ type: "disabled" }` is a 400; thinking off is
 *   `{ type: "between_tools" }`, which takes no other field and is accepted only at
 *   effort `high` or below. Effort defaults to `high` when unset.
 * - Opus 5.5 (`deep`): thinking cannot be disabled (only adaptive); effort is the
 *   only control and defaults to `medium` when unset.
 * Because thinking bills as output, an unset effort is a hidden cost line: every
 * spec sets `effort` and `thinking` explicitly, and `maxTokens` includes thinking.
 *
 * Refusal fallbacks: the API's server-side fallback is opt-in per request, via
 * the `fallbacks` request parameter (`fallbacks: "default"` with beta
 * `server-side-fallback-2026-07-01`, or `fallbacks: [{ model }]` with
 * `server-side-fallback-2026-06-01`). A request that omits `fallbacks` (and the
 * beta header) stops on a refusal. The gateway never sends `fallbacks`: `02` §5.8
 * makes a `refusal` stop reason fail the job and refund it, so a silent re-run on
 * another model would bypass that rule and bill a second model. Haiku 5.5 has no
 * server-side fallback at all. Every spec states this with `fallbacks: "none"`.
 */

import type { ZodType } from "zod";

// ---------------------------------------------------------------------------
// Tiers and models (`02` §5.2)
// ---------------------------------------------------------------------------

export const PROMPT_TIERS = ["fast", "draft", "deep"] as const;
export type PromptTier = (typeof PROMPT_TIERS)[number];

/**
 * - `fast`: Wren chat turns, social posts, ads drafts, quality checks,
 *   classification (policy, intent), memory summaries.
 * - `draft`: blueprint personalisation, brand kit text, landing spec, email
 *   sequence, SEO pack and article, launch plan, build pack, Wren turns that
 *   change the plan.
 * - `deep`: per-idea batch precompute, eval judging, one capped escalation after
 *   a failed quality check.
 * The spec sets the tier, never the plan: paying founders get more work, not a
 * pricier model for the same work.
 */
export const TIER_MODELS = {
  fast: "claude-haiku-5-5",
  draft: "claude-sonnet-5-5",
  deep: "claude-opus-5-5",
} as const satisfies Record<PromptTier, string>;

export type PromptModel = (typeof TIER_MODELS)[PromptTier];

export const PROMPT_EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;
export type PromptEffort = (typeof PROMPT_EFFORTS)[number];

/**
 * The effort the architecture plans for each tier. A guide for spec authors,
 * never applied as a fallback: `definePromptSpec` rejects a spec without effort.
 */
export const TIER_RECOMMENDED_EFFORT = {
  fast: "low",
  draft: "low",
  deep: "medium",
} as const satisfies Record<PromptTier, PromptEffort>;

/**
 * Thinking, explicit on every spec.
 * - `adaptive`: the model decides how much to think (bills as output).
 *   `display` controls visibility only; the API default is `omitted`.
 * - `between_tools`: Sonnet 5.5 only — thinking off; no other field allowed;
 *   effort must be `high` or below. The `draft` tier's planned setting.
 * - `disabled`: Haiku 5.5 only; effort must be `high` or below.
 */
export type PromptThinking =
  | { readonly type: "adaptive"; readonly display?: "omitted" | "summarized" }
  | { readonly type: "between_tools" }
  | { readonly type: "disabled" };

/** Which thinking types each tier's model accepts. */
export const TIER_THINKING_TYPES = {
  fast: ["adaptive", "disabled"],
  draft: ["adaptive", "between_tools"],
  deep: ["adaptive"],
} as const satisfies Record<PromptTier, readonly PromptThinking["type"][]>;

/** Efforts at which thinking may be turned off (`between_tools` / `disabled`). */
const THINKING_OFF_EFFORTS: readonly PromptEffort[] = ["low", "medium", "high"];

/**
 * Per-tier ceiling for `maxTokens` (output plus thinking). Roughly twice the
 * largest planned output in `03` §3 and §4, so a normal artifact never truncates
 * while a runaway generation and its metering reservation stay bounded.
 * - `fast` 4,096: the largest Haiku output is the 7-post social pack (~2k).
 * - `draft` 12,288: the largest Sonnet output is the build pack (~6k, thinking
 *   off); headroom covers the plan-changing Wren turns that run adaptive.
 * - `deep` 24,576: per-idea precompute writes ~12k tokens of seeds at `medium`
 *   effort (batch, half price).
 */
export const TIER_MAX_TOKENS = {
  fast: 4_096,
  draft: 12_288,
  deep: 24_576,
} as const satisfies Record<PromptTier, number>;

/**
 * A `deep` realtime escalation redoes one failed `draft` artifact, so it is held
 * to the draft ceiling, not the batch one: Opus output costs twice Sonnet's, and
 * this keeps one escalation's reservation inside a Free owner's daily cap.
 */
export const ESCALATION_MAX_TOKENS = TIER_MAX_TOKENS.draft;

/**
 * An eval judge returns a rubric score and a short rationale (a few hundred
 * tokens) after `medium`-effort adaptive thinking; 4,096 covers both.
 */
export const EVAL_JUDGE_MAX_TOKENS = 4_096;

/**
 * Input ceiling per lane, in tokens (system + business context + task). A
 * reservation may not assume more. With these, the worst `deep` escalation
 * (60k input at the cache-write rate + 12,288 output on Opus 5.5) reserves
 * about $0.55, inside a Free owner's $1.00 day.
 */
export const TIER_MAX_INPUT_TOKENS = {
  fast: 40_000,
  draft: 60_000,
  deep_realtime: 60_000,
  deep_batch: 120_000,
} as const;

export type InputTokenLane = keyof typeof TIER_MAX_INPUT_TOKENS;

/** The input lane for a tier and mode. Only `deep` runs in batch. */
export function inputLaneFor(tier: PromptTier, mode: PromptMode): InputTokenLane {
  if (tier === "deep") return mode === "batch" ? "deep_batch" : "deep_realtime";
  return tier;
}

/** The most input tokens a call for this spec may send (and reserve for). */
export function maxInputTokensForSpec(spec: Pick<PromptSpec<unknown, unknown>, "tier" | "mode">): number {
  return TIER_MAX_INPUT_TOKENS[inputLaneFor(spec.tier, spec.mode)];
}

// ---------------------------------------------------------------------------
// Spec shape (`02` §5.3, §5.4)
// ---------------------------------------------------------------------------

/** `batch` (Message Batches, half price) is for `deep` only: per-idea precompute. */
export const PROMPT_MODES = ["realtime", "batch"] as const;
export type PromptMode = (typeof PROMPT_MODES)[number];

/**
 * Why a `deep` spec runs in realtime. Required on `deep` + `realtime`, not
 * allowed anywhere else.
 * - `escalation`: the one capped redo after a failed quality check
 *   (`ESCALATION_MAX_TOKENS`; counted against the owner's daily escalation cap).
 * - `eval_judge`: grading an eval case (`EVAL_JUDGE_MAX_TOKENS`).
 */
export const PROMPT_PURPOSES = ["escalation", "eval_judge"] as const;
export type PromptPurpose = (typeof PROMPT_PURPOSES)[number];

/**
 * Three-block request order: system (stable across all businesses) → business
 * context (stable within one business) → task (changes per call). Breakpoints
 * after the first two blocks. 5-minute TTL only; we never pay for the 1-hour write.
 */
export type PromptCacheLayout = {
  readonly system: "stable";
  readonly business: "per_business" | "none";
  readonly ttl: "5m";
};

export type PromptSpec<TInput, TOutput> = {
  /** kebab-case, unique in the registry, e.g. `crew-brand-kit`. */
  readonly id: string;
  /** Positive integer, bumped on any change to text or schema (CI enforces). */
  readonly version: number;
  readonly tier: PromptTier;
  /** Required, no default. */
  readonly effort: PromptEffort;
  readonly thinking: PromptThinking;
  /** Required. Includes thinking. The metering reservation is sized from it. */
  readonly maxTokens: number;
  /** Stable system block. Never contains per-business or per-call content. */
  readonly system: string;
  /** The task block for one call. */
  readonly buildUser: (inputs: TInput) => string;
  /** zod schema for the structured output (`output_config.format`), re-validated on our side. */
  readonly outputSchema: ZodType<TOutput>;
  readonly cacheLayout: PromptCacheLayout;
  /** Eval suite id under `evals/crew`. */
  readonly evalSuite: string;
  /** `deep` + `batch` is the per-idea precompute path; other tiers are realtime only. */
  readonly mode: PromptMode;
  /** Required on `deep` + `realtime`; absent otherwise. */
  readonly purpose?: PromptPurpose;
  /** Always `"none"`: the gateway sends no `fallbacks` parameter (see the file header). */
  readonly fallbacks: "none";
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export const PROMPT_SPEC_ERROR_CODES = [
  "INVALID_ID",
  "INVALID_VERSION",
  "INVALID_TIER",
  "MISSING_EFFORT",
  "INVALID_EFFORT",
  "INVALID_THINKING",
  "MISSING_MAX_TOKENS",
  "INVALID_MAX_TOKENS",
  "MAX_TOKENS_OVER_CAP",
  "MISSING_SYSTEM",
  "MISSING_BUILD_USER",
  "MISSING_OUTPUT_SCHEMA",
  "INVALID_CACHE_LAYOUT",
  "MISSING_EVAL_SUITE",
  "INVALID_MODE",
  "DEEP_REALTIME_WITHOUT_PURPOSE",
  "INVALID_PURPOSE",
  "INVALID_FALLBACKS",
  "INVALID_PROMPT_REF",
] as const;

export type PromptSpecErrorCode = (typeof PROMPT_SPEC_ERROR_CODES)[number];

export class PromptSpecError extends Error {
  readonly code: PromptSpecErrorCode;

  constructor(code: PromptSpecErrorCode, message: string) {
    super(message);
    this.name = "PromptSpecError";
    this.code = code;
  }
}

export function isPromptSpecError(value: unknown): value is PromptSpecError {
  return value instanceof PromptSpecError;
}

const PROMPT_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

function includes<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (list as readonly string[]).includes(value);
}

/**
 * Validates a spec at construction and returns it frozen. Throws
 * `PromptSpecError` on: a bad id, a non-positive version, missing effort or
 * maxTokens, maxTokens above the tier (or purpose) cap, thinking the tier's model
 * rejects, `batch` on a non-deep tier, `deep` in `realtime` without a `purpose`,
 * a `purpose` anywhere else, and `fallbacks` other than `"none"`.
 */
export function definePromptSpec<TInput, TOutput>(
  spec: PromptSpec<TInput, TOutput>,
): Readonly<PromptSpec<TInput, TOutput>> {
  const id: unknown = spec.id;
  if (typeof id !== "string" || !PROMPT_ID_PATTERN.test(id)) {
    throw new PromptSpecError("INVALID_ID", `prompt id must be kebab-case, got ${JSON.stringify(id)}`);
  }
  if (!Number.isSafeInteger(spec.version) || spec.version < 1) {
    throw new PromptSpecError("INVALID_VERSION", `${id}: version must be a positive integer, got ${spec.version}`);
  }
  if (!includes(PROMPT_TIERS, spec.tier)) {
    throw new PromptSpecError("INVALID_TIER", `${id}: unknown tier ${String(spec.tier)}`);
  }
  const tier = spec.tier;

  const effort: unknown = spec.effort;
  if (effort === undefined || effort === null) {
    throw new PromptSpecError("MISSING_EFFORT", `${id}: effort is required (thinking bills as output)`);
  }
  if (!includes(PROMPT_EFFORTS, effort)) {
    throw new PromptSpecError("INVALID_EFFORT", `${id}: unknown effort ${String(effort)}`);
  }

  validateThinking(id, tier, effort, spec.thinking);

  const maxTokens: unknown = spec.maxTokens;
  if (maxTokens === undefined || maxTokens === null) {
    throw new PromptSpecError("MISSING_MAX_TOKENS", `${id}: maxTokens is required (the reservation is sized from it)`);
  }
  if (typeof maxTokens !== "number" || !Number.isSafeInteger(maxTokens) || maxTokens < 1) {
    throw new PromptSpecError("INVALID_MAX_TOKENS", `${id}: maxTokens must be a positive integer`);
  }

  if (!includes(PROMPT_MODES, spec.mode)) {
    throw new PromptSpecError("INVALID_MODE", `${id}: mode must be realtime or batch`);
  }
  if (spec.mode === "batch" && tier !== "deep") {
    throw new PromptSpecError("INVALID_MODE", `${id}: only deep specs run in batch`);
  }
  const purpose: unknown = spec.purpose;
  const deepRealtime = tier === "deep" && spec.mode === "realtime";
  if (purpose !== undefined && (!includes(PROMPT_PURPOSES, purpose) || !deepRealtime)) {
    throw new PromptSpecError("INVALID_PURPOSE", `${id}: purpose is escalation or eval_judge, on deep realtime only`);
  }
  if (deepRealtime && purpose === undefined) {
    throw new PromptSpecError(
      "DEEP_REALTIME_WITHOUT_PURPOSE",
      `${id}: deep runs in batch; realtime deep needs purpose escalation or eval_judge`,
    );
  }
  const fallbacks: unknown = spec.fallbacks;
  if (fallbacks !== "none") {
    throw new PromptSpecError("INVALID_FALLBACKS", `${id}: fallbacks must be "none" (a refusal fails the job)`);
  }

  const cap =
    purpose === "escalation" ? ESCALATION_MAX_TOKENS : purpose === "eval_judge" ? EVAL_JUDGE_MAX_TOKENS : TIER_MAX_TOKENS[tier];
  if (maxTokens > cap) {
    throw new PromptSpecError("MAX_TOKENS_OVER_CAP", `${id}: maxTokens ${maxTokens} is over the ${tier} cap of ${cap}`);
  }

  if (typeof spec.system !== "string" || spec.system.trim().length === 0) {
    throw new PromptSpecError("MISSING_SYSTEM", `${id}: system block is required`);
  }
  if (typeof spec.buildUser !== "function") {
    throw new PromptSpecError("MISSING_BUILD_USER", `${id}: buildUser must be a function`);
  }
  const schema: unknown = spec.outputSchema;
  if (
    typeof schema !== "object" ||
    schema === null ||
    typeof (schema as { safeParse?: unknown }).safeParse !== "function"
  ) {
    throw new PromptSpecError("MISSING_OUTPUT_SCHEMA", `${id}: outputSchema must be a zod schema`);
  }
  validateCacheLayout(id, spec.cacheLayout);
  if (typeof spec.evalSuite !== "string" || spec.evalSuite.trim().length === 0) {
    throw new PromptSpecError("MISSING_EVAL_SUITE", `${id}: evalSuite is required`);
  }

  return Object.freeze({ ...spec });
}

function validateThinking(id: string, tier: PromptTier, effort: PromptEffort, thinking: unknown): void {
  if (typeof thinking !== "object" || thinking === null) {
    throw new PromptSpecError("INVALID_THINKING", `${id}: thinking must be set explicitly`);
  }
  const record = thinking as Record<string, unknown>;
  const type = record.type;
  const allowed: readonly string[] = TIER_THINKING_TYPES[tier];
  if (typeof type !== "string" || !allowed.includes(type)) {
    throw new PromptSpecError(
      "INVALID_THINKING",
      `${id}: ${TIER_MODELS[tier]} does not accept thinking ${JSON.stringify(type)}`,
    );
  }
  const keys = Object.keys(record);
  if (type === "adaptive") {
    if (keys.some((key) => key !== "type" && key !== "display")) {
      throw new PromptSpecError("INVALID_THINKING", `${id}: adaptive thinking takes only type and display`);
    }
    if (record.display !== undefined && record.display !== "omitted" && record.display !== "summarized") {
      throw new PromptSpecError("INVALID_THINKING", `${id}: display must be omitted or summarized`);
    }
    return;
  }
  // between_tools / disabled: no other field, and only at effort high or below.
  if (keys.length !== 1) {
    throw new PromptSpecError("INVALID_THINKING", `${id}: ${type} thinking takes no other field`);
  }
  if (!THINKING_OFF_EFFORTS.includes(effort)) {
    throw new PromptSpecError("INVALID_THINKING", `${id}: ${type} thinking needs effort high or below`);
  }
}

function validateCacheLayout(id: string, layout: unknown): void {
  if (typeof layout !== "object" || layout === null) {
    throw new PromptSpecError("INVALID_CACHE_LAYOUT", `${id}: cacheLayout is required`);
  }
  const { system, business, ttl } = layout as Record<string, unknown>;
  if (system !== "stable" || (business !== "per_business" && business !== "none") || ttl !== "5m") {
    throw new PromptSpecError(
      "INVALID_CACHE_LAYOUT",
      `${id}: cacheLayout must be { system: "stable", business: "per_business" | "none", ttl: "5m" }`,
    );
  }
}

/** The model a spec runs on. */
export function modelForSpec(spec: Pick<PromptSpec<unknown, unknown>, "tier">): PromptModel {
  return TIER_MODELS[spec.tier];
}

// ---------------------------------------------------------------------------
// Prompt refs (`id@version`, recorded on every `ai_usage` row)
// ---------------------------------------------------------------------------

export type ParsedPromptRef = { readonly id: string; readonly version: number };

export function promptRef(spec: Pick<PromptSpec<unknown, unknown>, "id" | "version">): string {
  if (!PROMPT_ID_PATTERN.test(spec.id) || !Number.isSafeInteger(spec.version) || spec.version < 1) {
    throw new PromptSpecError("INVALID_PROMPT_REF", `cannot build a ref from ${spec.id}@${spec.version}`);
  }
  return `${spec.id}@${spec.version}`;
}

/** The parts of an `id@version` ref, or null when the string is not one. */
export function parsePromptRef(ref: string): ParsedPromptRef | null {
  if (typeof ref !== "string") return null;
  const match = /^([a-z][a-z0-9]*(?:-[a-z0-9]+)*)@([1-9][0-9]*)$/.exec(ref);
  if (!match) return null;
  const version = Number(match[2]);
  if (!Number.isSafeInteger(version)) return null;
  return { id: match[1], version };
}
