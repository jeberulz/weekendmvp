#!/usr/bin/env node
/**
 * Fail if any content/ideas/*.mdx cites "Ideabrowser" anywhere — body,
 * Sources, frontmatter, or footers. The brand must not render on idea pages.
 * Exit 0 on pass, 1 on failure.
 *
 *   npm run check:ideabrowser-attribution
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ideasDir = path.join(root, "content", "ideas");

const failures = [];
for (const name of fs.readdirSync(ideasDir).sort()) {
  if (!name.endsWith(".mdx")) continue;
  const filePath = path.join(ideasDir, name);
  const raw = fs.readFileSync(filePath, "utf8");
  if (!/ideabrowser/i.test(raw)) continue;
  const hits = [];
  for (const [i, line] of raw.split(/\n/).entries()) {
    if (/ideabrowser/i.test(line)) {
      hits.push(`${i + 1}: ${line.trim().slice(0, 120)}`);
    }
  }
  failures.push({ name, hits });
}

if (failures.length === 0) {
  console.log(
    "check:ideabrowser-attribution — ok (no Ideabrowser citations in idea MDX, including Sources)",
  );
  process.exit(0);
}

console.error(
  `check:ideabrowser-attribution — ${failures.length} idea(s) still cite Ideabrowser:`,
);
for (const failure of failures) {
  console.error(`\n${failure.name}`);
  for (const hit of failure.hits.slice(0, 8)) console.error(`  ${hit}`);
}
process.exit(1);
