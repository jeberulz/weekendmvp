import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

import { FREE_WEBINAR, freeWebinarTitlePlain } from "@/lib/live/config";
import {
  nextPhaseBoundaryMs,
  nextSessionEmptyCopy,
  nextUpcomingSession,
  pastSessions,
  sessionPhase,
  SESSION_LIVE_LEAD_MS,
  SESSION_LIVE_TRAIL_MS,
} from "@/lib/live/session-phase";
import {
  hydrotrailSession,
  LIVE_HUB_SEO,
  LIVE_SERIES_SUBSCRIBE_HREF,
  LIVE_SESSION_RESERVED_SLUGS,
  LIVE_SESSIONS,
  sessionDefaultDescription,
  sessionDefaultTitle,
  sessionEmbedUrl,
  sessionPath,
} from "@/lib/live/sessions";
import {
  loadIdeaSlugsFromManifest,
  validateSessions,
} from "@/lib/live/sessions-validate";

const manifest = JSON.parse(
  readFileSync("ideas/manifest.json", "utf8"),
) as { ideas: { slug: string }[] };
const ideaSlugs = loadIdeaSlugsFromManifest(manifest);

describe("LIVE_SESSIONS catalogue", () => {
  test("HydroTrail is present and backs FREE_WEBINAR", () => {
    const hydro = hydrotrailSession();
    expect(hydro.slug).toBe("hydration-app-for-hikers");
    expect(hydro.ideaSlug).toBe("hydration-app-for-hikers");
    expect(hydro.youtubeId).toBeUndefined();
    expect(FREE_WEBINAR.sessionSlug).toBe(hydro.slug);
    expect(FREE_WEBINAR.sessionId).toBe(hydro.id);
    expect(FREE_WEBINAR.startAt).toBe(Date.parse(hydro.startsAt));
    expect(FREE_WEBINAR.endAt).toBe(Date.parse(hydro.endsAt));
    expect(FREE_WEBINAR.title).toBe(hydro.title);
    expect(FREE_WEBINAR.slug).toBe("48-hours");
    expect(freeWebinarTitlePlain()).toBe("Build a real app live in one hour");
  });

  test("validators pass on the real catalogue (clock-free)", () => {
    const issues = validateSessions(LIVE_SESSIONS, { ideaSlugs });
    expect(issues).toEqual([]);
  });

  test("reserved slugs stay blocked", () => {
    expect(LIVE_SESSION_RESERVED_SLUGS).toContain("build-along");
    expect(LIVE_SESSION_RESERVED_SLUGS).toContain("48-hours");
    expect(LIVE_SESSION_RESERVED_SLUGS).toContain("replays");
  });

  test("rejects offset-less ISO strings", () => {
    const hydro = hydrotrailSession();
    const bad = {
      ...hydro,
      id: "bad-offset",
      slug: "bad-offset-session",
      startsAt: "2026-10-31T16:00:00",
      endsAt: "2026-10-31T17:00:00",
    };
    const issues = validateSessions([bad], { ideaSlugs });
    expect(issues.some((i) => i.message.includes("explicit offset"))).toBe(
      true,
    );
  });

  test("requires durationIso when youtubeId is set", () => {
    const hydro = hydrotrailSession();
    const bad = {
      ...hydro,
      id: "needs-duration",
      slug: "needs-duration-session",
      youtubeId: "dQw4w9WgXcQ",
      durationIso: undefined,
    };
    const issues = validateSessions([bad], { ideaSlugs });
    expect(
      issues.some((i) => i.message.includes("durationIso is required")),
    ).toBe(true);
  });

  test("rejects unknown ideaSlug", () => {
    const hydro = hydrotrailSession();
    const bad = {
      ...hydro,
      id: "missing-idea",
      slug: "missing-idea-session",
      ideaSlug: "this-idea-does-not-exist",
    };
    const issues = validateSessions([bad], { ideaSlugs });
    expect(issues.some((i) => i.message.includes("missing from ideas"))).toBe(
      true,
    );
  });

  test("rejects reserved slug", () => {
    const hydro = hydrotrailSession();
    const bad = { ...hydro, id: "reserved", slug: "build-along" };
    const issues = validateSessions([bad], { ideaSlugs });
    expect(issues.some((i) => i.message.includes("reserved"))).toBe(true);
  });

  test("subscribe empty-state uses the newsletter (no Luma calendar in repo/env)", () => {
    expect(LIVE_SERIES_SUBSCRIBE_HREF).toBe("/newsletter");
    expect(nextSessionEmptyCopy().ctaHref).toBe("/newsletter");
  });
});

