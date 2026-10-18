/**
 * Lovable (Impact.com) affiliate tracking.
 *
 * John approved routing every clickable lovable.dev outbound through this
 * single Impact vanity URL. Deep linking via Impact's documented `u=` param
 * is NOT used here: Impact allows `u=` only when the brand permits deep
 * linking for the ad, and that permission is not confirmed for this program.
 * Every outbound therefore lands on the plain affiliate URL.
 *
 * @see https://help.impact.com/partner/what-would-you-like-to-learn-about/platform-features/tracking/tracking-links/create-and-manage-links/create-a-deep-link-for-an-ad
 * @see https://help.impact.com/partner/what-would-you-like-to-learn-about/platform-features/tracking/tracking-links/create-and-manage-links/add-reporting-information-to-your-tracking-links
 */

/** Impact.com vanity tracking link for the Lovable partner program. */
export const LOVABLE_AFFILIATE_URL = "https://lovablelabs.pxf.io/m4320e" as const;

/**
 * Site already uses `noopener noreferrer` on external nav links
 * (`NavExternalLink`). Keep noreferrer; add `sponsored` for affiliate clicks.
 */
export const LOVABLE_AFFILIATE_REL = "sponsored noopener noreferrer" as const;

/** Hostnames treated as Lovable outbound destinations (apex + docs). */
const LOVABLE_HOSTS = new Set([
  "lovable.dev",
  "www.lovable.dev",
  "docs.lovable.dev",
]);

/** True when `href` is an absolute http(s) link to a Lovable host. */
export function isLovableOutboundUrl(href: string | null | undefined): boolean {
  if (!href) return false;
  try {
    const url = new URL(href);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    return LOVABLE_HOSTS.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * Resolve an outbound href: Lovable destinations become the affiliate URL;
 * everything else is unchanged. Deep-link destinations are intentionally
 * ignored until the Lovable program clearly allows Impact `u=` overrides.
 */
export function resolveLovableAffiliateHref(
  href: string | null | undefined,
): string | null | undefined {
  if (href == null) return href;
  return isLovableOutboundUrl(href) ? LOVABLE_AFFILIATE_URL : href;
}
