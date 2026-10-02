#!/usr/bin/env node
/**
 * WP46 production gate for the editorial workspace.
 *
 *   npm run build
 *   node tests/editorial/scripts/verify-production-build.mjs            # bundle scan
 *   npx next start -p 3247 &                                            # separate shell
 *   node tests/editorial/scripts/verify-production-build.mjs --probe http://localhost:3247
 *
 * 1. Scans `.next/` for fixture code and fictional demo data. Any hit fails:
 *    production builds must not contain the fixture adapter or its content.
 * 2. With --probe, requests every editorial path from a production server —
 *    with attempts to switch fixture mode on through the URL and cookies, and
 *    with a forged Convex Auth session — and requires a real 404 whose body
 *    carries no editorial or fixture content, plus private, no-store, noindex
 *    headers. It then calls every editorial server action directly and
 *    requires a refusal or WORKSPACE_UNAVAILABLE, never data.
 *
 * Works for both kinds of build: without a Convex URL every editorial path is
 * a static 404; with one (WP46-E4e) middleware refuses anyone the backend does
 * not confirm as the super-admin.
 *
 * WP46-E4f adds the URL forms that once skipped middleware (a final segment
 * that looks like an asset, Next.js segment-prefetch paths), RSC requests,
 * the anti-framing headers, a body comparison with an unknown path, and the
 * same server actions posted to the home page (Next.js forwards them).
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
  "/admin/editorial/ideas/idea_0318",
  "/admin/editorial/ideas/idea_0318?revision=rev_0001&tab=preview&inspector=details",
  "/admin/editorial/ideas/not-an-idea",
  "/admin/editorial?fixture=local-demo",
  "/admin/editorial?EDITORIAL_FIXTURE_MODE=local-demo",
  "/admin/editorial/library?mode=fixture",
  "/admin",
  // Once outside the middleware matcher: a final segment that looks like an asset.
  "/admin/editorial/ideas/idea_0318.js",
  "/admin/editorial/ideas/idea_0318.css",
  // Next.js transport forms (prerendered segment payloads).
  "/admin/editorial.segments/_tree.segment.rsc",
  "/admin/editorial/library.segments/_tree.segment.rsc",
  // A percent-encoded spelling, in case a router decodes before it matches.
  "/%61dmin/editorial",
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

/** An unsigned, unexpired JWT: middleware passes it on and Convex must refuse it. */
function forgedSessionCookie() {
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({ iat: now, exp: now + 3600, sub: "forged|forged" })).toString("base64url");
  return `__convexAuthJWT=eyJhbGciOiJSUzI1NiJ9.${payload}.forged; __convexAuthRefreshToken=forged`;
}

const ATTEMPTS = [
  { label: "fixture switch", headers: { cookie: "EDITORIAL_FIXTURE_MODE=local-demo; editorial_mode=fixture" } },
  { label: "forged session", headers: { cookie: forgedSessionCookie() } },
  // A client-side navigation or prefetch asks for the RSC payload, not HTML.
  { label: "RSC request", rsc: true, headers: { cookie: forgedSessionCookie(), RSC: "1", "Next-Router-Prefetch": "1" } },
];

function privateHeaders(response) {
  return (
    /noindex/.test(response.headers.get("x-robots-tag") ?? "") &&
    /no-store/.test(response.headers.get("cache-control") ?? "") &&
    response.headers.get("referrer-policy") === "no-referrer" &&
    response.headers.get("x-frame-options") === "DENY" &&
    /frame-ancestors 'none'/.test(response.headers.get("content-security-policy") ?? "")
  );
}

/** Rewrite markers Next.js may add; the body is identical, these are not (documented). */
function rewriteMarkers(response) {
  return ["x-middleware-rewrite", "x-nextjs-rewritten-path"].filter((name) => response.headers.has(name));
}

function headSignature(html) {
  const tags = html.match(/<(meta|title|link rel="canonical")[^>]*>(?:[^<]*<\/title>)?/g) ?? [];
  return [...new Set(tags)].sort().join("\n");
}

