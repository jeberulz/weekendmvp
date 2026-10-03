#!/usr/bin/env node
/**
 * Research CLI: brief → contract v2 research record JSON plus a run report
 * (WP54, evidence contract §10).
 *
 * Usage:
 *   npm run engine:research -- --fixture rfp-assistant --out /tmp/record.json
 *   npm run engine:research -- --brief path/to/brief.json --live [--out path]
 *
 * --fixture runs the hermetic synthetic fixture (mode "fixture"): no API keys,
 * no network, and only the fixture's own briefs (engine/briefs/fixtures/,
 * slug FIXTURE_BRIEF_SLUG, which no published idea uses). Its default output
 * is engine/records/fixtures/{slug}.json, and it refuses to write a record
 * straight into engine/records/ where published records live (ruling R11).
 * --live spends against the real providers (mode "live"). There is no
 * implicit mode.
 *
 * The record is validated with parseResearchRecord before it is written,
 * and an existing record or run report is never overwritten without --force
 * (checked before anything runs; the writes themselves refuse an existing
 * file too). The run report
 * is written on success AND failure and names the code revision (ruling
 * R12: git HEAD and whether tracked files had changes; nulls when git is
 * unavailable, which never fails the run). Output never includes secrets,
 * page bodies, stack traces or absolute local paths.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function usage(exit = 1) {
  console.error(`Usage:
  node --experimental-strip-types scripts/engine-research.mjs --fixture <name> [--out path] [--report path] [--force]
  node --experimental-strip-types scripts/engine-research.mjs --brief path.json --live [--out path] [--report path] [--force]

Flags:
  --fixture name    Synthetic fixture providers (mode "fixture"; no API keys, no network).
                    Loads engine/briefs/fixtures/{name}.json; only briefs for the fixture's idea
                    (slug fixture-rfp-response-assistant). Cannot be combined with --brief or --live.
  --brief path      Brief JSON: { title, audience, revenueModel, seedKeywords[], slug?, oneLiner? }.
                    Requires --live.
  --live            Live providers (mode "live"). Reads OPENAI_API_KEY, PERPLEXITY_API_KEY,
                    DATAFORSEO_LOGIN, DATAFORSEO_PASSWORD from the shell, then .env.local,
                    then .env (shell values win).
  --out path        Record JSON (default: engine/records/{slug}.json; fixture runs:
                    engine/records/fixtures/{slug}.json, never engine/records/ itself).
  --report path     Run report JSON (default: {out}.report.json). Written on success and failure.
  --force           Overwrite an existing record and run report.
`);
  process.exit(exit);
}

function parseArgs(argv) {
  const out = {
    fixture: false,
    fixtureName: null,
    briefPath: null,
    outPath: null,
    reportPath: null,
    live: false,
    force: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") usage(0);
    else if (a === "--fixture") {
      out.fixture = true;
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        out.fixtureName = next;
        i++;
      }
    } else if (a === "--brief") {
      out.briefPath = argv[++i];
    } else if (a === "--out") {
      out.outPath = argv[++i];
    } else if (a === "--report") {
      out.reportPath = argv[++i];
    } else if (a === "--live") {
      out.live = true;
    } else if (a === "--force") {
      out.force = true;
    } else {
      console.error(`unknown arg: ${a}`);
      usage(1);
    }
  }
  return out;
}

/**
 * Standalone Node does not read env files. Load .env.local then .env so live
 * keys work the same way they do for `next dev`. loadEnvFile never overrides
 * a variable already set, so the shell wins, then .env.local, then .env.
 */
function loadLocalEnv() {
  for (const name of [".env.local", ".env"]) {
    const envPath = path.join(root, name);
    if (fs.existsSync(envPath)) process.loadEnvFile(envPath);
  }
}

/** A path for terminal output: repo-relative inside the repo, else only the file name. */
function displayPath(p) {
  const rel = path.relative(root, path.resolve(p));
  return rel && !rel.startsWith("..") && !path.isAbsolute(rel) ? rel : `…/${path.basename(p)}`;
}

function fail(message) {
  console.error(`engine:research: ${message}`);
  process.exit(1);
}

const SHA_RE = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;

/**
 * Ruling R12: the code revision that runs, from git. `sha` is HEAD; `dirty`
 * is true when TRACKED files differ from HEAD (untracked outputs of earlier
 * runs do not count). Each is null when git is unavailable or fails; the run
 * goes on either way, so these catches are deliberate.
 */
