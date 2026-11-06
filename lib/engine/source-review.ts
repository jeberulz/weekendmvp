/**
 * Source Critic PASS contract (P2).
 *
 * Machine gate for live research: compile-write and editorial submit refuse
 * without a sealed PASS review bound to the exact record hash. The review is
 * operator (or Source Critic agent) judgment; this module only proves the
 * document is well-formed, covers the required evidence, and was not tampered
 * with after sealing. It does not open URLs or prove authenticity.
 *
 * Fixture-mode records are exempt (hermetic replay / synthetic pages).
 */

import { sha256Hex } from "./evidence/accept.ts";
import type {
  AcceptedEvidence,
  EvidenceKind,
  ResearchRecordV2,
} from "./evidence/contract.ts";
import { usedEvidenceIds } from "./page-format.ts";

export const SOURCE_REVIEW_CONTRACT_VERSION = 1 as const;

export type SourceReviewVerdict = "PASS" | "FAIL";

/** Per-item checks. Null means "not applicable for this kind". */
export type SourceReviewItemChecks = {
  excerptMatchesPage: boolean;
  topicalForBuyerJob: boolean;
  /** Required true for competitor_price; null otherwise. */
  comparableSoftwarePrice: boolean | null;
  /** Required true for market_stat; null otherwise. */
  nicheFitPrimaryOrIndependent: boolean | null;
  /** Required true for community_quote; null otherwise. */
  wholeStatementInContext: boolean | null;
  /** Required true for competitor_availability; null otherwise. */
  pricingStatusConfirmed: boolean | null;
};

export type SourceReviewItem = {
  evidenceId: string;
  kind: EvidenceKind;
  sourceUrl: string;
  checks: SourceReviewItemChecks;
  notes: string;
};

export type SourceReviewDocument = {
  contractVersion: typeof SOURCE_REVIEW_CONTRACT_VERSION;
  slug: string;
  /** sha256 hex of JSON.stringify(record) after parseResearchRecord. */
  recordHash: string;
  verdict: SourceReviewVerdict;
  reviewedAt: string;
  reviewer: string;
  items: SourceReviewItem[];
  /** Non-empty when verdict is FAIL; empty when PASS. */
  failures: string[];
  /** sha256 of stableJson(document without seal). */
  seal: string;
};

export class SourceReviewError extends Error {
  readonly issues: string[];

