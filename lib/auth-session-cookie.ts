/**
 * Heuristic session presence for marketing nav CTAs.
 * Full Convex Auth is scoped to platform routes; reading the host-only JWT
 * cookie name avoids mounting the auth provider on every public page.
 * Not an authorization check — `/dashboard` middleware still gates access.
 */
export function hasConvexAuthSessionCookie(cookieSource: string) {
  return /(?:^|;\s)(?:__Host-)?__convexAuthJWT=/.test(cookieSource);
}
