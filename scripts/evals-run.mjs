#!/usr/bin/env node
/**
 * Content quality gate for content/ideas/{slug}.mdx (WP41).
 *
 * Layer 0 (default) is free and deterministic: no network, no API key. CI
 * runs only Layer 0.
 *
 * Layers 1-2 (--layers 1|2) extract factual claims with an LLM and check
 * them against the sources each page cites. Layer 3 (--layers 3) adds a
 * panel of judges scoring the rubric in evals/rubric.md. Each layer
 * includes the ones below it. They need an explicit mode:
 *   --fixture   no key, no network, canned replies (for wiring checks)
 *   --live      OpenRouter (OPENROUTER_API_KEY) under the EVALS_MAX_USD cap
 * --estimate prints the worst-case cost of the planned run and stops.
 *
 * Usage:
 *   npm run evals:run -- --slug phone-neck-score-app   # exit 1 on fail
 *   npm run evals:run -- --changed [--base origin/main] # exit 1 on fail
 *   npm run evals:run -- --all [--report] [--strict]    # report only
 *   npm run evals:run -- --slug <slug> --layers 3 --live [--estimate]
 *   add --json for machine-readable output
 *
 * --changed checks idea MDX added, modified, or renamed since --base,
 * including uncommitted and untracked files. A page that is edited must pass
 * even if its failures predate the edit.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { listIdeaSlugs } from "./audit-idea-mdx.mjs";
import { SOURCES_TITLE } from "./lib/idea-sections.mjs";
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
    layers: 0,
    mode: null,
    estimate: false,
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
    else if (a === "--layers") args.layers = Number(argv[++i]);
    else if (a === "--fixture" || a === "--live") {
      if (args.mode) {
        console.error("pass only one of --fixture or --live");
        process.exit(2);
      }
      args.mode = a.slice(2);
    } else if (a === "--estimate") args.estimate = true;
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
  const c = r.claimLayer?.metrics;
  if (c) {
    console.log(
      `  claims (layer ${r.claimLayer.layers}): ${c.claims} checked: ${c.supported} supported, ${c.contradicted} contradicted,` +
        ` ${c.notFound} not found, ${c.unsourced} unsourced, ${c.unverifiable} unverifiable` +
        ` | dropped ${c.dropped} | sources read ${c.sourcesChecked - c.sourcesUnreachable}/${c.sourcesChecked}` +
        ` | $${c.costUsd.toFixed(4)}${c.cachedExtract ? " (cached)" : ""}`,
    );
  }
  const j = r.judgeLayer?.metrics;
  if (j) {
    const medians = Object.entries(j.medians)
      .map(([d, v]) => `${d} ${v ?? "-"}`)
      .join(", ");
    console.log(
      `  judges (median of ${r.judgeLayer.judgements.length - j.judgesFailed}): ${medians}` +
        ` | $${j.costUsd.toFixed(4)}${j.cached > 0 ? ` (${j.cached} cached)` : ""}`,
    );
  }
}

/** Standalone Node does not read env files. Shell, then .env.local, then .env. */
function loadLocalEnv() {
  for (const name of [".env.local", ".env"]) {
    const envPath = path.join(root, name);
    if (fs.existsSync(envPath)) process.loadEnvFile(envPath);
  }
}

const statusOf = (r) => (r.fails.length > 0 ? "fail" : r.warns.length > 0 ? "warn" : "pass");
const layerName = (n) => (n === 1 ? "layer 1" : `layers 1-${n}`);

/**
 * Layers 1-3 for every target page, merged into the Layer 0 results.
 * Layers 1-2 (claims) and 3 (judges) are independent: one failing on a page
 * does not stop the other. Returns the number of incomplete pages.
 */
