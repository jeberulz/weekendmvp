/// <reference types="vite/client" />

import { afterEach, describe, expect, test, vi } from "vitest";
import dashboardLayoutSource from "../../app/dashboard/layout.tsx?raw";
import dashboardPageSource from "../../app/dashboard/page.tsx?raw";
import savedCountSource from "../../components/platform/shell/SavedCount.tsx?raw";
import nextConfigSource from "../../next.config.ts?raw";
import {
  DASHBOARD_NEWEST_COUNT,
  toDashboardEditorial,
} from "../../lib/dashboard/editorial-map";
import type { HomeData, IndexRow, SpotlightIdea } from "../../lib/home/types";
import { DASHBOARD_EVENT_PROPS, trackDashboardEvent } from "../../lib/track";

function row(n: number): IndexRow {
  return {
    slug: `idea-${n}`,
    title: `Idea ${n}`,
    category: "automation",
    categoryName: "Automation",
    buildTime: 12,
    revenueGoal: "5k-month",
    libraryNo: n,
    art: null,
  };
}

const spotlight = { slug: "weekly-pick", title: "Weekly pick" } as SpotlightIdea;

const home = {
  totals: { ideas: 228, averageHours: 11, categories: [], tools: {} },
  week: { label: "21–27 Sep", start: "2026-09-21T00:00:00.000Z" },
  newest: [228, 227, 226, 225, 224, 223, 222, 221].map(row),
  spotlight,
} as unknown as HomeData;

describe("WP44-S3 editorial data", () => {
  test("uses the homepage's weekly pick, total and newest ideas", () => {
    const editorial = toDashboardEditorial(home);

    expect(editorial.weekly).toBe(home.spotlight);
    expect(editorial.total).toBe(228);
    expect(editorial.week).toBe(home.week);
    expect(editorial.newest.map((r) => r.slug)).toEqual(
      home.newest.slice(0, DASHBOARD_NEWEST_COUNT).map((r) => r.slug),
    );
    expect(editorial.newest).toHaveLength(5);
  });

  test("the layout passes the library total to the shell", () => {
    expect(dashboardLayoutSource).toContain("await getDashboardEditorial()");
    expect(dashboardLayoutSource).toContain("ideaCount={editorial?.total ?? null}");
  });

  test("idea files are traced into every dashboard function", () => {
    expect(nextConfigSource).toContain(
      '"/dashboard": ["./content/ideas/**/*.mdx", "./ideas/manifest.json"]',
    );
    expect(nextConfigSource).toContain(
      '"/dashboard/**": ["./content/ideas/**/*.mdx", "./ideas/manifest.json"]',
    );
  });
});

describe("WP44-S3 server rendering", () => {
  test("no Convex hook on the dashboard page runs on the server", () => {
    const gate = dashboardPageSource.indexOf("<WhenConvexReady>");
    const runner = dashboardPageSource.indexOf("<PreviewClaimRunner />");
    const close = dashboardPageSource.indexOf("</WhenConvexReady>");
    expect(gate).toBeGreaterThan(-1);
    expect(runner).toBeGreaterThan(gate);
    expect(close).toBeGreaterThan(runner);
  });

  test("the nav count is gated and cannot take the shell down", () => {
    expect(savedCountSource).toContain("<WhenConvexReady>");
    expect(savedCountSource).toContain("<QuietErrorBoundary>");
    expect(savedCountSource).toContain("useQuery(api.platform.dashboard.home)");
  });
});

describe("WP44-S3 dashboard events", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("forwards only allowlisted props", () => {
    const gtag = vi.fn();
    vi.stubGlobal("window", { gtag });

    trackDashboardEvent({
      name: "offer_dismissed",
      props: { offer_id: "starter-kit", kind: "starter_kit", email: "leak@example.test" } as never,
    });

    expect(gtag).toHaveBeenCalledWith("event", "offer_dismissed", {
      offer_id: "starter-kit",
      kind: "starter_kit",
    });
  });

  test("covers every PRD section 10 event and no free-text keys", () => {
    expect(Object.keys(DASHBOARD_EVENT_PROPS).sort()).toEqual(
      [
        "dashboard_viewed",
        "explore_state_changed",
        "offer_clicked",
        "offer_dismissed",
        "offer_viewed",
        "prompt_copied",
        "setup_completed",
        "setup_skipped",
        "upgrade_clicked",
        "upgrade_prompt_viewed",
        "weekend_plan_started",
        "weekend_step_completed",
      ].sort(),
    );
    const keys = Object.values(DASHBOARD_EVENT_PROPS).flat();
    for (const key of keys) {
      expect(key).not.toMatch(/email|name|note|text|title|query|url/i);
    }
  });

  test("is a no-op before consent loads GA", () => {
    vi.stubGlobal("window", {});
    expect(() =>
      trackDashboardEvent({ name: "setup_skipped", props: {} }),
    ).not.toThrow();
  });
});
