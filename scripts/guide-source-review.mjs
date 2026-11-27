#!/usr/bin/env node
/**
 * Source Critic for guides (WP103-S4). Works on a guide's research record in guides/records/.
 *
 * Imports TypeScript modules, so run it with `node --experimental-strip-types`
 * (npm run guide:source-review). Exit 0 on success, 1 when a check fails, 2 on a usage error.
 *
 *   draft   Write a review skeleton next to the record. Every check starts false, so it fails until judged.
 *   verify  Mechanical checks: the record is consistent, first-hand evidence reproduces from this repo,
 *           and with --fetch each cited page is re-fetched and must contain its excerpt.
 *   seal    Take a review a reviewer has filled in and seal it against the record. It sets the verdict from
 *           the checks, so a false check cannot be sealed as a PASS.
 *   check   The gate before a guide is drafted: exit 0 only for a sealed PASS on exactly this record.
 *
 * Usage:
 *   npm run guide:source-review -- draft  --record=guides/records/my-guide.json --reviewer="Name"
 *   npm run guide:source-review -- verify --record=guides/records/my-guide.json [--fetch] [--now=2026-11-27]
 *   npm run guide:source-review -- seal   --record=guides/records/my-guide.json
 *   npm run guide:source-review -- check  --record=guides/records/my-guide.json [--now=2026-11-27]
 *
 * The review defaults to the record's name with .source-review.json. The script reads no environment
 * variables. --fetch uses Node's own fetch, which does not go through a proxy.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RECORDS = path.join(ROOT, "guides", "records");

function usage(message) {
  if (message) console.error(`guide-source-review: ${message}\n`);
  console.error("usage: npm run guide:source-review -- <draft|verify|seal|check> --record=guides/records/<slug>.json [--review=<path>] [--reviewer=<name>] [--fetch] [--now=YYYY-MM-DD] [--force] [--json]");
  process.exit(2);
}

const [command, ...rest] = process.argv.slice(2);
if (!["draft", "verify", "seal", "check"].includes(command ?? "")) usage("the first argument must be draft, verify, seal or check");

const args = { json: false, fetch: false, force: false };
for (let i = 0; i < rest.length; i++) {
  const [flag, inline] = rest[i].split(/=(.*)/s);
  const value = () => inline ?? rest[++i];
  if (flag === "--record") args.record = value();
  else if (flag === "--review") args.review = value();
  else if (flag === "--reviewer") args.reviewer = value();
  else if (flag === "--now") args.now = value();
  else if (flag === "--fetch") args.fetch = true;
  else if (flag === "--force") args.force = true;
  else if (flag === "--json") args.json = true;
  else usage(`unknown argument: ${rest[i]}`);
}
if (!args.record) usage("--record is required");

const recordPath = path.resolve(ROOT, args.record);
if (!recordPath.startsWith(RECORDS + path.sep) || !recordPath.endsWith(".json") || recordPath.endsWith(".source-review.json")) {
  usage("--record must be a guides/records/<slug>.json file");
}
if (!fs.existsSync(recordPath)) usage(`no such record: ${path.relative(ROOT, recordPath)}`);
const reviewPath = args.review ? path.resolve(ROOT, args.review) : recordPath.replace(/\.json$/, ".source-review.json");
if (!reviewPath.startsWith(RECORDS + path.sep)) usage("--review must be inside guides/records/");

let now = Date.now();
if (args.now !== undefined) {
  now = Date.parse(`${args.now}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.now) || Number.isNaN(now)) usage("--now must be a date like 2026-11-27");
}
const today = new Date(now).toISOString().slice(0, 10);

const load = (file) => import(pathToFileURL(file).href);
const { researchRecordSchema } = await load(path.join(ROOT, "lib", "guides", "research-record.ts"));
const review = await load(path.join(ROOT, "lib", "guides", "guide-review.ts"));
const verifyClaims = await load(path.join(ROOT, "lib", "guides", "verify-claims.ts"));

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const parsed = researchRecordSchema.safeParse(readJson(recordPath));
if (!parsed.success) {
  for (const issue of parsed.error.issues) console.error(`error  record-invalid (${issue.path.join(".") || "record"}): ${issue.message}`);
  console.error(`FAIL ${path.relative(ROOT, recordPath)}: the record is not valid`);
  process.exit(1);
}
const record = parsed.data;

const findings = [];
const add = (rule, severity, message) => findings.push({ rule, severity, message });
const finish = (label) => {
  const errors = findings.filter((f) => f.severity === "error").length;
  const warns = findings.filter((f) => f.severity === "warn").length;
  if (args.json) console.log(JSON.stringify({ command, slug: record.slug, ok: errors === 0, findings }, null, 2));
  else {
    for (const f of findings) console.log(`${f.severity.padEnd(5)}  ${f.rule}: ${f.message}`);
    console.log(errors === 0 ? `PASS ${label}: 0 errors, ${warns} warnings` : `FAIL ${label}: ${errors} errors, ${warns} warnings`);
  }
  process.exit(errors === 0 ? 0 : 1);
};

function repoRunners() {
  const git = (...gitArgs) => execFileSync("git", gitArgs, { cwd: ROOT, encoding: "utf8" }).trim();
  return {
    countFiles(dir, ext) {
      const folder = path.resolve(ROOT, dir);
      if (!folder.startsWith(ROOT + path.sep)) throw new Error(`${dir} is outside the repo`);
      return fs.readdirSync(folder).filter((name) => name.endsWith(ext)).length;
    },
    gitCount(what) {
      // A shallow clone has only part of the history, so counting it would be wrong, not just low.
      if (git("rev-parse", "--is-shallow-repository") === "true") return null;
      if (what === "commits") return Number(git("rev-list", "--count", "HEAD"));
      return git("log", "--format=%s", "HEAD").split("\n").filter((subject) => /\(#\d+\)\s*$/.test(subject)).length;
    },
  };
}

if (command === "draft") {
  if (fs.existsSync(reviewPath) && !args.force) usage(`${path.relative(ROOT, reviewPath)} already exists, pass --force to replace it`);
  const draft = review.buildDraftReview(record, args.reviewer ?? "unassigned", new Date(now).toISOString());
  fs.writeFileSync(reviewPath, `${JSON.stringify(draft, null, 2)}\n`);
  console.log(`wrote ${path.relative(ROOT, reviewPath)}: ${draft.items.length} claims to judge, every check starts false`);
  process.exit(0);
}

if (command === "verify") {
  for (const f of verifyClaims.checkRecordConsistency(record)) add(f.rule, f.severity, f.message);

  for (const result of verifyClaims.verifyEvidence(record, repoRunners())) {
    if (result.status === "mismatch") add("evidence-mismatch", "error", `evidence "${result.evidenceId}": ${result.detail}`);
    else if (result.status === "unverifiable") add("evidence-unverifiable", "info", `evidence "${result.evidenceId}": ${result.detail}`);
    else add("evidence-verified", "info", `evidence "${result.evidenceId}": ${result.detail}`);
  }

  for (const f of review.sourceFreshness(record, now)) {
    if (f.level !== "ok") add("source-aging", f.level === "fail" ? "error" : "warn", `source "${f.sourceId}" was last checked ${f.ageDays} days ago`);
  }

  if (args.fetch) {
    const fetchText = async (url) => {
      const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(20000), headers: { "user-agent": "weekendmvp-guide-source-check" } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.text();
    };
    for (const result of await verifyClaims.verifyExcerpts(record, fetchText)) {
      if (result.status === "found") add("excerpt-found", "info", `claim "${result.claimId}": ${result.detail}`);
      else add(result.status === "unreachable" ? "excerpt-unreachable" : "excerpt-not-found", "error", `claim "${result.claimId}" (${result.sourceId}): ${result.detail}`);
    }
  } else {
    add("excerpts-not-fetched", "info", "excerpts were not re-fetched, pass --fetch to check each cited page");
  }
  finish(`verify ${record.slug}`);
}

if (!fs.existsSync(reviewPath)) usage(`no review at ${path.relative(ROOT, reviewPath)}, run draft first`);
const filled = readJson(reviewPath);

if (command === "seal") {
  const parsedReview = review.reviewSchema.safeParse(filled);
  if (!parsedReview.success) {
    for (const issue of parsedReview.error.issues) add("review-invalid", "error", `${issue.path.join(".") || "review"}: ${issue.message}`);
    finish(`seal ${record.slug}`);
  }
  let sealed;
  try {
    sealed = review.finalizeReview(record, parsedReview.data, new Date(now).toISOString());
  } catch (error) {
    if (!(error instanceof review.GuideReviewError)) throw error;
    for (const issue of error.issues) add("review-stale", "error", issue);
    add("review-stale", "error", "run draft with --force, judge every claim afresh, then seal");
    finish(`seal ${record.slug}`);
  }
  fs.writeFileSync(reviewPath, `${JSON.stringify(sealed, null, 2)}\n`);
  for (const failure of sealed.failures) add("review-failure", "error", failure);
  console.log(`sealed ${path.relative(ROOT, reviewPath)} with verdict ${sealed.verdict} on ${today}`);
  finish(`seal ${record.slug}`);
}

// check
try {
  review.assertReviewPass(record, filled, now);
  console.log(`PASS check ${record.slug}: a sealed Source Critic PASS covers all ${record.claims.length} claims`);
  process.exit(0);
} catch (error) {
  if (!(error instanceof review.GuideReviewError)) throw error;
  for (const issue of error.issues) add("review", "error", issue);
  finish(`check ${record.slug}`);
}
