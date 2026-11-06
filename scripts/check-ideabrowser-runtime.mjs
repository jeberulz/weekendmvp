#!/usr/bin/env node
/**
 * Phase 9 gate: live skills and agent docs must not require Ideabrowser MCP.
 *
 * Fails on `mcp__ideabrowser` under .claude/skills/, .agents/skills/, AGENTS.md,
 * and CLAUDE.md. Historical provenance in ideas/manifest.json and plan/docs/wp
 * mentions are allowed.
 *
 *   npm run check:ideabrowser-runtime
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NEEDLE = /mcp__ideabrowser/i;
const roots = [
  path.join(root, ".claude", "skills"),
  path.join(root, ".agents", "skills"),
  path.join(root, "AGENTS.md"),
  path.join(root, "CLAUDE.md"),
];

/** @type {string[]} */
const hits = [];

function scanFile(file) {
  const text = fs.readFileSync(file, "utf8");
  if (!NEEDLE.test(text)) return;
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (NEEDLE.test(line)) {
      hits.push(`${path.relative(root, file)}:${index + 1}: ${line.trim()}`);
    }
  }
}

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  const st = fs.statSync(dir);
  if (st.isFile()) {
    scanFile(dir);
    return;
  }
  for (const name of fs.readdirSync(dir)) {
    if (name === "node_modules" || name === ".git") continue;
    walk(path.join(dir, name));
  }
}

for (const target of roots) walk(target);

if (hits.length > 0) {
  console.error("check:ideabrowser-runtime — live skills/docs still reference Ideabrowser MCP:");
  for (const hit of hits) console.error(`  ${hit}`);
  process.exit(1);
}

console.log(
  "check:ideabrowser-runtime — ok (no mcp__ideabrowser in skills/AGENTS.md/CLAUDE.md)",
);
