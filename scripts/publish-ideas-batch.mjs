#!/usr/bin/env node
/**
 * One-command Idea Engine batch driver (shared by Claude / Codex / Grok adapters).
 *
 * Runs the same npm CLIs as `/publish-idea`. It never invents evidence, never
 * auto-PASSes Source Critic, never seeds production, never flips the E7
 * release switch, and never uses Ideabrowser.
 *
 * Usage:
 *   npm run publish:ideas -- --coverage
 *   npm run publish:ideas -- --fixture-smoke
 *   npm run publish:ideas -- --briefs a.json,b.json --live --confirm-semantic-dedupe --stop-at source-review
 *   npm run publish:ideas -- --count 5 --briefs-dir engine/briefs/batch --live --confirm-semantic-dedupe
 *
 * Default stop: after research + Source Critic FAIL draft. Compile / audit /
 * editorial dry-run require an existing sealed PASS (operator/agent filled).
 *
 * Live spend requires --confirm-semantic-dedupe (Scout + Corpus Guardian).
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NODE_FLAGS = ["--experimental-strip-types", "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON"];

/** @type {string | null} */
let cachedEngineNode = null;

async function engineNodeBin() {
  if (cachedEngineNode) return cachedEngineNode;
  const mod = await import(pathToFileURL(path.join(root, "scripts/lib/resolve-engine-node.mjs")).href);
  const resolved = mod.resolveEngineNode();
  cachedEngineNode = resolved.bin;
  return cachedEngineNode;
}

const STAGES = ["research", "source-review", "compile", "audit", "editorial-dry"];

const HELP = `Usage:
  npm run publish:ideas -- --coverage
  npm run publish:ideas -- --fixture-smoke [--work-root dir]
  npm run publish:ideas -- --briefs path[,path...] --live --confirm-semantic-dedupe [--stop-at stage]
  npm run publish:ideas -- --briefs-dir dir --count N --live --confirm-semantic-dedupe

Stages (--stop-at, default source-review):
  research | source-review | compile | audit | editorial-dry

Hard rules:
  - Shared CLIs only (engine:research, engine:source-review, engine:compile,
    audit:idea, validate:idea-tags, editorial:submit-engine).
  - Live spend requires --confirm-semantic-dedupe (Scout + Corpus Guardian:
    customer / JTBD / workflow / mechanism vs corpus) before any provider call.
  - Source Critic never auto-PASS for live records.
  - No seed:convex --prod, no EDITORIAL_RELEASE_ENABLED, no git push.
  - Google Search Console is not used for candidate selection (report only).
  - Requires Node >= 22.6 (see scripts/lib/resolve-engine-node.sh).

Exit: 0 all requested stages ok, 1 stage failure, 2 usage, 3 unsupported Node.
`;

function usage(exit, message) {
  if (message) console.error(message);
  (exit === 0 ? console.log : console.error)(HELP);
  process.exit(exit);
}

function parseArgs(argv) {
  const out = {
    coverage: false,
    fixtureSmoke: false,
    briefs: [],
    briefsDir: null,
    count: null,
    live: false,
    stopAt: "source-review",
    forceResearch: false,
    workRoot: null,
    json: false,
    confirmSemanticDedupe: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") usage(0);
    else if (a === "--coverage") out.coverage = true;
    else if (a === "--fixture-smoke") out.fixtureSmoke = true;
    else if (a === "--briefs") {
      const raw = argv[++i];
      if (!raw) usage(2, "missing value for --briefs");
      out.briefs.push(...raw.split(",").map((p) => p.trim()).filter(Boolean));
    } else if (a === "--briefs-dir") out.briefsDir = argv[++i];
    else if (a === "--count") out.count = Number(argv[++i]);
    else if (a === "--live") out.live = true;
    else if (a === "--stop-at") out.stopAt = argv[++i];
    else if (a === "--force-research") out.forceResearch = true;
    else if (a === "--work-root") out.workRoot = argv[++i];
    else if (a === "--json") out.json = true;
    else if (a === "--confirm-semantic-dedupe") out.confirmSemanticDedupe = true;
    else usage(2, `unknown arg: ${a}`);
  }
  return out;
}

function stageIndex(name) {
  const idx = STAGES.indexOf(name);
  if (idx < 0) usage(2, `invalid --stop-at ${name}`);
  return idx;
}

function runNode(nodeBin, script, args, env = process.env) {
  const result = spawnSync(nodeBin, [...NODE_FLAGS, script, ...args], {
    cwd: root,
    encoding: "utf8",
    env,
    timeout: 600_000,
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
}

function loadManifestIdeas() {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "ideas/manifest.json"), "utf8"));
  const ideas = Array.isArray(manifest.ideas) ? manifest.ideas : [];
  return ideas;
}

