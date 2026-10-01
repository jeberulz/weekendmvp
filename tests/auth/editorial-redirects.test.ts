import { describe, expect, test } from "vitest";

import { safeAuthRedirect } from "@/convex/auth";
import { createResendMagicLinkEmail } from "@/convex/resendMagicLink";
import { authCallbackTarget, safePlatformReturn } from "@/lib/auth-return";
import { isEditorialPath, isOperatorPath, isPrivateReturnPath } from "@/lib/private-paths";

/*
 * WP46-E4e. "Confirm it's you" signs in again and must come back to the
 * editorial page, so the three post-sign-in allowlists (Next.js, Convex Auth
 * redirects, the email link) accept `/admin/editorial` — and nothing else new.
 */

const siteUrl = "https://app.example.test";

function magicLinkReturn(path: string): string | null {
  const { link } = createResendMagicLinkEmail({
    identifier: "owner@example.test",
    token: "opaque-test-token",
    verificationUrl: `${siteUrl}${path}${path.includes("?") ? "&" : "?"}code=opaque-test-token`,
    siteUrl,
    from: "Weekend MVP <auth@example.test>",
  });
  return new URL(link).searchParams.get("returnTo");
}

describe("private path rules", () => {
  test.each([
    ["/dashboard", true],
    ["/dashboard/projects/one", true],
    ["/admin/editorial", true],
    ["/admin/editorial/ideas/idea_x", true],
    ["/admin", false],
    ["/admin/other", false],
    ["/admin/editorialish", false],
    ["/admin/editorial%2F..", false],
    ["/dashboardish", false],
  ])("returning to %s is %s", (pathname, allowed) => {
    expect(isPrivateReturnPath(pathname)).toBe(allowed);
  });

  test("operator and editorial paths", () => {
    expect(isOperatorPath("/admin")).toBe(true);
    expect(isOperatorPath("/admin/editorial/ideas/x")).toBe(true);
    expect(isOperatorPath("/administrator")).toBe(false);
    expect(isEditorialPath("/admin/editorial")).toBe(true);
    expect(isEditorialPath("/admin/editorial-old")).toBe(false);
    expect(isEditorialPath("/admin")).toBe(false);
  });
});

describe("post-sign-in allowlists accept the editorial workspace only", () => {
  test.each([
    ["/admin/editorial", "/admin/editorial"],
    ["/admin/editorial/ideas/idea_x?revision=rev_y&tab=review", "/admin/editorial/ideas/idea_x?revision=rev_y&tab=review"],
    ["/admin/other", "/dashboard"],
    ["/admin/editorialish", "/dashboard"],
    ["/admin/editorial/../../signin", "/dashboard"],
    ["https://evil.example/admin/editorial", "/dashboard"],
    ["//evil.example/admin/editorial", "/dashboard"],
    ["/admin/editorial\\@evil.example", "/dashboard"],
  ])("Next.js return %s → %s", (target, expected) => {
    expect(safePlatformReturn(target)).toBe(expected);
  });

  test("the Google callback carries an editorial return target and nothing else", () => {
    const callback = authCallbackTarget("/admin/editorial/ideas/idea_x");
    expect(callback).toBe("/auth/callback?returnTo=%2Fadmin%2Feditorial%2Fideas%2Fidea_x");
    expect(safeAuthRedirect(callback)).toBe(callback);
    expect(safeAuthRedirect("/auth/callback?returnTo=%2Fadmin%2Fother")).toBe("/auth/callback?returnTo=%2Fdashboard");
  });

  test.each([
    ["/admin/editorial/settings", "/admin/editorial/settings"],
    ["/admin/other", "/dashboard"],
    ["https://evil.example/admin/editorial", "/dashboard"],
  ])("Convex Auth redirect %s → %s", (target, expected) => {
    expect(safeAuthRedirect(target)).toBe(expected);
  });

  test.each([
    ["/admin/editorial/ideas/idea_x?tab=review", "/admin/editorial/ideas/idea_x?tab=review"],
    ["/admin/other", "/dashboard"],
  ])("email link return %s → %s", (path, expected) => {
    expect(magicLinkReturn(path)).toBe(expected);
  });
});
