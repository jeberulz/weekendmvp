/**
 * WP26-S2. Provider-agnostic interfaces for the three engine roles.
 *
 * One interface per *role*, not per vendor, so swapping a provider touches
 * only its adapter and never the pipeline. The roles are ruled
 * (`docs/wp/RULINGS.md`, 2026-08-06):
 *
 * - **synthesis** — the model that writes and scores the report
 * - **search** — cited search/community signal
 * - **keywordData** — volume, competition, and CPC
 *
 * Two rules hold across every adapter:
 *
 * 1. **Fail closed.** A missing or malformed credential, or a provider error,
 *    raises `ProviderConfigError` / `ProviderCallError`. No adapter returns a
 *    degraded or synthesized result. This matters most for `keywordData`,
 *    where the ruling forbids an LLM ever estimating the numbers — a failing
 *    provider must fail the step so `S3` retries and `S4` refunds, rather
 *    than quietly shipping a report with invented demand data.
 * 2. **Every call reports its cost**, including in fixture mode, so `S4` has
 *    real numbers to sum against the $4.00 per-report cap.
 */

/** Which role an adapter fills. Used in cost records and error messages. */
export type ProviderRole = "synthesis" | "search" | "keywordData";

/**
 * What one provider call cost, in USD.
 *
 * `estimated` is true when the figure comes from the published rate card
 * rather than a provider-reported amount — which is the normal case, and is
 * always the case in fixture mode. `S4` must treat estimates as the number to
 * reserve against, never as a settled charge.
 */
export type ProviderCost = {
  role: ProviderRole;
  provider: string;
  /** The exact model or endpoint identifier billed, for audit. */
  billedAs: string;
  usd: number;
  estimated: boolean;
  /** Free-form breakdown for the cost audit trail (tokens, requests, items). */
  units: Record<string, number>;
};

export type ProviderResult<T> = {
  value: T;
  cost: ProviderCost;
};

/**
 * Raised when configuration is absent or unusable.
 *
 * Distinct from a call failure because the operator response differs: a
 * config error is never worth retrying, so `S3` must not spend a retry on it
 * and `S4` must not reserve budget for it.
 */
export class ProviderConfigError extends Error {
  readonly role: ProviderRole;
  readonly retryable = false as const;

  constructor(role: ProviderRole, message: string) {
    super(message);
    this.name = "ProviderConfigError";
    this.role = role;
  }
}

/** Raised when a provider was reachable but the call did not succeed. */
export class ProviderCallError extends Error {
  readonly role: ProviderRole;
  readonly retryable: boolean;
  readonly status?: number;

  constructor(
    role: ProviderRole,
    message: string,
    options: { retryable: boolean; status?: number },
  ) {
    super(message);
    this.name = "ProviderCallError";
    this.role = role;
    this.retryable = options.retryable;
    this.status = options.status;
  }
}

// ---------------------------------------------------------------------------
// Role: synthesis
// ---------------------------------------------------------------------------

export type SynthesisRequest = {
  /** System/developer framing, kept separate so it can be audited. */
  instructions: string;
  input: string;
  /** Hard ceiling; the adapter must not silently exceed it. */
  maxOutputTokens: number;
};

export type SynthesisResponse = {
  text: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
};

export interface SynthesisProvider {
  readonly role: "synthesis";
  readonly name: string;
  /** The exact billed model identifier. Never a floating alias. */
  readonly model: string;
  complete(request: SynthesisRequest): Promise<ProviderResult<SynthesisResponse>>;
}

// ---------------------------------------------------------------------------
// Role: search
// ---------------------------------------------------------------------------

/**
 * A citation is a URL plus only as much text as attribution needs.
 *
 * The ruling is citation-only: we store and republish source URLs and short
 * snippets, never full third-party page content. The snippet bound is
 * enforced by the adapter, not left to the caller.
 */
export type Citation = {
  url: string;
  title?: string;
  snippet?: string;
};

export type SearchRequest = {
  query: string;
  /** Larger contexts cost materially more — see `pricing.ts`. */
  searchContextSize: "low" | "medium" | "high";
};

export type SearchResponse = {
  text: string;
  citations: Citation[];
  inputTokens: number;
  outputTokens: number;
  requests: number;
};

export interface SearchProvider {
  readonly role: "search";
  readonly name: string;
  search(request: SearchRequest): Promise<ProviderResult<SearchResponse>>;
}

// ---------------------------------------------------------------------------
// Role: keyword data
// ---------------------------------------------------------------------------

/**
 * Measured demand data. Every field here must come from the provider.
 *
 * There is deliberately no "confidence", "estimated", or "source" flag that
 * would let a caller mark a value as inferred: the type offers nowhere to put
 * a model's guess, which is a stronger guarantee than a runtime check.
 */
export type KeywordMetric = {
  keyword: string;
  searchVolume: number;
  competition: number;
  cpcUsd: number;
};

export type KeywordRequest = {
  keywords: string[];
  locationCode: number;
  languageCode: string;
};

export type KeywordResponse = {
  metrics: KeywordMetric[];
  tasks: number;
  items: number;
};

export interface KeywordDataProvider {
  readonly role: "keywordData";
  readonly name: string;
  lookup(request: KeywordRequest): Promise<ProviderResult<KeywordResponse>>;
}

// ---------------------------------------------------------------------------

export type EngineProviders = {
  synthesis: SynthesisProvider;
  search: SearchProvider;
  keywordData: KeywordDataProvider;
};

/**
 * Reads a required server-side secret.
 *
 * `NEXT_PUBLIC_*` is rejected by name, not merely absent from the lookup: a
 * key that reached a client bundle is compromised, and silently accepting one
 * would hide that. Convex functions have no `NEXT_PUBLIC_*` anyway, so this
 * guards the mistake of someone "fixing" a missing key by renaming it.
 */
export function requireSecret(role: ProviderRole, name: string): string {
  if (name.startsWith("NEXT_PUBLIC_")) {
    throw new ProviderConfigError(
      role,
      `${name} is a client-exposed variable and must never hold a provider credential`,
    );
  }
  const value = process.env[name];
  if (value === undefined || value.trim().length === 0) {
    throw new ProviderConfigError(role, `${name} is not set`);
  }
  return value.trim();
}