async function probe(base) {
  const residual = new Set();
  const markers = new Set();
  let differentBodies = 0;
  let htmlAttempts = 0;
  const control = await fetch(new URL("/__wp46-control-missing-page", base), { redirect: "manual" });
  const controlBody = await control.text();
  const controlHead = headSignature(controlBody);
  let ok = control.status === 404;
  console.log(`${ok ? "PASS" : "FAIL"} ${control.status} control 404 for comparison`);
  for (const route of PATHS) {
    for (const attempt of ATTEMPTS) {
      const response = await fetch(new URL(route, base), { redirect: "manual", headers: attempt.headers });
      const body = await response.text();
      const leaked = [...SENTINELS, ...UI_PHRASES].filter((phrase) => body.includes(phrase));
      // An RSC payload carries no HTML head; its headers still have to be private.
      const noindex = attempt.rsc || /<meta name="robots" content="noindex/.test(body);
      const headers = privateHeaders(response);
      const passed = response.status === 404 && leaked.length === 0 && noindex && headers;
      ok &&= passed;
      for (const marker of rewriteMarkers(response)) markers.add(marker);
      if (!attempt.rsc) {
        htmlAttempts += 1;
        if (body !== controlBody) differentBodies += 1;
        if (headSignature(body) !== controlHead) residual.add(route);
      }
      console.log(
        `${passed ? "PASS" : "FAIL"} ${response.status} ${route} (${attempt.label})` +
          `${leaked.length ? ` leaked: ${leaked.join(", ")}` : ""}` +
          `${noindex ? "" : " missing noindex"}` +
          `${headers ? "" : " missing private headers"}`,
      );
    }
  }
  console.log(
    `${differentBodies === 0 ? "PASS" : "NOTE"} ${htmlAttempts - differentBodies}/${htmlAttempts} denied HTML bodies are byte-identical to an unknown path's.`,
  );
  if (markers.size > 0) {
    console.log(`NOTE denied responses carry Next.js rewrite markers (${[...markers].join(", ")}); an unknown path does not.`);
  }
  if (residual.size > 0) {
    // Known limitation, reported rather than hidden: a statically prerendered
    // notFound() is served as Next's error shell (with prerender cache
    // headers), not the full site 404 page. Making it byte-identical needs the
    // proxy/middleware seam (WP46-E4 integration window).
    console.log(
      `NOTE ${residual.size} editorial path(s) return 404 via Next's error shell, not the full site 404 document ` +
        "(builds without a Convex URL; with one, middleware serves the site's own 404).",
    );
  }
  return ok && (await probeActions(base));
}

/** Benign, well-formed inputs for each editorial server action. */
const ACTION_INPUTS = {
  saveDraftAction: {
    ideaId: "idea_0318",
    revisionId: "rev_0001",
    baseVersion: 1,
    patch: { title: "Probe" },
    idempotencyKey: "probe-key-0001",
  },
  createRevisionAction: { ideaId: "idea_0318", fromRevisionId: null, idempotencyKey: "probe-key-0002", carry: null },
  discardRevisionAction: { ideaId: "idea_0318", revisionId: "rev_0001", expectedVersion: 1, reason: "Probe" },
  runChecksAction: { ideaId: "idea_0318", revisionId: "rev_0001", expectedArtifactHash: "0".repeat(64) },
  getRevisionAction: { ideaId: "idea_0318", revisionId: "rev_0001" },
  // Review
  decideCandidateAction: {
    ideaId: "idea_0318",
    revisionId: "rev_0001",
    expectedVersion: 1,
    input: { decision: "accepted", rationale: "Probe" },
  },
  markReviewedAction: { ideaId: "idea_0318", revisionId: "rev_0001", itemId: "section:problem", dependencyHash: "x", note: null },
  retractReviewAction: { ideaId: "idea_0318", revisionId: "rev_0001", itemId: "section:problem" },
  flagReviewItemAction: {
    ideaId: "idea_0318",
    revisionId: "rev_0001",
    itemId: "section:problem",
    dependencyHash: "x",
    input: { severity: "low", note: "Probe" },
  },
  resolveIssueAction: { ideaId: "idea_0318", revisionId: "rev_0001", issueId: "issue", dependencyHash: "x", note: "Probe" },
  addNoteAction: { ideaId: "idea_0318", revisionId: "rev_0001", target: { kind: "section", id: "problem" }, note: "Probe" },
  requestChangesAction: { ideaId: "idea_0318", revisionId: "rev_0001", note: "Probe" },
  resumeReviewAction: { ideaId: "idea_0318", revisionId: "rev_0001" },
  approveRevisionAction: {
    ideaId: "idea_0318",
    revisionId: "rev_0001",
    artifactHash: "0".repeat(64),
    input: { attest: true, note: null },
  },
  // Releases and lifecycle
  prepareReleaseAction: { revisionId: "rev_0001", expectedLiveReleaseId: null, idempotencyKey: "probe-key-0003" },
  publishReleaseAction: { releaseId: "rel_0001", expectedState: "preview_ready", approvalId: "apr_0001", idempotencyKey: "probe-key-0004" },
  cancelReleaseAction: { releaseId: "rel_0001", expectedState: "preview_ready", reason: "Probe" },
  retryReleaseAction: { releaseId: "rel_0001", expectedState: "failed", idempotencyKey: "probe-key-0005" },
  reconcileReleaseAction: { releaseId: "rel_0001" },
  requestRollbackAction: {
    ideaId: "idea_0318",
    targetReleaseId: "rel_0001",
    expectedLiveReleaseId: "rel_0002",
    reason: "Probe",
    idempotencyKey: "probe-key-0006",
  },
  unpublishIdeaAction: { ideaId: "idea_0318", expectedLiveReleaseId: "rel_0001", reason: "Probe", idempotencyKey: "probe-key-0007" },
  trashIdeaAction: { ideaId: "idea_0318", expectedVersion: 1, reason: "Probe" },
  restoreIdeaAction: { ideaId: "idea_0318", expectedVersion: 1, reason: "Probe" },
  // Local demo controls (must be unavailable in production too)
  demoConfirmStrongAuthAction: {},
  demoExpireStrongAuthAction: {},
  demoSetKillSwitchAction: { engaged: true },
  demoFailNextDeployAction: {},
  demoLoseNextAckAction: {},
  demoBumpPolicyAction: {},
  demoRunWorkerAction: {},
  demoResetAction: {},
};

