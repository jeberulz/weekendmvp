import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("private WP25 routes remain noindex", async () => {
  const routes = await Promise.all([
    read("app/dashboard/new/page.tsx"),
    read("app/dashboard/projects/page.tsx"),
    read("app/dashboard/projects/[projectId]/page.tsx"),
  ]);
  for (const source of routes) {
    assert.match(source, /robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/);
  }
});

test("actual idea renderer adds a normal same-origin preview link without changing metadata or JSON-LD", async () => {
  const [page, cta] = await Promise.all([
    read("app/ideas/[slug]/page.tsx"),
    read("components/ideas/PreviewIdeaCta.tsx"),
  ]);
  assert.match(page, /<PreviewIdeaCta slug=\{slug\} title=\{title\} \/>/);
  assert.match(cta, /href=\{`\/build\/\$\{slug\}`\}/);
  assert.match(cta, />\s*Preview this idea\s*/);
  assert.doesNotMatch(cta, /onClick|window\.|router\./);
  assert.match(page, /alternates:\s*\{ canonical: `?\/ideas\/\$\{slug\}`? \}/);
  assert.match(page, /<JsonLd schema=\{schema\} \/>/);
  assert.match(page, /const collection = await renderCollection\(slug\)/);
});

test("WP25 does not implement the future preview route", async () => {
  const cta = await read("components/ideas/PreviewIdeaCta.tsx");
  assert.doesNotMatch(cta, /preview_generated|generatePreview|capability|token/);
});
