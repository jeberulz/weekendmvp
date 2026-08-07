import {
  ProviderCallError,
  requireSecret,
  type Citation,
  type ProviderResult,
  type SearchProvider,
  type SearchRequest,
  type SearchResponse,
} from "./types";
import { estimateSearchUsd, SEARCH_MODEL } from "./pricing";
import type { Fetcher } from "./openai";

/**
 * WP26-S2. Search adapter (Perplexity Sonar Pro), citation-only.
 *
 * The ruling permits storing and republishing **source URLs and short
 * snippets**, never full third-party page content. That bound is enforced
 * here rather than left to callers: a downstream section that wanted more
 * text has nowhere to get it, which is a stronger guarantee than a policy
 * note.
 */

const ENDPOINT = "https://api.perplexity.ai/chat/completions";

/**
 * Hard cap on stored snippet length. Long enough to attribute a claim, far
 * short of reproducing a page.
 */
export const MAX_SNIPPET_CHARS = 320;

type PerplexityPayload = {
  choices?: Array<{ message?: { content?: string } }>;
  citations?: unknown;
  search_results?: Array<{ url?: string; title?: string; snippet?: string }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

function truncate(value: string | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  return trimmed.length > MAX_SNIPPET_CHARS
    ? `${trimmed.slice(0, MAX_SNIPPET_CHARS)}…`
    : trimmed;
}

/**
 * Only `http(s)` URLs are kept. A citation is republished to readers, so a
 * `javascript:` or `data:` URL arriving from a provider must never reach the
 * renderer — WP27's templates build no URLs from content, but a report
 * citation is the one place a provider-supplied URL does surface.
 */
function readCitations(payload: PerplexityPayload): Citation[] {
  const structured = Array.isArray(payload.search_results)
    ? payload.search_results
    : [];
  const bare = Array.isArray(payload.citations)
    ? payload.citations.filter((c): c is string => typeof c === "string")
    : [];

  const seen = new Set<string>();
  const citations: Citation[] = [];

  const push = (url: unknown, title?: string, snippet?: string) => {
    if (typeof url !== "string") return;
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return;
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return;
    if (seen.has(parsed.href)) return;
    seen.add(parsed.href);
    citations.push({
      url: parsed.href,
      ...(title ? { title: truncate(title) } : {}),
      ...(snippet ? { snippet: truncate(snippet) } : {}),
    });
  };

  for (const result of structured) push(result.url, result.title, result.snippet);
  for (const url of bare) push(url);

  return citations;
}

export function createSearchProvider(
  options: { fetchImpl?: Fetcher } = {},
): SearchProvider {
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    role: "search",
    name: "perplexity",

    async search(
      request: SearchRequest,
    ): Promise<ProviderResult<SearchResponse>> {
      const apiKey = requireSecret("search", "PERPLEXITY_API_KEY");

      let response: Response;
      try {
        response = await fetchImpl(ENDPOINT, {
          method: "POST",
          headers: {
            authorization: `Bearer ${apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: SEARCH_MODEL,
            messages: [{ role: "user", content: request.query }],
            web_search_options: {
              search_context_size: request.searchContextSize,
            },
          }),
        });
      } catch {
        throw new ProviderCallError("search", "request failed", {
          retryable: true,
        });
      }

      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 500;
        throw new ProviderCallError(
          "search",
          `provider returned ${response.status}`,
          { retryable, status: response.status },
        );
      }

      let payload: PerplexityPayload;
      try {
        payload = (await response.json()) as PerplexityPayload;
      } catch {
        throw new ProviderCallError("search", "unparseable response", {
          retryable: true,
        });
      }

      const text = payload.choices?.[0]?.message?.content ?? "";
      const citations = readCitations(payload);

      // A search result with no usable citation cannot support a cited claim,
      // and the report contract fails closed on uncited scored sections. Fail
      // here instead, where S3 can retry, rather than deeper in the compiler.
      if (citations.length === 0) {
        throw new ProviderCallError("search", "no usable citations returned", {
          retryable: true,
        });
      }

      const inputTokens = payload.usage?.prompt_tokens ?? 0;
      const outputTokens = payload.usage?.completion_tokens ?? 0;

      return {
        value: { text, citations, inputTokens, outputTokens, requests: 1 },
        cost: {
          role: "search",
          provider: "perplexity",
          billedAs: SEARCH_MODEL,
          usd: estimateSearchUsd({
            inputTokens,
            outputTokens,
            requests: 1,
            searchContextSize: request.searchContextSize,
          }),
          estimated: true,
          units: { inputTokens, outputTokens, requests: 1 },
        },
      };
    },
  };
}
