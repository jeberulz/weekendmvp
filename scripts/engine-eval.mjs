#!/usr/bin/env node
/**
 * Eval harness: re-run the MDX auditor on gold slugs and diff metrics
 * against engine/eval/gold.json. Fail on gold regression.
 *
 * Usage:
 *   node scripts/engine-eval.mjs
 *   node scripts/engine-eval.mjs --write-gold   # regenerate gold.json from auditor
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { auditIdeaFile } from "./audit-idea-mdx.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const goldPath = path.join(root, "engine", "eval", "gold.json");
const ideasDir = path.join(root, "content", "ideas");

const GOLD_SLUGS = [
  "ai-rfp-response-assistant",
  "ai-code-reviewer",
  "ai-landing-page-generator-ecommerce",
];

function auditSlug(slug) {
  const filePath = path.join(ideasDir, `${slug}.mdx`);
  const result = auditIdeaFile(filePath, slug);
  if (!result.ok || !result.metrics) {
    return {
      slug,
      ok: false,
      errors: result.errors,
      metrics: result.metrics,
    };
  }
  const m = result.metrics;
  return {
    slug,
    ok: true,
    errors: [],
    entry: {
      slug: m.slug,
      wordCount: m.wordCount,
      competitorMentions: m.competitorMentions,
      sourceLinkCount: m.sourceLinkCount,
      howToStepCount: m.howToStepCount,
    },
  };
}

function writeGold() {
  const entries = [];
  for (const slug of GOLD_SLUGS) {
    const result = auditSlug(slug);
    if (!result.ok) {
      console.error(`cannot write gold — ${slug} fails auditor:`);
      for (const e of result.errors) console.error(`  - ${e}`);
      process.exit(1);
    }
    entries.push(result.entry);
  }
  const payload = {
    generatedBy: "scripts/engine-eval.mjs --write-gold",
    generatedAt: new Date().toISOString(),
    entries,
  };
  fs.mkdirSync(path.dirname(goldPath), { recursive: true });
  fs.writeFileSync(goldPath, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`wrote ${goldPath} (${entries.length} entries)`);
  for (const e of entries) {
    console.log(
      `  ${e.slug}: words=${e.wordCount} competitors=${e.competitorMentions} sources=${e.sourceLinkCount} howTo=${e.howToStepCount}`,
    );
  }
}

function loadGold() {
  if (!fs.existsSync(goldPath)) {
    console.error(`missing ${goldPath} — run with --write-gold first`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(goldPath, "utf8"));
}

function diffEntry(expected, actual) {
  const regressions = [];
  if (actual.wordCount < expected.wordCount) {
    regressions.push(
      `wordCount ${actual.wordCount} < gold ${expected.wordCount}`,
    );
  }
  if (actual.competitorMentions < expected.competitorMentions) {
    regressions.push(
      `competitorMentions ${actual.competitorMentions} < gold ${expected.competitorMentions}`,
    );
  }
  if (actual.sourceLinkCount < expected.sourceLinkCount) {
    regressions.push(
      `sourceLinkCount ${actual.sourceLinkCount} < gold ${expected.sourceLinkCount}`,
    );
  }
  if (actual.howToStepCount < expected.howToStepCount) {
    regressions.push(
      `howToStepCount ${actual.howToStepCount} < gold ${expected.howToStepCount}`,
    );
  }
  return regressions;
}

function runEval() {
  const gold = loadGold();
  const bySlug = new Map(gold.entries.map((e) => [e.slug, e]));
  let failed = 0;

  for (const slug of GOLD_SLUGS) {
    const expected = bySlug.get(slug);
    if (!expected) {
      console.log(`FAIL  ${slug}`);
      console.log(`  - missing from gold.json`);
      failed += 1;
      continue;
    }

    const result = auditSlug(slug);
    if (!result.ok) {
      console.log(`FAIL  ${slug}`);
      for (const e of result.errors) console.log(`  - auditor: ${e}`);
      failed += 1;
      continue;
    }

    const regressions = diffEntry(expected, result.entry);
    if (regressions.length) {
      console.log(`FAIL  ${slug}`);
      for (const r of regressions) console.log(`  - ${r}`);
      failed += 1;
    } else {
      console.log(`PASS  ${slug}`);
      const m = result.entry;
      console.log(
        `  metrics: words=${m.wordCount} competitors=${m.competitorMentions} sources=${m.sourceLinkCount} howTo=${m.howToStepCount}`,
      );
    }
  }

  console.log(
    `\nengine-eval: ${GOLD_SLUGS.length - failed}/${GOLD_SLUGS.length} gold slugs ok`,
  );
  process.exit(failed > 0 ? 1 : 0);
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes("--write-gold")) {
    writeGold();
    return;
  }
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`Usage:
  node scripts/engine-eval.mjs
  node scripts/engine-eval.mjs --write-gold`);
    process.exit(0);
  }
  runEval();
}

main();
