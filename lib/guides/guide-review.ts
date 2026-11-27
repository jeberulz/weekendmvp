import { createHash } from "node:crypto";
import { z } from "zod";

import { claimBasis, type Claim, type Evidence, type ResearchRecord } from "./research-record.ts";

/**
 * Source Critic review for a guide's research record (WP103-S4).
 *
 * The review is a judgement by a reviewer, a person or the Source Critic agent: does the excerpt match the
 * page, is the figure the page's figure, is the source credible. This module proves the review is well formed,
 * covers every claim, is bound to the exact record it judged, and was not edited after sealing. It does not
 * judge the claims. Mechanical checks (the page really contains the excerpt) live in `verify-claims.ts`.
 *
 * Mirrors the Idea Engine's `lib/engine/source-review.ts` and keeps its fail-closed rule: no sealed PASS,
 * no draft. Plain Node can load this file.
 */

export const REVIEW_CONTRACT_VERSION = 1 as const;

export type ReviewVerdict = "PASS" | "FAIL";

/** A source last checked more than this many days ago earns a warning. Thresholds to confirm with the owner. */
export const SOURCE_WARN_DAYS = 60;
/** A source last checked more than this many days ago fails the review. */
export const SOURCE_FAIL_DAYS = 120;

export const CHECK_KEYS = [
  "excerptMatchesPage",
  "topical",
  "figureMatchesExcerpt",
  "sourceCredible",
  "asOfStated",
  "wholeStatementInContext",
  "speakerNamed",
  "reproducible",
  "ownerConfirmed",
] as const;
export type CheckKey = (typeof CHECK_KEYS)[number];

const checksSchema = z.object(Object.fromEntries(CHECK_KEYS.map((key) => [key, z.boolean().nullable()])) as Record<CheckKey, z.ZodNullable<z.ZodBoolean>>);
export type ReviewChecks = z.infer<typeof checksSchema>;

const hex64 = z.string().regex(/^[0-9a-f]{64}$/, "expected a sha256 hex string");

export const reviewSchema = z.object({
  contractVersion: z.literal(REVIEW_CONTRACT_VERSION),
  slug: z.string().min(1),
  /** sha256 of the stable JSON of the record this review judged. */
  recordHash: hex64,
  verdict: z.enum(["PASS", "FAIL"]),
  reviewedAt: z.string().min(1),
  reviewer: z.string().trim().min(1),
  items: z.array(
    z.object({
      claimId: z.string().min(1),
      kind: z.string().min(1),
      checks: checksSchema,
      notes: z.string(),
    }),
  ),
  /** Empty on a PASS. The reasons on a FAIL. */
  failures: z.array(z.string()),
  /** sha256 of the stable JSON of this document without the seal. */
  seal: hex64,
});

export type GuideReview = z.infer<typeof reviewSchema>;
export type UnsealedReview = Omit<GuideReview, "seal">;

export class GuideReviewError extends Error {
  readonly issues: string[];
  constructor(message: string, issues: string[]) {
    super(`${message}\n- ${issues.join("\n- ")}`);
    this.name = "GuideReviewError";
    this.issues = issues;
  }
}

/** JSON with sorted keys and no undefined values, so the same content always hashes the same. */
export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).filter((key) => record[key] !== undefined).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

const sha256 = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

export function recordHash(record: ResearchRecord): string {
  return sha256(stableJson(record));
}

export function sealReview(document: UnsealedReview): GuideReview {
  return { ...document, seal: sha256(stableJson(document)) };
}

/** Which checks apply to a claim. A check that does not apply must be null in the review. */
export function applicableChecks(claim: Claim, evidence?: Evidence): CheckKey[] {
  switch (claim.kind) {
    case "stat":
      return ["excerptMatchesPage", "topical", "figureMatchesExcerpt", "sourceCredible"];
    case "pay":
      return ["excerptMatchesPage", "topical", "figureMatchesExcerpt", "sourceCredible", "asOfStated"];
    case "tool-fact":
      return ["excerptMatchesPage", "topical", "sourceCredible", "asOfStated"];
    case "date":
      return ["excerptMatchesPage", "topical", "sourceCredible", "asOfStated"];
    case "quote":
      return ["excerptMatchesPage", "topical", "wholeStatementInContext", "speakerNamed"];
    case "first-hand":
      return evidence?.verify.type === "owner-statement" ? ["topical", "ownerConfirmed"] : ["topical", "reproducible"];
  }
}

function emptyChecks(applicable: readonly CheckKey[]): ReviewChecks {
  return Object.fromEntries(CHECK_KEYS.map((key) => [key, applicable.includes(key) ? false : null])) as ReviewChecks;
}

/** A review skeleton for the reviewer to fill in. Every applicable check starts false, so it fails until judged. */
export function buildDraftReview(record: ResearchRecord, reviewer: string, reviewedAt: string): GuideReview {
  return sealReview({
    contractVersion: REVIEW_CONTRACT_VERSION,
    slug: record.slug,
    recordHash: recordHash(record),
    verdict: "FAIL",
    reviewedAt,
    reviewer,
    items: record.claims.map((claim) => ({
      claimId: claim.id,
      kind: claim.kind,
      checks: emptyChecks(applicableChecks(claim, claimBasis(record, claim).evidence)),
      notes: "",
    })),
    failures: ["draft: no claim has been judged yet"],
  });
}

