#!/usr/bin/env node
/**
 * WP46 production gate for the fixture-only editorial slice.
 *
 *   npm run build
 *   node tests/editorial/scripts/verify-production-build.mjs            # bundle scan
 *   npx next start -p 3247 &                                            # separate shell
 *   node tests/editorial/scripts/verify-production-build.mjs --probe http://localhost:3247
 *
 * 1. Scans `.next/` for fixture code and fictional demo data. Any hit fails:
 *    production builds must not contain the fixture adapter or its content.
 * 2. With --probe, requests every editorial path (plus attempts to switch
 *    fixture mode on through the URL) from a production server and requires
 *    a real 404 whose body carries no editorial or fixture content.
 */
import fs from "node:fs";
import path from "node:path";

const NEXT_DIR = path.resolve(".next");
const SENTINELS = [
  "FixtureEditorialRepository",
  "seedFixtureScenarios",
  "createFixtureEnvironment",
  "fixture-ingestion-",
  "Freelance Hub Forum",
  "freelance-hub.example",
  "invoice-follow-up-for-freelancers",
  "Local demo editor",
];
const TEXT_EXTENSIONS = new Set([".js", ".mjs", ".cjs", ".json", ".html", ".rsc", ".txt", ".map", ".body", ".meta"]);
const SKIP_DIRS = new Set(["cache", "dev", "trace"]);

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* walk(full);
    } else if (TEXT_EXTENSIONS.has(path.extname(entry.name)) || !path.extname(entry.name)) {
      yield full;
    }
  }
}

function scanBundle() {
  if (!fs.existsSync(path.join(NEXT_DIR, "BUILD_ID"))) {
    console.error("No production build found in .next/. Run `npm run build` first.");
    process.exit(2);
  }
  const hits = [];
  let scanned = 0;
  for (const file of walk(NEXT_DIR)) {
    const stat = fs.statSync(file);
    if (stat.size > 25 * 1024 * 1024) continue;
    scanned += 1;
    const text = fs.readFileSync(file, "utf8");
    for (const sentinel of SENTINELS) {
      if (text.includes(sentinel)) hits.push(`${path.relative(process.cwd(), file)}: ${sentinel}`);
    }
  }
  console.log(`Scanned ${scanned} build files for ${SENTINELS.length} fixture sentinels.`);
  if (hits.length > 0) {
    console.error(`FAIL: fixture code or data found in the production build:\n  ${hits.join("\n  ")}`);
    return false;
  }
  console.log("PASS: no fixture code or fixture data in the production build.");
  return true;
}

const PATHS = [
  "/admin/editorial",
  "/admin/editorial/library",
  "/admin/editorial/releases",
  "/admin/editorial/trash",
  "/admin/editorial/activity",
  "/admin/editorial/settings",
  "/admin/editorial/ideas/idea_0001",
  "/admin/editorial?fixture=local-demo",
  "/admin/editorial?EDITORIAL_FIXTURE_MODE=local-demo",
  "/admin/editorial/library?mode=fixture",
];

/** Editorial copy that must never appear in a denied response. */
const UI_PHRASES = [
  "Review queue",
  "Candidates and revisions waiting",
  "Every idea: live pages",
  "Every staged preview",
  "stay recoverable",
  "A read-only record of edits",
  "What this workspace can actually do",
  "Local demo",
  "fictional data",
  "editorial-main",
  "Weekend MVP / Editorial",
];

function headSignature(html) {
  const tags = html.match(/<(meta|title|link rel="canonical")[^>]*>(?:[^<]*<\/title>)?/g) ?? [];
  return [...new Set(tags)].sort().join("\n");
}

async function probe(base) {
  const residual = new Set();
  const control = await fetch(new URL("/__wp46-control-missing-page", base), { redirect: "manual" });
  const controlHead = headSignature(await control.text());
  let ok = control.status === 404;
  console.log(`${ok ? "PASS" : "FAIL"} ${control.status} control 404 for comparison`);
  for (const route of PATHS) {
    const response = await fetch(new URL(route, base), {
      redirect: "manual",
      headers: { cookie: "EDITORIAL_FIXTURE_MODE=local-demo; editorial_mode=fixture" },
    });
    const body = await response.text();
    const leaked = [...SENTINELS, ...UI_PHRASES].filter((phrase) => body.includes(phrase));
    const noindex = /<meta name="robots" content="noindex/.test(body);
    const passed = response.status === 404 && leaked.length === 0 && noindex;
    ok &&= passed;
    if (headSignature(body) !== controlHead) residual.add(route);
    console.log(
      `${passed ? "PASS" : "FAIL"} ${response.status} ${route}` +
        `${leaked.length ? ` leaked: ${leaked.join(", ")}` : ""}` +
        `${noindex ? "" : " missing noindex"}`,
    );
  }
  if (residual.size > 0) {
    // Known limitation, reported rather than hidden: a statically prerendered
    // notFound() is served as Next's error shell (with prerender cache
    // headers), not the full site 404 page. Making it byte-identical needs the
    // proxy/middleware seam (WP46-E4 integration window).
    console.log(
      `NOTE ${residual.size} editorial path(s) return 404 via Next's error shell, not the full site 404 document. ` +
        "Identical responses need the proxy seam (E4).",
    );
  }
  return ok;
}

const probeIndex = process.argv.indexOf("--probe");
const bundleOk = scanBundle();
const probeOk = probeIndex === -1 ? true : await probe(process.argv[probeIndex + 1]);
process.exit(bundleOk && probeOk ? 0 : 1);
