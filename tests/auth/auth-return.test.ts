import { describe, expect, test } from "vitest";
import {
  authRouteDecision,
  authCallbackTarget,
  DEFAULT_AUTH_RETURN,
  isAuthManagedPath,
  isSensitiveAuthPath,
  safePlatformReturn,
} from "../../lib/auth-return";

describe("auth redirect allowlist", () => {
  test.each([
    undefined,
    "",
    "https://evil.example/dashboard",
    "//evil.example/dashboard",
    "/signin",
    "/login",
    "/dashboard\\@evil.example",
    "/dashboardish",
  ])("maps an unsafe target to the bounded default: %s", (target) => {
    expect(safePlatformReturn(target)).toBe(DEFAULT_AUTH_RETURN);
  });

  test.each([
    ["/dashboard", "/dashboard"],
    ["/dashboard/projects/one", "/dashboard/projects/one"],
    [
      "/dashboard/projects/one?tab=preview#status",
      "/dashboard/projects/one?tab=preview#status",
    ],
  ])("allows a platform dashboard target", (target, expected) => {
    expect(safePlatformReturn(target)).toBe(expected);
  });

  test("constructs a dedicated callback without exposing an external target", () => {
    expect(authCallbackTarget("https://evil.example/steal")).toBe(
      "/auth/callback?returnTo=%2Fdashboard",
    );
  });
});

describe("sensitive auth route analytics policy", () => {
  test.each([
    "/email-signin",
    "/email-signin/confirm",
    "/auth/callback",
    "/auth/callback/error",
  ])("suppresses analytics on %s", (pathname) => {
    expect(isSensitiveAuthPath(pathname)).toBe(true);
  });

  test.each(["/signin", "/login", "/signup", "/dashboard", "/auth/callbackish"])(
    "does not classify %s as a token-bearing auth route",
    (pathname) => {
      expect(isSensitiveAuthPath(pathname)).toBe(false);
    },
  );
});

describe("auth managed paths", () => {
  test.each(["/login", "/signup", "/signin", "/auth/callback", "/dashboard"])(
    "manages %s",
    (pathname) => {
      expect(isAuthManagedPath(pathname)).toBe(true);
    },
  );
});

describe("auth middleware route matrix", () => {
  test.each([
    ["https://www.weekendmvp.app/dashboard", false, "/login?returnTo=%2Fdashboard"],
    [
      "https://www.weekendmvp.app/dashboard/project?tab=build",
      false,
      "/login?returnTo=%2Fdashboard%2Fproject%3Ftab%3Dbuild",
    ],
    [
      "https://www.weekendmvp.app/dashboard/report.js",
      false,
      "/login?returnTo=%2Fdashboard%2Freport.js",
    ],
    ["https://www.weekendmvp.app/login", true, "/dashboard"],
    ["https://www.weekendmvp.app/signup", true, "/dashboard"],
    ["https://www.weekendmvp.app/signin", true, "/dashboard"],
    [
      "https://www.weekendmvp.app/auth/callback?returnTo=%2Fdashboard%2Fproject",
      true,
      "/dashboard/project",
    ],
  ])("redirects %s when authenticated=%s", (url, authenticated, target) => {
    expect(authRouteDecision(new URL(url), authenticated)).toEqual({
      kind: "redirect",
      target,
    });
  });

  test.each([
    ["https://www.weekendmvp.app/ideas/example", false],
    ["https://www.weekendmvp.app/login", false],
    ["https://www.weekendmvp.app/signup", false],
    ["https://www.weekendmvp.app/signin", false],
    ["https://www.weekendmvp.app/dashboard", true],
  ])("passes %s when authenticated=%s", (url, authenticated) => {
    expect(authRouteDecision(new URL(url), authenticated)).toEqual({
      kind: "next",
    });
  });
});
