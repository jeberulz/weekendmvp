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
 *   recheck Fetch every cited page again and report what moved since the record was written: the old excerpt
 *           and the closest passage on the page now. Also reproduces first-hand evidence. Changes nothing
 *           unless --write is passed, which saves the result next to the record. Exit 1 when anything needs a person.
 *
 * Usage:
 *   npm run guide:source-review -- draft  --record=guides/records/my-guide.json --reviewer="Name"
 *   npm run guide:source-review -- verify --record=guides/records/my-guide.json [--fetch] [--now=2026-11-27]
 *   npm run guide:source-review -- seal   --record=guides/records/my-guide.json
 *   npm run guide:source-review -- check  --record=guides/records/my-guide.json [--now=2026-11-27]
 *   npm run guide:source-review -- recheck --record=guides/records/my-guide.json [--every=30] [--write] [--pages-dir=<dir>]
 *   npm run guide:source-review -- recheck --all [--every=30] [--write]
 *
 * The review defaults to the record's name with .source-review.json. The re-check result is written to the
 * record's name with .recheck.json. The script reads no environment variables. Fetching uses Node's own fetch,
 * which goes through a proxy only when Node is started with NODE_USE_ENV_PROXY=1 (a cloud session needs it).
 * --pages-dir reads saved pages instead of the network: one <source id>.html file per cited source.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RECORDS = path.join(ROOT, "guides", "records");

function usage(message) {
  if (message) console.error(`guide-source-review: ${message}\n`);
  console.error("usage: npm run guide:source-review -- <draft|verify|seal|check|recheck> --record=guides/records/<slug>.json [--review=<path>] [--reviewer=<name>] [--fetch] [--now=YYYY-MM-DD] [--force] [--json]\n       npm run guide:source-review -- recheck (--record=guides/records/<slug>.json | --all) [--every=<days>] [--write] [--pages-dir=<dir>] [--now=YYYY-MM-DD] [--json]");
  process.exit(2);
}

const [command, ...rest] = process.argv.slice(2);
if (!["draft", "verify", "seal", "check", "recheck"].includes(command ?? "")) usage("the first argument must be draft, verify, seal, check or recheck");

const args = { json: false, fetch: false, force: false, all: false, write: false };
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
  else if (flag === "--all") args.all = true;
  else if (flag === "--write") args.write = true;
  else if (flag === "--every") args.every = value();
  else if (flag === "--pages-dir") args.pagesDir = value();
  else usage(`unknown argument: ${rest[i]}`);
}
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
const recheckLib = await load(path.join(ROOT, "lib", "guides", "recheck.ts"));

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));

// recheck runs on one record or on all of them, so it takes over before the single-record steps below.
if (command === "recheck") await runRecheck();

if (!args.record) usage("--record is required");

const recordPath = path.resolve(ROOT, args.record);
if (!recordPath.startsWith(RECORDS + path.sep) || !recordPath.endsWith(".json") || isSidecar(recordPath)) {
  usage("--record must be a guides/records/<slug>.json file");
}
if (!fs.existsSync(recordPath)) usage(`no such record: ${path.relative(ROOT, recordPath)}`);
const reviewPath = args.review ? path.resolve(ROOT, args.review) : recordPath.replace(/\.json$/, ".source-review.json");
if (!reviewPath.startsWith(RECORDS + path.sep)) usage("--review must be inside guides/records/");
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

/** A file next to a record that is not a record: the sealed review and the re-check result. */
function isSidecar(file) {
  return file.endsWith(".source-review.json") || file.endsWith(".recheck.json");
}

