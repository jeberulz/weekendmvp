import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";

import {
  FREE_HUB_HREF,
  HUB_META,
  nextFreeSessionCard,
  pastSessionCards,
} from "@/app/(marketing)/live/live-hub-data";

describe("live hub archive", () => {
  test("hub meta uses Demand series title", () => {
    expect(HUB_META.title).toBe(
      "Weekend MVP Live: Free Live AI App Builds, Every Two Weeks",
    );
  });

  test("FREE_HUB_HREF points at the HydroTrail session page", () => {
    expect(FREE_HUB_HREF).toBe("/live/hydration-app-for-hikers");
  });

  test("past sessions include HydroTrail as replay-pending on 2 Nov", () => {
    const past = pastSessionCards(Date.parse("2026-11-02T12:00:00.000Z"));
    expect(past.map((c) => c.id)).toEqual(["2026-10-31-hydrotrail"]);
    expect(past[0]?.phaseLabel).toBe("Replay coming soon");
    expect(past[0]?.href).toBe("/live/hydration-app-for-hikers");
  });

  test("no next free session after HydroTrail", () => {
    expect(
      nextFreeSessionCard(Date.parse("2026-11-02T12:00:00.000Z")),
    ).toBeNull();
  });

  test("dashboard live copy no longer calls public replays a Hub benefit", () => {
    const src = readFileSync("app/dashboard/live/page.tsx", "utf8");
    expect(src).toContain("prompt pack, build files and extras");
    expect(src).toMatch(/Public\s+Weekend MVP Live replays stay free on YouTube/);
    expect(src).not.toContain("join links and replays");
  });
});
