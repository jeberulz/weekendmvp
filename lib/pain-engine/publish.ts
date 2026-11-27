/**
 * Pain Engine → editorial bridge (managed route).
 *
 * Approved Pain Engine drafts land in the admin editorial system as PRIVATE
 * submissions — never straight into public MDX/manifest. This module is the
 * pure, testable half of that bridge: it turns an approved review record
 * into the exact submission artifacts the editorial system expects.
 *
 * ## Why the old bridge cannot be reused
 *
 * `scripts/editorial-submit-engine.mjs` + `lib/editorial/engine/validated-
 * artifact.ts` fail closed without a sealed Source Critic PASS — and the
 * coupling runs deeper than the review. `validateEngineSubmission` parses a
 * contract-v2 research record (`parseResearchRecord`), requires
 * `manifest.source === "engine:{slug}"` and `provenance.researchMode ===
 * "live"`, requires MDX frontmatter `engine: true`, runs the deep artifact
 * audit against that record, and maps evidence from
 * `record.evidence.accepted`. The mutation `importValidatedEngine`
 * (`convex/editorial/service.ts`) re-checks all of it: it requires
 * `record.contractVersion === 2`, `mode === "live"`, a `brief.slug/title`,
 * and an envelope with `producer === "engine"`,
 * `engineContractVersion === 2`, `submissionId === "eng_"+hash`,
 * `engineRunId === "run_"+hash`. The submission schema
 * (`SUBMISSION_PRODUCERS`) has no "pain-engine" value. A Pain Engine record
 * is a different shape at every layer, so no source-review JSON alone could
 * make the old path accept it.
 *
 * ## What the Source Critic PASS is actually used for
 *
 * From `lib/engine/source-review.ts`: the review is a tamper-evident
 * binding of a human judgment to the exact record bytes (`recordHash` =
 * sha256 of the normalized record; `seal` = sha256 of the stable-JSON
 * document) plus coverage proof — every used price/stat/availability
 * evidence id must appear with all applicable per-kind checks true, and at
 * least two used community quotes must be reviewed. The checks themselves
 * are human judgments (excerpt matches the page, topical for the buyer job,
 * comparable software price, niche fit, whole statement in context,
 * pricing status confirmed). It does NOT verify authenticity — it opens no
 * URLs. Its role is the one check the deterministic audit cannot do: that
 * the evidence used on the page is real, relevant, and correctly
 * represented.
 *
 * ## The Pain Engine equivalent (built here)
 *
 * A Pain Engine source review is a distinct document type
 * (`kind: "pain-engine-approval"`) that carries the same guarantees in
 * Pain Engine terms:
 * - `recordHash` = sha256 of the canonical submitted review-record JSON,
 *   so the review is bound to the exact approved bytes.
 * - `verdict: "PASS"` only ever for a record whose `status` is "approved";
 *   `reviewedAt` is the record's `decidedAt` and `reviewer` is
 *   "pain-engine:human-approval" — the single human approval IS the
 *   judgment, and the review says so instead of pretending to be a
 *   Source Critic PASS.
 * - `items` cover every evidence finding used in the draft, with checks
 *   scoped to what was actually done: the quote/text is verbatim in the
 *   record, and the finding is covered by the approval. No per-source
 *   page check is claimed — none was performed.
 * - `seal` = sha256 of the stable (sorted-key) JSON without the seal,
 *   the same tamper-evidence scheme as the Source Critic.
 * - The envelope carries the scorecard verdict as an advisory
 *   `recommendation` (BUILD→accept, PIVOT→needs_research, PASS→reject);
 *   the human approval remains the gate.
 * - Sources/claims mapped from the draft's evidence receipts carry
 *   verification status "unverified" with the reason stated, never
 *   "verified": nobody opened each source page.
 *
 * ## The server side (built on branch marley/pain-engine-server-acceptance)
 *
 * The ingest accepts this envelope since the server change landed in the
 * branch: (1) "pain-engine" is in `SUBMISSION_PRODUCERS`; (2) the validator
 * `lib/editorial/engine/validated-pain-engine-artifact.ts` parses a Pain
 * Engine review record, asserts this source review, validates the MDX shape
 * and manifest identity (`source === "pain-engine:{slug}"`,
 * `researchMode === "pain-engine"`), and builds the envelope with the
 * functions in this module; (3) the internal action
 * `validateAndImportPainEngine` in `convex/editorial/ingest.ts` plus the
 * matching internal mutation `importValidatedPainEngine` mirror
 * `importValidatedEngine` with pain-engine checks
 * (`record.draft.slug`, `status === "approved"`, envelope
 * `producer === "pain-engine"`, `submissionId === "pe_"+hash`,
 * `engineRunId === null`) and its own records table
 * (`editorial_pain_engine_records`). The import lands with authority "none"
 * and origin "manual" — no engine receipt is claimed. The bridge's
 * `--apply` calls that action; if the target deployment has not deployed
 * the server change yet, --apply refuses clearly instead.
 *
 * ## What this module never does
 *
 * It never writes public MDX or manifest rows, never pushes, merges,
 * deploys, seeds Convex, or touches Vercel. It builds submission artifacts
 * (record, MDX, manifest row, source review, envelope) for the editorial
 * system only. Publication stays a separate, human-operated step after
 * the editorial review — and the public release switch (WP46-E7) is a
 * separate launch decision.
 */
