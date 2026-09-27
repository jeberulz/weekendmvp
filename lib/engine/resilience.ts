/**
 * S3: configuration preflight, source capability, reserved-cost settlement,
 * and redacted failure reports. Secret values never leave this module.
 */

import fs from "node:fs";
import path from "node:path";

import type { ProviderCall } from "./research-record.ts";

export const PROVIDER_TIMEOUT_MS = 30_000;
export const MAX_ALTERNATIVE_SEARCHES = 1;
export const RETRY_BACKOFF_MS = 250;

export type SourceCapabilityState =
  | "unconfigured"
  | "approval_required"
  | "ready"
  | "rate_limited"
  | "unavailable";

export type SourceCapability = {
  state: SourceCapabilityState;
  reason: string;
  configured: boolean;
  authorised: boolean;
};

export type PreflightReport = {
  present: string[];
  missing: string[];
  capabilities: Record<string, SourceCapability>;
};

export type FailureReport = {
  slug?: string;
  stepId: string;
  message: string;
  spentMicroUsd: number;
  reservedUnknownMicroUsd: number;
  providerCalls: ProviderCall[];
  capabilities: Record<string, SourceCapability>;
};

const LIVE_SECRET_NAMES = [
  "OPENAI_API_KEY",
  "PERPLEXITY_API_KEY",
  "DATAFORSEO_LOGIN",
  "DATAFORSEO_PASSWORD",
] as const;

const REDDIT_SECRET_NAMES = ["REDDIT_CLIENT_ID", "REDDIT_CLIENT_SECRET"] as const;

export function isRetryableHttpStatus(status: number): boolean {
  if (status === 401 || status === 402 || status === 403) return false;
  return status === 429 || status >= 500;
}

export function capabilityFromHttp(status: number): SourceCapability {
  const observed = { configured: true, authorised: false };
  if (status === 429) {
    return { state: "rate_limited", reason: "HTTP 429", ...observed };
  }
  if (status === 403) {
    return { state: "approval_required", reason: "HTTP 403", ...observed };
  }
  if (status === 401 || status === 402 || status >= 500) {
    return { state: "unavailable", reason: `HTTP ${status}`, ...observed };
  }
  return { state: "unavailable", reason: `HTTP ${status}`, ...observed };
}

export function asJsonObject(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

export function knownNonNegative(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return value;
}

export function redactSecrets(text: string): string {
  return String(text)
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/Basic\s+\S+/gi, "Basic [redacted]")
    .replace(/\b(sk-|pplx-|ib_)[A-Za-z0-9_-]+/g, "[redacted]");
}

type EnvMap = Record<string, string | undefined>;

export function sourceCapabilities(
  env: EnvMap = process.env,
): Record<string, SourceCapability> {
  const has = (name: string) => {
    const value = env[name];
    return typeof value === "string" && value.trim().length > 0;
  };
  const redditReady = has("REDDIT_CLIENT_ID") && has("REDDIT_CLIENT_SECRET");
  const configured = (
    present: boolean,
    missingReason: string,
    configuredReason: string,
  ): SourceCapability =>
    present
      ? {
          state: "ready",
          reason: configuredReason,
          configured: true,
          authorised: false,
        }
      : {
          state: "unconfigured",
          reason: missingReason,
          configured: false,
          authorised: false,
        };
  return {
    synthesis: configured(
      has("OPENAI_API_KEY"),
      "OPENAI_API_KEY missing",
      "OPENAI_API_KEY configured; authorisation not observed",
    ),
    search: configured(
      has("PERPLEXITY_API_KEY"),
      "PERPLEXITY_API_KEY missing",
      "PERPLEXITY_API_KEY configured; authorisation not observed",
    ),
    keywordData: configured(
      has("DATAFORSEO_LOGIN") && has("DATAFORSEO_PASSWORD"),
      "DATAFORSEO credentials missing",
      "DATAFORSEO credentials configured; authorisation not observed",
    ),
    reddit: configured(
      redditReady,
      "REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET missing",
      "Reddit OAuth credentials configured; authorisation not observed",
    ),
    hackernews: {
      state: "ready",
      reason: "HN API needs no secret",
      configured: true,
      authorised: true,
    },
    web: {
      state: "ready",
      reason: "public HTTP(S) page reads",
      configured: true,
      authorised: true,
    },
  };
}

export function preflightLiveConfig(
  env: EnvMap = process.env,
): PreflightReport {
  const present: string[] = [];
  const missing: string[] = [];
  for (const name of LIVE_SECRET_NAMES) {
    const value = env[name];
    if (typeof value === "string" && value.trim()) present.push(name);
    else missing.push(name);
  }
  for (const name of REDDIT_SECRET_NAMES) {
    if (typeof env[name] === "string" && env[name].trim()) present.push(name);
  }
  return {
    present,
    missing,
    capabilities: sourceCapabilities(env),
  };
}

function stepIdFromError(error: unknown): string {
  if (error && typeof error === "object" && "stepId" in error) {
    const stepId = (error as { stepId?: unknown }).stepId;
    if (typeof stepId === "string") return stepId;
  }
  return "run";
}

function providerFailureFrom(error: unknown): {
  role?: string;
  status?: number;
} {
  if (!error || typeof error !== "object") return {};
  const row = error as {
    role?: unknown;
    status?: unknown;
    causeError?: unknown;
  };
  if (typeof row.role === "string" && typeof row.status === "number") {
    return { role: row.role, status: row.status };
  }
  if ("causeError" in row) return providerFailureFrom(row.causeError);
  if (error instanceof Error && error.cause !== undefined) {
    return providerFailureFrom(error.cause);
  }
  return {};
}

export function buildFailureReport(input: {
  slug?: string;
  error: unknown;
  spentMicroUsd: number;
  reservedUnknownMicroUsd: number;
  providerCalls: ProviderCall[];
  capabilities?: Record<string, SourceCapability>;
}): FailureReport {
  const message =
    input.error instanceof Error ? input.error.message : String(input.error);
  const capabilities = { ...(input.capabilities ?? sourceCapabilities()) };
  const provider = providerFailureFrom(input.error);
  if (provider.role && provider.status !== undefined) {
    capabilities[provider.role] = capabilityFromHttp(provider.status);
  }
  return {
    ...(input.slug ? { slug: input.slug } : {}),
    stepId: stepIdFromError(input.error),
    message: redactSecrets(message),
    spentMicroUsd: input.spentMicroUsd,
    reservedUnknownMicroUsd: input.reservedUnknownMicroUsd,
    providerCalls: input.providerCalls,
    capabilities,
  };
}

export function writeFailureReport(filePath: string, report: FailureReport): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(report, null, 2)}\n`);
}

export function alternativeCommunityQuery(brief: {
  title: string;
  audience: string;
  model?: string;
}): string {
  return [
    `Idea: ${brief.title}`,
    `Audience: ${brief.audience}`,
    brief.model ? `Business model: ${brief.model}` : "",
    "",
    "Find pain evidence from Hacker News and public vendor or community forums.",
    "Do not use Reddit.",
    "Copy short VERBATIM quotes (do not rewrite) and link each source.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function fetchInitWithTimeout(
  init: RequestInit = {},
  timeoutMs = PROVIDER_TIMEOUT_MS,
): RequestInit {
  return { ...init, signal: init.signal ?? AbortSignal.timeout(timeoutMs) };
}
