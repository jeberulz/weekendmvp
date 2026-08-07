import {
  ProviderCallError,
  requireSecret,
  type ProviderResult,
  type SynthesisProvider,
  type SynthesisRequest,
  type SynthesisResponse,
} from "./types";
import { estimateSynthesisUsd, SYNTHESIS_MODEL } from "./pricing";

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
function readText(payload: ResponsesPayload): string {
  if (typeof payload.output_text === "string" && payload.output_text.length > 0) {
    return payload.output_text;
  }
  const joined = (payload.output ?? [])
    .flatMap((item) => item.content ?? [])
    .map((part) => part.text ?? "")
    .join("")
    .trim();
  if (joined.length === 0) {
    throw new ProviderCallError("synthesis", "model returned no text", {
      retryable: true,
    });
  }
  return joined;
}

export function createSynthesisProvider(
  options: { fetchImpl?: Fetcher } = {},
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
      // ProviderConfigError from the call, where S3 can classify it as
      // non-retryable, rather than as an import-time crash.
      const apiKey = requireSecret("synthesis", "OPENAI_API_KEY");

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
      } catch (cause) {
        throw new ProviderCallError("synthesis", "request failed", {
          retryable: true,
          ...(cause instanceof Error ? {} : {}),
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

      let payload: ResponsesPayload;
      try {
        payload = (await response.json()) as ResponsesPayload;
      } catch {
        throw new ProviderCallError("synthesis", "unparseable response", {
          retryable: true,
        });
      }

      const text = readText(payload);
      const inputTokens = payload.usage?.input_tokens ?? 0;
      const outputTokens = payload.usage?.output_tokens ?? 0;
      const cachedInputTokens =
        payload.usage?.input_tokens_details?.cached_tokens ?? 0;

      return {
        value: { text, inputTokens, outputTokens, cachedInputTokens },
        cost: {
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
        },
      };
    },
  };
}
