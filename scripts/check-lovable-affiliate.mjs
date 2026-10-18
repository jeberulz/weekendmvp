#!/usr/bin/env node
/**
 * Fail if a raw lovable.dev (or docs.lovable.dev) href/url appears outside
 * the allowlisted affiliate module. MDX and TSX must use LOVABLE_AFFILIATE_URL
 * / <LovableLink> instead of hardcoding the vendor domain.
 *
 *   npm run check:lovable-affiliate
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Files allowed to mention lovable.dev hostnames (matching / comments only). */
const ALLOWLIST = new Set([
  path.join(root, "lib/affiliates/lovable.ts"),
  path.join(root, "scripts/check-lovable-affiliate.mjs"),
  path.join(root, "tests/links/lovable-affiliate.test.mjs"),
  path.join(root, "lib/affiliates/lovable.test.ts"),
]);

const EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".mdx",
  ".json",
  ".md",
  ".html",
]);

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "coverage",
  ".worktrees",
  "tmp",
  "public",
]);

/**
 * Raw outbound href / url literals to Lovable hosts.
 * Plain-text brand mentions like "Sign up at lovable.dev" are intentionally
 * not matched (no `https://` scheme).
 */
const RAW_HREF =
  /(?:href\s*=\s*["']|\]\(|(?:["']url["']|\burl)\s*:\s*["'])https?:\/\/(?:www\.)?(?:docs\.)?lovable\.dev(?:\/[^"'\)\s]*)?/gi;

const AFFILIATE_URL = "https://lovablelabs.pxf.io/m4320e";

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
      continue;
    }
    const ext = path.extname(entry.name);
    if (!EXTENSIONS.has(ext)) continue;
    out.push(full);
  }
  return out;
}

function lineOf(source, index) {
  return source.slice(0, index).split(/\n/).length;
}

const failures = [];

for (const file of walk(root)) {
  if (ALLOWLIST.has(file)) continue;
  // Historical planning docs — skip; not product UI.
  if (file.startsWith(path.join(root, "docs") + path.sep)) continue;

  const raw = fs.readFileSync(file, "utf8");
  RAW_HREF.lastIndex = 0;
  let match;
  while ((match = RAW_HREF.exec(raw))) {
    failures.push({
      file: path.relative(root, file),
      line: lineOf(raw, match.index),
      snippet: match[0].slice(0, 120),
    });
  }
}

// Manifest must keep the Lovable tool url in sync with the TS constant
// (JSON cannot import). Fail loudly if they drift.
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, "ideas/manifest.json"), "utf8"),
);
const tool = (manifest.tools ?? []).find((row) => row?.slug === "lovable");
if (!tool) {
  failures.push({
    file: "ideas/manifest.json",
    line: 1,
    snippet: "lovable tool row missing",
  });
} else if (tool.url !== AFFILIATE_URL) {
  failures.push({
    file: "ideas/manifest.json",
    line: 1,
    snippet: `lovable tool url must be ${AFFILIATE_URL} (got ${tool.url})`,
  });
}

const constantSource = fs.readFileSync(
  path.join(root, "lib/affiliates/lovable.ts"),
  "utf8",
);
if (!constantSource.includes(`"${AFFILIATE_URL}"`)) {
  failures.push({
    file: "lib/affiliates/lovable.ts",
    line: 1,
    snippet: `LOVABLE_AFFILIATE_URL must equal ${AFFILIATE_URL}`,
  });
}

if (failures.length === 0) {
  console.log(
    "check:lovable-affiliate — ok (no raw lovable.dev hrefs outside the affiliate module; manifest url matches)",
  );
  process.exit(0);
}

console.error(
  `check:lovable-affiliate — ${failures.length} raw Lovable href(s) / sync issue(s):`,
);
for (const failure of failures) {
  console.error(`  ${failure.file}:${failure.line}  ${failure.snippet}`);
}
console.error(
  "\nUse LOVABLE_AFFILIATE_URL / <LovableLink> from lib/affiliates/lovable.ts instead.",
);
process.exit(1);
