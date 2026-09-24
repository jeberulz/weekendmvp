#!/usr/bin/env node
/**
 * Content quality gate for content/ideas/{slug}.mdx (WP41).
 *
 * Layer 0 only for now: free, deterministic checks with no network and no
 * API key. See docs/wp/wp41-stories.md for the later LLM layers.
 *
 * Usage:
 *   node scripts/evals-run.mjs --slug phone-neck-score-app   # exit 1 on fail
 *   node scripts/evals-run.mjs --changed [--base origin/main] # exit 1 on fail
 *   node scripts/evals-run.mjs --all [--report] [--strict]    # report only
 *   add --json for machine-readable output
 *
 * --changed checks idea MDX added, modified, or renamed since --base,
 * including uncommitted and untracked files. A page that is edited must pass
 * even if its failures predate the edit.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listIdeaSlugs } from "./audit-idea-mdx.mjs";
import { buildShingleIndex } from "./lib/quality/dupes.mjs";
import { parseIdea } from "./lib/quality/parse.mjs";
import { renderReport } from "./lib/quality/report.mjs";
import { evaluateIdea } from "./lib/quality/verdict.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ideasDir = path.join(root, "content", "ideas");
const evalsDir = path.join(root, "evals");
const resultsDir = path.join(evalsDir, "results");

const IDEA_PATH_RE = /^content\/ideas\/([^/_][^/]*)\.mdx$/;

/** Map `git diff --name-only` output to idea slugs. */
export function slugsFromPaths(paths) {
  const slugs = new Set();
  for (const p of paths) {
    const m = p.trim().match(IDEA_PATH_RE);
    if (m) slugs.add(m[1]);
  }
  return [...slugs].sort();
}

function git(args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" });
}

function changedSlugs(base) {
  try {
    git(["rev-parse", "--verify", "--quiet", `${base}^{commit}`]);
  } catch {
    console.error(
      `evals-run: base ref '${base}' not found. Fetch it (git fetch origin main) or pass --base <ref>.`,
    );
    process.exit(2);
  }
  const tracked = git([
    "diff",
    "--name-only",
    "--diff-filter=AMR",
    base,
    "--",
    "content/ideas",
  ]);
  const untracked = git([
    "ls-files",
    "--others",
    "--exclude-standard",
    "--",
    "content/ideas",
  ]);
  return slugsFromPaths(`${tracked}\n${untracked}`.split("\n"));
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(evalsDir, file), "utf8"));
}

function parseArgs(argv) {
  const args = {
    slugs: [],
    all: false,
    changed: false,
    base: "origin/main",
    json: false,
    report: false,
    strict: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--slug") args.slugs.push(argv[++i]);
    else if (a === "--all") args.all = true;
    else if (a === "--changed") args.changed = true;
    else if (a === "--base") args.base = argv[++i];
    else if (a === "--json") args.json = true;
    else if (a === "--report") args.report = true;
    else if (a === "--strict") args.strict = true;
    else if (a === "--help" || a === "-h") args.help = true;
    else {
      console.error(`unknown arg: ${a}`);
      process.exit(2);
    }
  }
  return args;
}

function printResult(r) {
  console.log(`${r.status.toUpperCase().padEnd(4)}  ${r.slug}`);
  for (const f of r.fails) console.log(`  x ${f.check}: ${f.message}`);
  for (const w of r.warns) console.log(`  ! ${w.check}: ${w.message}`);
  const m = r.metrics;
  if (m) {
    console.log(
      `  metrics: words=${m.wordCount} slop/1k=${m.slop.watchPer1k} avgSentence=${m.verbosity.avgSentenceWords}` +
        ` numbers=${m.numbers.claims} (unsourced ${m.numbers.unsourced}, hedged ${m.numbers.hedged})` +
        ` sources=${m.sources?.links ?? 0} domains=${m.sources?.distinctDomains ?? 0}`,
    );
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const modes = [args.all, args.changed, args.slugs.length > 0].filter(Boolean);
  if (args.help || modes.length !== 1 || (args.report && !args.all)) {
    console.log(`Usage:
  node scripts/evals-run.mjs --slug <slug> [--slug <slug>...]
  node scripts/evals-run.mjs --changed [--base <ref>]   (default base: origin/main)
  node scripts/evals-run.mjs --all [--report] [--strict]
  add --json for machine-readable output`);
    process.exit(args.help ? 0 : 2);
  }

  const config = readJson("config.json");
  const lexicon = readJson("slop-lexicon.json");

  let targets;
  if (args.all) targets = listIdeaSlugs();
  else if (args.changed) targets = changedSlugs(args.base);
  else targets = args.slugs;

  if (targets.length === 0) {
    console.log(`evals-run: no idea pages changed since ${args.base}`);
    process.exit(0);
  }

  // Parse the whole corpus once: duplication compares every page to every
  // other page, including new pages that are not committed yet.
  const corpus = new Map();
  for (const slug of new Set([...listIdeaSlugs(), ...targets])) {
    const file = path.join(ideasDir, `${slug}.mdx`);
    if (!fs.existsSync(file)) continue;
    const raw = fs.readFileSync(file, "utf8");
    corpus.set(slug, {
      raw,
      page: parseIdea(raw, slug, { excludeSections: config.excludeFromProseSections }),
    });
  }
  const dupIndex = buildShingleIndex(
    [...corpus.values()].map((c) => c.page),
    config.duplication.shingleWords,
  );

  const results = targets.map((slug) => {
    const entry = corpus.get(slug);
    if (!entry) {
      return {
        slug,
        status: "fail",
        fails: [{ check: "structure", message: `file not found: content/ideas/${slug}.mdx` }],
        warns: [],
        metrics: null,
      };
    }
    return evaluateIdea({
      slug,
      raw: entry.raw,
      page: entry.page,
      config,
      lexicon,
      dupIndex,
    });
  });

  if (args.json) console.log(JSON.stringify(results, null, 2));
  else results.forEach(printResult);

  const failed = results.filter((r) => r.status === "fail").length;
  const warned = results.filter((r) => r.status === "warn").length;
  if (!args.json) {
    console.log(
      `\nevals-run: ${results.length} page(s): ${failed} fail, ${warned} warn, ${results.length - failed - warned} pass`,
    );
  }

  if (args.report) {
    const generatedOn = new Date().toISOString().slice(0, 10);
    fs.mkdirSync(resultsDir, { recursive: true });
    fs.writeFileSync(
      path.join(resultsDir, "latest.json"),
      `${JSON.stringify({ generatedOn, layer: 0, results }, null, 2)}\n`,
    );
    fs.writeFileSync(
      path.join(resultsDir, "report.md"),
      renderReport(results, { generatedOn }),
    );
    if (!args.json) console.log("evals-run: wrote evals/results/latest.json and report.md");
  }

  // The full corpus is report-only (existing debt). Targeted runs gate.
  const gating = !args.all || args.strict;
  process.exit(gating && failed > 0 ? 1 : 0);
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) main();
