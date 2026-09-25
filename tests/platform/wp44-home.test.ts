/// <reference types="vite/client" />

import { describe, expect, test } from "vitest";
import dashboardPageSource from "../../app/dashboard/page.tsx?raw";
import loadingSource from "../../app/dashboard/loading.tsx?raw";
import errorSource from "../../app/dashboard/error.tsx?raw";
import homeSource from "../../components/platform/home/DashboardHome.tsx?raw";
import greetingSource from "../../components/platform/home/Greeting.tsx?raw";
import nextStepSource from "../../components/platform/home/NextStepCard.tsx?raw";
import weeklySource from "../../components/platform/home/WeeklyPick.tsx?raw";
import picksSource from "../../components/platform/home/PickedForYou.tsx?raw";
import newestSource from "../../components/platform/home/NewestIdeas.tsx?raw";
import railSource from "../../components/platform/home/HomeRail.tsx?raw";
import saveSource from "../../components/platform/home/SaveIdeaButton.tsx?raw";
import scoreMetersSource from "../../components/platform/explore/ScoreMeters.tsx?raw";
import statesSource from "../../components/platform/home/module-states.tsx?raw";
import shellSource from "../../components/platform/shell/WorkspaceShell.tsx?raw";
import {
  MODULE_ERROR_COPY,
  dateLine,
  greeting,
  isoWeek,
  nextStep,
  viewedState,
  statusLine,
  timeOfDay,
} from "../../components/platform/home/home-copy";
import { isValidPlatformConvexUrl } from "../../lib/platform-convex-url";

const homeSources = {
  homeSource,
  greetingSource,
  nextStepSource,
  weeklySource,
  picksSource,
  newestSource,
  railSource,
  saveSource,
  statesSource,
  loadingSource,
  errorSource,
};

describe("WP44-S4 greeting copy", () => {
  test("names the time of day in the member's local hours", () => {
    expect(timeOfDay(4)).toBe("evening");
    expect(timeOfDay(5)).toBe("morning");
    expect(timeOfDay(11)).toBe("morning");
    expect(timeOfDay(12)).toBe("afternoon");
    expect(timeOfDay(17)).toBe("afternoon");
    expect(timeOfDay(18)).toBe("evening");
  });

  test("uses the first name, and no comma when there is none", () => {
    expect(greeting(20, "John")).toBe("Good evening, John.");
    expect(greeting(9, null)).toBe("Good morning.");
  });

  test("prints the date line with the ISO week", () => {
    expect(dateLine(new Date(2026, 8, 24))).toBe("Thu 24 Sep · Week 39");
    expect(isoWeek(new Date(2021, 0, 1))).toBe(53);
    expect(isoWeek(new Date(2026, 0, 1))).toBe(1);
    expect(isoWeek(new Date(2026, 11, 31))).toBe(53);
  });

  test("counts saved ideas and names the weekend", () => {
    expect(statusLine({ count: 0, capped: false }, 4)).toBe("Let’s find an idea worth your weekend.");
    expect(statusLine({ count: 1, capped: false }, 4)).toBe("1 saved idea. Your weekend starts Friday.");
    expect(statusLine({ count: 4, capped: false }, 5)).toBe("4 saved ideas. Your weekend starts tonight.");
    expect(statusLine({ count: 99, capped: true }, 6)).toBe("99+ saved ideas. It’s Saturday. Build day.");
    expect(statusLine({ count: 2, capped: false }, 0)).toBe("2 saved ideas. It’s Sunday. Ship day.");
  });

  test("module 1 asks the setup questions, then starts, then shortlists", () => {
    const fresh = { savedCount: 0, setupDone: false, setupSkipped: false };
    expect(nextStep(fresh)).toBe("setup");
    expect(nextStep({ ...fresh, setupSkipped: true })).toBe("start");
    expect(nextStep({ ...fresh, setupDone: true })).toBe("start");
    expect(nextStep({ ...fresh, savedCount: 1 })).toBe("choosing");
    expect(viewedState(fresh)).toBe("new");
    expect(viewedState({ ...fresh, setupSkipped: true })).toBe("new");
    expect(viewedState({ ...fresh, setupDone: true })).toBe("set_up");
    expect(viewedState({ ...fresh, savedCount: 2 })).toBe("choosing");
    // WP44-S9: a running plan wins, then a plan that just finished.
    expect(nextStep({ ...fresh, savedCount: 3, building: true, finishedRecently: true })).toBe("building");
    expect(nextStep({ ...fresh, savedCount: 3, finishedRecently: true })).toBe("finished");
    expect(viewedState({ ...fresh, building: true })).toBe("building");
    expect(viewedState({ ...fresh, finishedRecently: true })).toBe("finished");
  });
});