describe("sessionPhase", () => {
  const hydro = hydrotrailSession();
  const start = Date.parse(hydro.startsAt);
  const end = Date.parse(hydro.endsAt);

  test("upcoming → live (±15m) → replay-pending without youtubeId", () => {
    expect(sessionPhase(hydro, start - SESSION_LIVE_LEAD_MS - 1)).toBe(
      "upcoming",
    );
    expect(sessionPhase(hydro, start - SESSION_LIVE_LEAD_MS)).toBe("live");
    expect(sessionPhase(hydro, start)).toBe("live");
    expect(sessionPhase(hydro, end)).toBe("live");
    expect(sessionPhase(hydro, end + SESSION_LIVE_TRAIL_MS)).toBe("live");
    expect(sessionPhase(hydro, end + SESSION_LIVE_TRAIL_MS + 1)).toBe(
      "replay-pending",
    );
  });

  test("past once youtubeId is set", () => {
    const withReplay = {
      ...hydro,
      youtubeId: "dQw4w9WgXcQ",
      durationIso: "PT58M",
    };
    expect(sessionPhase(withReplay, end + SESSION_LIVE_TRAIL_MS + 1)).toBe(
      "past",
    );
  });

  test("status override wins over the clock", () => {
    expect(sessionPhase({ ...hydro, status: "cancelled" }, start - 60_000)).toBe(
      "cancelled",
    );
    expect(sessionPhase({ ...hydro, status: "postponed" }, start)).toBe(
      "postponed",
    );
    expect(sessionPhase({ ...hydro, status: "draft" }, start)).toBe("draft");
  });

  test("HydroTrail is replay-pending at the series-build window (2 Nov)", () => {
    expect(sessionPhase(hydro, Date.parse("2026-11-02T12:00:00.000Z"))).toBe(
      "replay-pending",
    );
    expect(pastSessions(Date.parse("2026-11-02T12:00:00.000Z")).map((s) => s.id)).toEqual([
      "2026-10-31-hydrotrail",
    ]);
    expect(nextUpcomingSession(Date.parse("2026-11-02T12:00:00.000Z"))).toBeNull();
  });

  test("nextPhaseBoundaryMs points at the upcoming→live flip", () => {
    const boundary = nextPhaseBoundaryMs(hydro, start - SESSION_LIVE_LEAD_MS - 1);
    expect(boundary).toBe(start - SESSION_LIVE_LEAD_MS);
    expect(nextPhaseBoundaryMs(hydro, end + SESSION_LIVE_TRAIL_MS + 1)).toBeNull();
  });
});

describe("Demand SEO formulas", () => {
  const hydro = hydrotrailSession();

  test("HydroTrail uses the category-led replay title override", () => {
    expect(sessionDefaultTitle(hydro, "after")).toBe(
      "Build a Hydration App with AI: HydroTrail Replay | Weekend MVP",
    );
    expect(sessionDefaultDescription(hydro, "after")).toContain(
      "first screen",
    );
  });

  test("before formula uses category + date when seo.title is absent", () => {
    const bare = { ...hydro, seo: undefined };
    expect(sessionDefaultTitle(bare, "before")).toBe(
      "Build a Hydration App with Claude Code, Live · Sat 31 Oct | Weekend MVP",
    );
  });

  test("hub series keywords and title", () => {
    expect(LIVE_HUB_SEO.title).toContain("Every Two Weeks");
    expect(LIVE_HUB_SEO.keywords).toContain("build app live");
  });

  test("VideoObject embed helper (no contentUrl / watch URL)", () => {
    expect(sessionEmbedUrl("dQw4w9WgXcQ")).toBe(
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
    );
    expect(sessionPath(hydro.slug)).toBe("/live/hydration-app-for-hikers");
  });
});
