/**
 * Canonical path cleaner for one-hop redirects.
 *
 * Pure string helper — safe for Edge middleware and Node tests.
 * Does not touch host; callers decide whether to force www.
 */

/** Strip trailing slash (except `/`) then `.html` / `.htm`, then `/index`. */
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

  // Collapse a trailing `/index` segment so dirty legacy URLs land on the
  // parent in one hop: `/startup-ideas/index.html` → `/startup-ideas`,
  // not `/startup-ideas/index` (which 404s). Also covers root `/index.html`.
  if (path.toLowerCase().endsWith("/index")) {
    path = path.slice(0, -"/index".length) || "/";
  }

  return path || "/";
}

/**
 * Path aliases that must resolve in the same hop as slash/.html cleaning
 * so apex + dirty + rename never becomes a redirect chain.
 *
 * `/ideas` is the pre-archive index; the live archive is `/startup-ideas`.
 * Idea detail URLs stay at `/ideas/{slug}`.
 */
export function aliasPath(pathname: string): string {
  if (pathname === "/ideas") return "/startup-ideas";
  return pathname;
}

/** Clean + alias. The destination path for a one-hop canonical redirect. */
export function canonicalPath(pathname: string): string {
  return aliasPath(cleanPath(pathname));
}

export function pathNeedsCleaning(pathname: string): boolean {
  return cleanPath(pathname) !== pathname;
}

/** True when the request path is not yet the canonical destination path. */
export function pathNeedsRedirect(pathname: string): boolean {
  return canonicalPath(pathname) !== pathname;
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
