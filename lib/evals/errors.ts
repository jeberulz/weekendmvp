/**
 * WP41-S2. Error types for the content-eval LLM layers.
 *
 * Kept separate from `lib/engine/providers/types.ts`: the engine's role union
 * is a frozen contract for the research pipeline, and eval judges are not one
 * of its roles.
 *
 * Every failure is fail-closed. No caller may substitute a guessed score or
 * verdict for a failed call.
 */

/**
 * Configuration is missing or unusable: no key, an invalid cap, a model
 * OpenRouter does not list or cannot price. Never worth retrying.
 */
export class EvalConfigError extends Error {
  readonly retryable = false;

  constructor(message: string) {
    super(message);
    this.name = "EvalConfigError";
  }
}

/**
 * Whether a failed call cost money.
 *
 * - `none`: rejected with an error status; OpenRouter does not bill it.
 * - `billed`: a 200 whose reply was unusable (empty, not JSON). Tokens were
 *   spent.
 * - `unknown`: network error, timeout, or unreadable body. The request may
 *   have run upstream, so the budget charges the worst case.
 */
export type EvalBilling = "none" | "billed" | "unknown";

export type EvalUsage = {
  inputTokens: number;
  outputTokens: number;
  reportedCostUsd: number | null;
};

/**
 * OpenRouter was reached (or the request was sent) but the call did not
 * produce a usable reply.
 *
 * `costUsd` is set by the budget-aware caller (`lib/evals/llm.ts`) to what
 * it charged for the failed call.
 */
export class EvalCallError extends Error {
  readonly retryable: boolean;
  readonly status?: number;
  readonly billing: EvalBilling;
  readonly usage?: EvalUsage;
  costUsd = 0;

  constructor(
    message: string,
    options: {
      retryable: boolean;
      billing: EvalBilling;
      status?: number;
      usage?: EvalUsage;
    },
  ) {
    super(message);
    this.name = "EvalCallError";
    this.retryable = options.retryable;
    this.billing = options.billing;
    this.status = options.status;
    this.usage = options.usage;
  }
}

/**
 * A call was refused before it was sent because its worst-case cost would
 * push the run over the cap. Nothing was spent on the refused call.
 */
export class BudgetExceededError extends Error {
  readonly code = "EVALS_BUDGET_EXCEEDED";
  readonly retryable = false;
  readonly capMicroUsd: number;
  readonly committedMicroUsd: number;
  readonly requestedMicroUsd: number;

  constructor(args: {
    capMicroUsd: number;
    committedMicroUsd: number;
    requestedMicroUsd: number;
  }) {
    const usd = (micro: number) => `$${(micro / 1_000_000).toFixed(4)}`;
    super(
      `refusing call: worst case ${usd(args.requestedMicroUsd)} on top of ${usd(args.committedMicroUsd)} spent or reserved would exceed the ${usd(args.capMicroUsd)} cap (EVALS_MAX_USD)`,
    );
    this.name = "BudgetExceededError";
    this.capMicroUsd = args.capMicroUsd;
    this.committedMicroUsd = args.committedMicroUsd;
    this.requestedMicroUsd = args.requestedMicroUsd;
  }
}