describe("WP44-S4 Home composition", () => {
  test("the page reads the homepage cache and keeps the preview claim", () => {
    expect(dashboardPageSource).toContain("await getDashboardEditorial()");
    expect(dashboardPageSource).toContain("<DashboardHome editorial={editorial} />");
    expect(dashboardPageSource).toContain("<PreviewClaimRunner />");
    expect(dashboardPageSource).not.toContain("components/platform/shell/DashboardHome");
  });

  test("orders modules personal, editorial, then discovery", () => {
    const order = ["<Greeting", "<NextStepCard", "<WeeklyPick", "<PickedForYou", "<NewestIdeas", "<HomeRail"];
    const positions = order.map((tag) => homeSource.indexOf(tag));
    expect(positions.every((p) => p > -1)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  test("editorial modules render on the server", () => {
    expect(homeSource).not.toContain('"use client"');
    expect(weeklySource).not.toContain('"use client"');
    expect(newestSource).not.toContain('"use client"');
    expect(weeklySource).not.toContain("useQuery");
    expect(newestSource).not.toContain("useQuery");
  });

  test("every Convex consumer sits behind the browser gate and an error boundary", () => {
    for (const [name, source] of Object.entries({ nextStepSource, picksSource, railSource })) {
      expect(source, name).toContain("useQuery(");
      expect(source, name).toContain("<PersonalModule");
    }
    expect(greetingSource).toContain("<WhenConvexReady");
    expect(greetingSource).toContain("<QuietErrorBoundary");
    expect(saveSource).toContain("<WhenConvexReady");
    expect(saveSource).toContain("<QuietErrorBoundary");
    expect(statesSource).toContain("<WhenConvexReady fallback={skeleton}");
    expect(statesSource).toContain("<ModuleErrorBoundary");
  });

  test("Home is on the research-desk tokens (the dark surface is gone, S7)", () => {
    expect(shellSource).not.toContain("LegacyDarkSurface");
    for (const [name, source] of Object.entries(homeSources)) {
      expect(source, name).not.toContain("#050505");
      expect(source, name).not.toMatch(/\bzinc-\d/);
      expect(source, name).not.toMatch(/\bwhite\/\d/);
    }
  });
});

describe("WP44-S4 states and copy", () => {
  test("skeletons announce through role=status, not a bare aria-label", () => {
    expect(statesSource).toContain('role="status"');
    expect(loadingSource).toContain('role="status"');
    expect(loadingSource).not.toContain("aria-label=");
    expect(statesSource).not.toMatch(/<div[^>]*aria-label=/);
  });

  test("module errors use the PRD copy and never blank the page", () => {
    expect(MODULE_ERROR_COPY).toBe("We can’t load your ideas right now. Try again in a minute.");
    expect(statesSource).toContain("{MODULE_ERROR_COPY}");
    expect(statesSource).toContain("console.error");
  });

  test("the route error stays calm and non-destructive", () => {
    expect(errorSource).toContain('role="alert"');
    expect(errorSource).toContain("No action was taken");
    expect(errorSource).toContain("Try again");
  });

  test("removed system copy is gone (PRD 6.8)", () => {
    const removed = [
      "Move one idea forward",
      "Nothing runs or spends credits",
      "server-owned",
      "Saved and Interested remain independent",
      "Supported shortcuts",
      "autonomous agent",
      "Available balance",
      "credits",
      "Canonical score",
      "Project cockpit",
      "Preview this idea",
      "Workspace data is unavailable",
      "/dashboard/new",
      "/build/",
    ];
    for (const [name, source] of Object.entries(homeSources)) {
      for (const phrase of removed) {
        expect(source, `${name}: ${phrase}`).not.toContain(phrase);
      }
    }
  });

  test("picked for you shows no invented reason", () => {
    expect(picksSource).not.toContain("Popular this month");
    // S8: reasons come only from the ranking, through ReasonLine.
    expect(picksSource).toContain("<ReasonLine reason={idea.reason} />");
  });

  test("the newest list does not claim to be this week's", () => {
    expect(newestSource).toContain("Newest ideas");
    expect(newestSource).not.toMatch(/>\s*New this week\s*</);
  });
});

describe("WP44-S4 accessibility contracts", () => {
  test("Save is a toggle with a polite announcement (PRD 6.10)", () => {
    expect(saveSource).toContain("aria-pressed={pressed}");
    expect(saveSource).toContain('<span role="status" className="sr-only">');
    expect(saveSource).toContain('fill={pressed ? "currentColor" : "none"}');
  });

  test("the Starter Kit card is labelled and dismissible (R6)", () => {
    expect(railSource).toContain('aria-labelledby="rail-kit-heading"');
    expect(railSource).toContain('aria-label="Dismiss the Starter Kit card"');
    expect(railSource).toContain('home.plan === "free"');
    expect(railSource).toContain("savedHeading.current?.focus()");
  });

  test("the rail is not a nested complementary landmark", () => {
    expect(railSource).not.toContain("<aside");
  });

  test("scores are text, bars are decoration", () => {
    expect(weeklySource).toContain("<ScoreMeters scores={idea.scores} />");
    expect(scoreMetersSource).toContain("<dt");
    expect(scoreMetersSource).toContain('<span className="sr-only"> out of 10</span>');
    expect(scoreMetersSource).toContain("<dd aria-hidden");
  });
});

describe("Platform Convex URL check (moved from the WP23 dashboard test)", () => {
  test("accepts only well-formed Convex cloud or local URLs", () => {
    expect(isValidPlatformConvexUrl(undefined)).toBe(false);
    expect(isValidPlatformConvexUrl("not-a-url")).toBe(false);
    expect(isValidPlatformConvexUrl("ftp://example.test")).toBe(false);
    expect(isValidPlatformConvexUrl("https://example.convex.site")).toBe(false);
    expect(isValidPlatformConvexUrl(" https://example.convex.cloud")).toBe(false);
    expect(isValidPlatformConvexUrl("https://example.convex.cloud ")).toBe(false);
    expect(isValidPlatformConvexUrl("https://example.convex.cloud")).toBe(true);
    expect(isValidPlatformConvexUrl("http://localhost:3210")).toBe(true);
    expect(isValidPlatformConvexUrl("http://127.0.0.1:3210")).toBe(true);
  });
});
