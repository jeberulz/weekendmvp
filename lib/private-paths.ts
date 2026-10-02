/**
 * Private path rules shared by middleware, the analytics loader and the
 * post-sign-in redirect allowlists (in Next.js and in Convex Auth). Pure
 * functions over an already parsed, normalised pathname.
 */

/** Where a sign-in may return to: the member dashboard and the editorial workspace (WP46-E4e). */
const PRIVATE_RETURN_PREFIXES = ["/dashboard", "/admin/editorial"] as const;

function underPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isPrivateReturnPath(pathname: string): boolean {
  return PRIVATE_RETURN_PREFIXES.some((prefix) => underPrefix(pathname, prefix));
}

/** Operator surfaces: never indexed, cached, referred from or measured by analytics. */
export function isOperatorPath(pathname: string): boolean {
  return underPrefix(pathname, "/admin");
}

function operatorPrefix(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/") || pathname.startsWith("/admin.");
}

/**
 * Any request for the operator area as middleware sees it, including Next.js
 * transport forms such as `/admin/editorial.segments/_tree.segment` (a
 * prerendered segment payload) that the path rules above do not match, and
 * percent-encoded spellings such as `/%61dmin/editorial` in case a router
 * decodes before matching. Middleware gates and marks every one of them.
 */
export function isOperatorRequestPath(pathname: string): boolean {
  if (operatorPrefix(pathname)) return true;
  try {
    return operatorPrefix(decodeURIComponent(pathname));
  } catch {
    return false;
  }
}

/** The editorial workspace, open only to the bound super-admin. */
export function isEditorialPath(pathname: string): boolean {
  return underPrefix(pathname, "/admin/editorial");
}
