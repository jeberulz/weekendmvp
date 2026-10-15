import { describe, expect, test } from "vitest";
import { execFileSync } from "node:child_process";
import path from "node:path";

describe("ideabrowser attribution lint", () => {
  test("idea body copy keeps Ideabrowser out of non-Sources sections", () => {
    const script = path.resolve("scripts/check-ideabrowser-attribution.mjs");
    const output = execFileSync(process.execPath, [script], {
      encoding: "utf8",
    });
    expect(output).toMatch(/ok/);
  });
});
