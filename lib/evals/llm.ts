/**
 * WP41-S2. Budget-aware LLM client for the content-eval layers.
 *
 * The only way Layers 1-3 call a model. Each call:
 *   1. looks up the model's live price (once per run),
 *   2. reserves its worst-case cost against the run's cap, refusing the call
 *      before any request if the cap would be crossed,
 *   3. sends it through the OpenRouter adapter,
 *   4. settles the reservation to the reported (or estimated) cost,
 *   5. appends a ledger entry, success or failure.
 *
 * Fixture mode swaps only the transport, so the budget and ledger logic
 * that guard real money are the code under test.
 */

import { createBudget, readCapUsd } from "./budget.ts";
import { BudgetExceededError, EvalCallError, EvalConfigError } from "./errors.ts";
import {
  createFixtureFetch,
  type FixtureOptions,
} from "./providers/fixtures.ts";
import {
  createOpenRouterClient,
  estimateInputTokens,
  estimateUsd,
  fetchModelCatalog,
  ratesFor,
  supportsParameter,
  worstCaseUsd,
  type ChatReply,
  type ChatRequest,
  type Fetcher,
  type ModelRates,
} from "./providers/openrouter.ts";

export type EvalMode = "fixture" | "live";

export type CostSource = "provider" | "estimate" | "worst-case" | "none";

export type LedgerEntry = {
  label: string;
  model: string;
  servedModel: string | null;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  costSource: CostSource;
  ok: boolean;
  error?: string;
};

export type LlmCall = ChatRequest & {
  /** What the call is for ("judge:specificity phone-neck-score-app"). */
  label: string;
};

export type LlmResult = ChatReply & {
  costUsd: number;
  costSource: "provider" | "estimate";
  /** Parsed reply when the call asked for JSON. */
  json?: unknown;
};

export type EvalLlmOptions = {
  mode: EvalMode;
  /** Defaults to readCapUsd(): EVALS_MAX_USD, else the ruled $10. */
  capUsd?: number;
  /** Live transport override (tests). Ignored in fixture mode. */
  fetchImpl?: Fetcher;
  apiKey?: string;
  timeoutMs?: number;
  fixture?: FixtureOptions;
};

/**
 * Parse a JSON reply, tolerating a ```json fence or prose around one object.
 */
export function parseJsonReply(text: string): unknown {
  const unfenced = text.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
  try {
    return JSON.parse(unfenced);
  } catch {
    const start = unfenced.indexOf("{");
    const end = unfenced.lastIndexOf("}");
    if (start !== -1 && end > start) return JSON.parse(unfenced.slice(start, end + 1));
    throw new SyntaxError("no JSON object in reply");
  }
}

