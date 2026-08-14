export const SITE_URL_CONFIGURATION_ERROR =
  "Unable to complete sign-in.";

const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Return the trusted application origin used by auth redirects and email links.
 * Production origins must use HTTPS; plain HTTP is limited to an explicitly
 * named loopback host for local development. Credentials are never accepted.
 */
export function validatedSiteOrigin(value: string | undefined) {
  if (!value?.trim()) throw new Error(SITE_URL_CONFIGURATION_ERROR);

  let site: URL;
  try {
    site = new URL(value);
  } catch {
    throw new Error(SITE_URL_CONFIGURATION_ERROR);
  }

  const secure = site.protocol === "https:";
  const explicitLoopback =
    site.protocol === "http:" && LOOPBACK_HOSTNAMES.has(site.hostname);
  if (
    (!secure && !explicitLoopback) ||
    site.username !== "" ||
    site.password !== ""
  ) {
    throw new Error(SITE_URL_CONFIGURATION_ERROR);
  }

  return site.origin;
}
