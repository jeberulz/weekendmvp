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
import {
  asJsonObject,
  fetchInitWithTimeout,
  isRetryableHttpStatus,
  knownNonNegative,
} from "../resilience.ts";

/**
 * WP26-S2. Synthesis adapter (OpenAI).
 *
 * Pins `SYNTHESIS_MODEL` — the concrete model ID, never the `gpt-5.6` alias.
 * See `pricing.ts` for why no dated snapshot is pinned: none exists.
 */

const ENDPOINT = "https://api.openai.com/v1/responses";

/** Injected so fixture mode needs no network and no key. */
export type Fetcher = typeof fetch;

type ResponsesPayload = {
  output_text?: string;
  output?: Array<{ content?: Array<{ text?: string }> }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    input_tokens_details?: { cached_tokens?: number };
  };
};

/**
 * Pulls the text out of a Responses payload.
 *
 * Fails closed on an empty result rather than returning `""`. An empty
 * synthesis is indistinguishable downstream from a model that legitimately
 * had nothing to add, and would produce a report with silently missing
 * sections.
 */
function readText(payload: ResponsesPayload, cost: ProviderCost): string {
  if (typeof payload.output_text === "string" && payload.output_text.length > 0) {
    return payload.output_text;
  }
  const joined = (payload.output ?? [])
    .flatMap((item) => item.content ?? [])
    .map((part) => part.text ?? "")
    .join("")
    .trim();
  if (joined.length === 0) {
    // Tokens were still billed, so the error carries the cost.
    throw new ProviderCallError("synthesis", "model returned no text", {
      retryable: true,
      cost,
    });
  }
  return joined;
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

      const reserved: ProviderCost = {
        role: "synthesis",
        provider: "openai",
        billedAs: SYNTHESIS_MODEL,
        usd: estimateSynthesisUsd({
          inputTokens: 4_000,
          cachedInputTokens: 0,
          outputTokens: request.maxOutputTokens,
        }),
        estimated: true,
        units: { reserved: 1 },
      };

      let response: Response;
      try {
        response = await fetchImpl(
          ENDPOINT,
          fetchInitWithTimeout({
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
          }),
        );
      } catch {
        throw new ProviderCallError("synthesis", "request failed", {
          retryable: true,
          cost: reserved,
        });
      }

      if (!response.ok) {
        throw new ProviderCallError(
          "synthesis",
          `provider returned ${response.status}`,
          {
            retryable: isRetryableHttpStatus(response.status),
            status: response.status,
            cost: reserved,
          },
        );
      }

      let payload: ResponsesPayload;
      try {
        const raw = asJsonObject(await response.json());
        if (!raw) throw new Error("expected JSON object");
        payload = raw as ResponsesPayload;
      } catch {
        throw new ProviderCallError("synthesis", "unparseable response", {
          retryable: true,
          cost: reserved,
        });
      }

      const inputTokens = knownNonNegative(payload.usage?.input_tokens);
      const outputTokens = knownNonNegative(payload.usage?.output_tokens);
      const cachedRaw = payload.usage?.input_tokens_details?.cached_tokens;
      const cachedInputTokens =
        cachedRaw === undefined ? 0 : knownNonNegative(cachedRaw);
      const usageKnown =
        inputTokens !== null &&
        outputTokens !== null &&
        cachedInputTokens !== null;
      const cost: ProviderCost = usageKnown
        ? {
            role: "synthesis",
            provider: "openai",
            billedAs: SYNTHESIS_MODEL,
            usd: estimateSynthesisUsd({
              inputTokens,
              cachedInputTokens,
              outputTokens,
            }),
            estimated: true,
            units: { inputTokens, cachedInputTokens, outputTokens },
          }
        : reserved;
      const text = readText(payload, cost);

      return {
        value: {
          text,
          inputTokens: inputTokens ?? 0,
          outputTokens: outputTokens ?? 0,
          cachedInputTokens: cachedInputTokens ?? 0,
        },
        cost,
      };
    },
  };
}
