/**
 * WP27-S6. Keeps preview capability tokens out of analytics.
 *
 * Raised by the independent gate review. GA4's automatic `page_view` sends
 * `page_location = document.location.href`, and `/preview/{token}` puts a
 * 256-bit capability — the *entire* authorization for a private preview — in
 * the path. Without redaction, any visitor who had accepted the consent
 * banner exported live tokens to Google and Meta, where they would sit in
 * page-path reports and stay replayable for the capability's full 7-day
 * lifetime.
 *
 * `Referrer-Policy: no-referrer` on `/preview/:token` does not help: the
 * token would be in the analytics request body, not in a `Referer`.
 *
 * Kept in `lib/` rather than beside the component so these stay pure and
 * directly testable from a `node --test` suite — Node can strip TypeScript
 * types but not JSX, so a `.tsx` module cannot be imported there at all.
 */

/**
 * A capability is exactly 64 lowercase hex characters
 * (`convex/platform/preview/capabilities.ts`). Anchored to a full path
 * segment so a shorter or non-hex segment is left untouched.
 */
const CAPABILITY_PATH = /\/preview\/[0-9a-f]{64}(?=$|[/?#])/;

export const REDACTED_PREVIEW_PATH = "/preview/[token]";

/** The query parameter `/preview/{token}` uses to hand off to sign-in. */
export const CLAIM_PARAM = "claimPreview";

export function redactCapabilityPath(pathname: string): string {
  return pathname.replace(CAPABILITY_PATH, REDACTED_PREVIEW_PATH);
}

/** True when this URL carries a secret that must not reach a third party. */
export function urlCarriesCapability(pathname: string, search: string): boolean {
  return (
    CAPABILITY_PATH.test(pathname) ||
    new URLSearchParams(search).has(CLAIM_PARAM)
  );
}

/** The full analytics-safe path: redacted segment, claim parameter removed. */
export function analyticsSafePath(pathname: string, search: string): string {
  const params = new URLSearchParams(search);
  params.delete(CLAIM_PARAM);
  const query = params.toString();
  return `${redactCapabilityPath(pathname)}${query ? `?${query}` : ""}`;
}
