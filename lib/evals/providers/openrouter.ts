/**
 * WP41-S2. OpenRouter adapter for the content-eval LLM layers.
 *
 * One key reaches several model families, so the judge panel does not share
 * one vendor's blind spots (`docs/wp/RULINGS.md`, "WP41 / eval judge
 * provider"). Raw `fetch`, no SDK, matching `lib/engine/providers/openai.ts`.
 *
 * Prices are read from OpenRouter's live model list at run time rather than
 * a hard-coded rate card, so a price change can never make the cost cap
 * under-reserve. A model with no fixed price fails closed.
 *
 * Every response carries `usage.cost` (USD) when OpenRouter reports it. The
 * budget settles against that figure and falls back to a token estimate.
 */

import {
  EvalCallError,
  EvalConfigError,
  type EvalUsage,
} from "../errors.ts";

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
export const OPENROUTER_KEY_ENV = "OPENROUTER_API_KEY";

/** Optional attribution headers OpenRouter shows on its dashboard. */
const APP_URL = "https://www.weekendmvp.app";
const APP_TITLE = "Weekend MVP content evals";

export const DEFAULT_TIMEOUT_MS = 120_000;

/** Injected so fixture mode needs no network and no key. */
export type Fetcher = typeof fetch;

// ---------------------------------------------------------------------------
// Model catalog and prices
// ---------------------------------------------------------------------------

export type ModelRates = {
  id: string;
  name: string;
  /** USD per token. */
  promptUsd: number;
  /** USD per token, reasoning tokens included. */
  completionUsd: number;
  /** Flat USD per request, usually 0. */
  requestUsd: number;
  contextLength: number | null;
};

type CatalogPayload = {
  data?: Array<{
    id?: string;
    name?: string;
    context_length?: number;
    pricing?: { prompt?: string; completion?: string; request?: string };
  }>;
};

/** A price string must be a fixed, non-negative number. "-1" means variable. */
function parsePrice(value: string | undefined, fallback?: number): number | null {
  if (value === undefined) return fallback ?? null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Fetch every model OpenRouter lists with a fixed price. The list endpoint
 * is public: no key is needed or sent.
 */
export async function fetchModelCatalog(
  fetchImpl: Fetcher = fetch,
): Promise<Map<string, ModelRates>> {
  let response: Response;
  try {
    response = await fetchImpl(`${OPENROUTER_BASE_URL}/models`, {
      headers: { "HTTP-Referer": APP_URL, "X-Title": APP_TITLE },
    });
  } catch {
    throw new EvalCallError("could not reach OpenRouter to read model prices", {
      retryable: true,
      billing: "none",
    });
  }
  if (!response.ok) {
    throw new EvalCallError(
      `OpenRouter model list returned ${response.status}`,
      { retryable: response.status === 429 || response.status >= 500, billing: "none", status: response.status },
    );
  }

  let payload: CatalogPayload;
  try {
    payload = (await response.json()) as CatalogPayload;
  } catch {
    throw new EvalCallError("OpenRouter model list was not JSON", {
      retryable: true,
      billing: "none",
    });
  }

  const catalog = new Map<string, ModelRates>();
  for (const model of payload.data ?? []) {
    if (!model.id) continue;
    const promptUsd = parsePrice(model.pricing?.prompt);
    const completionUsd = parsePrice(model.pricing?.completion);
    const requestUsd = parsePrice(model.pricing?.request, 0);
    if (promptUsd === null || completionUsd === null || requestUsd === null) {
      continue;
    }
    catalog.set(model.id, {
      id: model.id,
      name: model.name ?? model.id,
      promptUsd,
      completionUsd,
      requestUsd,
      contextLength: model.context_length ?? null,
    });
  }
  return catalog;
}

/** Rates for one pinned model, or a config error naming the problem. */
export function ratesFor(catalog: Map<string, ModelRates>, model: string): ModelRates {
  const rates = catalog.get(model);
  if (!rates) {
    throw new EvalConfigError(
      `model '${model}' is not listed by OpenRouter with a fixed price. Check the ID with: npm run evals:ping -- --live --list <filter>`,
    );
  }
  return rates;
}

/**
 * Conservative input-token estimate for reservation: 3 characters per token
 * (English runs closer to 4) plus a per-message overhead.
 */
export function estimateInputTokens(parts: string[]): number {
  return parts.reduce((sum, text) => sum + Math.ceil(text.length / 3) + 16, 0);
}

export function estimateUsd(
  rates: ModelRates,
  usage: { inputTokens: number; outputTokens: number },
): number {
  return (
    rates.requestUsd +
    usage.inputTokens * rates.promptUsd +
    usage.outputTokens * rates.completionUsd
  );
}

/** The most one call can cost: every output token the request allows. */
export function worstCaseUsd(
  rates: ModelRates,
  args: { inputTokens: number; maxOutputTokens: number },
): number {
  return estimateUsd(rates, {
    inputTokens: args.inputTokens,
    outputTokens: args.maxOutputTokens,
  });
}

// ---------------------------------------------------------------------------
// Chat completions
// ---------------------------------------------------------------------------

export type ChatRequest = {
  /** Exact OpenRouter model ID. Never a router alias like openrouter/auto. */
  model: string;
  system: string;
  user: string;
  /** Hard ceiling on output (reasoning included). Priced into the reservation. */
  maxOutputTokens: number;
  /** Defaults to 0: judges should be as repeatable as the model allows. */
  temperature?: number;
  /** Ask for a JSON object reply. */
  json?: boolean;
};

export type ChatReply = {
  text: string;
  /** The model OpenRouter says served the call, for the audit trail. */
  servedModel: string;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  /** `usage.cost` as reported, or null when absent. */
  reportedCostUsd: number | null;
  finishReason: string | null;
  /** The reply hit maxOutputTokens and may be cut off mid-JSON. */
  truncated: boolean;
};

type ChatPayload = {
  model?: string;
  error?: { message?: string; code?: number };
  choices?: Array<{
    finish_reason?: string | null;
    message?: { content?: string | Array<{ type?: string; text?: string }> | null };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    cost?: number;
    completion_tokens_details?: { reasoning_tokens?: number };
  };
};

function readKey(explicit: string | undefined): string {
  const value = explicit ?? process.env[OPENROUTER_KEY_ENV];
  if (value === undefined || value.trim().length === 0) {
    throw new EvalConfigError(`${OPENROUTER_KEY_ENV} is not set`);
  }
  return value.trim();
}

function readUsage(payload: ChatPayload): EvalUsage & { reasoningTokens: number } {
  const u = payload.usage ?? {};
  const cost = typeof u.cost === "number" && Number.isFinite(u.cost) && u.cost >= 0 ? u.cost : null;
  return {
    inputTokens: u.prompt_tokens ?? 0,
    outputTokens: u.completion_tokens ?? 0,
    reasoningTokens: u.completion_tokens_details?.reasoning_tokens ?? 0,
    reportedCostUsd: cost,
  };
}

function readText(payload: ChatPayload): string {
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content.map((part) => part.text ?? "").join("").trim();
  }
  return "";
}