  constructor(message: string, issues: string[] = []) {
    super(issues.length > 0 ? `${message}: ${issues[0]}` : message);
    this.name = "SourceReviewError";
    this.issues = issues;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Sorted-key JSON used for the tamper seal (mirrors pipeline stableJson). */
export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (isPlainObject(value)) {
    const keys = Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/** Hash a parsed contract-v2 record the same way editorial submit does. */
export function researchRecordHash(record: ResearchRecordV2): string {
  return sha256Hex(JSON.stringify(record));
}

export function sealSourceReview(
  document: Omit<SourceReviewDocument, "seal">,
): SourceReviewDocument {
  return { ...document, seal: sha256Hex(stableJson(document)) };
}

function emptyChecksFor(kind: EvidenceKind): SourceReviewItemChecks {
  return {
    excerptMatchesPage: false,
    topicalForBuyerJob: false,
    comparableSoftwarePrice: kind === "competitor_price" ? false : null,
    nicheFitPrimaryOrIndependent: kind === "market_stat" ? false : null,
    wholeStatementInContext: kind === "community_quote" ? false : null,
    pricingStatusConfirmed: kind === "competitor_availability" ? false : null,
  };
}

function applicableCheckKeys(kind: EvidenceKind): (keyof SourceReviewItemChecks)[] {
  const keys: (keyof SourceReviewItemChecks)[] = [
    "excerptMatchesPage",
    "topicalForBuyerJob",
  ];
  switch (kind) {
    case "competitor_price":
      keys.push("comparableSoftwarePrice");
      break;
    case "market_stat":
      keys.push("nicheFitPrimaryOrIndependent");
      break;
    case "community_quote":
      keys.push("wholeStatementInContext");
      break;
    case "competitor_availability":
      keys.push("pricingStatusConfirmed");
      break;
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
  return keys;
}

/** Price/stat/availability ids that must each appear in a PASS review. */
export function requiredClaimReviewIds(record: ResearchRecordV2): string[] {
  const used = usedEvidenceIds(record);
  const byId = new Map(record.evidence.accepted.map((item) => [item.id, item]));
  const required: string[] = [];
  for (const id of used) {
    const item = byId.get(id);
    if (!item) continue;
    if (
      item.kind === "market_stat" ||
      item.kind === "competitor_price" ||
      item.kind === "competitor_availability"
    ) {
      required.push(id);
    }
  }
  return required;
}

/** Used community quote ids (review must cover at least two when available). */
export function usedQuoteReviewIds(record: ResearchRecordV2): string[] {
  const used = usedEvidenceIds(record);
  const byId = new Map(record.evidence.accepted.map((item) => [item.id, item]));
  return [...used].filter((id) => byId.get(id)?.kind === "community_quote");
}

/** Minimum quote count a PASS review must include for this record. */
export function requiredQuoteReviewCount(record: ResearchRecordV2): number {
  return Math.min(2, usedQuoteReviewIds(record).length);
}

function parseChecks(
  raw: unknown,
  kind: EvidenceKind,
  path: string,
  issues: string[],
): SourceReviewItemChecks | null {
  if (!isPlainObject(raw)) {
    issues.push(`${path}.checks: must be an object`);
    return null;
  }
  const expected = emptyChecksFor(kind);
  const checks: SourceReviewItemChecks = { ...expected };
  for (const key of Object.keys(expected) as (keyof SourceReviewItemChecks)[]) {
    const value = raw[key];
    const wantNull = expected[key] === null;
    if (wantNull) {
      if (value !== null) {
        issues.push(`${path}.checks.${key}: must be null for ${kind}`);
      }
      // Keep the null sentinel from emptyChecksFor(kind).
      continue;
    }
    if (typeof value !== "boolean") {
      issues.push(`${path}.checks.${key}: must be a boolean for ${kind}`);
      continue;
    }
    checks[key] = value;
  }
  for (const key of Object.keys(raw)) {
    if (!(key in expected)) {
      issues.push(`${path}.checks.${key}: unknown field`);
    }
  }
  return checks;
}

/**
 * Parse an untrusted review document. Does not check the record binding —
 * call {@link assertSourceReviewPass} for the full gate.
 */
export function parseSourceReviewDocument(raw: unknown): SourceReviewDocument {
  const issues: string[] = [];
  if (!isPlainObject(raw)) {
    throw new SourceReviewError("source review must be a JSON object");
  }
  if (raw.contractVersion !== SOURCE_REVIEW_CONTRACT_VERSION) {
    issues.push(`contractVersion: expected ${SOURCE_REVIEW_CONTRACT_VERSION}`);
  }
  if (typeof raw.slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(raw.slug)) {
    issues.push("slug: must be a lowercase kebab slug");
  }
  if (typeof raw.recordHash !== "string" || !/^[a-f0-9]{64}$/.test(raw.recordHash)) {
    issues.push("recordHash: must be a sha256 hex digest");
  }
  if (raw.verdict !== "PASS" && raw.verdict !== "FAIL") {
    issues.push("verdict: must be PASS or FAIL");
  }
  if (typeof raw.reviewedAt !== "string" || Number.isNaN(Date.parse(raw.reviewedAt))) {
    issues.push("reviewedAt: must be an ISO timestamp");
  }
  if (typeof raw.reviewer !== "string" || raw.reviewer.trim().length === 0) {
    issues.push("reviewer: must be a non-empty string");
  }
  if (!Array.isArray(raw.items)) {
    issues.push("items: must be an array");
  }
  if (!Array.isArray(raw.failures) || !raw.failures.every((entry) => typeof entry === "string")) {
    issues.push("failures: must be an array of strings");
  }
  if (typeof raw.seal !== "string" || !/^[a-f0-9]{64}$/.test(raw.seal)) {
    issues.push("seal: must be a sha256 hex digest");
  }
  if (issues.length > 0) {
    throw new SourceReviewError("source review is invalid", issues);
  }

  const items: SourceReviewItem[] = [];
  for (let index = 0; index < (raw.items as unknown[]).length; index++) {
    const entry = (raw.items as unknown[])[index];
    const path = `items[${index}]`;
    if (!isPlainObject(entry)) {
      issues.push(`${path}: must be an object`);
      continue;
    }
    const kind = entry.kind;
    if (
      kind !== "community_quote" &&
      kind !== "market_stat" &&
      kind !== "competitor_price" &&
      kind !== "competitor_availability"
    ) {
      issues.push(`${path}.kind: unknown evidence kind`);
      continue;
    }
    if (typeof entry.evidenceId !== "string" || entry.evidenceId.length === 0) {
      issues.push(`${path}.evidenceId: required`);
      continue;
    }
    if (typeof entry.sourceUrl !== "string" || entry.sourceUrl.length === 0) {
      issues.push(`${path}.sourceUrl: required`);
      continue;
    }
    if (typeof entry.notes !== "string") {
      issues.push(`${path}.notes: must be a string`);
      continue;
    }
    const checks = parseChecks(entry.checks, kind, path, issues);
    if (!checks) continue;
    items.push({
      evidenceId: entry.evidenceId,
      kind,
      sourceUrl: entry.sourceUrl,
      checks,
      notes: entry.notes,
    });
  }

  if (issues.length > 0) {
    throw new SourceReviewError("source review is invalid", issues);
  }

  const document: SourceReviewDocument = {
    contractVersion: SOURCE_REVIEW_CONTRACT_VERSION,
    slug: raw.slug as string,
    recordHash: raw.recordHash as string,
    verdict: raw.verdict as SourceReviewVerdict,
    reviewedAt: raw.reviewedAt as string,
    reviewer: (raw.reviewer as string).trim(),
    items,
    failures: raw.failures as string[],
    seal: raw.seal as string,
  };

  const { seal: _seal, ...unsigned } = document;
  const expectedSeal = sha256Hex(stableJson(unsigned));
  if (document.seal !== expectedSeal) {
    throw new SourceReviewError("source review seal mismatch (tampered or unsigned)", [
      "seal: does not match the document body",
    ]);
  }

  if (document.verdict === "PASS" && document.failures.length > 0) {
    throw new SourceReviewError("source review is invalid", [
      "failures: must be empty when verdict is PASS",
    ]);
  }
  if (document.verdict === "FAIL" && document.failures.length === 0) {
    throw new SourceReviewError("source review is invalid", [
      "failures: must name at least one reason when verdict is FAIL",
    ]);
  }

  return document;
}

function itemPasses(item: SourceReviewItem): boolean {
  for (const key of applicableCheckKeys(item.kind)) {
    if (item.checks[key] !== true) return false;
  }
  return true;
}

/**
 * Fail-closed gate: live records need a sealed PASS review covering every
 * selected price/stat/availability and at least two selected quotes, bound to
 * this record's hash. Fixture mode skips (synthetic pages).
 */
export function assertSourceReviewPass(
  record: ResearchRecordV2,
  reviewRaw: unknown,
): SourceReviewDocument {
  if (record.mode === "fixture") {
    if (reviewRaw === undefined || reviewRaw === null) {
      return sealSourceReview({
        contractVersion: SOURCE_REVIEW_CONTRACT_VERSION,
        slug: record.brief.slug,
        recordHash: researchRecordHash(record),
        verdict: "PASS",
        reviewedAt: "1970-01-01T00:00:00.000Z",
        reviewer: "fixture-exempt",
        items: [],
        failures: [],
      });
    }
  }

  if (reviewRaw === undefined || reviewRaw === null) {
    throw new SourceReviewError(
      "source review required for live research (Source Critic PASS)",
      ["missing: pass a sealed engine source-review JSON"],
    );
  }

  const review = parseSourceReviewDocument(reviewRaw);
  const issues: string[] = [];
  const expectedHash = researchRecordHash(record);

  if (review.slug !== record.brief.slug) {
    issues.push(`slug: review is for ${review.slug}, record is ${record.brief.slug}`);
  }
  if (review.recordHash !== expectedHash) {
    issues.push("recordHash: does not match the research record (stale or wrong review)");
  }
  if (review.verdict !== "PASS") {
    issues.push(`verdict: ${review.verdict} (failures: ${review.failures.join("; ") || "none"})`);
  }

  const byId = new Map<string, AcceptedEvidence>(
    record.evidence.accepted.map((item) => [item.id, item]),
  );
  const used = usedEvidenceIds(record);
  const requiredClaims = requiredClaimReviewIds(record);
  const quoteIds = new Set(usedQuoteReviewIds(record));
  const seen = new Set<string>();
  let reviewedQuotes = 0;

  for (const [index, item] of review.items.entries()) {
    const path = `items[${index}]`;
    if (seen.has(item.evidenceId)) {
      issues.push(`${path}: duplicate evidenceId ${item.evidenceId}`);
      continue;
    }
    seen.add(item.evidenceId);
    const accepted = byId.get(item.evidenceId);
    if (!accepted) {
      issues.push(`${path}: evidenceId ${item.evidenceId} is not in the record`);
      continue;
    }
    if (!used.has(item.evidenceId)) {
      issues.push(`${path}: evidenceId ${item.evidenceId} is not used on the page`);
      continue;
    }
    if (accepted.kind !== item.kind) {
      issues.push(`${path}: kind ${item.kind} does not match record ${accepted.kind}`);
    }
    if (accepted.sourceUrl !== item.sourceUrl) {
      issues.push(`${path}: sourceUrl does not match the record`);
    }
    if (!itemPasses(item)) {
      issues.push(`${path}: one or more required checks are not true`);
    }
    if (quoteIds.has(item.evidenceId) && itemPasses(item)) reviewedQuotes += 1;
  }

  for (const id of requiredClaims) {
    if (!seen.has(id)) {
      issues.push(`coverage: missing required evidence ${id}`);
    }
  }
  const quoteNeed = requiredQuoteReviewCount(record);
  if (reviewedQuotes < quoteNeed) {
    issues.push(`coverage: need at least ${quoteNeed} reviewed community quotes, found ${reviewedQuotes}`);
  }

  if (issues.length > 0) {
    throw new SourceReviewError("source review refused", issues);
  }
  return review;
}

/**
 * Build a sealed PASS review for hermetic tests. Marks every required check
 * true — not for live publication.
 */
export function buildPassingSourceReview(
  record: ResearchRecordV2,
  options: { reviewer?: string; reviewedAt?: string } = {},
): SourceReviewDocument {
  const byId = new Map(record.evidence.accepted.map((item) => [item.id, item]));
  const ids = [
    ...requiredClaimReviewIds(record),
    ...usedQuoteReviewIds(record).slice(0, requiredQuoteReviewCount(record)),
  ];
  const items: SourceReviewItem[] = [];
  for (const id of ids) {
    const accepted = byId.get(id);
    if (!accepted) {
      throw new Error(`buildPassingSourceReview: missing accepted evidence ${id}`);
    }
    const checks = emptyChecksFor(accepted.kind);
    for (const key of applicableCheckKeys(accepted.kind)) {
      checks[key] = true;
    }
    items.push({
      evidenceId: accepted.id,
      kind: accepted.kind,
      sourceUrl: accepted.sourceUrl,
      checks,
      notes: "hermetic passing review",
    });
  }
  return sealSourceReview({
    contractVersion: SOURCE_REVIEW_CONTRACT_VERSION,
    slug: record.brief.slug,
    recordHash: researchRecordHash(record),
    verdict: "PASS",
    reviewedAt: options.reviewedAt ?? "2026-11-06T12:00:00.000Z",
    reviewer: options.reviewer ?? "test:source-critic",
    items,
    failures: [],
  });
}