/**
 * Server actions are POST endpoints that exist in the production build even
 * though every editorial page is a 404. Call each one directly (as an
 * attacker could) and require that it either refuses before running or
 * reports the workspace unavailable, with no fixture data in the response.
 */
async function probeActions(base) {
  const manifestPath = path.join(NEXT_DIR, "server", "server-reference-manifest.json");
  if (!fs.existsSync(manifestPath)) {
    console.log("NOTE no server action manifest found; skipping the action probe.");
    return true;
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const actions = Object.entries(manifest.node ?? {}).filter(([, entry]) => entry.filename?.startsWith("app/admin/editorial/"));
  let ok = true;
  for (const [id, entry] of actions) {
    const input = ACTION_INPUTS[entry.exportedName];
    if (!input) {
      console.log(`FAIL action ${entry.exportedName} has no probe input; add one.`);
      ok = false;
      continue;
    }
    const origin = new URL(base).origin;
    // Post to a page that bundles the action (its first worker), e.g.
    // "app/admin/editorial/ideas/[ideaId]/page" -> "/admin/editorial/ideas/idea_0318",
    // and to the home page, which Next.js forwards to the action's own page.
    const worker = Object.keys(entry.workers ?? {})[0] ?? "app/admin/editorial/page";
    const own = worker.replace(/^app/, "").replace(/\/page$/, "").replace("[ideaId]", "idea_0318") || "/";
    for (const route of [own, "/"]) {
      const response = await fetch(new URL(route, base), {
        method: "POST",
        redirect: "manual",
        headers: {
          "Next-Action": id,
          Accept: "text/x-component",
          "Content-Type": "text/plain;charset=UTF-8",
          Origin: origin,
          cookie: `EDITORIAL_FIXTURE_MODE=local-demo; editorial_mode=fixture; ${forgedSessionCookie()}`,
        },
        body: JSON.stringify([input]),
      });
      const body = await response.text();
      const leaked = [...SENTINELS, ...UI_PHRASES].filter((phrase) => body.includes(phrase));
      const unavailable = body.includes("WORKSPACE_UNAVAILABLE");
      const refused = response.status >= 400;
      const passed = leaked.length === 0 && (unavailable || refused);
      ok &&= passed;
      console.log(
        `${passed ? "PASS" : "FAIL"} ${response.status} action ${entry.exportedName} via ${route}` +
          `${unavailable ? " → WORKSPACE_UNAVAILABLE" : refused ? " → refused" : " → ran without refusing"}` +
          `${leaked.length ? ` leaked: ${leaked.join(", ")}` : ""}`,
      );
    }
  }
  if (actions.length === 0) console.log("NOTE no editorial server actions in the build.");
  return ok;
}

const probeIndex = process.argv.indexOf("--probe");
const bundleOk = scanBundle();
const probeOk = probeIndex === -1 ? true : await probe(process.argv[probeIndex + 1]);
process.exit(bundleOk && probeOk ? 0 : 1);
