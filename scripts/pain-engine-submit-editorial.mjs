#!/usr/bin/env node
/**
 * Pain Engine → editorial bridge (managed route).
 *
 * Submits an APPROVED Pain Engine draft to the admin editorial system as a
 * PRIVATE submission — the review gate is kept; nothing here can make an
 * idea public. Modelled on scripts/editorial-submit-engine.mjs:
 * dry-run-first, --apply only with the same confirmation discipline.
 *
 *   npm run pain-engine:submit-editorial -- --slug=<slug> [--title="..."] [--product-name="..."]
 *   npm run pain-engine:submit-editorial -- --slug=<slug> --apply --confirm-submission=<artifactHash> --backup=PATH --target=<deployment>
 *
 * What it does:
 * - reads engine/pain/review/{slug}.json; refuses unless status is
 *   "approved" (pending / rejected / already-submitted all throw);
 * - refuses a raw writer title/product name unless --title / --product-name
 *   are passed (the override is recorded in the review record);
 * - drops the highlights block from the submitted manifest row (it fails
 *   tagging validation without stats) and records the drop;
 * - leaves og.status as "draft" (no og:generate in this bridge);
 * - builds the Pain Engine source review (see lib/pain-engine/publish.ts)
 *   and the editorial envelope, and writes all five submission artifacts
 *   under tmp/pain-engine-editorial/{slug}/ (private mode: files outside
 *   the repo or under tmp/ only);
 * - dry run (default) prints exactly what would be submitted and stops.
 *
 * What --apply does today: the full confirmation discipline, then a
 * clear refusal. The current ingest (`convex/editorial/ingest.ts`
 * validateAndImport) only accepts old-engine contract-v2 records with a
 * sealed Source Critic PASS, and the submission schema has no
 * "pain-engine" producer — so no Pain Engine submission can be accepted
 * by the server yet. The minimal server change (new validator +
 * validateAndImportPainEngine action + matching mutation + schema enum)
 * is documented in lib/pain-engine/publish.ts. Until it lands, --apply
 * refuses locally and nothing is submitted. It never pushes, merges,
 * deploys, seeds Convex, or touches Vercel.
 */
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { buildSubmission } from "../lib/pain-engine/publish.ts";
import {
  loadReviewRecord,
  updateReviewRecordBookkeeping,
} from "../lib/pain-engine/review.ts";

const root = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const value = (prefix) => args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
const slug = value("--slug=");
if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.startsWith("engine-draft-")) {
  throw new Error("Give a publishable idea slug with --slug=<slug>.");
}
const apply = args.includes("--apply");
const titleOverride = value("--title=");
const productNameOverride = value("--product-name=");

let record;
try {
  record = loadReviewRecord(root, slug);
} catch {
  throw new Error(`No review record for ${slug} (engine/pain/review/${slug}.json).`);
}

const submission = buildSubmission(record, {
  ...(titleOverride ? { title: titleOverride } : {}),
  ...(productNameOverride ? { productName: productNameOverride } : {}),
});

const outputDir = path.join(root, "tmp", "pain-engine-editorial", slug);
await mkdir(outputDir, { recursive: true });
const files = {
  record: path.join(outputDir, "record.json"),
  mdx: path.join(outputDir, "idea.mdx"),
  manifestRow: path.join(outputDir, "manifest-row.json"),
  sourceReview: path.join(outputDir, "source-review.json"),
  submission: path.join(outputDir, "submission.json"),
};
await writeFile(files.record, submission.recordJson);
await writeFile(files.mdx, submission.mdx);
await writeFile(
  files.manifestRow,
  JSON.stringify(submission.manifestRow, null, 2),
);
await writeFile(files.sourceReview, submission.sourceReviewJson);
await writeFile(files.submission, JSON.stringify(submission.envelope, null, 2));

// Record the bridge bookkeeping in the review record: the human override
// (when passed) and the prepared-submission marker. Status/decidedAt are
// immutable here — updateReviewRecordBookkeeping enforces that.
const now = new Date().toISOString();
const updatedRecord = {
  ...record,
  ...(submission.overridesApplied
    ? { publishOverrides: submission.overridesApplied }
    : {}),
  submission: {
    status: "prepared",
    submissionId: submission.submissionId,
    artifactHash: submission.artifactHash,
    recordHash: submission.recordHash,
    highlightsDropped: submission.highlightsDropped,
    preparedAt: now,
    ideaId: null,
  },
};
updateReviewRecordBookkeeping(root, updatedRecord);

const summary = {
  verdict: submission.verdict,
  verdictNote:
    "Advisory only — the human approval is the gate; an approved PIVOT or PASS submits the same as an approved BUILD.",
  slug,
  title: submission.envelope.title,
  productName:
    submission.overridesApplied?.productName ?? record.draft.productName,
  status: "approved",
  source: "pain-engine",
  submissionId: submission.submissionId,
  artifactHash: submission.artifactHash,
  recordHash: submission.recordHash,
  sourceCount: submission.sources.length,
  claimCount: submission.claims.length,
  highlightsDropped: submission.highlightsDropped,
  overridesApplied: submission.overridesApplied,
  ogStatus: "draft",
  files: {
    record: path.relative(root, files.record),
    mdx: path.relative(root, files.mdx),
    manifestRow: path.relative(root, files.manifestRow),
    sourceReview: path.relative(root, files.sourceReview),
    submission: path.relative(root, files.submission),
  },
  recordBookkeeping: "publishOverrides + submission{status: prepared} written to the review record",
  ideaId: null,
  ideaState: "private submission — not yet accepted by the server",
  action: apply ? "apply requested" : "dry run only",
};
console.log(JSON.stringify(summary, null, 2));
if (!apply) process.exit(0);

if (value("--confirm-submission=") !== submission.artifactHash) {
  throw new Error("Submit refused: --confirm-submission must match this dry run's exact artifact hash.");
}
const backupPath = value("--backup=");
if (!backupPath || !existsSync(backupPath)) {
  throw new Error("Submit refused: provide a verified backend backup with --backup=PATH.");
}
const deploymentUrl = process.env.EDITORIAL_ENGINE_CONVEX_URL;
const adminKey = process.env.EDITORIAL_ENGINE_ADMIN_KEY;
const target = value("--target=");
if (
  !deploymentUrl ||
  !/^https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.convex\.cloud$/.test(deploymentUrl) ||
  !adminKey ||
  !target ||
  new URL(deploymentUrl).hostname.split(".")[0] !== target
) {
  throw new Error("Submit refused: set the exact EDITORIAL_ENGINE_CONVEX_URL, EDITORIAL_ENGINE_ADMIN_KEY and --target deployment name.");
}

throw new Error(
  "Submit refused: no Pain Engine ingest action exists on the target yet. " +
    "The current ingest (convex/editorial/ingest.ts validateAndImport) only accepts old-engine " +
    "contract-v2 records with a sealed Source Critic PASS, and the submission schema has no " +
    '"pain-engine" producer — see lib/pain-engine/publish.ts for the minimal server change ' +
    "(new validator + validateAndImportPainEngine action + matching mutation + schema enum). " +
    "Nothing was submitted; the dry-run artifacts above are ready for that action once it lands.",
);