async function runModelLayersForPages({ args, config, corpus, results }) {
  const load = (rel) => import(pathToFileURL(path.join(root, rel)).href);
  const [llmMod, layersMod, judgesMod, cacheMod, fixtureReplies, fixtures] = await Promise.all([
    load("lib/evals/llm.ts"),
    load("lib/evals/layers.ts"),
    load("lib/evals/judges.ts"),
    load("lib/evals/cache.ts"),
    load("lib/evals/fixture-replies.ts"),
    load("lib/evals/providers/fixtures.ts"),
  ]);
  const { createEvalLlm, BudgetExceededError, EvalConfigError } = llmMod;

  if (args.mode === "live") loadLocalEnv();
  const cc = config.claims;
  const models = {
    extractor: config.llm.extractor ?? (args.mode === "fixture" ? fixtures.FIXTURE_MODELS[0] : null),
    verifier: config.llm.verifier ?? (args.mode === "fixture" ? fixtures.FIXTURE_MODELS[1] : null),
    confirmer: config.llm.confirmer ?? undefined,
  };
  const judges = args.layers >= 3 ? config.llm.judges : [];
  if (!models.extractor || (args.layers >= 2 && !models.verifier) || (args.layers >= 3 && judges.length === 0)) {
    console.error(
      "evals-run: llm.extractor / llm.verifier / llm.judges are not pinned in evals/config.json. Pick them with npm run evals:ping -- --live --list <filter>.",
    );
    process.exit(2);
  }

  const llm = createEvalLlm({
    mode: args.mode,
    timeoutMs: config.llm.requestTimeoutMs,
    fixture: {
      models: [models.extractor, models.verifier, models.confirmer?.model, ...judges.map((spec) => spec.model)].filter(Boolean),
      reply: fixtureReplies.claimsFixtureReply,
    },
  });
  // Fixture runs never touch the disk cache: a fixture source doc or score
  // must not be served to a later live run.
  const cache =
    args.mode === "live"
      ? cacheMod.createDiskCache(path.join(evalsDir, "cache"), { ttlMs: cc.cacheTtlDays * 86_400_000 })
      : cacheMod.createMemoryCache();
  const sourceFetch = args.mode === "fixture" ? fixtureReplies.fixtureSourceFetch() : undefined;
  const pages = results.filter((r) => corpus.has(r.slug));
  const claimLayers = Math.min(args.layers, 2);
  const claimArgs = {
    layers: claimLayers,
    llm,
    models,
    config: cc,
    factualSections: config.factualSections,
    sourcesTitle: SOURCES_TITLE,
  };
  const judgeArgs = {
    llm,
    judges,
    thresholds: config.judges,
    excludeSections: config.excludeFromProseSections,
    sourcesTitle: SOURCES_TITLE,
  };

  if (args.estimate) {
    try {
      const rates = {
        extractor: await llm.rates(models.extractor),
        verifier: await llm.rates(models.verifier ?? models.extractor),
        ...(models.confirmer ? { confirmer: await llm.rates(models.confirmer.model) } : {}),
      };
      const judgeRates = new Map();
      for (const spec of judges) judgeRates.set(spec.model, await llm.rates(spec.model));
      let claimsUsd = 0;
      let judgesUsd = 0;
      for (const r of pages) {
        const sections = corpus.get(r.slug).page.sections;
        claimsUsd += layersMod.estimatePageWorstCaseUsd({ ...claimArgs, sections, rates, confirmer: models.confirmer });
        if (judges.length > 0) {
          judgesUsd += judgesMod.estimateJudgeWorstCaseUsd({ ...judgeArgs, sections, rates: judgeRates });
        }
      }
      const total = claimsUsd + judgesUsd;
      console.log(
        `evals-run: worst case for ${layerName(args.layers)} on ${pages.length} page(s): $${total.toFixed(4)}` +
          ` (claims $${claimsUsd.toFixed(4)}${judges.length > 0 ? `, judges $${judgesUsd.toFixed(4)}` : ""};` +
          ` $${(total / Math.max(1, pages.length)).toFixed(4)}/page, ignoring cache). Cap: $${llm.capUsd().toFixed(2)}.` +
          (total > llm.capUsd()
            ? " The worst case is above the cap: every call is reserved at its full output allowance, so the cap will refuse calls before overspending. Real runs cost far less (see docs/wp/wp41-progress.md)."
            : ""),
      );
      process.exit(0);
    } catch (error) {
      console.error(`evals-run: ${error.message}`);
      process.exit(2);
    }
  }

  let errors = 0;
  let stopped = false;
  let next = 0;
  const fail = (r, what, error) => {
    if (error instanceof EvalConfigError) {
      console.error(`evals-run: ${error.message}`);
      process.exit(2);
    }
    if (error instanceof BudgetExceededError) stopped = true;
    r.incomplete = true;
    r.warns.push({ check: "layers.error", message: `${what} did not finish: ${error.message}` });
  };
  const worker = async () => {
    while (!stopped && next < pages.length) {
      const r = pages[next++];
      const sections = corpus.get(r.slug).page.sections;
      try {
        const layer = await layersMod.runClaimLayers({ ...claimArgs, slug: r.slug, sections, cache, sourceFetch });
        r.fails.push(...layer.fails);
        r.warns.push(...layer.warns);
        r.claimLayer = layer;
      } catch (error) {
        fail(r, "claim layers", error);
      }
      if (judges.length > 0 && !stopped) {
        try {
          const layer = await judgesMod.runJudgeLayer({ ...judgeArgs, slug: r.slug, sections, cache });
          r.fails.push(...layer.fails);
          r.warns.push(...layer.warns);
          r.judgeLayer = layer;
        } catch (error) {
          fail(r, "judges", error);
        }
      }
      r.status = statusOf(r);
      r.visited = true;
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, cc.pageConcurrency) }, worker));

  for (const r of pages) {
    if (!r.visited) {
      r.incomplete = true;
      r.warns.push({ check: "layers.error", message: "skipped: the run hit the EVALS_MAX_USD cap" });
      r.status = statusOf(r);
    }
    if (r.incomplete) errors += 1;
    delete r.visited;
    delete r.incomplete;
  }

  const ledger = llm.ledger();
  console.error(
    `evals-run: ${layerName(args.layers)} (${args.mode}): ${ledger.length} model call(s), ${ledger.filter((e) => !e.ok).length} failed,` +
      ` spent $${llm.spentUsd().toFixed(4)} of $${llm.capUsd().toFixed(2)} cap` +
      (errors > 0 ? `, ${errors} page(s) incomplete` : ""),
  );
  return errors;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const modes = [args.all, args.changed, args.slugs.length > 0].filter(Boolean);
  const badLayers = ![0, 1, 2, 3].includes(args.layers);
  const needsMode = args.layers > 0 && !args.mode;
  const strayMode = args.layers === 0 && (args.mode || args.estimate);
  if (args.help || modes.length !== 1 || (args.report && !args.all) || badLayers || needsMode || strayMode) {
    console.log(`Usage:
  npm run evals:run -- --slug <slug> [--slug <slug>...]
  npm run evals:run -- --changed [--base <ref>]   (default base: origin/main)
  npm run evals:run -- --all [--report] [--strict]
  add --layers 1|2|3 --fixture|--live [--estimate]: 1 extracts claims, 2 checks them
  against cited sources, 3 adds the judge panel (each layer includes the ones below)
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

  const layerErrors =
    args.layers > 0 ? await runModelLayersForPages({ args, config, corpus, results }) : 0;

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
      `${JSON.stringify({ generatedOn, layers: args.layers, mode: args.mode, results }, null, 2)}\n`,
    );
    fs.writeFileSync(
      path.join(resultsDir, "report.md"),
      renderReport(results, { generatedOn, layers: args.layers, mode: args.mode }),
    );
    if (!args.json) console.log("evals-run: wrote evals/results/latest.json and report.md");
  }

  // The full corpus is report-only (existing debt). Targeted runs gate.
  const gating = !args.all || args.strict;
  // An unfinished layer run is not a pass: the gate could not complete.
  process.exit(gating && (failed > 0 || layerErrors > 0) ? 1 : 0);
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  main().catch((error) => {
    console.error(`evals-run: ${error.stack ?? error}`);
    process.exit(1);
  });
}
