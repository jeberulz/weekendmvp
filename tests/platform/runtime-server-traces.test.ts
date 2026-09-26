// @vitest-environment node
import { afterEach, expect, test } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const script = path.resolve("scripts/check-server-traces.mjs");
const fixtures: string[] = [];
const routes = ["api/ideas/prompts/route", "api/ideas/prompt-pack/route", "sitemap.xml/route"];
function fixture(omit?: string, routeToOmit = "sitemap.xml/route") {
  const root = mkdtempSync(path.join(tmpdir(), "wp44-trace-test-"));
  fixtures.push(root);
  const required = ["content/ideas/one.mdx", "content/ideas/two.mdx", "ideas/manifest.json"];
  for (const relative of required) {
    mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
    writeFileSync(path.join(root, relative), "fixture");
  }
  for (const route of routes) {
    const entry = path.join(root, ".next/server/app", `${route}.js`);
    mkdirSync(path.dirname(entry), { recursive: true });
    writeFileSync(entry, "fixture");
    const files = required.filter(file => !(file === omit && route === routeToOmit))
      .map(file => path.relative(path.dirname(entry), path.join(root, file)));
    writeFileSync(`${entry}.nft.json`, JSON.stringify({ files }));
  }
  return spawnSync(process.execPath, [script], { cwd: root, encoding: "utf8" });
}
afterEach(() => fixtures.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));

test("accepts small artifacts with every canonical idea and sitemap manifest", () => {
  const result = fixture();
  expect(result.status, result.stderr).toBe(0);
  expect(JSON.parse(result.stdout).artifacts).toHaveLength(3);
});

test.each(routes)("rejects a missing idea in %s even though the artifact is small", route => {
  const result = fixture("content/ideas/two.mdx", route);
  expect(result.status).toBe(1);
  expect(result.stderr).toContain(`Required canonical content missing from ${route}: content/ideas/two.mdx`);
});

test("rejects a missing sitemap manifest even when MDX is present", () => {
  const result = fixture("ideas/manifest.json");
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("Required canonical content missing from sitemap.xml/route: ideas/manifest.json");
});
