/// <reference types="vite/client" />

import { describe, expect, test } from "vitest";
import homeSource from "../../components/platform/shell/SignedInHome.tsx?raw";
import errorSource from "../../app/dashboard/error.tsx?raw";
import { isValidPlatformConvexUrl } from "../../lib/platform-convex-url";

describe("signed-in home states", () => {
  test("renders cold pick, Day 1 canvas, and Day n URL without cockpit furniture", () => {
    expect(homeSource).toContain("Pick one idea.");
    expect(homeSource).toContain("Preview this idea");
    expect(homeSource).toContain("HomeCanvas");
    expect(homeSource).toContain("PublishPacket");
    expect(homeSource).toContain("PreviewTemplateRenderer");
    expect(homeSource).not.toContain("Welcome back");
    expect(homeSource).not.toContain("Move one idea forward");
    expect(homeSource).not.toContain("No projects yet.");
    expect(homeSource).not.toContain("Supported shortcuts");
    expect(homeSource).not.toContain("/dashboard/new");
    expect(homeSource).not.toContain("For you");
    expect(homeSource).not.toContain("creditBalance");
  });

  test("provides a non-destructive route error state", () => {
    expect(errorSource).toContain('role="alert"');
    expect(errorSource).toContain("No action was taken");
    expect(errorSource).toContain("Try again");
    expect(errorSource).not.toContain("Your workspace could not be loaded");
  });

  test("shows an explicit state for missing Convex URLs", () => {
    expect(homeSource).toContain("HomeConfigurationError");
    expect(homeSource).toContain("Home data is unavailable");
    expect(homeSource).toContain("missing or invalid");
    expect(homeSource).toContain(
      "isValidPlatformConvexUrl(process.env.NEXT_PUBLIC_CONVEX_URL)",
    );
    expect(isValidPlatformConvexUrl(undefined)).toBe(false);
    expect(isValidPlatformConvexUrl("https://example.convex.cloud")).toBe(true);
  });
});
