import { describe, expect, test } from "vitest";

import { sessionPhase } from "@/lib/live/session-phase";
import { sessionJsonLd, sessionVideoObject } from "@/lib/live/session-schema";
import { hydrotrailSession, sessionEmbedUrl } from "@/lib/live/sessions";

describe("session page schema", () => {
  const hydro = hydrotrailSession();
  const afterLive = Date.parse("2026-11-02T12:00:00.000Z");

  test("HydroTrail replay-pending emits EducationEvent and no VideoObject", () => {
    const phase = sessionPhase(hydro, afterLive);
    expect(phase).toBe("replay-pending");
    const graph = sessionJsonLd(hydro, phase);
    const types = (graph["@graph"] as Record<string, unknown>[]).map(
      (node) => node["@type"],
    );
    expect(types).toContain("EducationEvent");
    expect(types).not.toContain("VideoObject");
  });

  test("past with youtubeId emits VideoObject with embedUrl only", () => {
    const withReplay = {
      ...hydro,
      youtubeId: "dQw4w9WgXcQ",
      durationIso: "PT58M",
      replayPublishedAt: "2026-11-07T12:00:00.000Z",
    };
    const video = sessionVideoObject(withReplay);
    expect(video["@type"]).toBe("VideoObject");
    expect(video.embedUrl).toBe(sessionEmbedUrl("dQw4w9WgXcQ"));
    expect(video).not.toHaveProperty("contentUrl");
    expect(video.duration).toBe("PT58M");

    const graph = sessionJsonLd(withReplay, "past");
    const types = (graph["@graph"] as Record<string, unknown>[]).map(
      (node) => node["@type"],
    );
    expect(types).toContain("VideoObject");
    expect(types).toContain("EducationEvent");
  });

  test("cancelled sets EventCancelled", () => {
    const cancelled = { ...hydro, status: "cancelled" as const };
    const graph = sessionJsonLd(cancelled, "cancelled");
    const event = (graph["@graph"] as Record<string, unknown>[]).find(
      (node) => node["@type"] === "EducationEvent",
    );
    expect(event?.eventStatus).toBe("https://schema.org/EventCancelled");
  });
});

describe("session page route wiring", () => {
  test("page + PhaseRefresh + NextSessionModule exist", async () => {
    const { readFileSync } = await import("node:fs");
    const page = readFileSync(
      "app/(marketing)/live/[session]/page.tsx",
      "utf8",
    );
    expect(page).toContain("PhaseRefresh");
    expect(page).toContain("NextSessionModule");
    expect(page).toContain("sessionJsonLd");
    expect(page).toContain("Replay coming soon");
    expect(page).toContain("build a ${session.category} app with AI");
    expect(page).not.toContain("contentUrl");

    const sitemap = readFileSync("app/sitemap.ts", "utf8");
    expect(sitemap).toContain("publishedSessions");
    expect(sitemap).toContain("sessionPath");
  });
});