import { createHash } from "node:crypto";

import { EDITORIAL_CONTRACT_VERSION } from "../editorial/contracts/limits.ts";
import { SECTION_DEFINITIONS, type SectionKey } from "../editorial/contracts/sections.ts";
import {
  AUDIENCE_SLUGS,
  BUILD_TIME_VALUES,
  CATEGORY_SLUGS,
  REVENUE_GOAL_SLUGS,
  TOOL_SLUGS,
} from "../editorial/contracts/taxonomy.ts";
import type {
  EditorialSubmissionMarker,
  PainDraft,
  PainFinding,
  PublishOverrides,
  ReviewRecord,
} from "./types.ts";

export const PAIN_ENGINE_SUBMISSION_CONTRACT_VERSION = 1 as const;
export const PAIN_ENGINE_PRODUCER = "pain-engine" as const;
/** The writer cuts draft titles at exactly this length (writer.ts). */
export const WRITER_TITLE_CUT = 100;
/** Editorial field limits (lib/editorial/contracts/limits.ts). */
const LIMITS = {
  titleChars: 160,
  descriptionChars: 320,
  buyerChars: 200,
  jobChars: 280,
  wedgeChars: 400,
  recommendationReasonChars: 280,
  ogSubjectChars: 240,
} as const;

/** Words that carry no naming information on their own ("App Show"). */
const GENERIC_PRODUCT_WORDS = new Set([
  "app", "show", "product", "place", "thing", "tool", "best", "top",
  "new", "my", "the", "pro", "plus", "fast", "easy", "smart", "better",
  "copy", "point", "work", "task", "job", "help", "free", "simple",
  "quick", "online", "web",
]);

/** Existing products/brands a new product must not be named after. */
const KNOWN_BRAND_WORDS = new Set([
  "claude", "chatgpt", "openai", "google", "notion", "slack", "github",
  "apple", "microsoft", "amazon", "meta", "facebook", "instagram",
  "stripe", "figma", "linear", "zapier", "asana", "trello", "zoom",
  "spotify", "shopify", "wordpress", "salesforce", "anthropic", "gemini",
  "copilot", "midjourney", "canva", "duolingo", "todoist", "capcut",
  "myfitnesspal",
]);

/** Sorted-key JSON (mirrors lib/engine/source-review.ts stableJson and
 * lib/editorial/domain/hash.ts canonicalJson): the canonical bytes that
 * record hashes and tamper seals are computed over. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * The artifact hash, exactly as the editorial receiver computes it
 * (`submissionArtifactHash` in lib/editorial/domain/artifact.ts). The
 * receiver re-derives it from the envelope content on import and refuses
 * the submission with ARTIFACT_HASH_MISMATCH when it disagrees, so the
 * bridge must use the receiver's formula — a plain hash of the envelope
 * fields is refused.
 *
 * This is the synchronous twin of the receiver's `computeRevisionHashes`:
 * the same steps (markdown content hash, metadata hash, evidence hash from
 * the archived source/claim fields only, then the combined hash), the same
 * canonical JSON, and node:crypto sha256 instead of WebCrypto (identical
 * digests). It is written inline rather than importing the domain module
 * because this file is loaded by the bridge CLI under Node type-stripping,
 * where the domain module's extensionless imports do not resolve; the
 * parity test in tests/editorial/pain-engine-submission.test.ts compares
 * this hash against the receiver's async function and fails loudly if the
 * two ever drift.
 */
