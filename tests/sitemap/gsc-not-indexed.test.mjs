/**
 * Regression tests for the 2026-10-24 GSC not-indexed bugs:
 * broken breadcrumb hubs, empty collection hubs, undefined prompt fences,
 * newsletter → quarantine idea links, and /links sitemap membership.
 */
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";
import { createRequire } from "node:module";

import { IDEA_COLLECTION_SLUGS } from "../../lib/idea-collection-slugs.ts";

const root = path.join(import.meta.dirname, "../..");
const require = createRequire(import.meta.url);

function liveIdeaSlugs() {
  const manifest = require("../../ideas/manifest.json");
  const ideas = Array.isArray(manifest) ? manifest : (manifest.ideas ?? []);
  return new Set(ideas.map((idea) => idea.slug));
}

async function walkMdx(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "_quarantine" || entry.name.startsWith(".")) continue;
      files.push(...(await walkMdx(full)));
    } else if (entry.name.endsWith(".mdx") || entry.name.endsWith(".md")) {
      files.push(full);
    }
  }
  return files;
}

describe("GSC not-indexed regressions", () => {
  it("does not keep empty revenue hubs in IDEA_COLLECTION_SLUGS", () => {
    assert.equal(IDEA_COLLECTION_SLUGS.includes("quick-wins"), false);
    assert.equal(IDEA_COLLECTION_SLUGS.includes("passive-income"), false);
  });

  it("every collection hub slug has ≥1 live idea in the manifest", () => {
    const manifest = require("../../ideas/manifest.json");
    const ideas = Array.isArray(manifest) ? manifest : (manifest.ideas ?? []);
    const byCategory = new Map();
    const byRevenue = new Map();
    const byBuildTime = new Map();
    for (const idea of ideas) {
      if (idea.category) {
        byCategory.set(idea.category, (byCategory.get(idea.category) ?? 0) + 1);
      }
      if (idea.revenueGoal) {
        byRevenue.set(idea.revenueGoal, (byRevenue.get(idea.revenueGoal) ?? 0) + 1);
      }
      if (idea.buildTime != null) {
        const key = String(idea.buildTime);
        byBuildTime.set(key, (byBuildTime.get(key) ?? 0) + 1);
      }
    }

    const buildTimeHubs = {
      "build-in-weekend": ["8", "10", "12"],
      "build-in-8-hours": ["8"],
      "build-in-1-week": ["20", "24", "30", "40"],
    };
    const revenueHubs = new Set(["1k-month", "5k-month", "10k-month"]);
    const categoryHubs = new Set(
      IDEA_COLLECTION_SLUGS.filter(
        (slug) => !revenueHubs.has(slug) && !(slug in buildTimeHubs),
      ),
    );

    for (const slug of categoryHubs) {
      assert.ok((byCategory.get(slug) ?? 0) > 0, `empty category hub: ${slug}`);
    }
    for (const slug of revenueHubs) {
      assert.ok((byRevenue.get(slug) ?? 0) > 0, `empty revenue hub: ${slug}`);
    }
    for (const [slug, values] of Object.entries(buildTimeHubs)) {
      const count = values.reduce((sum, value) => sum + (byBuildTime.get(value) ?? 0), 0);
      assert.ok(count > 0, `empty build-time hub: ${slug}`);
    }
  });

  it("sitemap source omits /links; collection list has no empty revenue hubs", async () => {
    const src = await readFile(path.join(root, "app/sitemap.ts"), "utf8");
    assert.equal(/entry\(\s*"\/links"/.test(src), false);
    assert.equal(IDEA_COLLECTION_SLUGS.includes("quick-wins"), false);
    assert.equal(IDEA_COLLECTION_SLUGS.includes("passive-income"), false);
  });

  it("/links metadata is noindex", async () => {
    const src = await readFile(path.join(root, "app/links/page.tsx"), "utf8");
    assert.match(src, /robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/);
  });

  it("hub BreadcrumbList level-2 points at /startup-ideas, never at missing indexes", async () => {
    const files = [
      "app/build-with/[tool]/page.tsx",
      "app/ideas-for/[audience]/page.tsx",
      "app/solve/[problem]/page.tsx",
    ];
    for (const file of files) {
      const src = await readFile(path.join(root, file), "utf8");
      assert.match(src, /label:\s*"Startup Ideas",\s*href:\s*"\/startup-ideas"/);
      assert.equal(/href:\s*"\/(build-with|ideas-for|solve)\/?"/.test(src.replace(/href:\s*"\/build-with\/[a-z0-9-]+"/g, "")), false, file);
      assert.doesNotMatch(src, /href:\s*"\/build-with\/"/);
      assert.doesNotMatch(src, /href:\s*"\/ideas-for\/"/);
      assert.doesNotMatch(src, /href:\s*"\/solve\/"/);
    }
  });

  it("idea page chips call the hub helpers instead of always linking", async () => {
    const src = await readFile(path.join(root, "app/ideas/[slug]/page.tsx"), "utf8");
    assert.match(src, /toolHubHref\(/);
    assert.match(src, /audienceHubHref\(/);
    assert.doesNotMatch(src, /href=\{`\/build-with\/\$\{tool\}`\}/);
    assert.doesNotMatch(src, /href=\{`\/ideas-for\/\$\{audience\}`\}/);
  });

  it("no live content idea MDX fences only the string undefined", async () => {
    const files = await walkMdx(path.join(root, "content/ideas"));
    const bad = [];
    for (const file of files) {
      const text = await readFile(file, "utf8");
      if (/```[a-z]*\n\s*undefined\s*\n```/.test(text)) bad.push(path.relative(root, file));
    }
    assert.deepEqual(bad, []);
  });

  it("content /** never links /ideas/{slug} to a missing or quarantined idea", async () => {
    const live = liveIdeaSlugs();
    const quarantineDir = path.join(root, "content/ideas/_quarantine");
    const quarantined = new Set(
      (await readdir(quarantineDir)).map((name) => name.replace(/\.(mdx?|md)$/, "")),
    );
    const files = await walkMdx(path.join(root, "content"));
    const broken = [];
    for (const file of files) {
      const text = await readFile(file, "utf8");
      for (const match of text.matchAll(/(?:href=["']|\]\()\/ideas\/([a-z0-9-]+)/g)) {
        const slug = match[1];
        if (IDEA_COLLECTION_SLUGS.includes(slug)) continue;
        if (!live.has(slug) || quarantined.has(slug)) {
          broken.push(`${path.relative(root, file)} → /ideas/${slug}`);
        }
      }
    }
    assert.deepEqual(broken, []);
  });
});
