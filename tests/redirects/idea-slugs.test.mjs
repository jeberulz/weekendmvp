import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  IDEA_SLUGS,
  isKnownIdeaSlug,
} from "../../lib/idea-slugs.generated.ts";

describe("idea-slugs.generated", () => {
  it("matches ideas/manifest.json exactly (sorted)", () => {
    const manifest = JSON.parse(
      readFileSync(new URL("../../ideas/manifest.json", import.meta.url), "utf8"),
    );
    const fromManifest = manifest.ideas.map((i) => i.slug).sort();
    assert.deepEqual([...IDEA_SLUGS], fromManifest);
  });

  it("rejects unknown slugs used in GSC soft-404 samples", () => {
    assert.equal(isKnownIdeaSlug("foo"), false);
    assert.equal(isKnownIdeaSlug(""), false);
  });

  it("accepts a real manifest slug", () => {
    assert.equal(isKnownIdeaSlug(IDEA_SLUGS[0]), true);
  });
});
