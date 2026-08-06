import { isRateLimitError } from "@convex-dev/rate-limiter";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import {
  clientRateLimitKey,
  isAllowedPreviewOrigin,
  parsePreviewGenerateRequest,
  readPreviewBridgeSecret,
  signPreviewPayload,
} from "../_server";

/**
 * WP27-S2. The only path to anonymous preview generation.
 *
 * This layer exists because Convex mutations cannot observe a client IP.
 * It derives the rate-limit key from request headers, signs it into the
 * bridge payload so the key cannot be forged, and hands off to Convex —
 * which refuses any call lacking a valid signature.
 */

function jsonError(status: number, code: string) {
  return Response.json({ ok: false, code }, { status });
}

export async function POST(request: Request) {
  // Requiring JSON blocks the CORS "simple request" shapes (text/plain,
  // form-encoded), so a third-party page cannot drive generation from its
  // visitors' browsers. Per-IP limiting is structurally unable to stop that
  // on its own, because those are thousands of genuine, distinct IPs.
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return jsonError(415, "UNSUPPORTED_MEDIA_TYPE");
  }

  // Same-origin gate, defence in depth only — NOT the primary control; the
  // bridge signature is. The check itself no longer borrows billing's
  // origin variable and no longer disappears when nothing is configured:
  // see `isAllowedPreviewOrigin`.
  if (!isAllowedPreviewOrigin(request.headers, process.env)) {
    return jsonError(403, "CROSS_ORIGIN_FORBIDDEN");
  }

  let input: ReturnType<typeof parsePreviewGenerateRequest>;
  try {
    input = parsePreviewGenerateRequest(await request.json());
  } catch {
    return jsonError(400, "INVALID_PREVIEW_REQUEST");
  }

  let bridgeSecret: string;
  try {
    bridgeSecret = readPreviewBridgeSecret(process.env);
  } catch {
    // Fails closed: an unconfigured bridge means no previews, never
    // unprotected ones.
    return jsonError(503, "PREVIEW_NOT_CONFIGURED");
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) return jsonError(503, "PREVIEW_NOT_CONFIGURED");

  const signed = signPreviewPayload(
    {
      slug: input.slug,
      templateId: input.templateId,
      clientKey: clientRateLimitKey(request.headers),
      customisation: input.customisation,
    },
    bridgeSecret,
  );

  try {
    const convex = new ConvexHttpClient(convexUrl);
    // Two calls, deliberately. Quota is consumed in its own committed
    // transaction first, so a subsequent generation failure cannot refund
    // it. Folding this into the generation mutation would make every
    // failing request free, which is exactly the abuse path.
    await convex.mutation(
      api.platform.preview.generate.consumeGenerationQuota,
      signed,
    );
    const { token } = await convex.mutation(
      api.platform.preview.generate.generateFromBridge,
      signed,
    );
    return Response.json({ ok: true, token });
  } catch (error) {
    // Use the component's own type guard rather than string-matching a code
    // whose shape could change under us. `retryAfter` is surfaced so a
    // client can back off correctly instead of hammering.
    if (isRateLimitError(error)) {
      return Response.json(
        { ok: false, code: "RATE_LIMITED" },
        {
          status: 429,
          headers: {
            "retry-after": String(Math.ceil(error.data.retryAfter / 1000)),
          },
        },
      );
    }
    const code =
      error && typeof error === "object" && "data" in error
        ? ((error.data as { code?: string })?.code ?? "PREVIEW_FAILED")
        : "PREVIEW_FAILED";
    // Map only what the client can act on. Everything else collapses to a
    // generic failure so internal detail never reaches an anonymous caller
    // — including whether the bridge secret was the thing that was wrong.
    if (code === "IDEA_NOT_FOUND") return jsonError(404, code);
    if (
      code === "INVALID_PREVIEW_FIELD" ||
      code === "INVALID_PREVIEW_CUSTOMISATION" ||
      code === "UNKNOWN_PREVIEW_TEMPLATE"
    ) {
      return jsonError(400, code);
    }
    return jsonError(500, "PREVIEW_FAILED");
  }
}
