#!/usr/bin/env node
/**
 * WP90-S3. The per-idea crew seed precompute, operator-run.
 *
 * Builds each library idea's seed source from its own published page
 * (`content/ideas/{slug}.mdx` + its `ideas/manifest.json` row) and drives the
 * internal functions in `convex/crew/seeds.ts` / `seedsBatch.ts` with
 * `npx convex run`.
 *
 * Usage (run with `npm run crew:seeds -- …`):
 *   --seed-version 2026-11-07.1          required; one batch per version
 *   (default)                            dry run: estimate only, writes nothing
 *   --apply                              create the run, add the ideas, submit the batch
 *   --status <runId>                     print a run's summary
 *   --poll <runId>                       poll a run now (it also polls itself every minute)
 *   --slugs a,b,c   --limit N            narrow the ideas
 *   --prod | --deployment <name>         target (default: the CLI's dev deployment)
 *
 * The dry run calls `crew/seeds:estimateItems`, a read-only query: per idea,
 * whether it would be sent (or is unchanged since its seed at this version)
 * and its worst-case reservation at the batch rate. `--apply` spends money
 * when the deployment's AI_PROVIDER_MODE is `live`: every request is reserved
 * against the meter first, and a budget refusal stops the run short (the rest
 * are left for a later run). Output never includes model text or secrets.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SeedSourceError, seedSourceFromPage, seedSourceToJson } from "../lib/workspace/crew/seedSource.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);

function flag(name) {
  return argv.includes(name);
}
function value(name) {
  const at = argv.indexOf(name);
  if (at === -1) return null;
  const next = argv[at + 1];
  if (next === undefined || next.startsWith("--")) fail(`${name} needs a value`, 2);
  return next;
}
function fail(message, code = 1) {
  console.error(`error: ${message}`);
  process.exit(code);
}

const prod = flag("--prod");
const deployment = value("--deployment");
if (prod && deployment) fail("pass either --prod or --deployment <name>, not both", 2);
const targetFlags = deployment ? ["--deployment", deployment] : prod ? ["--prod"] : [];
const targetLabel = deployment ?? (prod ? "prod" : "dev");

/** One `npx convex run`; returns the parsed JSON result. */
function convexRun(fn, args) {
  const json = JSON.stringify(args);
  const res = spawnSync("npx", ["convex", "run", fn, json, ...targetFlags], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  if (res.status !== 0) {
    console.error((res.stderr || res.stdout || "").trim().split("\n").slice(-6).join("\n"));
    fail(`npx convex run ${fn} failed (exit ${res.status})`);
  }
  const out = (res.stdout || "").trim();
  try {
    return JSON.parse(out);
  } catch {
    return out;
  }
}

/** At most 25 items and about 180 KB per call: under argv and Convex argument limits. */
function chunks(items) {
  const out = [];
  let current = [];
  let size = 0;
  for (const item of items) {
    const bytes = Buffer.byteLength(JSON.stringify(item));
    if (current.length > 0 && (current.length >= 25 || size + bytes > 180_000)) {
      out.push(current);
      current = [];
      size = 0;
    }
    current.push(item);
    size += bytes;
  }
  if (current.length > 0) out.push(current);
  return out;
}

const usd = (micro) => `$${(micro / 1_000_000).toFixed(2)}`;

function loadSources() {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "ideas", "manifest.json"), "utf8"));
  const rows = Array.isArray(manifest) ? manifest : manifest.ideas;
  const slugs = value("--slugs");
  const wanted = slugs ? new Set(slugs.split(",").map((s) => s.trim()).filter(Boolean)) : null;
  const limitRaw = value("--limit");
  const limit = limitRaw === null ? Infinity : Number.parseInt(limitRaw, 10);
  if (!(limit > 0)) fail("--limit must be a positive integer", 2);

  const items = [];
  const refused = [];
  for (const row of rows) {
    if (wanted && !wanted.has(row.slug)) continue;
    if (items.length >= limit) break;
    const file = path.join(root, "content", "ideas", `${row.slug}.mdx`);
    if (!fs.existsSync(file)) {
      refused.push({ slug: row.slug, reason: "no published page" });
      continue;
    }
    try {
      const source = seedSourceFromPage({ mdx: fs.readFileSync(file, "utf8"), manifest: row });
      items.push({ ideaSlug: row.slug, sourceJson: seedSourceToJson(source), researchLevel: source.researchLevel });
    } catch (error) {
      refused.push({ slug: row.slug, reason: error instanceof SeedSourceError ? error.message : "unreadable page" });
    }
  }
  if (wanted) for (const slug of wanted) if (!rows.some((row) => row.slug === slug)) refused.push({ slug, reason: "not in the manifest" });
  return { items, refused };
}

