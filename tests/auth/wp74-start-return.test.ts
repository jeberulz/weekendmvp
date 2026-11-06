import { describe, expect, test } from "vitest";

import { safeAuthRedirect } from "../../convex/auth";
import { DEFAULT_AUTH_RETURN, authCallbackTarget, authRouteDecision, safePlatformReturn } from "../../lib/auth-return";
import { hasDotSegmentInTarget, isAllowedAuthReturnPath, isBareReturnPath, isWizardReturnPath } from "../../lib/private-paths";
import { buildHref, isBuildCtaSlug } from "../../lib/workspace/build-cta";

/**
 * WP74-S5: a sign-in may return to `/start/{slug}` and nowhere else outside the
 * private app. The allowlist is shared by the Next.js check, the Convex Auth
 * redirect callback and the magic-link mailer, so each is tested.
 */

const ATTACKS = [
  "https://evil.example/start/hydrotrail",
  "//evil.example/start/hydrotrail",
  "///evil.example/start/hydrotrail",
  "/\\evil.example/start/hydrotrail",
  "/start/hydrotrail\\@evil.example",
  "/start/../dashboard",
  "/start/..%2f..%2fevil",
  "/start/%2e%2e/evil",
  "/start/hydrotrail/extra",
  "/start/hydrotrail/",
  "/start/",
  "/start",
  "/start/Hydrotrail",
  "/start/hydro_trail",
  "/start/-hydrotrail",
  "/startup/hydrotrail",
  "/start//evil.example",
  "javascript:alert(1)",
  "/start/hydrotrail?next=https://evil.example",
  "/start/own",
  "/start/./hydrotrail",
  "/start/%2e/hydrotrail",
  "/start/%2E%2e/start/hydrotrail",
  "/start/../start/hydrotrail",
  "/start/hydrotrail/..",
  "/start/hydrotrail/%2e%2e/hydrotrail",
  "/./start/hydrotrail",
  "/start/hydrotrail?e=reader@example.test",
  "/start/hydrotrail#token=secret",
];

describe("returnTo for the wizard", () => {
  test("accepts a canonical wizard path and keeps it exactly", () => {
    expect(safePlatformReturn("/start/hydrotrail")).toBe("/start/hydrotrail");
    expect(safePlatformReturn(buildHref("meal-planner-2"))).toBe("/start/meal-planner-2");
    expect(authCallbackTarget("/start/hydrotrail")).toBe("/auth/callback?returnTo=%2Fstart%2Fhydrotrail");
    expect(safeAuthRedirect("/start/hydrotrail")).toBe("/start/hydrotrail");
    expect(safeAuthRedirect("/auth/callback?returnTo=%2Fstart%2Fhydrotrail")).toBe("/auth/callback?returnTo=%2Fstart%2Fhydrotrail");
  });

  test.each(ATTACKS)("an open-redirect or malformed target collapses to the default: %s", (target) => {
    expect(safePlatformReturn(target)).toBe(DEFAULT_AUTH_RETURN);
    expect(authCallbackTarget(target)).toBe("/auth/callback?returnTo=%2Fdashboard");
    expect(safeAuthRedirect(target)).toBe("/dashboard");
    expect(safeAuthRedirect(`/auth/callback?returnTo=${encodeURIComponent(target)}`)).toBe(
      "/auth/callback?returnTo=%2Fdashboard",
    );
  });

  test("the path rules", () => {
    expect(isWizardReturnPath("/start/hydrotrail")).toBe(true);
    expect(isWizardReturnPath("/start/own")).toBe(false);
    expect(isWizardReturnPath("/start/owned-by-me")).toBe(true);
    expect(isWizardReturnPath("/start/%2e%2e/dashboard")).toBe(false);
    expect(isWizardReturnPath("/start/../start/x")).toBe(false);
    expect(hasDotSegmentInTarget("/start/../start/x?a=1")).toBe(true);
    expect(hasDotSegmentInTarget("/ideas/v1.2-tool")).toBe(false);
    expect(hasDotSegmentInTarget("/ideas/x?next=/../a")).toBe(false);
    expect(isWizardReturnPath("/start/a/b")).toBe(false);
    expect(isAllowedAuthReturnPath("/start/hydrotrail")).toBe(true);
    expect(isAllowedAuthReturnPath("/start")).toBe(false);
    expect(isBareReturnPath("/ideas/hydrotrail")).toBe(true);
    expect(isBareReturnPath("/dashboard")).toBe(false);
  });

  test("a signed-in visitor on the sign-in page is sent to the wizard, a bad target to the dashboard", () => {
    expect(authRouteDecision(new URL("https://x.test/login?returnTo=%2Fstart%2Fhydrotrail"), true)).toEqual({
      kind: "redirect",
      target: "/start/hydrotrail",
    });
    expect(authRouteDecision(new URL("https://x.test/login?returnTo=https%3A%2F%2Fevil.example"), true)).toEqual({
      kind: "redirect",
      target: "/dashboard",
    });
  });

  test("the idea and dashboard rules are unchanged", () => {
    expect(safePlatformReturn("/ideas/hydrotrail")).toBe("/ideas/hydrotrail");
    expect(safePlatformReturn("/ideas/hydrotrail?e=a@b.test")).toBe(DEFAULT_AUTH_RETURN);
    expect(safePlatformReturn("/dashboard/b/abc?tab=x")).toBe("/dashboard/b/abc?tab=x");
  });
});

describe("which slugs get a CTA", () => {
  test("a library slug does, an engine draft or a malformed slug does not", () => {
    expect(isBuildCtaSlug("hydrotrail")).toBe(true);
    expect(isBuildCtaSlug("engine-draft-secret")).toBe(false);
    expect(isBuildCtaSlug("")).toBe(false);
    expect(isBuildCtaSlug("Has Caps")).toBe(false);
    expect(isBuildCtaSlug("a/b")).toBe(false);
    expect(isBuildCtaSlug(undefined)).toBe(false);
  });
});