export function createEvalLlm(options: EvalLlmOptions) {
  const budget = createBudget(options.capUsd ?? readCapUsd());
  const fixture = options.mode === "fixture";
  const fetchImpl = fixture
    ? createFixtureFetch(options.fixture)
    : (options.fetchImpl ?? fetch);
  const client = createOpenRouterClient({
    fetchImpl,
    apiKey: fixture ? "fixture-key-not-a-secret" : options.apiKey,
    timeoutMs: options.timeoutMs,
  });

  const ledger: LedgerEntry[] = [];
  let catalog: Promise<Map<string, ModelRates>> | null = null;

  async function rates(model: string): Promise<ModelRates> {
    catalog ??= fetchModelCatalog(fetchImpl).catch((error) => {
      catalog = null; // let a later call retry the lookup
      throw error;
    });
    return ratesFor(await catalog, model);
  }

  async function call(request: LlmCall): Promise<LlmResult> {
    if (!Number.isInteger(request.maxOutputTokens) || request.maxOutputTokens <= 0) {
      throw new EvalConfigError(
        `maxOutputTokens must be a positive integer, got ${request.maxOutputTokens}`,
      );
    }
    const modelRates = await rates(request.model);
    // Send only what the model accepts: temperature 0 where allowed, JSON
    // mode where offered (the prompt still asks for JSON, and the reply is
    // parsed either way), reasoning effort for models that think.
    const wire: ChatRequest = {
      model: request.model,
      system: request.system,
      user: request.user,
      maxOutputTokens: request.maxOutputTokens,
      temperature: supportsParameter(modelRates, "temperature") ? (request.temperature ?? 0) : undefined,
      json: request.json === true && supportsParameter(modelRates, "response_format"),
      reasoning: supportsParameter(modelRates, "reasoning") ? request.reasoning : undefined,
    };
    const worstCase = worstCaseUsd(modelRates, {
      inputTokens: estimateInputTokens([request.system, request.user]),
      maxOutputTokens: request.maxOutputTokens,
    });

    // Throws BudgetExceededError before any request is sent.
    const reservation = budget.reserve(worstCase);

    const record = (entry: Omit<LedgerEntry, "label" | "model">) =>
      ledger.push({ label: request.label, model: request.model, ...entry });

    let reply: ChatReply;
    try {
      reply = await client.chat(wire);
    } catch (error) {
      if (!(error instanceof EvalCallError)) {
        // Config errors (no key) happen before any request.
        budget.release(reservation);
        throw error;
      }
      let costUsd = 0;
      let costSource: CostSource = "none";
      if (error.billing === "none") {
        budget.release(reservation);
      } else if (error.billing === "billed" && error.usage) {
        costSource = error.usage.reportedCostUsd === null ? "estimate" : "provider";
        costUsd = error.usage.reportedCostUsd ?? estimateUsd(modelRates, error.usage);
        budget.settle(reservation, costUsd);
      } else {
        // Unknown outcome: the request may have run. Charge the worst case.
        costUsd = worstCase;
        costSource = "worst-case";
        budget.settle(reservation, costUsd);
      }
      error.costUsd = costUsd;
      record({
        servedModel: null,
        inputTokens: error.usage?.inputTokens ?? 0,
        outputTokens: error.usage?.outputTokens ?? 0,
        costUsd,
        costSource,
        ok: false,
        error: error.message,
      });
      throw error;
    }

    const costSource = reply.reportedCostUsd === null ? "estimate" : "provider";
    const costUsd = reply.reportedCostUsd ?? estimateUsd(modelRates, reply);
    budget.settle(reservation, costUsd);

    let parsed: unknown;
    let parseError: string | undefined;
    if (request.json) {
      try {
        parsed = parseJsonReply(reply.text);
      } catch {
        parseError = reply.truncated
          ? `${request.model} hit maxOutputTokens before finishing its JSON`
          : `${request.model} did not return valid JSON`;
      }
    }

    record({
      servedModel: reply.servedModel,
      inputTokens: reply.inputTokens,
      outputTokens: reply.outputTokens,
      costUsd,
      costSource,
      ok: parseError === undefined,
      ...(parseError ? { error: parseError } : {}),
    });

    if (parseError) {
      const error = new EvalCallError(parseError, {
        retryable: true,
        billing: "billed",
        usage: {
          inputTokens: reply.inputTokens,
          outputTokens: reply.outputTokens,
          reportedCostUsd: reply.reportedCostUsd,
        },
      });
      error.costUsd = costUsd;
      throw error;
    }

    return {
      ...reply,
      costUsd,
      costSource,
      ...(request.json ? { json: parsed } : {}),
    };
  }

  return {
    mode: options.mode,
    capUsd: () => budget.capMicroUsd / 1_000_000,
    call,
    /** Prices for a model, from the same live catalog calls use. */
    rates,
    ledger: (): readonly LedgerEntry[] => ledger,
    spentUsd: budget.spentUsd,
    remainingUsd: budget.remainingUsd,
  };
}

export type EvalLlm = ReturnType<typeof createEvalLlm>;

/**
 * One retry for a retryable call failure (429, 5xx, empty or non-JSON
 * reply). Budget and config errors are never retried: the budget refusal
 * would repeat, and a config error is ours to fix. The retry goes through
 * the same cap, so it can be refused too.
 */
export async function callWithRetry(llm: EvalLlm, request: LlmCall): Promise<LlmResult> {
  try {
    return await llm.call(request);
  } catch (error) {
    if (error instanceof EvalCallError && error.retryable) {
      return llm.call({ ...request, label: `${request.label} (retry)` });
    }
    throw error;
  }
}

export { BudgetExceededError, EvalCallError, EvalConfigError };
