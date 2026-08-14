import { describe, expect, test } from "vitest";
import {
  authRouteDecision,
  authCallbackTarget,
  DEFAULT_AUTH_RETURN,
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
    "/dashboard\\@evil.example",
    "/dashboardish",
  ])("maps an unsafe target to the bounded default: %s", (target) => {
    expect(safePlatformReturn(target)).toBe(DEFAULT_AUTH_RETURN);
  });

  test.each([
    ["/dashboard", "/dashboard"],
    ["/dashboard/explore", "/dashboard/explore"],
    ["/dashboard/billing", "/dashboard"],
    ["/dashboard/new", "/dashboard"],
    ["/dashboard/projects", "/dashboard"],
    ["/dashboard/projects/one", "/dashboard?project=one"],
    ["/dashboard/explore?view=saved", "/dashboard/explore"],
    ["/dashboard/explore?view=interested", "/dashboard/explore"],
    [
      "/dashboard/explore?q=cart",
      "/dashboard/explore?q=cart",
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

  test.each(["/signin", "/dashboard", "/auth/callbackish"])(
    "does not classify %s as a token-bearing auth route",
    (pathname) => {
      expect(isSensitiveAuthPath(pathname)).toBe(false);
    },
  );
});

describe("auth middleware route matrix", () => {
  test.each([
    [
      "https://www.weekendmvp.app/dashboard/billing",
      false,
      "/signin?returnTo=%2Fdashboard",
    ],
    [
      "https://www.weekendmvp.app/dashboard/explore?view=saved",
      false,
      "/signin?returnTo=%2Fdashboard%2Fexplore",
    ],
    [
      "https://www.weekendmvp.app/dashboard/project?tab=build",
      false,
      "/signin?returnTo=%2Fdashboard%2Fproject%3Ftab%3Dbuild",
    ],
    [
      "https://www.weekendmvp.app/dashboard/report.js",
      false,
      "/signin?returnTo=%2Fdashboard%2Freport.js",
    ],
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
    ["https://www.weekendmvp.app/signin", false],
    ["https://www.weekendmvp.app/dashboard", true],
  ])("passes %s when authenticated=%s", (url, authenticated) => {
    expect(authRouteDecision(new URL(url), authenticated)).toEqual({
      kind: "next",
    });
  });
});
