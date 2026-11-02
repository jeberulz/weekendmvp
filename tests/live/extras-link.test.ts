import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";

import {
  LIVE_REPLAY_SIGNUP_SRC,
  liveReplayExtrasSignupHref,
} from "@/lib/live/config";

describe("gated extras link", () => {
  test("signup href uses src=live-replay and returnTo", () => {
    expect(LIVE_REPLAY_SIGNUP_SRC).toBe("live-replay");
    expect(liveReplayExtrasSignupHref("/live/hydration-app-for-hikers")).toBe(
      "/signup?returnTo=%2Flive%2Fhydration-app-for-hikers&src=live-replay",
    );
  });

  test("session page and signupSrc allowlist include live-replay", () => {
    const page = readFileSync(
      "app/(marketing)/live/[session]/page.tsx",
      "utf8",
    );
    expect(page).toContain("liveReplayExtrasSignupHref");
    expect(page).toContain("Get the extras (free account)");
    expect(page).toContain("RecordSignupSrc");

    const convex = readFileSync("convex/live/signupSrc.ts", "utf8");
    expect(convex).toContain('"live-replay"');

    const record = readFileSync("components/live/RecordSignupSrc.tsx", "utf8");
    expect(record).toContain("LIVE_REPLAY_SIGNUP_SRC");
  });
});
