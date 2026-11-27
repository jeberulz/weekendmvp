/**
 * Sealed validation for a Pain Engine submission.
 *
 * This mirrors `lib/editorial/engine/validated-artifact.ts` for the original
 * engine, but the trust basis is different:
 *
 * - The original engine proves quality with a sealed Source Critic PASS
 *   (`assertSourceReviewPass`) plus a deep artifact audit.
 * - A Pain Engine draft has no Source Critic review. Its judgment is the
 *   single human approval recorded in the review record, and its evidence is
 *   carried as an explicit "pain-engine-approval" source review whose sources
 *   and claims are honestly marked "unverified" (no per-source page check was
 *   run; the human approval is the coverage).
 *
 * The seal has three layers, and any one failing refuses the submission:
 * 1. The source review is verified against the submitted record bytes
 *    (`verifyPainEngineSourceReview`): contractVersion, kind, PASS verdict,
 *    no failures, recordHash match, seal match, and one item per evidence
 *    finding.
 * 2. Everything the CLI derived from the record is re-derived here
 *    (`buildSubmission`): the title gate, manifest identity/taxonomy, the
 *    evidence mapping, and the envelope. The artifacts passed in must be
 *    byte-identical (canonical JSON for the manifest row and source review)
 *    to the re-derived ones, so a tampered MDX, manifest row, or review
 *    cannot slip past a record that was approved.
 * 3. The MDX shape is checked directly: frontmatter slug/title identity
 *    (and never `engine: true`), the eight canonical H2 sections in order,
 *    and a numbered "**How it works:**" list in The Solution.
 *
 * This is a Node boundary module (gray-matter, node:crypto via the publish
 * bridge). It must never run inside a Convex mutation.
 *
 * Deliberately NOT used here: `assertSourceReviewPass` (there is no Source
 * Critic review for Pain Engine drafts), `runEngineChecks` / the deep audit
 * (a pain-engine submission lands with origin "manual" and follows the normal
 * human review flow; the engine-only checks do not apply).
 */

import { Buffer } from "node:buffer";

import matter from "gray-matter";

import { editorialMetadataSchema } from "../contracts/metadata";
import { SECTION_DEFINITIONS, HOW_IT_WORKS_LABEL } from "../contracts/sections";
import { editorialSubmissionSchema, type EditorialSubmission } from "../contracts/submission";
import { splitSections } from "../domain/structure";
import {
  buildSubmission,
  verifyPainEngineSourceReview,
  canonicalJson,
  type PainEngineSourceReview,
} from "../../pain-engine/publish";
import type { ReviewRecord } from "../../pain-engine/types";

export class PainEngineSubmissionError extends Error {}

export type PainEngineSubmissionInput = {
  /** Canonical JSON bytes of the Pain Engine review record (must be approved). */
  recordJson: string;
  /** The draft MDX, exactly as the bridge built it from the record. */
  mdx: string;
  /** JSON of the final manifest row (highlights dropped). */
  manifestJson: string;
  /** JSON of the pain-engine-approval source review. */
  sourceReviewJson: string;
};

export type ValidatedPainEngineSubmission = {
  envelope: EditorialSubmission;
  /** The canonical record bytes the envelope was built from. */
  recordJson: string;
  recordHash: string;
};

const MAX_RECORD_BYTES = 512_000;
const MAX_MDX_BYTES = 220_000;
const MAX_MANIFEST_BYTES = 32_000;
const MAX_SOURCE_REVIEW_BYTES = 128_000;

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function fail(message: string): never {
  throw new PainEngineSubmissionError(message);
}

function failIssue(issues: readonly { path: readonly PropertyKey[]; message: string }[]): never {
  const first = issues[0];
  if (!first) fail("Submission validation failed.");
  fail(`Submission validation failed at ${first.path.map(String).join(".")}: ${first.message}`);
}

