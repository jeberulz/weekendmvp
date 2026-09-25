import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("robots.ts crawl-budget disallow", () => {
  it("disallows private activation and auth surfaces", () => {
    const source = readFileSync(
      new URL("../../app/robots.ts", import.meta.url),
      "utf8",
    );
    for (const path of [
      "/preview/",
      "/login/",
      "/signup/",
      "/dashboard/",
      "/build/",
    ]) {
      assert.match(
        source,
        new RegExp(`"${path.replace(/\//g, "\\/")}"`),
        `missing Disallow ${path}`,
      );
    }
  });
});
