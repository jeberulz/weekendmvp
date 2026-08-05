import assert from "node:assert/strict";
import { describe, it } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  loadIdeaPublishedAtMap,
  parsePublishedAt,
} from "../../lib/sitemap-data.ts";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("parsePublishedAt", () => {
  it("parses ISO date strings to epoch ms", () => {
    const ms = parsePublishedAt("2026-07-26");
    assert.equal(ms, Date.parse("2026-07-26"));
  });

  it("passes through finite numbers", () => {
    assert.equal(parsePublishedAt(1_700_000_000_000), 1_700_000_000_000);
  });

  it("rejects junk", () => {
    assert.equal(parsePublishedAt(undefined), undefined);
    assert.equal(parsePublishedAt("not-a-date"), undefined);
    assert.equal(parsePublishedAt(Number.NaN), undefined);
  });
});

describe("loadIdeaPublishedAtMap", () => {
  it("loads real publish dates from ideas/manifest.json", async () => {
    const map = await loadIdeaPublishedAtMap(
      path.join(root, "ideas", "manifest.json"),
    );
    assert.ok(map.size >= 100, `expected many idea dates, got ${map.size}`);
    const waitlist = map.get("waitlist-manager");
    assert.ok(typeof waitlist === "number" && waitlist > 0);
    // Must not look like "right now" — dates are calendar days in the past/near.
    assert.ok(
      Math.abs(Date.now() - waitlist) > 60_000 ||
        new Date(waitlist).toISOString().startsWith("2026-"),
      "publishedAt should be a stable calendar date",
    );
  });
});