function coverageReport() {
  const ideas = loadManifestIdeas();
  const counts = new Map();
  for (const idea of ideas) {
    const category = typeof idea.category === "string" ? idea.category : "uncategorized";
    counts.set(category, (counts.get(category) || 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
  const gscKey = Boolean(process.env.GSC_KEY_FILE);
  const gscSite = Boolean(process.env.GSC_SITE_URL);
  return {
    totalIdeas: ideas.length,
    categories: ranked.map(([category, count]) => ({ category, count })),
    thinnest: ranked.slice(0, 5).map(([category, count]) => ({ category, count })),
    searchConsole: {
      integratedForCandidateSelection: false,
      envPresent: { GSC_KEY_FILE: gscKey, GSC_SITE_URL: gscSite },
      note:
        "GSC scripts (gsc:submit-sitemap / gsc:inspect-indexing) are post-publish indexing only. Candidate selection uses manifest category coverage + Step 0 evidence fetches, not Search Console queries.",
    },
    e7: {
      status: "NO-GO",
      gate: "docs/wp/wp46-e7-gate.md",
      note: "Batch may research/compile/submit privately; public release needs owner E7 triad + one approved candidate.",
    },
  };
}

function providerPresence() {
  const names = [
    "OPENAI_API_KEY",
    "PERPLEXITY_API_KEY",
    "DATAFORSEO_LOGIN",
    "DATAFORSEO_PASSWORD",
    "REDDIT_CLIENT_ID",
    "REDDIT_CLIENT_SECRET",
  ];
  const present = {};
  for (const name of names) present[name] = Boolean(process.env[name]);
  return {
    present,
    failureMap: {
      missing_OPENAI_API_KEY: "ProviderConfigError at brief_normalization; non-retryable; $0",
      openai_429:
        "ProviderCallError retryable=true, unbilled (pre-2xx); attemptWithRetry once; then fail at current step with recorded $0 if both attempts fail before a 2xx",
      openai_5xx: "same retryable path as 429",
      openai_4xx_other: "non-retryable ProviderCallError; no invented failover",
      missing_DATAFORSEO: "keywords_demand fails closed; no LLM estimate",
      missing_REDDIT: "community pages may 403; report Reddit: not checked when unset",
    },
    note: "No cross-provider synthesis failover. Claude/Codex/Grok adapters invoke these CLIs; they do not replace OpenAI synthesis (RULINGS 2026-08-06).",
  };
}

function resolveBriefs(args) {
  const briefs = [...args.briefs];
  if (args.briefsDir) {
    const dir = path.resolve(root, args.briefsDir);
    if (!fs.existsSync(dir)) usage(2, `briefs dir not found: ${args.briefsDir}`);
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".json") && !f.endsWith(".fixture.json"))
      .sort()
      .map((f) => path.join(dir, f));
    briefs.push(...files);
  }
  if (args.count != null) {
    if (!Number.isInteger(args.count) || args.count < 1) usage(2, "--count must be a positive integer");
    if (briefs.length < args.count) {
      usage(
        2,
        `need ${args.count} briefs, found ${briefs.length}. Pass --briefs or --briefs-dir with enough JSON briefs (do not invent titles here).`,
      );
    }
    return briefs.slice(0, args.count);
  }
  return briefs;
}

function slugFromBrief(briefPath) {
  const raw = JSON.parse(fs.readFileSync(briefPath, "utf8"));
  if (typeof raw.slug === "string" && raw.slug.trim()) return raw.slug.trim();
  if (typeof raw.title === "string" && raw.title.trim()) {
    return raw.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80);
  }
  throw new Error(`brief missing slug/title: ${path.basename(briefPath)}`);
}

function shouldRun(stopAt, stage) {
  return stageIndex(stage) <= stageIndex(stopAt);
}

/** @type {boolean} */
let quietJson = false;

function printTail(label, run) {
  if (quietJson) return;
  const text = `${run.stdout}\n${run.stderr}`.trim();
  if (!text) return;
  const lines = text.split("\n").slice(-12);
  console.error(`--- ${label} ---`);
  for (const line of lines) console.error(line);
}

