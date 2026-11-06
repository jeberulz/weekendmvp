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

/** Only canonical idea destinations are admitted outside the private app. */
export function isIdeaReturnPath(pathname: string): boolean {
  return pathname === "/startup-ideas" || /^\/ideas\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(pathname);
}

/**
 * WP74-S5: the build wizard for one library idea, `/start/{slug}`. The slug has
 * the same shape as an idea slug. `/start/own` is not a library idea and is
 * refused. Nothing may follow the slug, and a dot segment is refused as written.
 */
export function isWizardReturnPath(pathname: string): boolean {
  if (hasDotSegment(pathname)) return false;
  const match = /^\/start\/([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(pathname);
  return match !== null && match[1] !== "own";
}

/**
 * True when the path part of a raw return target (before any `?` or `#`) has
 * a `.` or `..` segment. `new URL()` would quietly normalise it
 * (`/start/../start/x` becomes `/start/x`), so callers check the raw string
 * first and refuse the target.
 */
export function hasDotSegmentInTarget(value: string): boolean {
  return hasDotSegment(value.split(/[?#]/, 1)[0] ?? "");
}

/** A `.` or `..` segment, raw or percent-encoded: refused, never normalised. */
function hasDotSegment(pathname: string): boolean {
  return pathname
    .split("/")
    .some((segment) => /^(?:\.|%2e){1,2}$/i.test(segment));
}

/**
 * Return paths that keep their pathname only: a query or fragment on them
 * collapses to the default (an `?e=` email, a token or a tracking tail never
 * rides through sign-in).
 */
export function isBareReturnPath(pathname: string): boolean {
  return isIdeaReturnPath(pathname) || isWizardReturnPath(pathname);
}

/**
 * Build-Along checkout return: signed-out buyers who click Buy go through
 * magic-link / Google, then straight back to the paid ticket page.
 */
export function isLiveWorkshopReturnPath(pathname: string): boolean {
  return pathname === "/live/build-along";
}

export function isAllowedAuthReturnPath(pathname: string): boolean {
  return (
    isPrivateReturnPath(pathname) ||
    isIdeaReturnPath(pathname) ||
    isWizardReturnPath(pathname) ||
    isLiveWorkshopReturnPath(pathname)
  );
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
