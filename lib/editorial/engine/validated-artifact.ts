import { Buffer } from "node:buffer";

import matter from "gray-matter";

import { auditEngineArtifact } from "../../engine/artifact-audit";
import type { AcceptedEvidence, ResearchRecordV2 } from "../../engine/evidence/contract";
import { renderEvidenceInline } from "../../engine/evidence/tokens";
import { escapeMdxText } from "../../engine/evidence/quote";
import { usedEvidenceIds } from "../../engine/page-format";
import { parseResearchRecord } from "../../engine/research-record";
import { editorialMetadataSchema } from "../contracts/metadata";
import { editorialSubmissionSchema, type EditorialSubmission } from "../contracts/submission";
import type { EditorialClaimInput, EditorialSourceInput, SourceType } from "../contracts/evidence";
import type { SectionKey } from "../contracts/sections";
import { submissionArtifactHash } from "../domain/artifact";
import { sha256Hex } from "../domain/hash";
import { splitSections } from "../domain/structure";

/** Node-only boundary: never import this module into a Convex query or mutation. */
const MAX_RECORD_BYTES = 512_000;
const MAX_MDX_BYTES = 220_000;
const MAX_MANIFEST_BYTES = 32_000;

export class EngineSubmissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EngineSubmissionError";
  }
}

export type EngineArtifactInput = {
  recordJson: string;
  mdx: string;
  manifestJson: string;
};

export type ValidatedEngineSubmission = {
  envelope: EditorialSubmission;
  /** Normalized contract-v2 record for trusted storage and later re-checks. */
  recordJson: string;
  recordHash: string;
};

function jsonObject(text: string, label: string, maxBytes: number): Record<string, unknown> {
  if (Buffer.byteLength(text, "utf8") > maxBytes) throw new EngineSubmissionError(`${label} exceeds its size limit.`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new EngineSubmissionError(`${label} is not valid JSON.`);
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new EngineSubmissionError(`${label} must be a JSON object.`);
  }
  return parsed as Record<string, unknown>;
}

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function sourceType(item: AcceptedEvidence): SourceType {
  if (item.kind === "community_quote") return "community_discussion";
  if (item.kind === "competitor_price" || item.kind === "competitor_availability") {
    return item.attribution === "first_party" ? "first_party_pricing" : "other";
  }
  // The record does not classify a market source as a report or government page.
  return "other";
}

function claimTopic(item: AcceptedEvidence): EditorialClaimInput["topic"] {
  if (item.kind === "competitor_price" || item.kind === "competitor_availability") return "pricing";
  if (item.kind === "community_quote") return "pain";
  return item.metric === "market_size" ? "market_size" : "usage";
}

function mappedEvidence(record: ResearchRecordV2, markdown: string): {
  sources: EditorialSourceInput[];
  claims: EditorialClaimInput[];
} {
  const used = usedEvidenceIds(record);
  const sections = splitSections(markdown).blocks;
  const sources: EditorialSourceInput[] = [];
  const claims: EditorialClaimInput[] = [];

  for (const item of record.evidence.accepted) {
    if (!used.has(item.id)) continue;
    const sourceId = `src_${item.id}`;
    const anchor = escapeMdxText(renderEvidenceInline(item));
    const section = sections.find((block) => block.key !== null && block.body.replace(/\s+/g, " ").includes(anchor.replace(/\s+/g, " ")));
    if (!section?.key) {
      throw new EngineSubmissionError(`Evidence ${item.id} has no exact anchor in the audited page.`);
    }
    sources.push({
      id: sourceId,
      url: item.sourceUrl,
      publisher: null,
      title: item.sourceTitle,
      sourceType: sourceType(item),
      publishedAt: null,
      retrievedAt: item.retrievedAt,
      excerpt: item.excerpt,
      context: null,
      verification: { status: "verified", reason: null, checkedAt: item.retrievedAt },
    });
    claims.push({
      id: `claim_${item.id}`,
      text: renderEvidenceInline(item),
      anchorText: anchor,
      section: section.key as SectionKey,
      kind: "observed",
      topic: claimTopic(item),
      material: true,
      sourceIds: [sourceId],
      contradictingSourceIds: [],
      verification: { status: "verified", reason: null },
    });
  }

  if (sources.length !== used.size || claims.length !== used.size) {
    throw new EngineSubmissionError("The audited page references evidence missing from the record.");
  }
  return { sources, claims };
}