async function fixtureSmoke(workRoot) {
  const nodeBin = await engineNodeBin();
  const parent = workRoot ? path.resolve(workRoot) : os.tmpdir();
  const dir = fs.mkdtempSync(path.join(parent, "publish-ideas-batch-"));
  const recordOut = path.join(dir, "record.json");
  const reviewOut = path.join(dir, "record.source-review.json");
  const ideasDir = path.join(dir, "ideas");
  const results = [];

  const research = runNode(
    nodeBin,
    path.join(root, "scripts/engine-research.mjs"),
    ["--fixture", "rfp-assistant", "--out", recordOut],
    { NODE_ENV: "test" },
  );
  results.push({ stage: "research", status: research.status });
  printTail("research", research);
  if (research.status !== 0) {
    fs.rmSync(dir, { recursive: true, force: true });
    return { ok: false, results, work: dir };
  }

  const draft = runNode(
    nodeBin,
    path.join(root, "scripts/engine-source-review.mjs"),
    ["--record", recordOut, "--draft", "--out", reviewOut, "--force"],
    { NODE_ENV: "test" },
  );
  results.push({ stage: "source-review-draft", status: draft.status });
  printTail("source-review-draft", draft);
  if (draft.status !== 0) {
    fs.rmSync(dir, { recursive: true, force: true });
    return { ok: false, results, work: dir };
  }

  // Draft must NOT clear compile for a live-shaped flow; fixture compile is
  // exempt from Source Critic, so prove the draft check path instead.
  const check = runNode(
    nodeBin,
    path.join(root, "scripts/engine-source-review.mjs"),
    ["--record", recordOut, "--check", "--source-review", reviewOut, "--json"],
    { NODE_ENV: "test" },
  );
  results.push({ stage: "source-review-check-expects-fail", status: check.status === 1 ? 0 : 1 });
  printTail("source-review-check", check);

  const compile = runNode(
    nodeBin,
    path.join(root, "scripts/engine-compile.mjs"),
    [
      "--record",
      recordOut,
      "--slug",
      "engine-draft-batch-smoke",
      "--ideas-dir",
      ideasDir,
      "--no-manifest",
      "--json",
    ],
    { NODE_ENV: "test" },
  );
  results.push({ stage: "fixture-compile-exempt", status: compile.status });
  printTail("fixture-compile", compile);

  const ok = results.every((r) => r.status === 0);
  fs.rmSync(dir, { recursive: true, force: true });
  return { ok, results, work: "(removed)" };
}