async function errorDetail(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as ChatPayload;
    return body.error?.message ? `: ${body.error.message}` : "";
  } catch {
    return "";
  }
}

function statusMessage(status: number): string {
  if (status === 401 || status === 403) return "OpenRouter rejected the API key";
  if (status === 402) return "OpenRouter account is out of credits";
  if (status === 404) return "OpenRouter does not serve that model";
  return `OpenRouter returned ${status}`;
}

export function createOpenRouterClient(
  options: { fetchImpl?: Fetcher; apiKey?: string; timeoutMs?: number } = {},
) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return {
    async chat(request: ChatRequest): Promise<ChatReply> {
      // Read at call time so a missing key is a config error from the call,
      // not an import-time crash, and fixture mode never needs one.
      const apiKey = readKey(options.apiKey);

      const body = {
        model: request.model,
        messages: [
          { role: "system", content: request.system },
          { role: "user", content: request.user },
        ],
        max_tokens: request.maxOutputTokens,
        temperature: request.temperature ?? 0,
        ...(request.json
          ? {
              response_format: { type: "json_object" },
              // Route only to upstreams that honour JSON mode, rather than
              // one that silently ignores it.
              provider: { require_parameters: true },
            }
          : {}),
        usage: { include: true },
      };

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let response: Response;
      try {
        response = await fetchImpl(`${OPENROUTER_BASE_URL}/chat/completions`, {
          method: "POST",
          headers: {
            authorization: `Bearer ${apiKey}`,
            "content-type": "application/json",
            "HTTP-Referer": APP_URL,
            "X-Title": APP_TITLE,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } catch {
        throw new EvalCallError(
          `request to ${request.model} failed or timed out after ${timeoutMs} ms`,
          { retryable: true, billing: "unknown" },
        );
      } finally {
        clearTimeout(timer);
      }

      if (!response.ok) {
        // 4xx other than 408/429 is our bug or our account: retrying spends
        // time to fail again.
        const s = response.status;
        const retryable = s === 408 || s === 429 || s >= 500;
        throw new EvalCallError(
          `${statusMessage(s)} for ${request.model}${await errorDetail(response)}`,
          { retryable, billing: "none", status: s },
        );
      }

      let payload: ChatPayload;
      try {
        payload = (await response.json()) as ChatPayload;
      } catch {
        throw new EvalCallError(`unreadable response from ${request.model}`, {
          retryable: true,
          billing: "unknown",
        });
      }

      const usage = readUsage(payload);
      if (payload.error) {
        throw new EvalCallError(
          `${request.model} failed upstream: ${payload.error.message ?? "unknown error"}`,
          { retryable: true, billing: "unknown", usage },
        );
      }

      const text = readText(payload);
      if (text.length === 0) {
        throw new EvalCallError(`${request.model} returned an empty reply`, {
          retryable: true,
          billing: "billed",
          usage,
        });
      }

      const finishReason = payload.choices?.[0]?.finish_reason ?? null;
      return {
        text,
        servedModel: payload.model ?? request.model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        reasoningTokens: usage.reasoningTokens,
        reportedCostUsd: usage.reportedCostUsd,
        finishReason,
        truncated: finishReason === "length",
      };
    },
  };
}

export type OpenRouterClient = ReturnType<typeof createOpenRouterClient>;