const DAY_MS = 24 * 3600 * 1000;

export type SourceFreshness = { sourceId: string; ageDays: number; level: "ok" | "warn" | "fail" };

export function sourceFreshness(record: ResearchRecord, now: number): SourceFreshness[] {
  return record.sources.map((source) => {
    const ageDays = Math.floor((now - Date.parse(`${source.dateChecked}T00:00:00Z`)) / DAY_MS);
    return { sourceId: source.id, ageDays, level: ageDays > SOURCE_FAIL_DAYS ? "fail" : ageDays > SOURCE_WARN_DAYS ? "warn" : "ok" };
  });
}

/** What is wrong with a review of this record, as a list. Empty means the review stands. Does not throw. */
export function reviewIssues(record: ResearchRecord, review: GuideReview, now: number): string[] {
  const issues: string[] = [];
  const { seal, ...unsealed } = review;
  if (sha256(stableJson(unsealed)) !== seal) issues.push("seal: the review was edited after it was sealed");
  if (review.slug !== record.slug) issues.push(`slug: the review is for "${review.slug}", the record is "${record.slug}"`);
  if (review.recordHash !== recordHash(record)) issues.push("recordHash: the record changed since this review, so it is stale");
  if (review.verdict !== "PASS") issues.push(`verdict: ${review.verdict}${review.failures.length ? ` (${review.failures.join("; ")})` : ""}`);
  if (review.verdict === "PASS" && review.failures.length > 0) issues.push("failures: a PASS must list none");

  const byClaim = new Map(review.items.map((item) => [item.claimId, item]));
  if (byClaim.size !== review.items.length) issues.push("items: a claim is reviewed more than once");
  for (const id of byClaim.keys()) {
    if (!record.claims.some((claim) => claim.id === id)) issues.push(`items: "${id}" is not a claim in the record`);
  }
  for (const claim of record.claims) {
    const item = byClaim.get(claim.id);
    if (!item) {
      issues.push(`claim "${claim.id}": not reviewed`);
      continue;
    }
    const applicable = applicableChecks(claim, claimBasis(record, claim).evidence);
    for (const key of CHECK_KEYS) {
      const value = item.checks[key];
      if (applicable.includes(key) && value !== true) issues.push(`claim "${claim.id}": ${key} is ${String(value)}, expected true`);
      if (!applicable.includes(key) && value !== null) issues.push(`claim "${claim.id}": ${key} does not apply to a ${claim.kind} claim, expected null`);
    }
  }
  for (const entry of sourceFreshness(record, now)) {
    if (entry.level === "fail") issues.push(`source "${entry.sourceId}": last checked ${entry.ageDays} days ago, the limit is ${SOURCE_FAIL_DAYS}`);
  }
  return issues;
}

/** Throws unless the review is a sealed PASS for exactly this record. This is the gate before a guide is drafted. */
export function assertReviewPass(record: ResearchRecord, reviewRaw: unknown, now: number): GuideReview {
  if (reviewRaw === undefined || reviewRaw === null) {
    throw new GuideReviewError("a sealed Source Critic PASS is required before a guide is drafted", ["missing: no review was given"]);
  }
  const parsed = reviewSchema.safeParse(reviewRaw);
  if (!parsed.success) {
    throw new GuideReviewError("the review is not well formed", parsed.error.issues.map((issue) => `${issue.path.join(".") || "review"}: ${issue.message}`));
  }
  const issues = reviewIssues(record, parsed.data, now);
  if (issues.length > 0) throw new GuideReviewError("the review does not pass", issues);
  return parsed.data;
}

/**
 * Take a review a reviewer has filled in and seal it against this record: set the record hash, work out the
 * verdict from the checks, list what failed, and seal. A reviewer cannot seal a PASS over a false check.
 */
export function finalizeReview(record: ResearchRecord, filled: GuideReview, reviewedAt: string): GuideReview {
  const failures: string[] = [];
  const byClaim = new Map(filled.items.map((item) => [item.claimId, item]));
  for (const claim of record.claims) {
    const item = byClaim.get(claim.id);
    if (!item) {
      failures.push(`claim "${claim.id}": not reviewed`);
      continue;
    }
    for (const key of applicableChecks(claim, claimBasis(record, claim).evidence)) {
      if (item.checks[key] !== true) failures.push(`claim "${claim.id}": ${key} is ${String(item.checks[key])}`);
    }
  }
  return sealReview({
    contractVersion: REVIEW_CONTRACT_VERSION,
    slug: record.slug,
    recordHash: recordHash(record),
    verdict: failures.length === 0 ? "PASS" : "FAIL",
    reviewedAt,
    reviewer: filled.reviewer,
    items: filled.items,
    failures,
  });
}