function printSummary(summary) {
  console.log(`run ${summary.seedVersion}: ${summary.status}${summary.mode ? ` (${summary.mode})` : ""}${summary.batchId ? `, batch ${summary.batchId}` : ""}`);
  console.log(`  items: ${Object.entries(summary.counts).filter(([, n]) => n > 0).map(([k, n]) => `${k} ${n}`).join(", ") || "none"}`);
  console.log(`  reserved ${usd(summary.reservedMicroUsd)}, charged so far ${usd(summary.costMicroUsd)}, polls ${summary.polls}`);
  if (summary.note) console.log(`  note: ${summary.note}`);
  for (const finding of summary.auditFindings) console.log(`  audit: ${finding.ideaSlug} ${finding.code} at ${finding.path}`);
  for (const failure of summary.failures) console.log(`  ${failure.status}: ${failure.ideaSlug} (${failure.errorKind})`);
}

// ---------------------------------------------------------------------------

const statusRun = value("--status");
const pollRun = value("--poll");
if (statusRun) {
  printSummary(convexRun("crew/seeds:runSummary", { runId: statusRun }));
  process.exit(0);
}
if (pollRun) {
  console.log(JSON.stringify(convexRun("crew/seedsBatch:pollRun", { runId: pollRun })));
  printSummary(convexRun("crew/seeds:runSummary", { runId: pollRun }));
  process.exit(0);
}

const seedVersion = value("--seed-version");
if (!seedVersion || !/^[0-9A-Za-z._-]{1,40}$/.test(seedVersion)) fail("--seed-version is required (1-40 of [0-9A-Za-z._-], e.g. 2026-11-07.1)", 2);

const { items, refused } = loadSources();
console.log(`target: ${targetLabel}; seed version ${seedVersion}; ${items.length} idea pages read, ${refused.length} refused`);
for (const entry of refused) console.log(`  refused: ${entry.slug} (${entry.reason})`);
if (items.length === 0) fail("no ideas to seed");

const payload = (list) => list.map(({ ideaSlug, sourceJson }) => ({ ideaSlug, sourceJson }));
const estimate = [];
for (const part of chunks(payload(items))) estimate.push(...convexRun("crew/seeds:estimateItems", { seedVersion, items: part }));
const fresh = estimate.filter((row) => row.status === "new");
const unchanged = estimate.filter((row) => row.status === "unchanged");
const invalid = estimate.filter((row) => row.status === "invalid");
const worstCase = fresh.reduce((sum, row) => sum + row.reservedMicroUsd, 0);
console.log(`  would send ${fresh.length} (${fresh.filter((r) => r.validated).length} validated, ${fresh.filter((r) => !r.validated).length} not yet validated)`);
console.log(`  unchanged since their seed: ${unchanged.length}; refused by Convex: ${invalid.length}`);
for (const row of invalid) console.log(`  invalid: ${row.ideaSlug} (${row.reason})`);
console.log(`  worst-case reservation at the batch rate: ${usd(worstCase)} (the meter's free pool and kill switch apply; actual cost is usually far lower)`);

if (!flag("--apply")) {
  console.log("dry run: nothing reserved, sent or written. Re-run with --apply to submit.");
  process.exit(0);
}
if (fresh.length === 0) {
  console.log("nothing to send.");
  process.exit(0);
}

const sendable = new Set(fresh.map((row) => row.ideaSlug));
const runId = convexRun("crew/seeds:createRun", { seedVersion });
console.log(`run ${runId} created`);
for (const part of chunks(payload(items.filter((item) => sendable.has(item.ideaSlug))))) {
  const added = convexRun("crew/seeds:addItems", { runId, items: part });
  console.log(`  added ${added.added}, unchanged ${added.unchanged}`);
}
const submitted = convexRun("crew/seedsBatch:submitRun", { runId });
console.log(`submit: ${submitted.status}, ${submitted.submitted} sent, ${submitted.notReserved} not reserved${submitted.note ? ` (${submitted.note})` : ""}`);
console.log(`the run polls itself every minute. Check it with: npm run crew:seeds -- --status ${runId}${targetFlags.length ? ` ${targetFlags.join(" ")}` : ""}`);