/**
 * Re-parse the record and re-run the deep audit before granting any engine
 * authority. The caller supplies bytes, never a verification flag or receipt.
 */
export async function validateEngineSubmission(input: EngineArtifactInput): Promise<ValidatedEngineSubmission> {
  const rawRecord = jsonObject(input.recordJson, "Research record", MAX_RECORD_BYTES);
  const record = parseResearchRecord(rawRecord);
  if (record.mode !== "live") throw new EngineSubmissionError("Fixture research cannot enter the live editorial workspace.");
  if (record.brief.slug.startsWith("engine-draft-") || record.brief.slug.startsWith("_")) {
    throw new EngineSubmissionError("An engine draft cannot enter the live editorial workspace.");
  }
  if (Buffer.byteLength(input.mdx, "utf8") > MAX_MDX_BYTES) throw new EngineSubmissionError("Idea MDX exceeds its size limit.");
  const manifest = jsonObject(input.manifestJson, "Manifest row", MAX_MANIFEST_BYTES);
  const provenance = object(manifest.provenance);
  if (
    manifest.slug !== record.brief.slug ||
    manifest.title !== record.brief.title ||
    manifest.source !== `engine:${record.brief.slug}` ||
    provenance?.researchMode !== "live"
  ) {
    throw new EngineSubmissionError("Manifest identity or research mode disagrees with the record.");
  }

  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(input.mdx);
  } catch {
    throw new EngineSubmissionError("Idea MDX frontmatter is invalid.");
  }
  if (parsed.data.slug !== record.brief.slug || parsed.data.title !== record.brief.title || parsed.data.engine !== true) {
    throw new EngineSubmissionError("Idea MDX frontmatter disagrees with the engine record.");
  }
  const audit = auditEngineArtifact(parsed.content, record, { slug: record.brief.slug, manifestRow: manifest });
  if (audit.errors.length > 0) {
    throw new EngineSubmissionError(`Deep artifact audit failed: ${audit.errors.slice(0, 3).join("; ")}`);
  }

  const rawHighlights = object(manifest.highlights);
  const highlights = rawHighlights === null ? null : {
    problemQuote: rawHighlights.problemQuote,
    stats: Array.isArray(rawHighlights.stats)
      ? rawHighlights.stats.map((value) => {
          const stat = object(value);
          return { value: stat?.value, label: stat?.label, source: stat?.source ?? null };
        })
      : rawHighlights.stats,
    competitors: rawHighlights.competitors ?? null,
  };
  const rawOg = object(manifest.og);
  const metadata = editorialMetadataSchema.safeParse({
    description: manifest.description,
    category: manifest.category,
    buildTime: manifest.buildTime,
    revenueGoal: manifest.revenueGoal,
    tools: manifest.tools,
    audiences: manifest.audiences,
    highlights,
    og: rawOg ? { subject: rawOg.subject, accent: rawOg.accent } : null,
  });
  if (!metadata.success) {
    throw new EngineSubmissionError(`Manifest metadata is not editorial-ready: ${metadata.error.issues.map((issue) => issue.path.join(".")).slice(0, 8).join(", ")}`);
  }

  const markdown = parsed.content;
  const { sources, claims } = mappedEvidence(record, markdown);
  const normalizedRecordJson = JSON.stringify(record);
  const recordHash = await sha256Hex(normalizedRecordJson);
  const title = record.brief.title;
  const envelope: EditorialSubmission = {
    contractVersion: 1,
    submissionId: `eng_${recordHash.slice(0, 32)}`,
    producer: "engine",
    mode: "live",
    engineRunId: `run_${recordHash.slice(0, 32)}`,
    engineContractVersion: 2,
    artifactHash: await submissionArtifactHash({ title, markdown, metadata: metadata.data, sources, claims }),
    title,
    proposedSlug: record.brief.slug,
    buyer: record.brief.targetCustomer,
    job: "Not recorded in the research brief",
    wedge: record.brief.oneLiner,
    recommendation: "unknown",
    recommendationReasons: [],
    markdown,
    metadata: metadata.data,
    sources,
    claims,
    checks: [],
    legacy: null,
  };
  const validated = editorialSubmissionSchema.safeParse(envelope);
  if (!validated.success) {
    throw new EngineSubmissionError(`Mapped submission is invalid: ${validated.error.issues.map((issue) => issue.path.join(".")).slice(0, 8).join(", ")}`);
  }
  return { envelope: validated.data, recordJson: normalizedRecordJson, recordHash };
}