async function fetchLive(url) {
  const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(20000), headers: { "user-agent": "weekendmvp-guide-source-check" } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

/** Re-check one record. Reads the record and the saved page text, writes only the .recheck.json file, and only with --write. */
async function recheckOne(recordFile, every) {
  const findings = [];
  const add = (rule, severity, message) => findings.push({ rule, severity, message });
  const rel = path.relative(ROOT, recordFile);
  const parsedRecord = researchRecordSchema.safeParse(readJson(recordFile));
  if (!parsedRecord.success) {
    for (const issue of parsedRecord.error.issues) add("record-invalid", "error", `${issue.path.join(".") || "record"}: ${issue.message}`);
    return { slug: path.basename(recordFile, ".json"), file: rel, ok: false, findings };
  }
  const rec = parsedRecord.data;
  const sidecarPath = recordFile.replace(/\.json$/, ".recheck.json");

  // When did a re-check last run, and is the next one overdue?
  let previous;
  if (fs.existsSync(sidecarPath)) {
    const saved = recheckLib.recheckFileSchema.safeParse(readJson(sidecarPath));
    if (saved.success) previous = saved.data;
    else add("recheck-file-invalid", "warn", "the saved re-check result is not valid, so the cadence cannot be worked out");
  }
  const schedule = recheckLib.recheckSchedule(previous?.checkedAt, every, now);
  if (schedule.neverChecked) add("recheck-never", "info", "this record has not been re-checked before");
  else if (schedule.overdueByDays > 0) add("recheck-overdue", "warn", `the last re-check was ${schedule.daysSince} days ago, the cadence is ${every} days`);
  else add("recheck-last", "info", `the last re-check was ${schedule.daysSince} days ago, the cadence is ${every} days`);
  if (previous && previous.recordHash !== review.recordHash(rec)) add("recheck-record-changed", "info", "the record changed since the last re-check");

  // Pages: the live web, or saved copies with --pages-dir.
  const pagesDir = args.pagesDir ? path.resolve(ROOT, args.pagesDir) : undefined;
  const readPage = pagesDir
    ? async (_url, sourceId) => {
        const saved = path.join(pagesDir, `${sourceId}.html`);
        if (!fs.existsSync(saved)) throw new Error(`no saved page for source "${sourceId}"`);
        return fs.readFileSync(saved, "utf8");
      }
    : (url) => fetchLive(url);
  const claims = recheckLib.recheckClaims(rec, await recheckLib.fetchPages(rec, readPage));
  for (const c of claims) {
    const at = `claim "${c.claimId}" (${c.sourceId})`;
    if (c.status === "unchanged") add("claim-unchanged", "info", `${at}: ${c.detail}`);
    else if (c.status === "drifted") add("claim-drifted", "error", `${at}: ${c.detail}\n         old: "${c.oldExcerpt}"\n         new: "${c.newExcerpt}"`);
    else if (c.status === "gone") add("claim-gone", "error", `${at}: ${c.detail}\n         old: "${c.oldExcerpt}"`);
    else add("claim-unreachable", "error", `${at}: ${c.detail}`);
  }

  // First-hand evidence is checked against this repo again too. A count that no longer holds is drift.
  let evidenceMismatch = 0;
  for (const r of verifyClaims.verifyEvidence(rec, repoRunners())) {
    if (r.status === "mismatch") {
      evidenceMismatch++;
      add("evidence-mismatch", "error", `evidence "${r.evidenceId}": ${r.detail}`);
    } else if (r.status === "verified") add("evidence-verified", "info", `evidence "${r.evidenceId}": ${r.detail}`);
  }

  // A re-check does not reset a source's age. That date moves only when someone updates it and the review is redone.
  for (const f of review.sourceFreshness(rec, now)) {
    if (f.level !== "ok") {
      add("source-aging", f.level === "fail" ? "error" : "warn", `source "${f.sourceId}" was last checked ${f.ageDays} days ago. A re-check does not reset this: update dateChecked in the record and have the review done again.`);
    }
  }

  const report = recheckLib.buildRecheckFile({ record: rec, claims, evidenceMismatch, checkedAt: new Date(now).toISOString(), everyDays: every });
  let written = false;
  if (args.write) {
    if (claims.some((c) => c.status === "unreachable")) {
      add("recheck-not-written", "error", "not saved: a page could not be read, so this re-check is incomplete and saving it would reset the clock without checking everything");
    } else {
      fs.writeFileSync(sidecarPath, `${JSON.stringify(report, null, 2)}\n`);
      written = true;
      add("recheck-written", "info", `saved ${path.relative(ROOT, sidecarPath)}`);
    }
  }
  return { slug: rec.slug, file: rel, ok: !findings.some((f) => f.severity === "error"), findings, report, written };
}

async function runRecheck() {
  if (args.all && args.record) usage("use --all or --record, not both");
  if (!args.all && !args.record) usage("recheck needs --record=guides/records/<slug>.json or --all");
  if (args.all && args.pagesDir) usage("--pages-dir works with --record only, saved pages are named by source id");
  const every = args.every === undefined ? recheckLib.DEFAULT_RECHECK_DAYS : Number(args.every);
  if (!Number.isInteger(every) || every < 1 || every > 365) usage("--every must be a whole number of days from 1 to 365");
  if (args.pagesDir && !fs.existsSync(path.resolve(ROOT, args.pagesDir))) usage(`no such pages folder: ${args.pagesDir}`);

  let files;
  if (args.all) {
    files = fs.existsSync(RECORDS)
      ? fs.readdirSync(RECORDS).filter((name) => name.endsWith(".json") && !isSidecar(name)).sort().map((name) => path.join(RECORDS, name))
      : [];
    if (files.length === 0) usage("there are no records in guides/records");
  } else {
    const file = path.resolve(ROOT, args.record);
    if (!file.startsWith(RECORDS + path.sep) || !file.endsWith(".json") || isSidecar(file)) usage("--record must be a guides/records/<slug>.json file");
    if (!fs.existsSync(file)) usage(`no such record: ${path.relative(ROOT, file)}`);
    files = [file];
  }

  const results = [];
  for (const file of files) results.push(await recheckOne(file, every));
  const ok = results.every((r) => r.ok);
  if (args.json) console.log(JSON.stringify({ command: "recheck", ok, results }, null, 2));
  else {
    for (const r of results) {
      console.log(`re-check ${r.slug}`);
      for (const f of r.findings) console.log(`${f.severity.padEnd(5)}  ${f.rule}: ${f.message}`);
      const errors = r.findings.filter((f) => f.severity === "error").length;
      const warns = r.findings.filter((f) => f.severity === "warn").length;
      const c = r.report?.counts;
      const tally = c ? `${c.unchanged} unchanged, ${c.drifted} drifted, ${c.gone} gone, ${c.unreachable} unreachable, ${c.evidenceMismatch} evidence mismatches` : "not run";
      console.log(`${errors === 0 ? "PASS" : "FAIL"} recheck ${r.slug}: ${tally}, ${warns} warnings`);
    }
  }
  process.exit(ok ? 0 : 1);
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
    for (const result of await verifyClaims.verifyExcerpts(record, fetchLive)) {
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
