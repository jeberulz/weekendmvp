import {
  ProviderCallError,
  requireSecret,
  type KeywordDataProvider,
  type KeywordMetric,
  type KeywordRequest,
  type KeywordResponse,
  type ProviderResult,
} from "./types";
import { estimateKeywordUsd, KEYWORD_PROVIDER } from "./pricing";
import type { Fetcher } from "./openai";

/**
 * WP26-S2. Keyword/demand adapter (DataForSEO).
 *
 * **This adapter must never produce a number the provider did not return.**
 * The ruling is explicit: an LLM may not synthesize, estimate, or infer
 * search volume, competition, or CPC. A missing or failing provider fails the
 * step closed so `S3` retries and `S4` refunds — it never degrades to a
 * model guess, and it never returns partial data padded with defaults.
 *
 * Concretely, that means:
 *
 * - no default values for absent fields (a missing metric drops the keyword,
 *   it does not become zero);
 * - if *no* keyword resolves, the call throws rather than returning `[]`,
 *   because an empty list downstream looks like "no demand" — a finding —
 *   rather than "we failed to measure".
 */

const ENDPOINT =
  "https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live";

type DataForSeoItem = {
  keyword?: unknown;
  search_volume?: unknown;
  competition_index?: unknown;
  cpc?: unknown;
};

type DataForSeoPayload = {
  status_code?: number;
  status_message?: string;
  tasks?: Array<{
    status_code?: number;
    result?: DataForSeoItem[] | null;
  }>;
};

/** DataForSEO signals success with 20000; anything else is a failure. */
const OK_STATUS = 20000;

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Converts one provider item, or returns `null`.
 *
 * Every field must be present and numeric. `competition_index` and `cpc` are
 * legitimately absent for very low-volume keywords, and coercing those to 0
 * would state as measured fact that a keyword has zero competition and zero
 * commercial value — exactly the fabricated-demand-data outcome the ruling
 * forbids.
 */
function toMetric(item: DataForSeoItem): KeywordMetric | null {
  if (typeof item.keyword !== "string" || item.keyword.length === 0) return null;
  const searchVolume = readNumber(item.search_volume);
  const competition = readNumber(item.competition_index);
  const cpcUsd = readNumber(item.cpc);
  if (searchVolume === null || competition === null || cpcUsd === null) {
    return null;
  }
  return { keyword: item.keyword, searchVolume, competition, cpcUsd };
}

export function createKeywordDataProvider(
  options: { fetchImpl?: Fetcher } = {},
): KeywordDataProvider {
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    role: "keywordData",
    name: KEYWORD_PROVIDER,

    async lookup(
      request: KeywordRequest,
    ): Promise<ProviderResult<KeywordResponse>> {
      const login = requireSecret("keywordData", "DATAFORSEO_LOGIN");
      const password = requireSecret("keywordData", "DATAFORSEO_PASSWORD");

      if (request.keywords.length === 0) {
        throw new ProviderCallError("keywordData", "no keywords supplied", {
          retryable: false,
        });
      }

      const authorization = `Basic ${btoa(`${login}:${password}`)}`;

      let response: Response;
      try {
        response = await fetchImpl(ENDPOINT, {
          method: "POST",
          headers: { authorization, "content-type": "application/json" },
          body: JSON.stringify([
            {
              keywords: request.keywords,
              location_code: request.locationCode,
              language_code: request.languageCode,
            },
          ]),
        });
      } catch {
        throw new ProviderCallError("keywordData", "request failed", {
          retryable: true,
        });
      }

      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 500;
        throw new ProviderCallError(
          "keywordData",
          `provider returned ${response.status}`,
          { retryable, status: response.status },
        );
      }

      let payload: DataForSeoPayload;
      try {
        payload = (await response.json()) as DataForSeoPayload;
      } catch {
        throw new ProviderCallError("keywordData", "unparseable response", {
          retryable: true,
        });
      }

      // DataForSEO returns HTTP 200 with an error status code in the body, so
      // `response.ok` alone would wave failures through.
      if (payload.status_code !== OK_STATUS) {
        throw new ProviderCallError(
          "keywordData",
          `provider status ${payload.status_code ?? "unknown"}`,
          { retryable: true },
        );
      }

      const tasks = payload.tasks ?? [];
      const metrics: KeywordMetric[] = [];
      let items = 0;
      for (const task of tasks) {
        if (task.status_code !== OK_STATUS) {
          throw new ProviderCallError(
            "keywordData",
            `task status ${task.status_code ?? "unknown"}`,
            { retryable: true },
          );
        }
        for (const item of task.result ?? []) {
          items += 1;
          const metric = toMetric(item);
          if (metric !== null) metrics.push(metric);
        }
      }

      // Empty is a failure, not a finding. Returning `[]` here would be read
      // downstream as "this idea has no search demand".
      if (metrics.length === 0) {
        throw new ProviderCallError(
          "keywordData",
          "provider returned no usable keyword metrics",
          { retryable: true },
        );
      }

      return {
        value: { metrics, tasks: tasks.length, items },
        cost: {
          role: "keywordData",
          provider: KEYWORD_PROVIDER,
          billedAs: "google_ads/search_volume/live",
          usd: estimateKeywordUsd({ tasks: tasks.length, items }),
          estimated: true,
          units: { tasks: tasks.length, items },
        },
      };
    },
  };
}
