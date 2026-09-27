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
  if (status === 429) {
    return { state: "rate_limited", reason: "HTTP 429" };
  }
  if (status === 403) {
    return { state: "approval_required", reason: "HTTP 403" };
  }
  if (status === 401 || status === 402 || status >= 500) {
    return { state: "unavailable", reason: `HTTP ${status}` };
  }
  return { state: "unavailable", reason: `HTTP ${status}` };
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
  return {
    synthesis: has("OPENAI_API_KEY")
      ? { state: "ready", reason: "OPENAI_API_KEY configured" }
      : { state: "unconfigured", reason: "OPENAI_API_KEY missing" },
    search: has("PERPLEXITY_API_KEY")
      ? { state: "ready", reason: "PERPLEXITY_API_KEY configured" }
      : { state: "unconfigured", reason: "PERPLEXITY_API_KEY missing" },
    keywordData:
      has("DATAFORSEO_LOGIN") && has("DATAFORSEO_PASSWORD")
        ? { state: "ready", reason: "DATAFORSEO credentials configured" }
        : { state: "unconfigured", reason: "DATAFORSEO credentials missing" },
    reddit: redditReady
      ? { state: "ready", reason: "Reddit OAuth credentials configured" }
      : {
          state: "unconfigured",
          reason: "REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET missing",
        },
    hackernews: { state: "ready", reason: "HN API needs no secret" },
    web: { state: "ready", reason: "public HTTP(S) page reads" },
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
  if (
    input.error &&
    typeof input.error === "object" &&
    "status" in input.error &&
    "role" in input.error &&
    typeof (input.error as { status?: unknown }).status === "number" &&
    typeof (input.error as { role?: unknown }).role === "string"
  ) {
    const role = (input.error as { role: string }).role;
    const status = (input.error as { status: number }).status;
    capabilities[role] = capabilityFromHttp(status);
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

export type BatchSpendFile = {
  spentMicroUsd: number;
  runs: number;
};

export function readBatchSpentMicroUsd(filePath: string): number {
  if (!fs.existsSync(filePath)) return 0;
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as {
      spentMicroUsd?: unknown;
    };
    return typeof parsed.spentMicroUsd === "number" &&
      Number.isFinite(parsed.spentMicroUsd) &&
      parsed.spentMicroUsd >= 0
      ? Math.ceil(parsed.spentMicroUsd)
      : 0;
  } catch {
    return 0;
  }
}

export function addBatchSpentMicroUsd(filePath: string, deltaMicroUsd: number): void {
  if (!Number.isFinite(deltaMicroUsd) || deltaMicroUsd <= 0) return;
  const next: BatchSpendFile = {
    spentMicroUsd: readBatchSpentMicroUsd(filePath) + Math.ceil(deltaMicroUsd),
    runs: 0,
  };
  if (fs.existsSync(filePath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as {
        runs?: unknown;
      };
      if (typeof parsed.runs === "number" && parsed.runs >= 0) {
        next.runs = Math.floor(parsed.runs) + 1;
      } else {
        next.runs = 1;
      }
    } catch {
      next.runs = 1;
    }
  } else {
    next.runs = 1;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(next, null, 2)}\n`);
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
