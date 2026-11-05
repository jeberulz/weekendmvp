import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";

import { sessionsForIdea } from "@/lib/live/sessions";

describe("LiveIdeaModule idea lookup", () => {
  test("HydroTrail idea maps to the live session", () => {
    const sessions = sessionsForIdea("hydration-app-for-hikers");
    expect(sessions.map((s) => s.id)).toEqual(["2026-10-31-hydrotrail"]);
  });

  test("unknown idea returns empty", () => {
    expect(sessionsForIdea("no-such-idea")).toEqual([]);
  });

  test("module accepts ideaSlug and idea page passes it", () => {
    const mod = readFileSync("components/live/LiveIdeaModule.tsx", "utf8");
    expect(mod).toContain("Watch this built live");
    expect(mod).toContain("sessionsForIdea");
    expect(mod).toContain("ideaSlug");

    const summary = readFileSync(
      "components/ideas/IdeaPublicSummary.tsx",
      "utf8",
    );
    expect(summary).toContain("<LiveIdeaModule ideaSlug={ideaSlug} />");

    const page = readFileSync("app/ideas/[slug]/page.tsx", "utf8");
    expect(page).toContain("ideaSlug={slug}");
  });
});
