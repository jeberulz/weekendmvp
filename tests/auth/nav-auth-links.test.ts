import { describe, expect, test } from "vitest";
import {
  hasSessionHintCookie,
  SESSION_HINT_COOKIE,
} from "../../lib/auth-session-cookie";

describe("nav auth session hint", () => {
  test.each([
    [`${SESSION_HINT_COOKIE}=1`, true],
    [`foo=1; ${SESSION_HINT_COOKIE}=1; bar=2`, true],
    [`${SESSION_HINT_COOKIE}=0`, false],
    [`x${SESSION_HINT_COOKIE}=1`, false],
    ["", false],
    ["unrelated=1", false],
  ])("detects a session from %s", (cookie, expected) => {
    expect(hasSessionHintCookie(cookie)).toBe(expected);
  });

  test("never depends on the httpOnly Convex Auth cookie", () => {
    // `document.cookie` cannot contain `__convexAuthJWT`: Convex Auth sets it
    // httpOnly. Only the middleware-written hint is visible to page scripts.
    expect(hasSessionHintCookie("__Host-__convexAuthJWT=abc")).toBe(false);
  });
});
