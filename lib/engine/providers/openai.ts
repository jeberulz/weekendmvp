import {
  ProviderCallError,
  requireSecret,
  type ProviderCost,
  type ProviderResult,
  type SynthesisProvider,
  type SynthesisRequest,
  type SynthesisResponse,
} from "./types.ts";
import { estimateSynthesisUsd, SYNTHESIS_MODEL } from "./pricing.ts";

/**
 * WP26-S2. Synthesis adapter (OpenAI).
 *
 * Pins `SYNTHESIS_MODEL` — the concrete model ID, never the `gpt-5.6` alias.
 * See `pricing.ts` for why no dated snapshot is pinned: none exists.
 */

const ENDPOINT = "https://api.openai.com/v1/responses";

/** Injected so fixture mode needs no network and no key. */
export type Fetcher = typeof fetch;

/**
 * Headroom for the provider's own message framing when usage is unknown;
 * the same allowance the pipeline keeps under each step's input budget.
 */
const FRAMING_TOKENS = 200;

const utf8 = new TextEncoder();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A reported token count, or null when absent or not a non-negative integer. */
function tokenCount(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

type TokenUsage = { inputTokens: number; cachedInputTokens: number; outputTokens: number };

/**
 * The tokens a billed reply (any 2xx) is charged for. Usage that is missing
 * or malformed is never recorded as zero: each unknown count is the most this
 * request could have been billed. Input: its UTF-8 bytes plus framing, since
 * a token is never shorter than one byte. Output: `maxOutputTokens`, which
 * the API enforces. Cached input: none, the dearest case, also when the
 * reported count exceeds the input it belongs to.
 */
function billedUsage(usage: unknown, request: SynthesisRequest): TokenUsage {
  const reported = isRecord(usage) ? usage : {};
  const details = isRecord(reported.input_tokens_details) ? reported.input_tokens_details : {};
  const inputTokens =
    tokenCount(reported.input_tokens) ??
    utf8.encode(request.instructions).byteLength + utf8.encode(request.input).byteLength + FRAMING_TOKENS;
  const outputTokens = tokenCount(reported.output_tokens) ?? request.maxOutputTokens;
  const cached = tokenCount(details.cached_tokens);
  const cachedInputTokens = cached !== null && cached <= inputTokens ? cached : 0;
  return { inputTokens, cachedInputTokens, outputTokens };
}

function costOf(usage: TokenUsage): ProviderCost {
  return {
    role: "synthesis",
    provider: "openai",
    billedAs: SYNTHESIS_MODEL,
    usd: estimateSynthesisUsd(usage),
    estimated: true,
    units: { ...usage },
  };
}

/**
 * Pulls the text out of a Responses payload, whatever its shape.
 *
 * Fails closed on an empty result rather than returning `""`. An empty
 * synthesis is indistinguishable downstream from a model that legitimately
 * had nothing to add, and would produce a report with silently missing
 * sections. Tokens were still billed, so the error carries the cost.
 */
function readText(payload: unknown, cost: ProviderCost): string {
  if (isRecord(payload)) {
    if (typeof payload.output_text === "string" && payload.output_text.length > 0) {
      return payload.output_text;
    }
    const parts: string[] = [];
    for (const item of Array.isArray(payload.output) ? payload.output : []) {
      if (!isRecord(item) || !Array.isArray(item.content)) continue;
      for (const part of item.content) {
        if (isRecord(part) && typeof part.text === "string") parts.push(part.text);
      }
    }
    const joined = parts.join("").trim();
    if (joined.length > 0) return joined;
  }
  throw new ProviderCallError("synthesis", "model returned no text", {
    retryable: true,
    cost,
  });
}

export function createSynthesisProvider(
  options: { fetchImpl?: Fetcher; apiKey?: string } = {},
): SynthesisProvider {
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    role: "synthesis",
    name: "openai",
    model: SYNTHESIS_MODEL,

    async complete(
      request: SynthesisRequest,
    ): Promise<ProviderResult<SynthesisResponse>> {
      // Read at call time, not module load: a config error must surface as a
      // ProviderConfigError from the call, where the pipeline can classify it
      // as non-retryable, rather than as an import-time crash.
      // Optional apiKey lets fixture mode skip env without rewriting requireSecret.
      const apiKey =
        options.apiKey !== undefined
          ? options.apiKey
          : requireSecret("synthesis", "OPENAI_API_KEY");

      let response: Response;
      try {
        response = await fetchImpl(ENDPOINT, {
          method: "POST",
          headers: {
            authorization: `Bearer ${apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: SYNTHESIS_MODEL,
            instructions: request.instructions,
            input: request.input,
            max_output_tokens: request.maxOutputTokens,
          }),
        });
      } catch {
        // No reply arrived, so nothing was billed.
        throw new ProviderCallError("synthesis", "request failed", {
          retryable: true,
        });
      }

      if (!response.ok) {
        // 4xx other than 429 is our bug — a bad request or a rejected key —
        // and retrying spends budget to fail again.
        const retryable = response.status === 429 || response.status >= 500;
        throw new ProviderCallError(
          "synthesis",
          `provider returned ${response.status}`,
          { retryable, status: response.status },
        );
      }

      // A 2xx means the request ran and was billed: from here on every
      // failure carries a cost, so the pipeline settles it as spend.
      let raw: string;
      try {
        raw = await response.text();
      } catch {
        throw new ProviderCallError("synthesis", "response body could not be read", {
          retryable: true,
          cost: costOf(billedUsage(undefined, request)),
        });
      }
      let payload: unknown;
      try {
        payload = JSON.parse(raw);
      } catch {
        throw new ProviderCallError("synthesis", "unparseable response", {
          retryable: true,
          cost: costOf(billedUsage(undefined, request)),
        });
      }

      const usage = billedUsage(isRecord(payload) ? payload.usage : undefined, request);
      const cost = costOf(usage);
      const text = readText(payload, cost);

      return { value: { text, ...usage }, cost };
    },
  };
}
