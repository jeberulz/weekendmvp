/**
 * WP71-S1. Provider mode: fixture unless explicitly live.
 *
 * - `providerMode(env)` is `"live"` only when `AI_PROVIDER_MODE === "live"`
 *   exactly. Unset, empty, `"LIVE"`, `"fixture"` or anything else is fixture.
 * - Live also needs the provider's key: `resolveProviderAccess` throws a
 *   `config` `ProviderError` (billed `none`) before any request is built.
 * - Fixture mode needs no key and never uses an injected `fetch` or SDK
 *   client; each adapter swaps in the deterministic transport from
 *   `fixtures.ts`, so a fixture call cannot reach the network.
 *
 * `env` is a parameter, never `process.env`, so tests stay hermetic and the
 * gateway (S2) decides where env comes from.
 *
 * The kill switch (`ops_settings.killSwitches.ai`) is not checked here. It is
 * the gateway's job (S2): C-METER `reserve` fails with `AI_DISABLED` before
 * any adapter is called, so a switched-off deployment never reaches this file.
 */

import type { MeterProvider } from "../../../lib/workspace/contracts/metering";
import { ProviderError } from "./types";

export type ProviderEnv = Readonly<Record<string, string | undefined>>;

export type ProviderMode = "live" | "fixture";

export const AI_PROVIDER_MODE_ENV = "AI_PROVIDER_MODE";

export function providerMode(env: ProviderEnv): ProviderMode {
  return env[AI_PROVIDER_MODE_ENV] === "live" ? "live" : "fixture";
}

/** The env var holding each provider's key (`02` §5.5). Video has no adapter yet (WP82). */
export const PROVIDER_KEY_ENV = {
  anthropic: "ANTHROPIC_API_KEY",
  openai_images: "OPENAI_API_KEY",
  recraft: "RECRAFT_API_KEY",
} as const satisfies Partial<Record<MeterProvider, string>>;

export type KeyedProvider = keyof typeof PROVIDER_KEY_ENV;

export type ProviderAccess = { readonly mode: "fixture" } | { readonly mode: "live"; readonly apiKey: string };

/**
 * Fixture access, or live access with a trimmed key. Throws `config` when
 * live has no usable key, so nothing is sent.
 */
export function resolveProviderAccess(provider: KeyedProvider, env: ProviderEnv): ProviderAccess {
  if (providerMode(env) === "fixture") return { mode: "fixture" };
  const name = PROVIDER_KEY_ENV[provider];
  const key = env[name]?.trim();
  if (key === undefined || key.length === 0) {
    throw new ProviderError(provider, "config", `${AI_PROVIDER_MODE_ENV}=live needs ${name}, which is not set`);
  }
  return { mode: "live", apiKey: key };
}
