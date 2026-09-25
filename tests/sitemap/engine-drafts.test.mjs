import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { isEngineDraftSlug } from "../../lib/engine-drafts.ts";
import { listMdxFrontmatter } from "../../lib/sitemap-data.ts";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("engine drafts stay off the site", () => {
  it("recognises engine-draft slugs and file names", () => {
    assert.equal(isEngineDraftSlug("engine-draft-ai-code-reviewer"), true);
    assert.equal(isEngineDraftSlug("engine-draft-ai-code-reviewer.mdx"), true);
    assert.equal(isEngineDraftSlug("ai-code-reviewer"), false);
  });

  it("listMdxFrontmatter skips engine-draft files", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "engine-drafts-"));
    fs.writeFileSync(path.join(tmp, "real-idea.mdx"), "---\nslug: real-idea\n---\n");
    fs.writeFileSync(
      path.join(tmp, "engine-draft-real-idea.mdx"),
      "---\nslug: engine-draft-real-idea\n---\n",
    );
    const cwd = process.cwd();
    try {
      process.chdir(tmp);
      const rows = await listMdxFrontmatter(".");
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
