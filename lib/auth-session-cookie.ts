/**
 * Readable hint that a Convex Auth session is present, for marketing nav CTAs.
 *
 * Convex Auth sets its session JWT `httpOnly`, so page scripts cannot read
 * it. `syncSessionHintCookie` in `middleware.ts` mirrors its presence into
 * this cookie, which avoids mounting the auth provider on every public page.
 * Not an authorization check — `/dashboard` middleware still gates access.
 */
export const SESSION_HINT_COOKIE = "wmvp_signed_in";

export function hasSessionHintCookie(cookieSource: string) {
  return cookieSource
    .split(";")
    .some((part) => part.trim() === `${SESSION_HINT_COOKIE}=1`);
}
