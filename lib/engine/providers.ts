/**
 * Provider factory for the idea-engine CLI (Mode A2 phase 4).
 *
 * Fixture mode must run with NO API keys. v1.1 registry.ts required keys even
 * in fixture mode — that file is left behind on purpose.
 */

import { createSynthesisProvider } from "./providers/openai.ts";
import { createSearchProvider } from "./providers/perplexity.ts";
import { createKeywordDataProvider } from "./providers/keywordData.ts";
import { createSourceTextProvider } from "./providers/sourceText.ts";
import {
  fixtureKeywordFetch,
  fixtureScenarioPages,
  fixtureSearchFetch,
  fixtureSourceText,
  fixtureSynthesisFetch,
  KEYWORD_RFP_FIXTURE,
  type FixtureScenario,
} from "./providers/fixtures.ts";
import type { EngineProviders } from "./providers/types.ts";

export type ProviderMode = "fixture" | "live";

export type CreateProvidersOptions = {
  mode: ProviderMode;
  /** Optional keyword fixture override (tests). */
  keywordFixturePayload?: unknown;
  /** Fixture mode only: which synthetic source-page set to serve (default "default"). */
  scenario?: FixtureScenario;
};

/**
 * Build the four role adapters.
 *
 * - `live`: reads OPENAI_API_KEY, PERPLEXITY_API_KEY, DATAFORSEO_* from env
 *   at call time (fail closed on missing keys); pages are read over the
 *   network by the bounded public-only source reader.
 * - `fixture`: injectable fixture transports + placeholder credentials so
 *   requireSecret is never consulted, and synthetic source pages. No
 *   network. No env keys required.
 */
export function createProviders(options: CreateProvidersOptions): EngineProviders {
  if (options.mode === "fixture") {
    return {
      synthesis: createSynthesisProvider({
        fetchImpl: fixtureSynthesisFetch(),
        apiKey: "fixture-mode",
      }),
      search: createSearchProvider({
        fetchImpl: fixtureSearchFetch(),
        apiKey: "fixture-mode",
      }),
      keywordData: createKeywordDataProvider({
        fetchImpl: fixtureKeywordFetch({
          payload: options.keywordFixturePayload ?? KEYWORD_RFP_FIXTURE,
        }),
        login: "fixture-mode",
        password: "fixture-mode",
      }),
      sourceText: fixtureSourceText(fixtureScenarioPages(options.scenario ?? "default")),
    };
  }

  if (options.scenario !== undefined) {
    throw new Error("a fixture scenario cannot be used in live mode");
  }
  return {
    synthesis: createSynthesisProvider(),
    search: createSearchProvider(),
    keywordData: createKeywordDataProvider(),
    sourceText: createSourceTextProvider(),
  };
}
