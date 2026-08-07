/**
 * WP26-S2. Published rate cards and cost estimation.
 *
 * Kept in one module so `S4`'s cap enforcement, the cost audit trail, and the
 * adapters all price a call the same way. Every rate here is quoted from the
 * ruling of 2026-08-06 (`docs/wp/RULINGS.md`) or from the provider's own
 * documentation on 2026-08-07, and each is dated so a silent rate change is
 * visible in `git blame` rather than absorbed into a wrong estimate.
 *
 * These produce **estimates**. Providers do not return a dollar amount, so
 * `S4` must reserve against the estimate and treat a run trending far above
 * the ~$0.52 reference budget as a prompt or context-size regression rather
 * than merely an expensive report.
 */

/** USD per 1,000,000 tokens. */
type TokenRate = { input: number; cachedInput: number; output: number };

// ---------------------------------------------------------------------------
// Synthesis — OpenAI
// ---------------------------------------------------------------------------

/**
 * Verified against OpenAI's model documentation on 2026-08-07.
 *
 * **There is no dated snapshot for this model.** The documentation lists a
 * single ID, `gpt-5.6-sol`, with the floating alias `gpt-5.6` routing to it.
 * `WP26-S2`'s AC asks for a dated snapshot; none exists to pin, so the
 * concrete model ID is pinned instead and the *alias* is never used. Recorded
 * as a deviation in `docs/wp/wp26-progress.md`; re-pin when OpenAI ships a
 * dated snapshot.
 */
export const SYNTHESIS_MODEL = "gpt-5.6-sol";

/** Matches the ruling's $5.00 / $30.00 figures, re-verified 2026-08-07. */
export const SYNTHESIS_RATE: TokenRate = {
  input: 5.0,
  cachedInput: 0.5,
  output: 30.0,
};

/**
 * Long-context surcharge, from OpenAI's documentation 2026-08-07:
 * "Prompts with >272K input tokens are priced at 2x input and 1.5x output for
 * the full request."
 *
 * **Not mentioned in the 2026-08-06 ruling.** It applies to the *entire*
 * request, not the excess, so a run that drifts just past the threshold does
 * not get slightly more expensive — it roughly doubles. A cost model that
 * ignored this would under-reserve by ~2x on exactly the runs most likely to
 * breach the $4.00 cap.
 */
export const SYNTHESIS_LONG_CONTEXT_THRESHOLD_TOKENS = 272_000;
export const SYNTHESIS_LONG_CONTEXT_INPUT_MULTIPLIER = 2;
export const SYNTHESIS_LONG_CONTEXT_OUTPUT_MULTIPLIER = 1.5;

export function estimateSynthesisUsd(usage: {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
}): number {
  const longContext =
    usage.inputTokens > SYNTHESIS_LONG_CONTEXT_THRESHOLD_TOKENS;
  const inputMultiplier = longContext
    ? SYNTHESIS_LONG_CONTEXT_INPUT_MULTIPLIER
    : 1;
  const outputMultiplier = longContext
    ? SYNTHESIS_LONG_CONTEXT_OUTPUT_MULTIPLIER
    : 1;

  // Cached input is billed at its own rate and is not additionally discounted.
  const uncachedInput = Math.max(usage.inputTokens - usage.cachedInputTokens, 0);
  const inputUsd =
    ((uncachedInput * SYNTHESIS_RATE.input) / 1_000_000) * inputMultiplier +
    ((usage.cachedInputTokens * SYNTHESIS_RATE.cachedInput) / 1_000_000) *
      inputMultiplier;
  const outputUsd =
    ((usage.outputTokens * SYNTHESIS_RATE.output) / 1_000_000) *
    outputMultiplier;

  return inputUsd + outputUsd;
}

// ---------------------------------------------------------------------------
// Search — Perplexity Sonar Pro
// ---------------------------------------------------------------------------

export const SEARCH_MODEL = "sonar-pro";

export const SEARCH_RATE: TokenRate = {
  input: 3.0,
  cachedInput: 3.0,
  output: 15.0,
};

/**
 * Per-1,000-request search fee, **separate from token cost**.
 *
 * The ruling flags this as "easy to omit", and it dominates: three calls at
 * the high tier cost $0.042 in fees against roughly a cent of tokens. Omitting
 * it would under-price the search step by an order of magnitude.
 */
export const SEARCH_REQUEST_FEE_PER_1K: Record<
  "low" | "medium" | "high",
  number
> = { low: 6, medium: 10, high: 14 };

export function estimateSearchUsd(usage: {
  inputTokens: number;
  outputTokens: number;
  requests: number;
  searchContextSize: "low" | "medium" | "high";
}): number {
  const tokenUsd =
    (usage.inputTokens * SEARCH_RATE.input) / 1_000_000 +
    (usage.outputTokens * SEARCH_RATE.output) / 1_000_000;
  const feeUsd =
    (usage.requests * SEARCH_REQUEST_FEE_PER_1K[usage.searchContextSize]) /
    1_000;
  return tokenUsd + feeUsd;
}

// ---------------------------------------------------------------------------
// Keyword data — DataForSEO
// ---------------------------------------------------------------------------

export const KEYWORD_PROVIDER = "dataforseo";

/** $0.01 per task plus $0.0001 per returned item (ruling, 2026-08-06). */
export const KEYWORD_TASK_USD = 0.01;
export const KEYWORD_ITEM_USD = 0.0001;

export function estimateKeywordUsd(usage: {
  tasks: number;
  items: number;
}): number {
  return usage.tasks * KEYWORD_TASK_USD + usage.items * KEYWORD_ITEM_USD;
}

// ---------------------------------------------------------------------------

/** The owner-ruled hard cap for one report. `S4` enforces it pre-call. */
export const REPORT_COST_CAP_USD = 4.0;

/**
 * The ruling's reference budget: roughly $0.52 for a clean run and $1.04 if
 * every step takes its one allowed retry. Exported so `S6`'s eval can assert
 * a run has not drifted, rather than only that it stayed under the cap — the
 * cap is 8x the expected cost, so a serious regression could hide beneath it.
 */
export const REFERENCE_RUN_USD = 0.52;
export const REFERENCE_RUN_WITH_RETRIES_USD = 1.04;
