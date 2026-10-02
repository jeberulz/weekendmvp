import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ENGINE_DRAFT_PREFIX,
  ENGINE_DRAFT_SLUG_END,
  isEngineDraftSlug,
  publicIdeaPath,
} from "../../lib/engine-drafts.ts";
import { IDEA_SLUGS } from "../../lib/idea-slugs.generated.ts";
import { listMdxFrontmatter } from "../../lib/sitemap-data.ts";
import {
  ENGINE_DRAFT_PREFIX as SCRIPT_ENGINE_DRAFT_PREFIX,
  isEngineDraftSlug as scriptIsEngineDraftSlug,
} from "../../scripts/lib/idea-quality.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("engine drafts stay off the site", () => {
  it("recognises engine-draft slugs and file names", () => {
    assert.equal(isEngineDraftSlug("engine-draft-ai-code-reviewer"), true);
    assert.equal(isEngineDraftSlug("engine-draft-ai-code-reviewer.mdx"), true);
    assert.equal(isEngineDraftSlug("ai-code-reviewer"), false);
  });

  it("listMdxFrontmatter skips engine-draft files", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "engine-drafts-"));
    const ideas = path.join(tmp, "content", "ideas");
    fs.mkdirSync(ideas, { recursive: true });
    fs.writeFileSync(path.join(ideas, "real-idea.mdx"), "---\nslug: real-idea\n---\n");
    fs.writeFileSync(
      path.join(ideas, "engine-draft-real-idea.mdx"),
      "---\nslug: engine-draft-real-idea\n---\n",
    );
    const cwd = process.cwd();
    try {
      process.chdir(tmp);
      const rows = await listMdxFrontmatter("content/ideas");
      assert.deepEqual(
        rows.map((r) => r.slug),
        ["real-idea"],
      );
    } finally {
      process.chdir(cwd);
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("no engine-draft MDX or manifest row is in the public content", () => {
    const ideasDir = path.join(root, "content", "ideas");
    const drafts = fs.readdirSync(ideasDir).filter((f) => isEngineDraftSlug(f));
    assert.deepEqual(drafts, []);
    const manifest = JSON.parse(
      fs.readFileSync(path.join(root, "ideas", "manifest.json"), "utf8"),
    );
    const rows = manifest.ideas.filter((i) => isEngineDraftSlug(i.slug));
    assert.deepEqual(rows.map((i) => i.slug), []);
  });
});

// WP54-S5 (review F3): one visibility rule, readable from every runtime.
const SAMPLES = [
  "",
  "engine",
  "engine-draf",
  "engine-draft",
  "engine-draft-",
  "engine-draft-ai-code-reviewer",
  "engine-draft-ai-code-reviewer.mdx",
  "engine-draft-\u00e9t\u00e9",
  "engine-draft.",
  "engine-draft.x",
  "engine-draft/",
  "engine-drafts",
  "engine-draftz",
  "engine-draft_",
  "engine-draf\u00ff",
  "ai-code-reviewer",
  "zzz",
];

describe("engine draft visibility rule (WP54-S5)", () => {
  it("the Convex range bound selects exactly the prefixed slugs", () => {
    assert.equal(ENGINE_DRAFT_SLUG_END, "engine-draft.");
    for (const slug of SAMPLES) {
      const inRange = slug >= ENGINE_DRAFT_PREFIX && slug < ENGINE_DRAFT_SLUG_END;
      assert.equal(inRange, isEngineDraftSlug(slug), slug);
    }
  });

  it("the script copy used by seed:convex agrees with lib/engine-drafts.ts", () => {
    assert.equal(SCRIPT_ENGINE_DRAFT_PREFIX, ENGINE_DRAFT_PREFIX);
    for (const slug of SAMPLES) {
      assert.equal(scriptIsEngineDraftSlug(slug), isEngineDraftSlug(slug), slug);
    }
  });

  it("member views get no public page path for a draft", () => {
    assert.equal(publicIdeaPath("engine-draft-ai-code-reviewer"), null);
    assert.equal(publicIdeaPath("ai-code-reviewer"), "/ideas/ai-code-reviewer");
  });

  it("the middleware's generated slug list holds no draft", () => {
    assert.ok(IDEA_SLUGS.length > 100, `expected the full list, got ${IDEA_SLUGS.length}`);
    assert.deepEqual(IDEA_SLUGS.filter((slug) => isEngineDraftSlug(slug)), []);
  });
});
