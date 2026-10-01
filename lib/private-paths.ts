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

/** The editorial workspace, open only to the bound super-admin. */
export function isEditorialPath(pathname: string): boolean {
  return underPrefix(pathname, "/admin/editorial");
}