async function processBrief(briefPath, args) {
  const nodeBin = await engineNodeBin();
  const absBrief = path.resolve(root, briefPath);
  if (!fs.existsSync(absBrief)) throw new Error(`brief not found: ${path.basename(briefPath)}`);
  const slug = slugFromBrief(absBrief);
  const recordPath = path.join(root, "engine/records", `${slug}.json`);
  const reviewPath = path.join(root, "engine/records", `${slug}.source-review.json`);
  const stages = [];

  if (!args.live) {
    throw new Error("live briefs require --live (fixture use --fixture-smoke)");
  }

  if (shouldRun(args.stopAt, "research")) {
    const researchArgs = ["--brief", absBrief, "--live", "--out", recordPath];
    if (args.forceResearch) researchArgs.push("--force");
    const research = runNode(nodeBin, path.join(root, "scripts/engine-research.mjs"), researchArgs);
    stages.push({ stage: "research", status: research.status, slug });
    printTail(`${slug}/research`, research);
    if (research.status !== 0) return { ok: false, slug, stages };
  }

  if (shouldRun(args.stopAt, "source-review")) {
    if (!fs.existsSync(recordPath)) {
      stages.push({ stage: "source-review", status: 1, slug, error: "record missing" });
      return { ok: false, slug, stages };
    }
    const draft = runNode(nodeBin, path.join(root, "scripts/engine-source-review.mjs"), [
      "--record",
      recordPath,
      "--draft",
      "--out",
      reviewPath,
      "--force",
    ]);
    stages.push({ stage: "source-review-draft", status: draft.status, slug });
    printTail(`${slug}/source-review-draft`, draft);
    if (draft.status !== 0) return { ok: false, slug, stages };

    if (args.stopAt === "source-review") {
      stages.push({
        stage: "halt",
        status: 0,
        slug,
        note: "waiting for Source Critic PASS before compile",
      });
      return { ok: true, slug, stages, halted: "source-review" };
    }
  }

  if (shouldRun(args.stopAt, "compile")) {
    if (!fs.existsSync(reviewPath)) {
      stages.push({ stage: "compile", status: 1, slug, error: "source-review missing" });
      return { ok: false, slug, stages };
    }
    const compile = runNode(nodeBin, path.join(root, "scripts/engine-compile.mjs"), [
      "--record",
      recordPath,
      "--source-review",
      reviewPath,
    ]);
    stages.push({ stage: "compile", status: compile.status, slug });
    printTail(`${slug}/compile`, compile);
    if (compile.status !== 0) {
      return {
        ok: false,
        slug,
        stages,
        note: "compile refused — likely Source Critic still FAIL/draft; fill checks and reseal PASS",
      };
    }
  }

  if (shouldRun(args.stopAt, "audit")) {
    const audit = runNode(nodeBin, path.join(root, "scripts/audit-idea-mdx.mjs"), ["--slug", slug]);
    stages.push({ stage: "audit", status: audit.status, slug });
    printTail(`${slug}/audit`, audit);
    if (audit.status !== 0) return { ok: false, slug, stages };
    const tags = runNode(nodeBin, path.join(root, "scripts/validate-idea-tags.mjs"), ["--slug", slug]);
    stages.push({ stage: "validate-idea-tags", status: tags.status, slug });
    printTail(`${slug}/validate-idea-tags`, tags);
    if (tags.status !== 0) return { ok: false, slug, stages };
  }

  if (shouldRun(args.stopAt, "editorial-dry")) {
    const submit = runNode(nodeBin, path.join(root, "scripts/editorial-submit-engine.mjs"), [
      `--slug=${slug}`,
      `--source-review=${reviewPath}`,
    ]);
    stages.push({ stage: "editorial-dry", status: submit.status, slug });
    printTail(`${slug}/editorial-dry`, submit);
    if (submit.status !== 0) return { ok: false, slug, stages };
  }

  return { ok: true, slug, stages };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  quietJson = Boolean(args.json);

  if (args.coverage) {
    const report = {
      ok: true,
      mode: "coverage",
      coverage: coverageReport(),
      providers: providerPresence(),
    };
    if (args.json) console.log(JSON.stringify(report, null, 2));
    else {
      console.log("publish:ideas coverage");
      console.log(`total ideas: ${report.coverage.totalIdeas}`);
      console.log("thinnest categories:");
      for (const row of report.coverage.thinnest) {
        console.log(`  ${row.category}: ${row.count}`);
      }
      console.log(`Search Console candidate selection: NOT integrated`);
      console.log(`E7 public release: ${report.coverage.e7.status} (${report.coverage.e7.gate})`);
      console.log("provider presence (names only):");
      for (const [name, set] of Object.entries(report.providers.present)) {
        console.log(`  ${name}: ${set ? "set" : "missing"}`);
      }
      console.log("429 behavior: retry once, no invented failover; see PIPELINE.md");
    }
    process.exit(0);
  }

  if (args.fixtureSmoke) {
    const smoke = await fixtureSmoke(args.workRoot);
    const payload = { ok: smoke.ok, mode: "fixture-smoke", results: smoke.results };
    if (args.json) console.log(JSON.stringify(payload));
    else {
      console.log(`publish:ideas fixture-smoke ${smoke.ok ? "PASS" : "FAIL"}`);
      for (const row of smoke.results) console.log(`  ${row.stage}: exit ${row.status}`);
    }
    process.exit(smoke.ok ? 0 : 1);
  }

  const briefs = resolveBriefs(args);
  if (briefs.length === 0) {
    usage(
      2,
      "no briefs. Use --coverage, --fixture-smoke, or pass --briefs / --briefs-dir (and --count for N).",
    );
  }
  if (!args.live) usage(2, "brief batches require --live (or use --fixture-smoke)");
  if (!args.confirmSemanticDedupe) {
    usage(
      2,
      "live spend refused: Scout + Corpus Guardian must semantic-dedupe customer/JTBD/workflow/mechanism against the corpus before spend. Re-run with --confirm-semantic-dedupe after that $0 check.",
    );
  }

  console.log(`publish:ideas batch · ${briefs.length} brief(s) · stop-at ${args.stopAt}`);
  console.log("providers:", JSON.stringify(providerPresence().present));
  console.log("GSC candidate selection: NOT integrated");
  console.log("semantic dedupe: confirmed by operator flag (Scout + Corpus Guardian)");
  console.log("E7 public release: NO-GO — private editorial dry-run max unless owner authorizes");

  const outcomes = [];
  for (const brief of briefs) {
    try {
      outcomes.push(await processBrief(brief, args));
    } catch (error) {
      outcomes.push({
        ok: false,
        slug: path.basename(brief),
        stages: [],
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const ok = outcomes.every((o) => o.ok);
  if (args.json) console.log(JSON.stringify({ ok, outcomes }, null, 2));
  else {
    console.log(`publish:ideas ${ok ? "ok" : "FAILED"} · ${outcomes.length} idea(s)`);
    for (const o of outcomes) {
      console.log(`  ${o.slug}: ${o.ok ? "ok" : "fail"}${o.halted ? ` (halted at ${o.halted})` : ""}`);
    }
  }
  process.exit(ok ? 0 : 1);
}

main().catch((error) => {
  const code = typeof error?.code === "number" ? error.code : 1;
  console.error(`publish:ideas: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(code);
});
