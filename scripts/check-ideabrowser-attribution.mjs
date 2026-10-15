#!/usr/bin/env node
/**
 * Fail if any content/ideas/*.mdx cites "Ideabrowser" outside ## Sources.
 * Sources-section citations are allowed. Exit 0 on pass, 1 on failure.
 *
 *   npm run check:ideabrowser-attribution
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ideasDir = path.join(root, "content", "ideas");

function bodyOutsideSources(raw) {
  let body = raw;
  if (raw.startsWith("---")) {
    const end = raw.indexOf("\n---", 3);
    if (end !== -1) body = raw.slice(end + 4);
  }
  const match = /^##\s+Sources\s*$/m.exec(body);
  if (!match) return body;
  return body.slice(0, match.index);
}

const failures = [];
for (const name of fs.readdirSync(ideasDir).sort()) {
  if (!name.endsWith(".mdx")) continue;
  const filePath = path.join(ideasDir, name);
  const raw = fs.readFileSync(filePath, "utf8");
  const pre = bodyOutsideSources(raw);
  if (/ideabrowser/i.test(pre)) {
    const lines = pre.split(/\n/);
    const hits = [];
    for (let i = 0; i < lines.length; i++) {
      if (/ideabrowser/i.test(lines[i])) {
        hits.push(`${i + 1}: ${lines[i].trim().slice(0, 120)}`);
      }
    }
    failures.push({ name, hits });
  }
}

if (failures.length === 0) {
  console.log("check:ideabrowser-attribution — ok (no body citations outside ## Sources)");
  process.exit(0);
}

console.error(
  `check:ideabrowser-attribution — ${failures.length} idea(s) cite Ideabrowser outside ## Sources:`,
);
for (const failure of failures) {
  console.error(`\n${failure.name}`);
  for (const hit of failure.hits.slice(0, 5)) console.error(`  ${hit}`);
}
process.exit(1);
