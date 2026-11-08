#!/usr/bin/env node
/**
 * Pain Engine (Phase 1) CLI — NEW engine, separate from `lib/engine/`.
 *
 *   npm run pain-engine:fixture          offline end-to-end (fixture data, $0)
 *   npm run pain-engine:run -- --live    live listeners (free APIs only, $0)
 *   npm run pain-engine:run -- --live --idea-requests-file rows.json
 *   npm run pain-engine:run -- --list    show the single-approval review queue
 *   npm run pain-engine:run -- --approve <slug>
 *   npm run pain-engine:run -- --reject <slug> [--reason "..."]
 *
 * Live mode spends $0: every Phase 1 listener API is free and the writer
 * uses no LLM. Approving a review marks it approved; it does NOT publish
 * anything — publishing stays a separate, human-operated step.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { clusterFindings } from "../lib/pain-engine/cluster.ts";
import {
  decideReview,
  listReviewRecords,
  saveReviewRecord,
} from "../lib/pain-engine/review.ts";
import { runPainEngine } from "../lib/pain-engine/run.ts";
import { writeDraft } from "../lib/pain-engine/writer.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cacheDir = path.join(root, "engine", "pain", "cache");

function usage(exit, message) {
  if (message) console.error(message);
  console.error(
    "Usage: npm run pain-engine:run -- [--fixture | --live] [--top N] [--idea-requests-file rows.json]\n" +
      "       npm run pain-engine:run -- --list | --approve <slug> | --reject <slug> [--reason ...]",
  );
  process.exit(exit);
}

function parseArgs(argv) {
  const out = { fixture: false, live: false, top: 3, ideaRequestsFile: null, list: false, approve: null, reject: null, reason: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--fixture") out.fixture = true;
    else if (a === "--live") out.live = true;
    else if (a === "--top") out.top = Number(argv[++i]);
    else if (a === "--idea-requests-file") out.ideaRequestsFile = argv[++i];
    else if (a === "--list") out.list = true;
    else if (a === "--approve") out.approve = argv[++i];
    else if (a === "--reject") out.reject = argv[++i];
    else if (a === "--reason") out.reason = argv[++i];
    else if (a === "--help" || a === "-h") usage(0);
    else usage(2, `unknown arg: ${a}`);
  }
  return out;
}

function readIdeaRequestRows(file) {
  const raw = JSON.parse(fs.readFileSync(path.resolve(root, file), "utf8"));
  const rows = Array.isArray(raw) ? raw : raw.rows;
  if (!Array.isArray(rows)) throw new Error("idea-requests file must be a JSON array (or {rows: [...]}) of listForSuggest rows");
  return rows;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.list) {
    const records = listReviewRecords(root);
    if (records.length === 0) console.log("review queue is empty");
    for (const r of records) {
      console.log(`  ${r.slug} — ${r.status} — ${r.draft.title} (score ${r.cluster.score.total}/100, ${r.cluster.findings.length} findings)`);
    }
    return;
  }
  if (args.approve) {
    const r = decideReview(root, args.approve, "approved", args.reason);
    console.log(`approved ${r.slug} — publishing is still a separate human step; nothing went live.`);
    return;
  }
  if (args.reject) {
    const r = decideReview(root, args.reject, "rejected", args.reason);
    console.log(`rejected ${r.slug}${args.reason ? `: ${args.reason}` : ""}`);
    return;
  }

  if (!args.fixture && !args.live) usage(2, "pass --fixture or --live");
  if (args.fixture && args.live) usage(2, "pass only one of --fixture / --live");
  if (!Number.isInteger(args.top) || args.top < 1) usage(2, "--top must be a positive integer");

  const ideaRequestRows = args.ideaRequestsFile ? readIdeaRequestRows(args.ideaRequestsFile) : undefined;

  if (args.fixture) {
    const fixture = JSON.parse(
      fs.readFileSync(path.join(root, "engine", "pain", "fixtures", "findings.json"), "utf8"),
    );
    const findings = fixture.findings;
    const clusters = clusterFindings(findings);
    const winners = clusters.slice(0, args.top);
    for (const cluster of winners) {
      const draft = writeDraft(cluster);
      saveReviewRecord(root, {
        slug: draft.slug,
        status: "pending",
        createdAt: new Date().toISOString(),
        cluster,
        draft,
        runCostUsd: 0,
      });
    }
    console.log(`pain-engine fixture: ${findings.length} findings -> ${clusters.length} clusters -> ${winners.length} draft(s) in the review queue`);
    for (const cluster of winners) {
      console.log(`  ${cluster.id} score ${cluster.score.total}/100 — ${cluster.label} (${cluster.findings.length} findings, ${cluster.sources.join(", ")})`);
    }
    console.log("cost: $0.00 (fixture mode, no network, no LLM)");
    return;
  }

  const report = await runPainEngine({
    rootDir: root,
    cacheDir,
    topN: args.top,
    ideaRequestRows,
    env: process.env,
    log: (m) => console.error(m),
  });
  console.log(`pain-engine live: ${report.clustersFound} clusters, ${report.drafts.length} draft(s) in the review queue`);
  for (const source of report.sourceReports) {
    console.log(`  ${source.source}: ${source.status}${source.reason ? ` — ${source.reason}` : ""} (${source.findings.length} findings)`);
  }
  for (const draft of report.drafts) {
    console.log(`  draft: ${draft.slug} — score ${draft.cluster.score.total}/100 — status ${draft.status}`);
  }
  console.log(`cost: $${report.costUsd.toFixed(2)} (Phase 1 listeners are free APIs; writer uses no LLM)`);
}

main().catch((error) => {
  console.error(`pain-engine: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
