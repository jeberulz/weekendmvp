/**
 * WP26-S2. Fixture transports.
 *
 * Every later story's tests run against these, so no test needs a key and no
 * test spends money. Each fixture is a `fetch`-shaped function, so the adapter
 * under test is the *real* adapter — parsing, validation, fail-closed
 * behaviour and cost estimation all execute exactly as in production. Only the
 * transport is substituted.
 *
 * **Provenance, stated plainly:** these payloads are authored from each
 * provider's documented response shape, not captured from live traffic. WP26's
 * manifest boundary keeps real provider calls disabled until this story's own
 * test-mode gate passes, and no credentials exist in this environment to
 * record against. That means they verify our parsing contract, not that the
 * provider actually emits this shape today. Recorded as a deviation in
 * `docs/wp/wp26-progress.md`; the `S6` eval against a live deployment is where
 * shape drift would surface.
 *
 * They contain no credential, account identifier, or request header — there is
 * nothing here to scrub, by construction.
 */

import type { Fetcher } from "./openai";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// ---------------------------------------------------------------------------

export const SYNTHESIS_FIXTURE = {
  output_text:
    "Collectors lose thousands to counterfeit sales because authentication is slow and scarce.",
  usage: {
    input_tokens: 1_200,
    output_tokens: 640,
    input_tokens_details: { cached_tokens: 400 },
  },
};

export function fixtureSynthesisFetch(
  overrides: { payload?: unknown; status?: number } = {},
): Fetcher {
  return (async () =>
    jsonResponse(
      overrides.payload ?? SYNTHESIS_FIXTURE,
      overrides.status ?? 200,
    )) as Fetcher;
}

// ---------------------------------------------------------------------------

export const SEARCH_FIXTURE = {
  choices: [
    {
      message: {
        content:
          "Independent authentication services report multi-week turnaround times.",
      },
    },
  ],
  search_results: [
    {
      url: "https://example.com/collectibles-fraud-report-2026",
      title: "Collectibles fraud report 2026",
      snippet: "Counterfeit losses reached an estimated $1.2B in 2025.",
    },
    {
      url: "https://example.org/authentication-turnaround",
      title: "Authentication turnaround benchmarks",
    },
  ],
  citations: ["https://example.net/market-size"],
  usage: { prompt_tokens: 900, completion_tokens: 380 },
};

export function fixtureSearchFetch(
  overrides: { payload?: unknown; status?: number } = {},
): Fetcher {
  return (async () =>
    jsonResponse(
      overrides.payload ?? SEARCH_FIXTURE,
      overrides.status ?? 200,
    )) as Fetcher;
}

// ---------------------------------------------------------------------------

export const KEYWORD_FIXTURE = {
  status_code: 20000,
  status_message: "Ok.",
  tasks: [
    {
      status_code: 20000,
      result: [
        {
          keyword: "collectible authentication",
          search_volume: 2400,
          competition_index: 34,
          cpc: 1.82,
        },
        {
          keyword: "verify trading card",
          search_volume: 880,
          competition_index: 21,
          cpc: 0.94,
        },
      ],
    },
  ],
};

export function fixtureKeywordFetch(
  overrides: { payload?: unknown; status?: number } = {},
): Fetcher {
  return (async () =>
    jsonResponse(
      overrides.payload ?? KEYWORD_FIXTURE,
      overrides.status ?? 200,
    )) as Fetcher;
}

/** A transport that always throws, for the network-failure paths. */
export function unreachableFetch(): Fetcher {
  return (async () => {
    throw new Error("ECONNREFUSED");
  }) as Fetcher;
}
