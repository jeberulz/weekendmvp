/**
 * Canonical path cleaner for one-hop redirects.
 *
 * Pure string helper — safe for Edge middleware and Node tests.
 * Does not touch host; callers decide whether to force www.
 */

/** Strip trailing slash (except `/`) then `.html` / `.htm`. */
export function cleanPath(pathname: string): string {
  let path = pathname || "/";

  if (path.length > 1 && path.endsWith("/")) {
    path = path.slice(0, -1);
  }

  const lower = path.toLowerCase();
  if (lower.endsWith(".html")) {
    path = path.slice(0, -5);
  } else if (lower.endsWith(".htm")) {
    path = path.slice(0, -4);
  }

  // /index.html → /index → /
  if (path.toLowerCase() === "/index") {
    path = "/";
  }

  return path || "/";
}

export function pathNeedsCleaning(pathname: string): boolean {
  return cleanPath(pathname) !== pathname;
}

/** Production hosts that participate in apex↔www canonicalization. */
export const PROD_APEX_HOST = "weekendmvp.app";
export const PROD_WWW_HOST = "www.weekendmvp.app";

export function isProdApexHost(host: string): boolean {
  return host.toLowerCase() === PROD_APEX_HOST;
}

export function isProdWwwHost(host: string): boolean {
  return host.toLowerCase() === PROD_WWW_HOST;
}
