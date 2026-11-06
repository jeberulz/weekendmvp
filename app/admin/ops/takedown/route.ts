import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchAction } from "convex/nextjs";
import { ConvexError } from "convex/values";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { classifyHost } from "@/lib/tenant-host";

const jsonError = (status: number, code: string) =>
  Response.json({ ok: false, code }, { status, headers: { "cache-control": "no-store" } });

/**
 * The Convex action authorizes the session and validates the exact site and
 * reason before the Vercel write, then commits the audited state internally.
 */
export async function POST(request: Request) {
  const hostKind = classifyHost(request.headers.get("host")).kind;
  if (hostKind !== "www" && hostKind !== "platform-preview" && hostKind !== "local") {
    return jsonError(404, "NOT_FOUND");
  }
  const origin = request.headers.get("origin");
  if (origin !== new URL(request.url).origin) return jsonError(403, "FORBIDDEN");
  if (!(request.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) {
    return jsonError(415, "UNSUPPORTED_MEDIA_TYPE");
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return jsonError(400, "INVALID_REQUEST");
  }
  if (
    typeof input !== "object" || input === null || Array.isArray(input) ||
    Object.keys(input).length !== 2 ||
    !("siteConfigId" in input) || typeof input.siteConfigId !== "string" ||
    !("reason" in input) || typeof input.reason !== "string"
  ) return jsonError(400, "INVALID_REQUEST");

  const siteConfigId = input.siteConfigId as Id<"site_configs">;
  const reason = input.reason;
  let token: string | null | undefined;
  try {
    token = await convexAuthNextjsToken();
  } catch {
    return jsonError(404, "NOT_FOUND");
  }
  if (!token) return jsonError(404, "NOT_FOUND");

  try {
    const result = await fetchAction(api.platform.sites.takedown.takeDown,
      { siteConfigId, reason }, { token });
    return Response.json({ ok: true, changed: result.changed },
      { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const data: unknown = error instanceof ConvexError ? error.data : null;
    const code = typeof data === "object" && data !== null && "code" in data
      ? data.code : null;
    if (code === "FORBIDDEN" || code === "RESOURCE_NOT_FOUND" || code === "INVALID_TAKEDOWN_REASON") {
      return jsonError(404, "NOT_FOUND");
    }
    if (code === "TAKEDOWN_DENYLIST_UNAVAILABLE") {
      return jsonError(503, "TAKEDOWN_DENYLIST_UNAVAILABLE");
    }
    // A remote deny entry may have been written before a backend failure.
    // Retrying the same action is safe and finishes a pending Convex audit.
    return jsonError(503, "TAKEDOWN_NOT_COMPLETED");
  }
}
