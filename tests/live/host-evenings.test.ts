import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { LIVE_ASSETS } from "@/lib/live/config";

const EVENINGS_PREFIX =
  "I build Weekend MVP around a full-time job, on evenings and Saturdays";

describe("host evenings confirmed", () => {
  test("LIVE_ASSETS.hostEveningsConfirmed is on", () => {
    expect(LIVE_ASSETS.hostEveningsConfirmed).toBe(true);
  });

  test("free webinar, hub, and build-along pages gate the evenings line on the flag", () => {
    const free = readFileSync("app/(marketing)/live/48-hours/page.tsx", "utf8");
    const hub = readFileSync("app/(marketing)/live/live-hub-data.tsx", "utf8");
    const paid = readFileSync(
      "app/(live-checkout)/live/build-along/page.tsx",
      "utf8",
    );
    for (const src of [free, hub, paid]) {
      expect(src).toContain("hostEveningsConfirmed");
      expect(src).toContain(EVENINGS_PREFIX);
    }
  });
});
