#!/usr/bin/env node
/**
 * Source Critic scaffold / check CLI.
 *
 *   npm run engine:source-review -- --record engine/records/{slug}.json --draft
 *   npm run engine:source-review -- --record path.json --check --source-review path.json
 *
 * --draft writes a sealed FAIL covering every required evidence id with all
 * checks still false. Compile and editorial submit stay refused until an
 * operator or Source Critic agent sets checks and reseals a PASS.
 *
 * There is no --pass / auto-PASS flag for live records. Fixture mode does not
 * need a review for hermetic replay.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const HELP = `Usage:
  npm run engine:source-review -- --record path.json --draft [--out path] [--force] [--reviewer name]
  npm run engine:source-review -- --record path.json --check [--source-review path]

Flags:
  --record path          Contract v2 research record JSON
  --draft                Write a sealed FAIL scaffold (checks all false)
  --check                Validate an existing review against the record
  --source-review path   Review JSON (default: {record}.source-review.json)
  --out path             Draft output path (default: same as --source-review)
  --reviewer name        reviewer field for --draft (default: draft:source-critic)
  --force                Overwrite an existing draft/review file
  --json                 Print one JSON result line

Exit: 0 ok, 1 refused/failed, 2 usage.
`;

function usage(exit) {
  (exit === 0 ? console.log : console.error)(HELP);
  process.exit(exit);
}

function scrubPaths(text) {
  return String(text).replace(/(?:\/(?:Users|home|private|tmp|var|opt|root)\/|[A-Za-z]:\\)[^\s'"<>)]*/g, "[path]");
}

function parseArgs(argv) {
  const out = {
    recordPath: null,
    sourceReviewPath: null,
    outPath: null,
    draft: false,
    check: false,
    force: false,
    json: false,
    reviewer: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") usage(0);
    else if (a === "--record") out.recordPath = argv[++i];
    else if (a === "--source-review") out.sourceReviewPath = argv[++i];
    else if (a === "--out") out.outPath = argv[++i];
    else if (a === "--reviewer") out.reviewer = argv[++i];
    else if (a === "--draft") out.draft = true;
    else if (a === "--check") out.check = true;
    else if (a === "--force") out.force = true;
    else if (a === "--json") out.json = true;
    else {
      console.error(`unknown arg: ${a}`);
      usage(2);
    }
  }
  return out;
}

function defaultReviewPath(recordPath) {
  const dir = path.dirname(recordPath);
  const base = path.basename(recordPath, ".json");
  return path.join(dir, `${base}.source-review.json`);
}

async function loadModules() {
  const recordUrl = pathToFileURL(path.join(root, "lib/engine/research-record.ts")).href;
  const reviewUrl = pathToFileURL(path.join(root, "lib/engine/source-review.ts")).href;
  const [{ parseResearchRecord }, review] = await Promise.all([import(recordUrl), import(reviewUrl)]);
  return { parseResearchRecord, ...review };
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.recordPath) {
    console.error("missing --record");
    usage(2);
  }
  if (args.draft === args.check) {
    console.error("choose exactly one of --draft or --check");
    usage(2);
  }

  const recordPath = path.resolve(root, args.recordPath);
  if (!fs.existsSync(recordPath)) {
    console.error(`engine:source-review: record not found (${path.basename(recordPath)})`);
    process.exit(1);
  }

  const reviewPath = path.resolve(
    root,
    args.outPath || args.sourceReviewPath || defaultReviewPath(args.recordPath),
  );

  try {
    const {
      parseResearchRecord,
      assertSourceReviewPass,
      buildDraftSourceReview,
      parseSourceReviewDocument,
    } = await loadModules();
    const record = parseResearchRecord(readJson(recordPath));

    if (args.draft) {
      if (fs.existsSync(reviewPath) && !args.force) {
        console.error(
          `engine:source-review: refusing to overwrite existing review (${path.basename(reviewPath)}); pass --force`,
        );
        process.exit(1);
      }
      const draft = buildDraftSourceReview(record, {
        ...(args.reviewer ? { reviewer: args.reviewer } : {}),
      });
      fs.mkdirSync(path.dirname(reviewPath), { recursive: true });
      fs.writeFileSync(reviewPath, `${JSON.stringify(draft, null, 2)}\n`, "utf8");
      const payload = {
        ok: true,
        mode: "draft",
        slug: record.brief.slug,
        verdict: draft.verdict,
        items: draft.items.length,
        path: path.relative(root, reviewPath) || path.basename(reviewPath),
        note: "FAIL scaffold only; set checks and reseal PASS before compile/submit",
      };
      if (args.json) console.log(JSON.stringify(payload));
      else {
        console.log(
          `engine:source-review draft · slug ${payload.slug} · items ${payload.items} · ${payload.path}`,
        );
        console.log("compile/submit remain refused until Source Critic PASS");
      }
      process.exit(0);
    }

    if (!fs.existsSync(reviewPath)) {
      console.error(`engine:source-review: review not found (${path.basename(reviewPath)})`);
      process.exit(1);
    }
    const raw = readJson(reviewPath);
    const parsed = parseSourceReviewDocument(raw);
    try {
      assertSourceReviewPass(record, parsed);
      const payload = {
        ok: true,
        mode: "check",
        slug: record.brief.slug,
        verdict: "PASS",
        path: path.relative(root, reviewPath) || path.basename(reviewPath),
      };
      if (args.json) console.log(JSON.stringify(payload));
      else console.log(`engine:source-review check PASS · slug ${payload.slug}`);
      process.exit(0);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const payload = {
        ok: false,
        mode: "check",
        slug: record.brief.slug,
        verdict: parsed.verdict,
        error: message,
        path: path.relative(root, reviewPath) || path.basename(reviewPath),
      };
      if (args.json) console.log(JSON.stringify(payload));
      else console.error(`engine:source-review check FAILED · ${scrubPaths(message)}`);
      process.exit(1);
    }
  } catch (error) {
    const message = scrubPaths(error instanceof Error ? error.message : String(error));
    if (args.json) console.log(JSON.stringify({ ok: false, error: message }));
    else console.error(`engine:source-review: ${message}`);
    process.exit(1);
  }
}

main();
