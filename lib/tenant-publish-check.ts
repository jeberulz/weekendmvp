/**
 * WP28-S4. Best-effort "is this tenant host live?" check for middleware.
 *
 * Why this exists: WP28's gate criterion is "unknown tenant is 404", and a
 * route cannot deliver it. Under `cacheComponents`, PPR flushes a 200 shell
 * before `notFound()` runs, so an unpublished tenant host answered 200 with a
 * not-found body — a soft 404 that search engines penalise and keep indexed.
 * Middleware runs before the route and can set a real status, so the check has
 * to happen here.
 *
 * **It fails open, deliberately.** This lookup is not an authorization
 * boundary: `app/site/[slug]/page.tsx` independently resolves the site and
 * refuses to render anything unpublished. So when Convex is unreachable, a
 * timeout fires, or the response is malformed, this returns `null` and
 * middleware serves the route exactly as it did before — degrading to a soft
 * 404 rather than taking every customer site offline on one backend blip.
 * Failing closed here would turn a status-code improvement into a
 * total-outage risk.
 */

/** Convex resolves in single-digit milliseconds; this only bounds the tail. */
const TIMEOUT_MS = 1500;

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

export type PublishCheck = true | false | null;

/**
 * `true` published, `false` definitively not published, `null` unknown.
 * Only `false` is strong enough to answer a 404.
 */
export async function checkTenantSitePublished(
  hostname: string,
): Promise<PublishCheck> {
  if (!CONVEX_URL) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${CONVEX_URL}/api/query`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        path: "platform/sites/read:isPublished",
        args: { hostname },
        format: "json",
      }),
      signal: controller.signal,
    });
    if (!response.ok) return null;

    const payload: unknown = await response.json();
    if (
      typeof payload !== "object" ||
      payload === null ||
      !("status" in payload) ||
      payload.status !== "success" ||
      !("value" in payload) ||
      typeof payload.value !== "boolean"
    ) {
      // Anything unrecognised is "unknown", never "not published".
      return null;
    }
    return payload.value;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
