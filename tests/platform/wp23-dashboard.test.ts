/// <reference types="vite/client" />

import { describe, expect, test } from "vitest";
import dashboardSource from "../../components/platform/shell/DashboardHome.tsx?raw";
import errorSource from "../../app/dashboard/error.tsx?raw";
import { isValidPlatformConvexUrl } from "../../lib/platform-convex-url";

describe("WP23 dashboard states", () => {
  test("renders loading and educational empty states without invented metrics", () => {
    expect(dashboardSource).toContain("DashboardSkeleton");
    expect(dashboardSource).toContain("No projects yet.");
    expect(dashboardSource).toContain("Nothing saved or marked Interested yet.");
    expect(dashboardSource).not.toContain("progress percentage");
    expect(dashboardSource).not.toContain("revenue");
  });

  test("maps the bounded composer to explicit routes", () => {
    expect(dashboardSource).toContain("Supported shortcuts");
    expect(dashboardSource).toContain("they do not run an autonomous agent");
    expect(dashboardSource).toContain('href="/dashboard/explore"');
    expect(dashboardSource).toContain('href="/dashboard/new"');
  });

  test("provides a non-destructive route error state", () => {
    expect(errorSource).toContain('role="alert"');
    expect(errorSource).toContain("No action was taken");
    expect(errorSource).toContain("Try again");
  });

  test("shows an explicit state for missing or malformed Convex URLs", () => {
    expect(dashboardSource).toContain("DashboardConfigurationError");
    expect(dashboardSource).toContain("Workspace data is unavailable");
    expect(dashboardSource).toContain("missing or invalid");
    expect(dashboardSource).toContain(
      "isValidPlatformConvexUrl(process.env.NEXT_PUBLIC_CONVEX_URL)",
    );
    expect(isValidPlatformConvexUrl(undefined)).toBe(false);
    expect(isValidPlatformConvexUrl("not-a-url")).toBe(false);
    expect(isValidPlatformConvexUrl("ftp://example.test")).toBe(false);
    expect(isValidPlatformConvexUrl("https://example.convex.site")).toBe(false);
    expect(
      isValidPlatformConvexUrl(" https://example.convex.cloud"),
    ).toBe(false);
    expect(
      isValidPlatformConvexUrl("https://example.convex.cloud "),
    ).toBe(false);
    expect(isValidPlatformConvexUrl("https://example.convex.cloud")).toBe(
      true,
    );
    expect(isValidPlatformConvexUrl("http://localhost:3210")).toBe(true);
    expect(isValidPlatformConvexUrl("http://127.0.0.1:3210")).toBe(true);
  });
});
