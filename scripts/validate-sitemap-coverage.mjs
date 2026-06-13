#!/usr/bin/env node
/**
 * Pre-cutover validation: confirm every URL in the legacy sitemap.xml
 * resolves on the new Next.js deploy (200 or 301→200).
 *
 * Usage:
 *   node scripts/validate-sitemap-coverage.mjs <legacy-sitemap-path> <new-origin>
 *
 * Example:
 *   node scripts/validate-sitemap-coverage.mjs /tmp/legacy-sitemap.xml https://next.weekendmvp.app
 *
 * Exit codes:
 *   0 — every URL resolved (200 or 3xx→200)
 *   1 — at least one URL returned 4xx/5xx
 */

import { promises as fs } from "node:fs";

const [, , sitemapPath, origin] = process.argv;
if (!sitemapPath || !origin) {
  console.error(
    "Usage: validate-sitemap-coverage.mjs <legacy-sitemap.xml> <new-origin>",
  );
  process.exit(2);
}

const xml = await fs.readFile(sitemapPath, "utf8");
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
console.log(`Found ${urls.length} URLs in legacy sitemap.`);

const failures = [];
let count = 0;

for (const legacyUrl of urls) {
  const path = legacyUrl.replace(/^https?:\/\/[^/]+/, "");
  const target = `${origin}${path}`;
  try {
    const res = await fetch(target, { redirect: "follow" });
    count++;
    if (!res.ok) {
      failures.push({ url: target, status: res.status });
      console.error(`✗ ${res.status} ${target}`);
    } else if (count % 20 === 0) {
      console.log(`  ${count}/${urls.length}…`);
    }
  } catch (err) {
    failures.push({ url: target, error: err instanceof Error ? err.message : String(err) });
    console.error(`✗ ERR ${target}: ${err}`);
  }
}

console.log(`\nDone. Checked ${count}/${urls.length}. Failures: ${failures.length}`);
if (failures.length > 0) {
  for (const f of failures) console.error(JSON.stringify(f));
  process.exit(1);
}