export function submissionArtifactHashSync(input: {
  title: string;
  markdown: string;
  metadata: Record<string, unknown>;
  sources: readonly Record<string, unknown>[];
  claims: readonly Record<string, unknown>[];
}): string {
  const normalizeNewlines = (text: string): string => text.replace(/\r\n?/g, "\n");
  const content = sha256Hex(`markdown\n${normalizeNewlines(input.markdown)}`);
  const metadata = sha256Hex(canonicalJson({ title: input.title, metadata: input.metadata }));
  const evidence = sha256Hex(
    canonicalJson({
      sources: input.sources.map((source) => ({
        id: source.id,
        url: source.url,
        publisher: source.publisher,
        title: source.title,
        sourceType: source.sourceType,
        publishedAt: source.publishedAt,
        retrievedAt: source.retrievedAt,
        excerpt: source.excerpt,
        context: source.context,
      })),
      claims: input.claims.map((claim) => ({
        id: claim.id,
        text: claim.text,
        anchorText: claim.anchorText,
        section: claim.section,
        kind: claim.kind,
        topic: claim.topic,
        material: claim.material,
        sourceIds: [...(claim.sourceIds as readonly unknown[])],
        contradictingSourceIds: [...(claim.contradictingSourceIds as readonly unknown[])],
      })),
    }),
  );
  return sha256Hex(
    canonicalJson({
      contractVersion: EDITORIAL_CONTRACT_VERSION,
      content,
      metadata,
      evidence,
    }),
  );
}

