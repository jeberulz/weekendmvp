/**
 * WP71-S1. Transport helpers shared by the adapters: deadlines, HTTP status
 * classification and body decoding. No network access of its own.
 */

import type { MeterProvider } from "../../../lib/workspace/contracts/metering";
import { ProviderError, type ProviderErrorKind } from "./types";

/** The image endpoints, shared by the adapters and their fixtures. */
export const OPENAI_IMAGES_ENDPOINT = "https://api.openai.com/v1/images/generations";
export const RECRAFT_ENDPOINT = "https://external.api.recraft.ai/v1/images/generations";

/**
 * The longest deadline an adapter accepts: 9 minutes, under the 10-minute
 * Convex action limit (and the 15-minute realtime sweep window).
 */
export const MAX_TIMEOUT_MS = 9 * 60 * 1_000;

export type Deadline = {
  /** Aborts when the deadline fires or the parent signal aborts. */
  readonly signal: AbortSignal;
  readonly timedOut: () => boolean;
  readonly parentAborted: () => boolean;
  readonly clear: () => void;
};

/**
 * Starts a deadline of `timeoutMs`, linked to an optional parent signal.
 * Throws `config` (billed `none`) for a non-positive or oversized timeout —
 * every call must be bounded, so the C-METER reservation cannot outlive it —
 * and for a parent signal that is already aborted: nothing has been sent.
 */
export function startDeadline(provider: MeterProvider, timeoutMs: number, parent?: AbortSignal): Deadline {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > MAX_TIMEOUT_MS) {
    throw new ProviderError(provider, "config", `timeoutMs must be an integer in 1..${MAX_TIMEOUT_MS}, got ${timeoutMs}`);
  }
  if (parent?.aborted) {
    throw new ProviderError(provider, "config", "the call was cancelled before it was sent", {
      billed: "none",
      cause: parent.reason,
    });
  }
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort(new Error(`deadline of ${timeoutMs} ms passed`));
  }, timeoutMs);
  const onParentAbort = () => controller.abort(parent?.reason);
  parent?.addEventListener("abort", onParentAbort, { once: true });
  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    parentAborted: () => parent?.aborted === true && !timedOut,
    clear: () => {
      clearTimeout(timer);
      parent?.removeEventListener("abort", onParentAbort);
    },
  };
}

/**
 * The error kind for a non-2xx HTTP status:
 * 401/403 auth, 408 timeout, 429 rate limit, 5xx server, other 4xx bad request.
 *
 * 5xx (529 overloaded included) stays billed `possible` (`types.ts`
 * `DEFAULT_BILLED`): the conservative C-METER rule, so the meter charges the
 * reservation. Most 5xx replies are probably unbilled, and charging them can
 * lock a Free owner out early; that policy question is recorded for the owner.
 * Do not relax it here without that ruling.
 */
export function kindForHttpStatus(status: number): ProviderErrorKind {
  if (status === 401 || status === 403) return "auth";
  if (status === 408) return "timeout";
  if (status === 429) return "rate_limit";
  if (status >= 500) return "server";
  return "bad_request";
}

/**
 * The error for a request that left but got no usable HTTP reply: our
 * deadline (`timeout`), the caller's abort (`aborted`), or a network failure.
 * All three are billed `possible`.
 */
export function noReplyError(provider: MeterProvider, deadline: Deadline, cause: unknown): ProviderError {
  if (deadline.timedOut()) {
    return new ProviderError(provider, "timeout", "the provider did not answer before the deadline", { cause });
  }
  if (deadline.parentAborted()) {
    return new ProviderError(provider, "aborted", "the call was cancelled after it was sent", { cause });
  }
  return new ProviderError(provider, "network", "the request failed before a reply arrived", { cause });
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A reported count, or null when absent or not a safe non-negative integer. */
export function tokenCount(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

/** Decodes standard base64 without Node's `Buffer` (Convex's default runtime has none). */
export function decodeBase64(data: string): Uint8Array {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** The 8-byte PNG signature. */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function isPng(bytes: Uint8Array): boolean {
  return bytes.length > PNG_SIGNATURE.length && PNG_SIGNATURE.every((byte, i) => bytes[i] === byte);
}

const utf8 = new TextEncoder();

export function utf8Bytes(text: string): number {
  return utf8.encode(text).byteLength;
}
