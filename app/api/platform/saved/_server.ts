import { isIdeaSlug } from "../../../../lib/pending-save";

/**
 * WP44-S6. Pure request checks for the idea-page Save endpoint, kept apart
 * from the route so tests can load them without Next or Convex.
 */

export const NO_STORE = { "Cache-Control": "private, no-store" } as const;

/**
 * Writes must come from our own pages. Session cookies are SameSite=Lax,
 * which already keeps cross-site POSTs anonymous. This refuses them outright.
 */
export function isSameOriginWrite(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (origin === null) return false;
  let expected: string;
  try {
    expected = new URL(request.url).origin;
  } catch {
    return false;
  }
  const site = request.headers.get("sec-fetch-site");
  if (site !== null && site !== "same-origin") return false;
  return origin === expected;
}

export function parseSlugParam(url: string): string | null {
  try {
    const slug = new URL(url).searchParams.get("slug");
    return isIdeaSlug(slug) ? slug : null;
  } catch {
    return null;
  }
}

export function parseSaveBody(body: unknown): { slug: string; saved: boolean } | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  const { slug, saved } = body as Record<string, unknown>;
  if (!isIdeaSlug(slug) || typeof saved !== "boolean") return null;
  return { slug, saved };
}
