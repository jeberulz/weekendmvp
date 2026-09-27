#!/usr/bin/env node
/**
 * Calibrate the content-eval engine against the gold set (WP41-S5).
 *
 * Runs Layer 0 and the judge panel (Layer 3) on every page in
 * evals/gold/manifest.json and checks two things: the seeded bad pages
 * fail with the expected checks, and the good pages do not fail at all.
 *
 * Usage:
 *   npm run evals:calibrate -- --fixture            # wiring only, $0
 *   npm run evals:calibrate -- --live [--report]    # real judges, ~$0.12
 *
 * --report writes evals/results/calibration.md. Exit 1 when a live run
 * misses the bar (catch rate or any false fail). Run it after changing a
 * threshold, the rubric, a prompt, or a judge model.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { SOURCES_TITLE } from "./lib/idea-sections.mjs";
import { parseIdea } from "./lib/quality/parse.mjs";
import { evaluateIdea } from "./lib/quality/verdict.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const evalsDir = path.join(root, "evals");
const MIN_CATCH_RATE = 0.9;

function parseArgs(argv) {
  const args = { mode: null, report: false, json: false };
  for (const a of argv) {
    if (a === "--fixture" || a === "--live") {
      if (args.mode) usage(2);
      args.mode = a.slice(2);
    } else if (a === "--report") args.report = true;
    else if (a === "--json") args.json = true;
    else if (a === "--help" || a === "-h") usage(0);
    else {
      console.error(`unknown arg: ${a}`);
      usage(2);
    }
  }
  if (!args.mode) {
    console.error("pass --fixture or --live (there is no implicit mode)");
    usage(2);
  }
  return args;
}

function usage(exit) {
  console.error("Usage: npm run evals:calibrate -- --fixture|--live [--report] [--json]");
  process.exit(exit);
}

function loadLocalEnv() {
  for (const name of [".env.local", ".env"]) {
    const envPath = path.join(root, name);
    if (fs.existsSync(envPath)) process.loadEnvFile(envPath);
  }
}

const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const load = (rel) => import(pathToFileURL(path.join(root, rel)).href);
  const [llmMod, judgesMod, cacheMod, fixtureReplies, calibrate] = await Promise.all([
    load("lib/evals/llm.ts"),
    load("lib/evals/judges.ts"),
    load("lib/evals/cache.ts"),
    load("lib/evals/fixture-replies.ts"),
    load("lib/evals/calibrate.ts"),
  ]);
  if (args.mode === "live") loadLocalEnv();

  const config = readJson("evals/config.json");
  const lexicon = readJson("evals/slop-lexicon.json");
  const gold = readJson("evals/gold/manifest.json");
  const judges = config.llm.judges;

  const llm = llmMod.createEvalLlm({
    mode: args.mode,
    timeoutMs: config.llm.requestTimeoutMs,
    fixture: { models: judges.map((j) => j.model), reply: fixtureReplies.claimsFixtureReply },
  });
  const cache =
    args.mode === "live"
      ? cacheMod.createDiskCache(path.join(evalsDir, "cache"), { ttlMs: config.claims.cacheTtlDays * 86_400_000 })
      : cacheMod.createMemoryCache();

  const inputs = [];
  let next = 0;
  const worker = async () => {
    while (next < gold.pages.length) {
      const entry = gold.pages[next++];
      const raw = fs.readFileSync(path.join(root, entry.path), "utf8");
      const page = parseIdea(raw, entry.slug, { excludeSections: config.excludeFromProseSections });
      // No duplication index: seeded pages are copies by design.
      const l0 = evaluateIdea({ slug: entry.slug, raw, page, config, lexicon });
      const fails = l0.fails.map((f) => f.check);
      const warns = l0.warns.map((w) => w.check);
      const judgeLayer = await judgesMod.runJudgeLayer({
        slug: entry.slug,
        sections: page.sections,
        llm,
        judges,
        thresholds: config.judges,
        excludeSections: config.excludeFromProseSections,
        sourcesTitle: SOURCES_TITLE,
        cache,
      });
      fails.push(...judgeLayer.fails.map((f) => f.check));
      warns.push(...judgeLayer.warns.map((w) => w.check));
      inputs.push({ ...entry, fails, warns, judgeLayer });
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  inputs.sort((a, b) => gold.pages.findIndex((p) => p.slug === a.slug) - gold.pages.findIndex((p) => p.slug === b.slug));

  const result = calibrate.scoreCalibration(inputs, {
    ignoreChecks: gold.ignoreChecks,
    minCatchRate: MIN_CATCH_RATE,
    failAtOrBelow: config.judges.failAtOrBelow,
  });

  if (args.json) {
    console.log(JSON.stringify({ result, pages: inputs.map(({ judgeLayer, ...p }) => ({ ...p, medians: judgeLayer.metrics.medians })) }, null, 2));
  } else {
    for (const p of result.pages) console.log(`${p.ok ? "ok   " : "WRONG"} ${p.label.padEnd(4)} ${p.slug}: ${p.detail}`);
    console.log("");
    for (const j of result.judges) {
      console.log(
        `judge ${j.model}: target ${j.targetHits}/${j.targetTotal}, good-page alarms ${j.goodFalseAlarms}, discarded ${j.discarded}, distance ${j.meanDistance ?? "-"}`,
      );
    }
    console.log(
      `\nevals-calibrate (${args.mode}): ${result.passed ? "PASS" : "FAIL"}, caught ${result.caught}/${result.bad}, false fails ${result.falseFails}/${result.good}, spent $${llm.spentUsd().toFixed(4)}`,
    );
  }

  if (args.report) {
    const md = calibrate.renderCalibration(result, {
      generatedOn: new Date().toISOString().slice(0, 10),
      mode: args.mode,
      minCatchRate: MIN_CATCH_RATE,
      costUsd: llm.spentUsd(),
    });
    fs.mkdirSync(path.join(evalsDir, "results"), { recursive: true });
    fs.writeFileSync(path.join(evalsDir, "results", "calibration.md"), md);
    if (!args.json) console.log("evals-calibrate: wrote evals/results/calibration.md");
  }

  // Fixture judges always score 4, so a fixture run checks wiring only.
  process.exit(args.mode === "live" && !result.passed ? 1 : 0);
}

main().catch((error) => {
  console.error(`evals-calibrate: ${error.message}`);
  process.exit(1);
});
