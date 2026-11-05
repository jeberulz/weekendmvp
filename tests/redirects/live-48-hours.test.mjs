import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("live/48-hours redirect", () => {
  it("308s /live/48-hours to the HydroTrail session page", () => {
    const source = readFileSync(
      new URL("../../next.config.ts", import.meta.url),
      "utf8",
    );
    assert.match(source, /source:\s*"\/live\/48-hours"/);
    assert.match(
      source,
      /destination:\s*"\/live\/hydration-app-for-hikers"/,
    );
    assert.match(source, /permanent:\s*true/);
    // middleware stays untouched for this redirect
    assert.doesNotMatch(
      readFileSync(new URL("../../middleware.ts", import.meta.url), "utf8"),
      /48-hours/,
    );
  });

  it("drops /live/48-hours from the sitemap", () => {
    const sitemap = readFileSync(
      new URL("../../app/sitemap.ts", import.meta.url),
      "utf8",
    );
    assert.doesNotMatch(sitemap, /entry\("\/live\/48-hours"/);
    assert.match(sitemap, /publishedSessions/);
  });
});