function byteLength(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

/**
 * Fail-closed shape check for a Pain Engine review record. This only asserts
 * the fields the rest of the validation relies on; the record's own seal is
 * checked separately against the source review.
 */
function parseReviewRecord(raw: unknown): ReviewRecord {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    fail("Pain Engine review record must be a JSON object.");
  }
  const record = raw as Record<string, unknown>;
  if (typeof record.slug !== "string" || !SLUG_PATTERN.test(record.slug)) {
    fail("Pain Engine review record must have a valid slug.");
  }
  if (record.status !== "approved" && record.status !== "pending" && record.status !== "rejected") {
    fail("Pain Engine review record status must be pending, approved, or rejected.");
  }
  if (typeof record.createdAt !== "string" || record.createdAt.length === 0) {
    fail("Pain Engine review record must have a createdAt timestamp.");
  }
  if (record.decidedAt !== undefined && typeof record.decidedAt !== "string") {
    fail("Pain Engine review record decidedAt must be a string when present.");
  }
  if (typeof record.runCostUsd !== "number") {
    fail("Pain Engine review record must have a numeric runCostUsd.");
  }
  const cluster = record.cluster;
  if (!cluster || typeof cluster !== "object" || Array.isArray(cluster)) {
    fail("Pain Engine review record must have a cluster.");
  }
  if (typeof (cluster as Record<string, unknown>).label !== "string") {
    fail("Pain Engine review record cluster must have a label.");
  }
  const draft = record.draft;
  if (!draft || typeof draft !== "object" || Array.isArray(draft)) {
    fail("Pain Engine review record must have a draft.");
  }
  const draftFields = draft as Record<string, unknown>;
  if (typeof draftFields.slug !== "string" || draftFields.slug !== record.slug) {
    fail("Pain Engine draft slug must match the review record slug.");
  }
  for (const field of ["title", "productName", "category", "mdx"] as const) {
    if (typeof draftFields[field] !== "string" || draftFields[field].length === 0) {
      fail(`Pain Engine draft must have a non-empty ${field}.`);
    }
  }
  if (!draftFields.manifestRow || typeof draftFields.manifestRow !== "object" || Array.isArray(draftFields.manifestRow)) {
    fail("Pain Engine draft must have a manifest row.");
  }
  if (!Array.isArray(draftFields.evidence)) {
    fail("Pain Engine draft must have an evidence array.");
  }
  if (!draftFields.scorecard || typeof draftFields.scorecard !== "object") {
    fail("Pain Engine draft must have a scorecard.");
  }
  return raw as ReviewRecord;
}

