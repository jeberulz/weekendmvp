import { describe, expect, test } from "vitest";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { config, publicIdeaSlug } from "../../middleware";
import {
  IDEA_REQUESTS_PATH,
  authRouteDecision,
  isAuthManagedPath,
  safePlatformReturn,
} from "../../lib/auth-return";
import { safeAuthRedirect } from "../../convex/auth";
import panelSource from "../../components/idea-requests/IdeaRequestPanel.tsx?raw";
import widgetSource from "../../components/idea-requests/IdeaRequestWidget.tsx?raw";
import requestsPageSource from "../../app/ideas/requests/page.tsx?raw";

/**
 * Idea 4 — /ideas/requests is for account holders only.
 *
 * Root cause of the live 404: middleware's publicIdeaSlug() treated any
 * /ideas/<slug> except /ideas/today as an idea slug, so "requests" went
 * through the editorial visibility gate and was 404ed before Next ever
 * reached the static page. The fix exempts /ideas/requests from that
 * gate and puts the page behind signup instead.
 */
describe("idea requests route is not an idea slug", () => {
  test("publicIdeaSlug exempts /ideas/requests (and /ideas/today)", () => {
    expect(publicIdeaSlug("/ideas/requests")).toBeNull();
    expect(publicIdeaSlug("/ideas/today")).toBeNull();
  });

  test("publicIdeaSlug still treats real idea slugs as slugs", () => {
    expect(publicIdeaSlug("/ideas/freelance-scope-creep-detector")).toBe(
      "freelance-scope-creep-detector",
    );
    expect(publicIdeaSlug("/ideas/example")).toBe("example");
    expect(publicIdeaSlug("/image/og/idea/example.png")).toBe("example");
  });

  test("middleware still runs for /ideas/requests", () => {
    expect(
      unstable_doesMiddlewareMatch({
        config,
        url: "https://www.weekendmvp.app/ideas/requests",
      }),
    ).toBe(true);
  });
});

describe("idea requests auth gate", () => {
  test("the page is an auth-managed path", () => {
    expect(IDEA_REQUESTS_PATH).toBe("/ideas/requests");
    expect(isAuthManagedPath("/ideas/requests")).toBe(true);
  });

  test("anonymous visitors are sent to signup, not login, with returnTo", () => {
    expect(
      authRouteDecision(new URL("https://www.weekendmvp.app/ideas/requests"), false),
    ).toEqual({
      kind: "redirect",
      target: "/signup?returnTo=%2Fideas%2Frequests",
    });
  });

  test("signed-in visitors pass through to the page", () => {
    expect(
      authRouteDecision(new URL("https://www.weekendmvp.app/ideas/requests"), true),
    ).toEqual({ kind: "next" });
  });

  test("real idea slugs are still public, not signup-gated", () => {
    expect(
      authRouteDecision(new URL("https://www.weekendmvp.app/ideas/example"), false),
    ).toEqual({ kind: "next" });
    expect(
      authRouteDecision(new URL("https://www.weekendmvp.app/ideas/today"), false),
    ).toEqual({ kind: "next" });
  });

  test("the signup returnTo survives every auth redirect layer", () => {
    expect(safePlatformReturn("/ideas/requests")).toBe("/ideas/requests");
    expect(safeAuthRedirect("/ideas/requests")).toBe("/ideas/requests");
    expect(safeAuthRedirect("/auth/callback?returnTo=%2Fideas%2Frequests")).toBe(
      "/auth/callback?returnTo=%2Fideas%2Frequests",
    );
  });

  test("unsafe lookalikes of the requests path still collapse to /dashboard", () => {
    expect(safePlatformReturn("/ideas/requests/extra")).toBe("/dashboard");
    expect(safePlatformReturn("/ideas/requests?e=a@b.test")).toBe("/dashboard");
    expect(safePlatformReturn("/ideas/../dashboard")).toBe("/dashboard");
  });
});

describe("idea requests panel is signed-in only", () => {
  test("anonymous visitors get a create-account CTA, not the form", () => {
    expect(panelSource).toContain("Create a free account");
    expect(panelSource).toContain("/signup?returnTo=%2Fideas%2Frequests");
    expect(panelSource).toContain("/login?returnTo=%2Fideas%2Frequests");
    // The sentence wraps across lines in the JSX source, so assert the
    // two halves that each sit on one line.
    expect(panelSource).toContain("only for users who have created an");
    expect(panelSource).toContain("Create a free account and tell us what to research next");
  });

  test("the panel no longer has an anonymous voter path", () => {
    expect(panelSource).not.toContain("getOrCreateAnonymousId");
    expect(panelSource).not.toContain("anonymousId");
  });

  test("the widget character is unchanged", () => {
    expect(widgetSource).toContain("DEFAULT_WIDGET_AVATAR_SRC");
    expect(widgetSource).toContain("avatarSrc");
    // The widget still opens the panel; the panel itself gates anonymous.
    expect(widgetSource).toContain("IdeaRequestPanel");
  });

  test("the requests page is marked noindex", () => {
    expect(requestsPageSource).toContain("index: false");
    expect(requestsPageSource).toContain("follow: false");
  });
});
