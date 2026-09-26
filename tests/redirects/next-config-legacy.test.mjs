import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("next.config legacy fallback", () => {
  it("does not proxy unknown paths to a legacy origin", () => {
    const source = readFileSync(
      new URL("../../next.config.ts", import.meta.url),
      "utf8",
    );
    assert.doesNotMatch(source, /LEGACY_ORIGIN/);
    assert.doesNotMatch(source, /\bfallback\s*:/);
    assert.doesNotMatch(source, /async\s+rewrites\s*\(/);
  });
});
