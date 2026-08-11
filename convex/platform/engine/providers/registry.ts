import { createSynthesisProvider } from "./openai";
import { createSearchProvider } from "./perplexity";
import { createKeywordDataProvider } from "./keywordData";
import {
  fixtureKeywordFetch,
  fixtureSearchFetch,
  fixtureSynthesisFetch,
} from "./fixtures";
import { ProviderConfigError, type EngineProviders } from "./types";

/**
 * WP26-S3. Chooses between live providers and S2's fixture transports.
 *
 * **The mode is required, never defaulted.** Defaulting either direction is a
 * silent failure: defaulting to `live` lets a misconfigured deployment spend
 * real money the manifest has not yet authorised, and defaulting to `fixture`
 * would serve customers invented research that looks exactly like a real
 * report. An unset variable is a deployment mistake, so it throws.
 */

export const ENGINE_PROVIDER_MODE_VAR = "ENGINE_PROVIDER_MODE";

export type EngineProviderMode = "live" | "fixture";

export function readProviderMode(
  env: Record<string, string | undefined> = process.env,
): EngineProviderMode {
  const raw = env[ENGINE_PROVIDER_MODE_VAR];
  if (raw === "live" || raw === "fixture") return raw;
  throw new ProviderConfigError(
    "synthesis",
    `${ENGINE_PROVIDER_MODE_VAR} must be set to "live" or "fixture"`,
  );
}

/**
 * Note that fixture mode still runs each adapter's credential check — only the
 * transport is swapped, so `OPENAI_API_KEY` and friends must be present even
 * with placeholder values. That is deliberate: a fixture run that skipped the
 * config path would pass while the live path was still unconfigured.
 */
export function createProviders(mode: EngineProviderMode): EngineProviders {
  if (mode === "fixture") {
    return {
      synthesis: createSynthesisProvider({ fetchImpl: fixtureSynthesisFetch() }),
      search: createSearchProvider({ fetchImpl: fixtureSearchFetch() }),
      keywordData: createKeywordDataProvider({ fetchImpl: fixtureKeywordFetch() }),
    };
  }
  return {
    synthesis: createSynthesisProvider(),
    search: createSearchProvider(),
    keywordData: createKeywordDataProvider(),
  };
}
