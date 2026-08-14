import { isRateLimitError } from "@convex-dev/rate-limiter";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { classifyHost, tenantHostForSlug } from "@/lib/tenant-host";
import { clientRateLimitKey } from "../../platform/preview/_server";
import { validateLeadBody } from "./_server";

/**
 * WP28-S5. The only lead-write path on a published tenant site.
 *
 * Reachable **only** through the middleware rewrite from `/__lead` on a
 * tenant host; `/api/tenant/lead` is 404ed on every platform host, exactly
 * like `/site/*`. The tenant hostname is re-derived here from the `Host`
 * header rather than trusted from the rewrite, so the route is safe even if
 * the rewrite were ever reachable another way.
 *
 * This layer exists because Convex mutations cannot observe a client IP. It
 * derives the rate-limit key from request headers and passes it through.
 *
 * WP28 stores no real lead (owner ruling 2026-08-07), so the body is
 * validated for personal data and **refused** rather than stripped.
 */

function jsonError(status: number, code: string) {
  return Response.json({ ok: false, code }, { status });
}

export async function POST(request: Request) {
  // Requiring JSON blocks the CORS "simple request" shapes (text/plain,
  // form-encoded), so a third-party page cannot drive lead writes from its
  // visitors' browsers — per-IP limiting cannot stop that on its own, because
  // those are thousands of genuine distinct IPs.
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return jsonError(415, "UNSUPPORTED_MEDIA_TYPE");
  }

  // The hostname is derived from the request, never from the body or the
  // rewritten path. Everything about ownership follows from it.
  const classification = classifyHost(request.headers.get("host"));
  if (classification.kind !== "tenant") {
    return jsonError(404, "NOT_FOUND");
  }
  const hostname = tenantHostForSlug(classification.slug);
  if (hostname === null) {
    return jsonError(404, "NOT_FOUND");
  }

  // Same-origin gate, defence in depth. A tenant site's own page is the only
  // legitimate caller, so the `Origin` must match the tenant host itself —
  // never a platform origin.
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host.toLowerCase() !== hostname) {
        return jsonError(403, "CROSS_ORIGIN_FORBIDDEN");
      }
    } catch {
      return jsonError(403, "CROSS_ORIGIN_FORBIDDEN");
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "TENANT_LEAD_MALFORMED");
  }

  const verdict = validateLeadBody(body);
  if (!verdict.ok) {
    // Refused, not stripped. Accepting the request and discarding the email
    // would leave the customer believing capture works.
    return jsonError(verdict.status, verdict.code);
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return jsonError(503, "TENANT_LEAD_UNAVAILABLE");
  }

  try {
    const client = new ConvexHttpClient(convexUrl);
    await client.mutation(api.platform.sites.leads.recordSynthetic, {
      hostname,
      rateLimitKey: clientRateLimitKey(request.headers),
    });
  } catch (error) {
    if (isRateLimitError(error)) {
      return jsonError(429, "RATE_LIMITED");
    }
    // An unpublished or unknown site arrives here as the same generic
    // refusal the public resolver gives, so this endpoint cannot be used to
    // enumerate which tenant sites are live.
    return jsonError(404, "NOT_FOUND");
  }

  // Nothing about the lead is echoed back, and nothing is logged. The
  // response is a bare acknowledgement.
  return Response.json({ ok: true }, { status: 202 });
}