function parseJsonInput(label: string, value: string, maxBytes: number): unknown {
  if (byteLength(value) > maxBytes) {
    fail(`${label} exceeds the ${maxBytes} byte limit.`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    fail(`${label} must be valid JSON.`);
  }
  return parsed;
}

/**
 * The MDX shape the publish contract requires, checked independently of the
 * record: frontmatter identity, the eight canonical H2 sections in order,
 * and a numbered "**How it works:**" list inside The Solution.
 */
function assertMdxShape(mdx: string, slug: string, effectiveTitle: string): void {
  if (byteLength(mdx) > MAX_MDX_BYTES) {
    fail("MDX exceeds the 220k byte limit.");
  }
  const parsed = matter(mdx);
  const data = parsed.data as Record<string, unknown>;
  if (data.slug !== slug) {
    fail("MDX frontmatter slug must match the Pain Engine draft slug.");
  }
  if (data.title !== effectiveTitle) {
    fail("MDX frontmatter title must match the approved title.");
  }
  if (data.engine === true) {
    fail("Pain Engine MDX must not claim engine: true (there is no engine Source Critic PASS).");
  }
  const { blocks } = splitSections(parsed.content);
  const expectedKeys = SECTION_DEFINITIONS.map((section) => section.key);
  const actualKeys = blocks.map((block) => block.key);
  if (
    blocks.length !== SECTION_DEFINITIONS.length ||
    actualKeys.some((key, index) => key !== expectedKeys[index]) ||
    blocks.some((block) => block.body.trim().length === 0)
  ) {
    fail(
      `MDX must contain exactly the canonical sections in order: ${SECTION_DEFINITIONS.map((section) => section.title).join(", ")}.`,
    );
  }
  const solution = blocks.find((block) => block.key === "solution");
  if (!solution) fail("MDX must contain a Solution section.");
  const labelIndex = solution.body.indexOf(HOW_IT_WORKS_LABEL);
  if (labelIndex === -1) {
    fail("MDX Solution section must contain a '**How it works:**' list.");
  }
  const afterLabel = solution.body.slice(labelIndex + HOW_IT_WORKS_LABEL.length);
  if (!/^\s*\d+\.\s+\S/m.test(afterLabel)) {
    fail("MDX '**How it works:**' must be followed by a numbered list.");
  }
}

export function validatePainEngineSubmission(input: PainEngineSubmissionInput): ValidatedPainEngineSubmission {
  if (byteLength(input.recordJson) > MAX_RECORD_BYTES) {
    fail("Pain Engine review record exceeds the 512k byte limit.");
  }
  const rawRecord = parseJsonInput("Pain Engine review record", input.recordJson, MAX_RECORD_BYTES);
  const record = parseReviewRecord(rawRecord);
  if (record.status !== "approved") {
    fail(`Pain Engine review record must be approved before submission (status is "${record.status}").`);
  }
  if (!record.decidedAt) {
    fail("Pain Engine review record must have a decidedAt timestamp for an approved decision.");
  }

  const rawReview = parseJsonInput("Pain Engine source review", input.sourceReviewJson, MAX_SOURCE_REVIEW_BYTES);
  if (!rawReview || typeof rawReview !== "object" || Array.isArray(rawReview)) {
    fail("Pain Engine source review must be a JSON object.");
  }
  const reviewIssues = verifyPainEngineSourceReview(
    rawReview as PainEngineSourceReview,
    input.recordJson,
  );
  if (reviewIssues.length > 0) {
    fail(`Pain Engine source review failed verification: ${reviewIssues.join("; ")}`);
  }

  // Re-derive everything from the record. This re-checks the approval, the
  // title gate, manifest identity/taxonomy, and the evidence mapping, and
  // re-verifies the source review against the record bytes.
  const submission = buildSubmission(record);

  // The passed artifacts must be exactly what the record produces. A record
  // that was approved but whose MDX/manifest/review was swapped afterwards
  // is refused here.
  if (input.mdx !== submission.mdx) {
    fail("MDX does not match the MDX derived from the approved Pain Engine record.");
  }
  const manifestRow = parseJsonInput("Manifest row", input.manifestJson, MAX_MANIFEST_BYTES);
  if (canonicalJson(manifestRow) !== canonicalJson(submission.manifestRow)) {
    fail("Manifest row does not match the manifest row derived from the approved Pain Engine record.");
  }
  const sourceReview = parseJsonInput("Pain Engine source review", input.sourceReviewJson, MAX_SOURCE_REVIEW_BYTES);
  if (canonicalJson(sourceReview) !== canonicalJson(submission.sourceReview)) {
    fail("Source review does not match the source review derived from the approved Pain Engine record.");
  }

  const effectiveTitle = record.publishOverrides?.title ?? record.draft.title;
  assertMdxShape(input.mdx, record.slug, effectiveTitle);

  const metadata = editorialMetadataSchema.safeParse(submission.metadata);
  if (!metadata.success) {
    failIssue(metadata.error.issues.map((issue) => ({ path: issue.path, message: issue.message })));
  }

  const envelope = editorialSubmissionSchema.safeParse(submission.envelope);
  if (!envelope.success) {
    failIssue(envelope.error.issues.map((issue) => ({ path: issue.path, message: issue.message })));
  }
  if (envelope.data.producer !== "pain-engine" || envelope.data.mode !== "live" || envelope.data.engineRunId !== null) {
    fail("Pain Engine envelope must use producer pain-engine, mode live, and a null engineRunId.");
  }

  return {
    envelope: envelope.data,
    recordJson: submission.recordJson,
    recordHash: submission.recordHash,
  };
}
