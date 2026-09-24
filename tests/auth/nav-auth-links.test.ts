import { describe, expect, test } from "vitest";
import { hasConvexAuthSessionCookie } from "../../components/layout/NavAuthLinks";

describe("nav auth session cookie heuristic", () => {
  test.each([
    ["__convexAuthJWT=abc", true],
    ["foo=1; __Host-__convexAuthJWT=abc; bar=2", true],
    ["__convexAuthRefreshToken=only-refresh", false],
    ["", false],
    ["unrelated=1", false],
  ])("detects session from %s", (cookie, expected) => {
    expect(hasConvexAuthSessionCookie(cookie)).toBe(expected);
  });
});