function wordsOf(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

/** The finding the writer took the draft title from (highest agreement). */
function topFinding(record: ReviewRecord): PainFinding | null {
  const findings = record.draft.evidence;
  if (findings.length === 0) return null;
  return [...findings].sort((a, b) => b.agreementCount - a.agreementCount)[0];
}

function sanitizeFrontmatterTitle(title: string): string {
  // Same sanitising the writer applies to the frontmatter title line.
  return title.replace(/\\/g, "\\\\").replace(/"/g, "");
}

/**
 * Title/product-name gate for WRITER-derived values. Refuses when the title
 * or product name is clearly raw source text. A human override bypasses
 * these checks (see overrideTitleIssues) — the override is the human taking
 * responsibility, and it is recorded in the review record.
 */
export function writerTitleIssues(record: ReviewRecord): string[] {
  const issues: string[] = [];
  const { title, productName } = record.draft;
  if (title.startsWith("[")) {
    issues.push(
      `title starts with a bracket tag ("${title.slice(0, 40)}…") — raw source title; pass --title with a clean title`,
    );
  }
  if (title.length >= WRITER_TITLE_CUT) {
    const top = topFinding(record);
    const sourceLen = top
      ? top.title.replace(/\s+/g, " ").trim().length
      : null;
    issues.push(
      sourceLen !== null && sourceLen > WRITER_TITLE_CUT
        ? `title is truncated at the writer's ${WRITER_TITLE_CUT}-char cut (source title was ${sourceLen} chars); pass --title with the full title`
        : `title is exactly ${WRITER_TITLE_CUT} chars — the writer's cut length, so it may be truncated mid-phrase; pass --title to confirm it deliberately`,
    );
  }
  if (title.trim().length < 10) issues.push("title is too short to publish");
  const nameWords = wordsOf(productName);
  if (nameWords.length === 0) {
    issues.push("product name is empty");
  } else {
    if (nameWords.every((w) => GENERIC_PRODUCT_WORDS.has(w))) {
      issues.push(
        `product name "${productName}" is only generic words — a label fragment, not a name; pass --product-name`,
      );
    }
    const brand = nameWords.find((w) => KNOWN_BRAND_WORDS.has(w));
    if (brand) {
      issues.push(
        `product name "${productName}" contains "${brand}" — another company's product; pass --product-name with an original name`,
      );
    }
  }
  return issues;
}

/**
 * Sanity checks for HUMAN-supplied --title / --product-name values. These
 * are deliberately narrower than the writer gate: the override is a human
 * decision, so only things that are never publishable are refused.
 */
export function overrideTitleIssues(title: string, productName: string): string[] {
  const issues: string[] = [];
  if (title.startsWith("[")) {
    issues.push(`--title starts with a bracket tag ("${title.slice(0, 40)}…") — never a publishable title`);
  }
  if (title.trim().length < 10 || title.length > LIMITS.titleChars) {
    issues.push(`--title must be 10–${LIMITS.titleChars} chars (got ${title.length})`);
  }
  if (productName.trim().length < 2 || productName.length > 60) {
    issues.push(`--product-name must be 2–60 chars (got ${productName.length})`);
  }
  const brand = wordsOf(productName).find((w) => KNOWN_BRAND_WORDS.has(w));
  if (brand) {
    issues.push(
      `--product-name "${productName}" contains "${brand}" — another company's product`,
    );
  }
  return issues;
}

function stripFrontmatter(mdx: string): string {
  const match = mdx.match(/^---\n[\s\S]*?\n---\n/);
  return match ? mdx.slice(match[0].length) : mdx;
}

function normalizeForSearch(text: string): string {
  return text
    .replace(/\\([{}<[\]])/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Which canonical H2 section an evidence anchor lives in (default: sources). */
export function sectionForAnchor(mdx: string, anchor: string): SectionKey {
  const body = stripFrontmatter(mdx);
  const needle = normalizeForSearch(anchor);
  if (!needle) return "sources";
  const blocks = body.split(/^## /m).slice(1);
  for (const block of blocks) {
    const [headingLine, ...rest] = block.split("\n");
    const key = SECTION_DEFINITIONS.find(
      (section) => section.title === headingLine.trim(),
    )?.key;
    if (!key) continue;
    if (normalizeForSearch(rest.join("\n")).includes(needle)) return key;
  }
  return "sources";
}

function sourceTypeFor(finding: PainFinding): string {
  if (finding.source === "app-store") return "review_site";
  if (
    finding.source === "hacker-news" ||
    finding.source === "reddit" ||
    finding.source === "github-issues" ||
    finding.source === "idea-4"
  ) {
    return "community_discussion";
  }
  return "other";
}

function isoTimestamp(value: string, fallback: string): string {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return fallback;
  // Plain dates become midnight UTC; full timestamps pass through.
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim())
    ? `${value.trim()}T00:00:00.000Z`
    : new Date(parsed).toISOString();
}

/** The record as it will be submitted: approved record + recorded
 * overrides, WITHOUT the submission bookkeeping marker (the marker is
 * written after submission; the hash must cover the submitted bytes). */
export function recordForSubmission(
  record: ReviewRecord,
  overrides?: PublishOverrides,
): Record<string, unknown> {
  const { submission: _submission, ...rest } = record as ReviewRecord & {
    submission?: EditorialSubmissionMarker;
  };
  void _submission;
  const submitted: Record<string, unknown> = JSON.parse(JSON.stringify(rest));
  if (overrides) submitted.publishOverrides = overrides;
  return submitted;
}

/**
 * Apply human title/product-name overrides to the draft MDX and manifest
 * row. Pure: returns new artifacts, never mutates the record.
 */
export function applyTitleOverrides(
  draft: PainDraft,
  overrides: { title?: string; productName?: string },
): { mdx: string; manifestRow: Record<string, unknown> } {
  const title = overrides.title ?? draft.title;
  const productName = overrides.productName ?? draft.productName;
  let mdx = draft.mdx;
  // Frontmatter title line (same sanitising the writer applies).
  mdx = mdx.replace(
    /^title: "[^"]*"\n/m,
    `title: "${sanitizeFrontmatterTitle(title)}"\n`,
  );
  // Hero line in the Landing Page build prompt.
  mdx = mdx.split(`Hero line: ${draft.title}.`).join(`Hero line: ${title}.`);
  // Product name throughout the body (exact phrase, all occurrences).
  if (overrides.productName && overrides.productName !== draft.productName) {
    mdx = mdx.split(draft.productName).join(overrides.productName);
  }
  const manifestRow: Record<string, unknown> = JSON.parse(
    JSON.stringify(draft.manifestRow),
  );
  manifestRow.title = title;
  manifestRow.description =
    `${title} — ${productName}, a weekend-buildable tool for the people reporting this pain.`;
  const og = manifestRow.og as Record<string, unknown> | undefined;
  if (og && typeof og === "object") {
    og.subject =
      `${productName}: a focused tool that removes one manual task, shown in use, no people, no legible text`;
  }
  return { mdx, manifestRow };
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

/**
 * The manifest row as it will be submitted: highlights dropped (the block
 * fails tagging validation without stats — see validate-idea-tags; the
 * writer only ever emits a bare problemQuote), OG left as "draft",
 * no publishedAt (editorial sets it on release). Validated against the
 * editorial taxonomy allowlists; throws with the field name on violation.
 */
export function finalManifestRow(
  record: ReviewRecord,
  manifestRow: Record<string, unknown>,
): { row: Record<string, unknown>; highlightsDropped: boolean } {
  const row: Record<string, unknown> = JSON.parse(JSON.stringify(manifestRow));
  const highlightsDropped = row.highlights !== undefined && row.highlights !== null;
  delete row.highlights;
  const problems: string[] = [];
  if (row.slug !== record.slug) problems.push(`manifestRow.slug (${String(row.slug)}) does not match the record slug`);
  if (row.source !== `pain-engine:${record.slug}`) {
    problems.push(`manifestRow.source must be "pain-engine:${record.slug}"`);
  }
  const provenance = row.provenance as Record<string, unknown> | undefined;
  if (!provenance || provenance.researchMode !== "pain-engine") {
    problems.push('manifestRow.provenance.researchMode must be "pain-engine"');
  }
  if (typeof row.title !== "string" || row.title.length > LIMITS.titleChars) {
    problems.push(`manifestRow.title must be ≤${LIMITS.titleChars} chars`);
  }
  if (typeof row.description !== "string" || row.description.length > LIMITS.descriptionChars) {
    problems.push(`manifestRow.description must be ≤${LIMITS.descriptionChars} chars`);
  }
  if (typeof row.category !== "string" || !(CATEGORY_SLUGS as readonly string[]).includes(row.category)) {
    problems.push(`manifestRow.category "${String(row.category)}" is not an editorial category`);
  }
  const tools = asStringArray(row.tools);
  if (tools.length < 2 || tools.some((t) => !(TOOL_SLUGS as readonly string[]).includes(t))) {
    problems.push("manifestRow.tools needs ≥2 editorial tool slugs");
  }
  const audiences = asStringArray(row.audiences);
  if (audiences.length < 2 || audiences.some((a) => !(AUDIENCE_SLUGS as readonly string[]).includes(a))) {
    problems.push("manifestRow.audiences needs ≥2 editorial audience slugs");
  }
  if (typeof row.revenueGoal !== "string" || !(REVENUE_GOAL_SLUGS as readonly string[]).includes(row.revenueGoal)) {
    problems.push(`manifestRow.revenueGoal "${String(row.revenueGoal)}" is not an editorial revenue goal`);
  }
  if (typeof row.buildTime !== "string" || !(BUILD_TIME_VALUES as readonly string[]).includes(row.buildTime)) {
    problems.push(`manifestRow.buildTime "${String(row.buildTime)}" is not an editorial build time`);
  }
  if (row.publishedAt !== undefined) {
    problems.push("manifestRow must not carry publishedAt yet — editorial sets it on release");
  }
  if (problems.length > 0) {
    throw new Error(`Manifest row is not submission-ready: ${problems.join("; ")}`);
  }
  return { row, highlightsDropped };
}

/** Editorial metadata input, in the shape `editorialMetadataSchema` takes. */
export function buildMetadata(manifestRow: Record<string, unknown>): Record<string, unknown> {
  const og = manifestRow.og as Record<string, unknown> | undefined;
  return {
    description: manifestRow.description,
    category: manifestRow.category,
    buildTime: manifestRow.buildTime,
    revenueGoal: manifestRow.revenueGoal,
    tools: manifestRow.tools,
    audiences: manifestRow.audiences,
    highlights: null,
    og: og && typeof og.subject === "string" && typeof og.accent === "string"
      ? { subject: og.subject, accent: og.accent }
      : null,
  };
}

const UNVERIFIED_REASON =
  "pain-engine: no per-source page check; covered by the single human approval";

/** Map the draft's evidence receipts onto editorial sources + claims. */
export function mapEvidenceToEditorial(
  record: ReviewRecord,
  mdx: string,
): { sources: Record<string, unknown>[]; claims: Record<string, unknown>[] } {
  const findings = record.draft.evidence;
  const seenUrls = new Map<string, number>();
  const sources: Record<string, unknown>[] = [];
  const claims: Record<string, unknown>[] = [];
  const pricedUrls = new Set(record.draft.prices.map((p) => p.url));
  for (const finding of findings) {
    // The editorial envelope requires a public http(s) URL per source. A
    // finding whose URL is not one (the App Store listener used to store
    // the bare numeric review id here) must refuse at build time with a
    // clear message — not produce an envelope the server then refuses with
    // a schema error. Repair the finding URL in the review record (the
    // evidence text is unchanged) or re-run the engine.
    let findingUrl: URL | null = null;
    try {
      findingUrl = new URL(finding.url);
    } catch {
      findingUrl = null;
    }
    if (!findingUrl || (findingUrl.protocol !== "http:" && findingUrl.protocol !== "https:")) {
      throw new Error(
        `Cannot submit ${record.slug}: evidence "${finding.title}" (${finding.source}) has no usable URL (${JSON.stringify(finding.url)}) — the editorial envelope requires a public http(s) URL.`,
      );
    }
    if (seenUrls.has(finding.url)) continue;
    const index = sources.length + 1;
    seenUrls.set(finding.url, index);
    const sourceId = `src_${index}`;
    const retrievedAt = isoTimestamp(finding.date, record.createdAt);
    // The envelope schema trims every text field on parse, and the
    // receiver hashes the parsed values — so a value the schema would
    // trim (a quote sliced mid-phrase ending in a space) would make the
    // submitted artifact hash disagree with the receiver's. Trim here, so
    // the envelope the bridge builds is already schema-canonical.
    sources.push({
      id: sourceId,
      url: finding.url,
      publisher: null,
      title: finding.title.trim(),
      sourceType: sourceTypeFor(finding),
      publishedAt: /^\d{4}-\d{2}-\d{2}$/.test(finding.date.trim()) ? finding.date.trim() : null,
      retrievedAt,
      excerpt: (finding.quote || finding.text.slice(0, 500)).trim(),
      context: finding.context.trim(),
      verification: { status: "unverified", reason: UNVERIFIED_REASON, checkedAt: null },
    });
    const anchor = (finding.quote || finding.text.slice(0, 120)).trim();
    claims.push({
      id: `claim_${index}`,
      text: (finding.quote || finding.title).trim(),
      anchorText: anchor,
      section: sectionForAnchor(mdx, anchor),
      kind: "observed",
      topic: pricedUrls.has(finding.url) ? "pricing" : "pain",
      material: true,
      sourceIds: [sourceId],
      contradictingSourceIds: [],
      verification: { status: "unverified", reason: UNVERIFIED_REASON },
    });
  }
  return { sources, claims };
}

export interface PainEngineSourceReview {
  contractVersion: typeof PAIN_ENGINE_SUBMISSION_CONTRACT_VERSION;
  kind: "pain-engine-approval";
  slug: string;
  recordHash: string;
  verdict: "PASS";
  reviewedAt: string;
  reviewer: string;
  items: {
    evidenceId: string;
    source: string;
    sourceUrl: string;
    quote: string | null;
    checks: {
      excerptMatchesRecord: boolean;
      quotedVerbatim: boolean;
      coveredByApproval: boolean;
    };
    notes: string;
  }[];
  scorecard: { composite: number; verdict: string; rationale: string };
  notProven: string[];
  failures: string[];
  seal: string;
}

/**
 * The Pain Engine source review: the tamper-evident binding of the single
 * human approval to the exact submitted record bytes. It is a distinct
 * document type from the Source Critic PASS and says so — it does not
 * claim per-source page checks nobody performed.
 */
export function buildPainEngineSourceReview(
  record: ReviewRecord,
  recordJson: string,
): PainEngineSourceReview {
  if (record.status !== "approved" || !record.decidedAt) {
    throw new Error(
      `Cannot build a source review for ${record.slug}: the record is ${record.status} (a review needs the human approval and decidedAt).`,
    );
  }
  const recordHash = sha256Hex(recordJson);
  const items = record.draft.evidence.map((finding, i) => ({
    evidenceId: `finding_${i + 1}`,
    source: finding.source,
    sourceUrl: finding.url,
    quote: finding.quote || null,
    checks: {
      excerptMatchesRecord: true,
      quotedVerbatim: finding.quote.length > 0,
      coveredByApproval: true,
    },
    notes:
      "covered by the single human approval; no per-source page check was performed",
  }));
  const unsigned: Omit<PainEngineSourceReview, "seal"> = {
    contractVersion: PAIN_ENGINE_SUBMISSION_CONTRACT_VERSION,
    kind: "pain-engine-approval",
    slug: record.slug,
    recordHash,
    verdict: "PASS" as const,
    reviewedAt: record.decidedAt,
    reviewer: "pain-engine:human-approval",
    items,
    scorecard: {
      composite: record.draft.scorecard.composite,
      verdict: record.draft.scorecard.verdict,
      rationale: record.draft.scorecard.rationale,
    },
    notProven: record.draft.notProven,
    failures: [] as string[],
  };
  return { ...unsigned, seal: sha256Hex(canonicalJson(unsigned)) };
}

/** Re-verify a sealed Pain Engine source review against the submitted record
 * bytes. Returns the issues found (empty = valid). */
export function verifyPainEngineSourceReview(
  doc: PainEngineSourceReview,
  recordJson: string,
): string[] {
  const issues: string[] = [];
  if (doc.contractVersion !== PAIN_ENGINE_SUBMISSION_CONTRACT_VERSION) {
    issues.push(`contractVersion: expected ${PAIN_ENGINE_SUBMISSION_CONTRACT_VERSION}`);
  }
  if (doc.kind !== "pain-engine-approval") issues.push('kind: expected "pain-engine-approval"');
  if (doc.verdict !== "PASS") issues.push(`verdict: ${doc.verdict}`);
  if (doc.failures.length > 0) issues.push("failures: must be empty when verdict is PASS");
  if (doc.recordHash !== sha256Hex(recordJson)) {
    issues.push("recordHash: does not match the submitted record bytes");
  }
  const { seal: _seal, ...unsigned } = doc;
  void _seal;
  if (doc.seal !== sha256Hex(canonicalJson(unsigned))) {
    issues.push("seal: does not match the document body (tampered or unsigned)");
  }
  let record: Record<string, unknown>;
  try {
    record = JSON.parse(recordJson) as Record<string, unknown>;
  } catch {
    issues.push("recordJson: not valid JSON");
    return issues;
  }
  const draft = record.draft as Record<string, unknown> | undefined;
  const evidence = Array.isArray(draft?.evidence)
    ? (draft.evidence as { url?: unknown }[])
    : [];
  const covered = new Set(doc.items.map((item) => item.sourceUrl));
  for (const finding of evidence) {
    if (typeof finding.url === "string" && !covered.has(finding.url)) {
      issues.push(`coverage: evidence ${finding.url} is not covered by the review`);
    }
  }
  return issues;
}

const RECOMMENDATION_FOR_VERDICT: Record<string, string> = {
  BUILD: "accept",
  PIVOT: "needs_research",
  PASS: "reject",
};

export interface PainEngineSubmission {
  record: ReviewRecord;
  recordJson: string;
  recordHash: string;
  mdx: string;
  manifestRow: Record<string, unknown>;
  metadata: Record<string, unknown>;
  sources: Record<string, unknown>[];
  claims: Record<string, unknown>[];
  sourceReview: PainEngineSourceReview;
  sourceReviewJson: string;
  envelope: Record<string, unknown>;
  submissionId: string;
  artifactHash: string;
  highlightsDropped: boolean;
  overridesApplied: PublishOverrides | null;
  verdict: string;
}

/**
 * Build the full editorial submission for an approved review record.
 * Refuses (throws) unless the record is approved and not already
 * submitted, and unless the title/product name pass the gate (writer
 * values, or the human overrides when passed). Pure except for hashing;
 * writes nothing — the CLI decides what lands in tmp/ and in the record.
 */
export function buildSubmission(
  record: ReviewRecord,
  overrides?: { title?: string; productName?: string },
): PainEngineSubmission {
  if (record.status !== "approved") {
    throw new Error(
      `Refusing to submit ${record.slug}: the review is ${record.status}. Only an approved draft can enter editorial.`,
    );
  }
  if (record.submission?.status === "submitted") {
    throw new Error(
      `Refusing to submit ${record.slug}: already submitted (submission ${record.submission.submissionId}).`,
    );
  }
  // Resolve the effective overrides: freshly passed flags win; otherwise a
  // previously recorded override from an earlier bridge run still applies
  // (the draft's raw title must not resurface just because --title was not
  // re-passed). The appliedAt timestamp is stable for identical override
  // values, so the submission hash is reproducible across runs — a
  // --confirm-submission from a dry run must still match on the --apply run.
  const recorded = record.publishOverrides;
  const effectiveTitle =
    overrides?.title ?? recorded?.title ?? record.draft.title;
  const effectiveProductName =
    overrides?.productName ?? recorded?.productName ?? record.draft.productName;
  const hasOverride =
    effectiveTitle !== record.draft.title ||
    effectiveProductName !== record.draft.productName;
  const recordedTitle = recorded?.title ?? record.draft.title;
  const recordedProductName = recorded?.productName ?? record.draft.productName;
  const overridesApplied: PublishOverrides | null = hasOverride
    ? {
        ...(effectiveTitle !== record.draft.title ? { title: effectiveTitle } : {}),
        ...(effectiveProductName !== record.draft.productName
          ? { productName: effectiveProductName }
          : {}),
        appliedAt:
          recorded &&
          recordedTitle === effectiveTitle &&
          recordedProductName === effectiveProductName
            ? recorded.appliedAt
            : new Date().toISOString(),
      }
    : null;
  if (overridesApplied) {
    const issues = overrideTitleIssues(effectiveTitle, effectiveProductName);
    if (issues.length > 0) {
      throw new Error(`Title override refused: ${issues.join("; ")}`);
    }
  } else {
    const issues = writerTitleIssues(record);
    if (issues.length > 0) {
      throw new Error(`Title gate refused ${record.slug}: ${issues.join("; ")}`);
    }
  }

  const { mdx, manifestRow } = applyTitleOverrides(record.draft, {
    title: effectiveTitle,
    productName: effectiveProductName,
  });
  const { row: finalRow, highlightsDropped } = finalManifestRow(record, manifestRow);
  const metadata = buildMetadata(finalRow);
  for (const [field, limit] of [
    ["title", LIMITS.titleChars],
    ["description", LIMITS.descriptionChars],
  ] as const) {
    const value = finalRow[field];
    if (typeof value === "string" && value.length > limit) {
      throw new Error(`Manifest row ${field} is ${value.length} chars (limit ${limit}) — shorten the title`);
    }
  }
  if (typeof (metadata.og as Record<string, unknown> | null)?.subject === "string") {
    const subject = (metadata.og as Record<string, unknown>).subject as string;
    if (subject.length > LIMITS.ogSubjectChars) {
      throw new Error(`OG subject is ${subject.length} chars (limit ${LIMITS.ogSubjectChars})`);
    }
  }

  const { sources, claims } = mapEvidenceToEditorial(record, mdx);
  const markdown = stripFrontmatter(mdx);
  const submittedRecord = recordForSubmission(record, overridesApplied ?? undefined);
  const recordJson = canonicalJson(submittedRecord);
  const recordHash = sha256Hex(recordJson);
  const sourceReview = buildPainEngineSourceReview(
    { ...record, publishOverrides: overridesApplied ?? record.publishOverrides },
    recordJson,
  );
  const sourceReviewJson = canonicalJson(sourceReview);
  const reviewIssues = verifyPainEngineSourceReview(sourceReview, recordJson);
  if (reviewIssues.length > 0) {
    throw new Error(`Built source review failed self-check: ${reviewIssues.join("; ")}`);
  }

  const buyer = "People doing this task by hand today";
  // Slices can land on a space; the envelope schema trims these fields on
  // parse, so trim here as well — otherwise the submitted artifact hash
  // (computed from the raw values) disagrees with the receiver's (computed
  // from the parsed values). See the same note in mapEvidenceToEditorial.
  const job = `The manual step in these reports: ${record.cluster.label}`.slice(0, LIMITS.jobChars).trim();
  const wedge =
    `${effectiveProductName}: a focused tool that removes the manual step behind ${record.draft.evidence.length} reports.`.slice(
      0,
      LIMITS.wedgeChars,
    ).trim();
  const recommendation = RECOMMENDATION_FOR_VERDICT[record.draft.scorecard.verdict] ?? "unknown";
  const artifactHash = submissionArtifactHashSync({
    title: effectiveTitle,
    markdown,
    metadata,
    sources,
    claims,
  });
  const envelope: Record<string, unknown> = {
    contractVersion: PAIN_ENGINE_SUBMISSION_CONTRACT_VERSION,
    submissionId: `pe_${recordHash.slice(0, 32)}`,
    producer: PAIN_ENGINE_PRODUCER,
    mode: "live",
    engineRunId: null,
    engineContractVersion: PAIN_ENGINE_SUBMISSION_CONTRACT_VERSION,
    artifactHash,
    title: effectiveTitle,
    proposedSlug: record.slug,
    buyer,
    job,
    wedge,
    recommendation,
    recommendationReasons: [
      record.draft.scorecard.rationale.slice(0, LIMITS.recommendationReasonChars).trim(),
    ],
    markdown,
    metadata,
    sources,
    claims,
    checks: [],
    legacy: null,
  };
  return {
    record,
    recordJson,
    recordHash,
    mdx,
    manifestRow: finalRow,
    metadata,
    sources,
    claims,
    sourceReview,
    sourceReviewJson,
    envelope,
    submissionId: envelope.submissionId as string,
    artifactHash,
    highlightsDropped,
    overridesApplied,
    verdict: record.draft.scorecard.verdict,
  };
}
