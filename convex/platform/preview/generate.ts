import { RateLimiter, MINUTE, HOUR } from "@convex-dev/rate-limiter";
import { ConvexError, v } from "convex/values";
import { components } from "../../_generated/api";
import { env, mutation } from "../../_generated/server";
import {
  capabilityExpiresAt,
  generateCapabilityToken,
  hashCapabilityToken,
} from "./capabilities";
import {
  normalizePreviewCustomisation,
  toSiteInput,
} from "./customisation";
import {
  SITE_RENDER_SPEC_CONTRACT_VERSION,
  isPreviewTemplate,
  serializeSiteRenderSpec,
} from "./renderSpec";

/**
 * WP27-S2. Anonymous preview generation.
 *
 * This is the only endpoint in the platform where an unauthenticated
 * stranger causes server-side artifact creation, so it is gated twice:
 *
 * 1. An HMAC bridge signature proves the call came from our Next.js route.
 *    Convex mutations cannot observe a client IP, so the per-IP limit has to
 *    live in the Next layer; without this gate that limit would be bypassable
 *    by calling Convex directly. Same design as the billing bridge, but
 *    verified with Web Crypto rather than `node:crypto` so it can run in a
 *    mutation instead of forcing a `"use node"` action plus an extra hop.
 * 2. A durable per-IP rate limit via `@convex-dev/rate-limiter`, keyed on the
 *    IP the Next route observed and passed through inside the signed payload
 *    — so the key itself cannot be forged without the secret.
 */

const rateLimiter = new RateLimiter(components.rateLimiter, {
  // Short burst ceiling, then a slower sustained ceiling. Generation is
  // cheap (one row, no provider spend), so these bound spam rather than
  // cost, and are deliberately generous enough not to punish a real visitor
  // iterating on their copy.
  previewGenerationBurst: { kind: "token bucket", rate: 5, period: MINUTE },
  previewGenerationSustained: { kind: "token bucket", rate: 40, period: HOUR },
});

const MAX_BRIDGE_PAYLOAD_BYTES = 8_192;

function bridgeSecret(): string {
  const secret = env.PLATFORM_PREVIEW_BRIDGE_SECRET;
  // Fails closed. An unset secret must never mean "skip verification".
  if (!secret || secret.length < 32) {
    throw new ConvexError({ code: "PREVIEW_BRIDGE_NOT_CONFIGURED" });
  }
  return secret;
}

function decodeBase64Url(value: string): ArrayBuffer {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

/**
 * `crypto.subtle.verify` performs the comparison itself and is constant
 * time, so there is no separate timing-safe compare to get wrong.
 */
async function verifyBridgeSignature(
  payload: string,
  signature: string,
): Promise<void> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(bridgeSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  let supplied: ArrayBuffer;
  try {
    supplied = decodeBase64Url(signature);
  } catch {
    throw new ConvexError({ code: "INVALID_PREVIEW_BRIDGE_SIGNATURE" });
  }
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    supplied,
    new TextEncoder().encode(payload),
  );
  if (!valid) {
    throw new ConvexError({ code: "INVALID_PREVIEW_BRIDGE_SIGNATURE" });
  }
}

type BridgePayload = {
  slug: string;
  templateId: string;
  clientKey: string;
  customisation: unknown;
};

function parseBridgePayload(payload: string): BridgePayload {
  if (payload.length > MAX_BRIDGE_PAYLOAD_BYTES) {
    throw new ConvexError({ code: "INVALID_PREVIEW_BRIDGE_PAYLOAD" });
  }
  let value: unknown;
  try {
    value = JSON.parse(payload);
  } catch {
    throw new ConvexError({ code: "INVALID_PREVIEW_BRIDGE_PAYLOAD" });
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ConvexError({ code: "INVALID_PREVIEW_BRIDGE_PAYLOAD" });
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.slug !== "string" ||
    typeof record.templateId !== "string" ||
    typeof record.clientKey !== "string" ||
    record.clientKey.length === 0
  ) {
    throw new ConvexError({ code: "INVALID_PREVIEW_BRIDGE_PAYLOAD" });
  }
  return {
    slug: record.slug,
    templateId: record.templateId,
    clientKey: record.clientKey,
    customisation: record.customisation,
  };
}

/**
 * Consumes generation quota in its own transaction.
 *
 * This is deliberately a *separate* mutation from `generateFromBridge`, not
 * a step inside it. Convex mutations are transactional and the rate limiter
 * stores its counters in the same database, so quota consumed inside a
 * mutation that later throws is rolled back along with everything else. If
 * the limit lived in the generation mutation, every failing request —
 * unknown slug, invalid field, oversized document — would refund its own
 * quota, leaving slug probing and compute abuse effectively unlimited while
 * only *successful* generation was bounded.
 *
 * Because this commits independently, a failed generation still costs the
 * caller quota, which is the behaviour the limit exists to provide.
 */
export const consumeGenerationQuota = mutation({
  args: { payload: v.string(), signature: v.string() },
  handler: async (ctx, args) => {
    await verifyBridgeSignature(args.payload, args.signature);
    const bridge = parseBridgePayload(args.payload);
    await rateLimiter.limit(ctx, "previewGenerationBurst", {
      key: bridge.clientKey,
      throws: true,
    });
    await rateLimiter.limit(ctx, "previewGenerationSustained", {
      key: bridge.clientKey,
      throws: true,
    });
    return { ok: true as const };
  },
});

/**
 * Public because an anonymous visitor's request must reach it, but callable
 * in practice only by a holder of the bridge secret. Returns the plaintext
 * token exactly once; it is never stored and never re-derivable.
 *
 * Quota is consumed by `consumeGenerationQuota` before this runs. Callers
 * must not reorder that: this mutation intentionally contains no rate limit,
 * because any limit inside it would be refunded by its own failures.
 */
export const generateFromBridge = mutation({
  args: { payload: v.string(), signature: v.string() },
  handler: async (ctx, args) => {
    await verifyBridgeSignature(args.payload, args.signature);
    const bridge = parseBridgePayload(args.payload);

    if (!isPreviewTemplate(bridge.templateId)) {
      throw new ConvexError({ code: "UNKNOWN_PREVIEW_TEMPLATE" });
    }

    const idea = await ctx.db
      .query("ideas")
      .withIndex("by_slug", (q) => q.eq("slug", bridge.slug))
      .unique();
    if (idea === null) {
      throw new ConvexError({ code: "IDEA_NOT_FOUND" });
    }

    const customisation = normalizePreviewCustomisation(bridge.customisation);
    // Only ever persisted through the serializer, so the contract round-trip
    // and the byte ceiling both hold. A direct JSON.stringify here would
    // silently skip both.
    const renderSpec = serializeSiteRenderSpec({
      contractVersion: SITE_RENDER_SPEC_CONTRACT_VERSION,
      templateId: bridge.templateId,
      siteInput: toSiteInput(customisation),
    });

    const token = generateCapabilityToken();
    const tokenHash = await hashCapabilityToken(token);
    // Server clock, never a client-supplied timestamp: a caller who chose
    // `now` would choose their own expiry window.
    const now = Date.now();

    await ctx.db.insert("preview_capabilities", {
      tokenHash,
      sourceIdeaId: idea._id,
      templateId: bridge.templateId,
      renderSpec,
      expiresAt: capabilityExpiresAt(now),
      createdAt: now,
    });

    return { token };
  },
});