function codeRevision() {
  const git = (args) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 10_000 });
  let sha = null;
  let dirty = null;
  try {
    const head = git(["rev-parse", "HEAD"]).trim();
    sha = SHA_RE.test(head) ? head : null;
  } catch {
    sha = null; // git missing, not a repository, or no PATH: the revision is unknown
  }
  try {
    dirty = git(["status", "--porcelain", "--untracked-files=no"]).trim() !== "";
  } catch {
    dirty = null; // same: unknown, never a failure
  }
  return { sha, dirty };
}

function formatCounts(entries) {
  const parts = entries.filter(([, n]) => n > 0).map(([key, n]) => `${key} ${n}`);
  return parts.length > 0 ? parts.join(", ") : "none";
}

function rejectedByReason(report) {
  const counts = new Map();
  for (const r of report.evidence.rejected) counts.set(r.reason, (counts.get(r.reason) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function printSummary(report, paths) {
  const head = report.ok
    ? `engine:research ok · mode ${report.mode} · slug ${report.briefSlug}`
    : `engine:research FAILED at ${report.failedStep} · mode ${report.mode} · slug ${report.briefSlug || "(none)"}`;
  const lines = [head];
  if (!report.ok && report.error) lines.push(`  error: ${report.error}`);
  lines.push(
    `  cost $${report.costUsd.toFixed(4)} · attempts ${formatCounts(Object.entries(report.attempts))}`,
    `  accepted: ${formatCounts(Object.entries(report.evidence.accepted))}`,
    `  rejected: ${formatCounts(rejectedByReason(report))}`,
  );
  if (paths.record) lines.push(`  record: ${displayPath(paths.record)}`);
  lines.push(`  report: ${displayPath(paths.report)}`);
  (report.ok ? console.log : console.error)(lines.join("\n"));
}

/** True when anything is at `p`, a dangling symbolic link included (lstat, not stat). */
function pathTaken(p) {
  return fs.lstatSync(p, { throwIfNoEntry: false }) !== undefined;
}

/** Writes the run report; without --force an existing file (or one created meanwhile) is never replaced. */
function writeReport(reportPath, report, force) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  try {
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, { flag: force ? "w" : "wx" });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "EEXIST") {
      fail(`refusing to overwrite ${displayPath(reportPath)} (pass --force to replace it)`);
    }
    throw error;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.live && args.fixture) fail("--live and --fixture are mutually exclusive");
  if (args.fixture && (args.briefPath || !args.fixtureName)) {
    fail("--fixture takes a fixture name (engine/briefs/{name}.json) and cannot be combined with --brief");
  }
  if (!args.fixture && !(args.briefPath && args.live)) {
    console.error("pass --fixture <name>, or --brief <path> --live");
    usage(1);
  }
  const mode = args.live ? "live" : "fixture";
  if (mode === "fixture" && !/^[a-z0-9-]+$/.test(args.fixtureName)) {
    fail("--fixture takes a fixture brief name such as rfp-assistant (letters, digits and dashes only)");
  }

  const [pipeline, providersModule, recordModule, fixtures, sourceText] = await Promise.all([
    import(pathToFileURL(path.join(root, "lib/engine/pipeline.ts")).href),
    import(pathToFileURL(path.join(root, "lib/engine/providers.ts")).href),
    import(pathToFileURL(path.join(root, "lib/engine/research-record.ts")).href),
    import(pathToFileURL(path.join(root, "lib/engine/providers/fixtures.ts")).href),
    import(pathToFileURL(path.join(root, "lib/engine/providers/sourceText.ts")).href),
  ]);

  const briefPath = args.briefPath ?? path.join(root, fixtures.FIXTURE_BRIEFS_DIR, `${args.fixtureName}.json`);
  if (!fs.existsSync(briefPath)) fail(`brief not found: ${displayPath(briefPath)}`);
  let rawBrief;
  try {
    rawBrief = JSON.parse(fs.readFileSync(briefPath, "utf8"));
  } catch {
    fail(`brief is not valid JSON: ${displayPath(briefPath)}`);
  }
  if (typeof rawBrief !== "object" || rawBrief === null || Array.isArray(rawBrief)) {
    fail(`brief must be a JSON object: ${displayPath(briefPath)}`);
  }
  const { runResearch, normalizeBriefInput, PipelineError } = pipeline;
  const { parseResearchRecord } = recordModule;
  const { redactText } = sourceText;

  // A fixture brief may name a synthetic page set; a live brief never may.
  const { fixtureScenario, ...brief } = rawBrief;
  if (fixtureScenario !== undefined) {
    if (mode === "live") fail("fixtureScenario is only allowed in fixture briefs (remove it to research live)");
    if (!fixtures.FIXTURE_SCENARIOS.includes(fixtureScenario)) {
      fail(`unknown fixtureScenario (known: ${fixtures.FIXTURE_SCENARIOS.join(", ")})`);
    }
  }

  let slug;
  try {
    slug = normalizeBriefInput(brief).slug;
  } catch (error) {
    fail(`invalid brief: ${redactText(error instanceof PipelineError ? error.detail : String(error), 300)}`);
  }
  // The fixture describes one idea; its data must never land under another slug.
  if (mode === "fixture" && slug !== fixtures.FIXTURE_BRIEF_SLUG) {
    fail(`fixture data describes ${fixtures.FIXTURE_BRIEF_SLUG} only (brief slug ${slug}); research other briefs with --brief <path> --live`);
  }

  const recordsDir = path.join(root, "engine", "records");
  const defaultOut =
    mode === "fixture" ? path.join(recordsDir, "fixtures", `${slug}.json`) : path.join(recordsDir, `${slug}.json`);
  const outPath = path.resolve(args.outPath || defaultOut);
  // Ruling R11: published records live directly in engine/records/; fixture output never does.
  if (mode === "fixture" && path.dirname(outPath) === recordsDir) {
    fail("a fixture record never goes to engine/records/ (published record paths); use engine/records/fixtures/ or a temp path");
  }
  const reportPath = path.resolve(args.reportPath || `${outPath}.report.json`);
  if (reportPath === outPath) fail("--report must differ from --out");
  if (pathTaken(outPath) && !args.force) {
    fail(`refusing to overwrite ${displayPath(outPath)} (pass --force to replace it)`);
  }
  // Security: --report may name any path; an existing file (or link) there is never replaced without --force.
  if (pathTaken(reportPath) && !args.force) {
    fail(`refusing to overwrite ${displayPath(reportPath)} (pass --force to replace it)`);
  }

  if (mode === "live") loadLocalEnv();
  const providers = providersModule.createProviders({
    mode,
    ...(fixtureScenario !== undefined ? { scenario: fixtureScenario } : {}),
  });

  let result;
  try {
    result = await runResearch({ brief, providers, mode, codeRevision: codeRevision() });
  } catch (error) {
    if (error instanceof PipelineError && error.report) {
      writeReport(reportPath, error.report, args.force);
      printSummary(error.report, { report: reportPath });
    } else {
      // Not a pipeline failure (no report exists): print the redacted message only.
      console.error(`engine:research: unexpected error: ${redactText(error instanceof Error ? error.message : String(error), 300)}`);
    }
    process.exit(1);
  }

  // CLI boundary: validate exactly the bytes that will be written.
  const text = `${JSON.stringify(result.record, null, 2)}\n`;
  try {
    parseResearchRecord(JSON.parse(text));
  } catch (error) {
    const report = {
      ...result.report,
      ok: false,
      failedStep: "provenance_parse",
      error: redactText(`record failed validation at the CLI boundary: ${error instanceof Error ? error.message : String(error)}`, 600),
    };
    writeReport(reportPath, report, args.force);
    printSummary(report, { report: reportPath });
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, text, { flag: args.force ? "w" : "wx" });
  writeReport(reportPath, result.report, args.force);
  printSummary(result.report, { record: outPath, report: reportPath });
}

/** Absolute local paths out of a message (this runs even if the TS modules failed to load). */
function scrubPaths(text) {
  return text.replace(/(?:\/(?:Users|home|private|tmp|var|opt|root)\/|[A-Za-z]:\\)[^\s'"<>)]*/g, "[path]");
}

main().catch((err) => {
  // Never print a stack trace: it carries local paths.
  console.error(`engine:research: ${scrubPaths(err instanceof Error ? err.message : String(err))}`);
  process.exit(1);
});
