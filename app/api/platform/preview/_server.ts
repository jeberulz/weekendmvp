import { createHmac } from "node:crypto";

/**
 * WP27-S2 server helpers for anonymous preview generation.
 *
 * Mirrors the billing bridge in `app/api/platform/billing/_server.ts`: HMAC
 * over the exact serialized payload, base64url signature. Kept in its own
 * module so the pure functions are unit-testable without a request.
 */

type PreviewEnvironment = Readonly<Record<string, string | undefined>>;

export const MIN_BRIDGE_SECRET_LENGTH = 32;

export function readPreviewBridgeSecret(
  environment: PreviewEnvironment,
): string {
  const secret = environment.PLATFORM_PREVIEW_BRIDGE_SECRET;
  if (!secret || secret.length < MIN_BRIDGE_SECRET_LENGTH) {
    throw new Error("PREVIEW_BRIDGE_NOT_CONFIGURED");
  }
  return secret;
}

export function signPreviewPayload(payload: object, bridgeSecret: string) {
  const serialized = JSON.stringify(payload);
  return {
    payload: serialized,
    signature: createHmac("sha256", bridgeSecret)
      .update(serialized)
      .digest("base64url"),
  };
}

const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;
const IPV6 = /^[0-9a-f:]{2,45}$/i;

/**
 * Accepts only something that actually looks like an IP.
 *
 * A length check alone is not enough: it lets a caller mint effectively
 * unlimited distinct bucket keys, which inflates the limiter's tables and
 * dilutes every bucket. Shape-validating collapses all junk into the single
 * shared `unknown` bucket instead.
 */
function normalizeIp(value: string | null): string | null {
  const first = value?.split(",")[0]?.trim();
  if (!first) return null;
  if (IPV4.test(first)) {
    return first.split(".").every((part) => Number(part) <= 255) ? first : null;
  }
  return IPV6.test(first) ? first.toLowerCase() : null;
}

/**
 * Derives the rate-limit key from the client IP.
 *
 * Header trust is the whole game here. `x-forwarded-for` is client-settable
 * and is only trustworthy when an edge overwrites it, so it is checked
 * *after* `x-vercel-forwarded-for`, which Vercel's edge sets and a client
 * cannot forge through it. Preferring XFF would let any caller pick their
 * own bucket with a single header — unlimited generation by rotating it, or
 * a targeted lockout by pinning a victim's IP.
 *
 * Off Vercel (local dev, self-host, or any direct-to-origin path) `x-real-ip`
 * and XFF remain spoofable. That residual is accepted rather than hidden:
 * the bridge secret is what prevents direct Convex access, and an
 * unparseable or absent header degrades to one shared bucket — more
 * limiting, never unlimited.
 */
export function clientRateLimitKey(headers: Headers): string {
  const trusted = normalizeIp(headers.get("x-vercel-forwarded-for"));
  if (trusted) return `ip:${trusted}`;
  const forwarded = normalizeIp(headers.get("x-forwarded-for"));
  if (forwarded) return `ip:${forwarded}`;
  const realIp = normalizeIp(headers.get("x-real-ip"));
  if (realIp) return `ip:${realIp}`;
  return "ip:unknown";
}

/**
 * Same-origin gate for the preview API.
 *
 * WP27-S4 carried this over from S2, where the check read
 * `PLATFORM_BILLING_APP_ORIGIN` — a billing-named variable governing a
 * preview route — and skipped entirely when it was unset, so the default
 * deployment ran with no gate at all and nothing said so.
 *
 * This version never silently skips. When an `Origin` header is present it
 * is always compared against something: the explicitly configured
 * `PLATFORM_PREVIEW_APP_ORIGIN` when set, otherwise the request's own `Host`.
 * Host is the right fallback because a browser sets it from the URL being
 * fetched, so a page on another site cannot make it match ours; page script
 * cannot forge either header. An absent `Origin` (curl, server-to-server)
 * still passes, which is deliberate — this is defence in depth against the
 * drive-by browser case, and the bridge signature remains the real
 * authority. An unparseable `Origin`, or one with no `Host` to compare
 * against, fails closed.
 */
export function isAllowedPreviewOrigin(
  headers: Headers,
  environment: PreviewEnvironment,
): boolean {
  const origin = headers.get("origin");
  if (!origin) return true;

  const configured = environment.PLATFORM_PREVIEW_APP_ORIGIN;
  if (configured) return origin === configured;

  const host = headers.get("host");
  if (!host) return false;
  try {
    return new URL(origin).host.toLowerCase() === host.toLowerCase();
  } catch {
    return false;
  }
}

export type PreviewGenerateRequest = {
  slug: string;
  templateId: string;
  customisation: unknown;
};

export function parsePreviewGenerateRequest(
  value: unknown,
): PreviewGenerateRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("INVALID_PREVIEW_REQUEST");
  }
  const candidate = value as Record<string, unknown>;
  const allowed = new Set(["slug", "templateId", "customisation"]);
  // Reject unknown keys outright rather than ignoring them, matching the
  // billing request parser: a request carrying fields we do not model is a
  // signal something is wrong, not something to silently drop.
  if (Object.keys(candidate).some((key) => !allowed.has(key))) {
    throw new Error("INVALID_PREVIEW_REQUEST");
  }
  if (
    typeof candidate.slug !== "string" ||
    !/^[a-z0-9][a-z0-9-]{0,120}$/.test(candidate.slug) ||
    typeof candidate.templateId !== "string"
  ) {
    throw new Error("INVALID_PREVIEW_REQUEST");
  }
  return {
    slug: candidate.slug,
    templateId: candidate.templateId,
    customisation: candidate.customisation,
  };
}
