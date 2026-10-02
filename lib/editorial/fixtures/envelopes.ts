import { runFixtureChecks } from "../adapters/fixture/checks";
import type { EditorialClaimInput, EditorialSourceInput } from "../contracts/evidence";
import { EDITORIAL_CONTRACT_VERSION } from "../contracts/limits";
import type { EditorialMetadata } from "../contracts/metadata";
import type { EditorialSubmission, EngineRecommendation } from "../contracts/submission";
import { submissionArtifactHash } from "../domain/artifact";
import { buildArticleMarkdown, type ArticleSpec } from "./spec";

const DAY_MS = 24 * 60 * 60 * 1000;

type EnvelopeOptions = {
  submissionId: string;
  nowMs: number;
  policyVersion: string;
  producer: "engine" | "legacy-import";
  engineRunId?: string;
  recommendation?: EngineRecommendation;
  recommendationReasons?: string[];
  proposedSlug?: string;
  firstPublishedAt?: string | null;
  /** Non-legacy envelopes default to fixture mode; live-adapter tests build live ones. */
  mode?: "fixture" | "live";
};

export function specSources(spec: ArticleSpec, nowMs: number): EditorialSourceInput[] {
  return spec.sources.map((source) => {
    const retrievedAt =
      source.retrievedDaysAgo === null ? null : new Date(nowMs - source.retrievedDaysAgo * DAY_MS).toISOString();
    const checked = source.verification === "verified" || source.verification === "changed";
    return {
      id: source.id,
      url: source.url,
      publisher: source.publisher,
      title: source.title,
      sourceType: source.sourceType,
      publishedAt: source.publishedAt,
      retrievedAt,
      excerpt: source.excerpt,
      context: source.context,
      verification: {
        status: source.verification,
        reason: source.verificationReason ?? null,
        checkedAt: checked ? retrievedAt : null,
      },
    };
  });
}

export function specClaims(spec: ArticleSpec): EditorialClaimInput[] {
  return spec.claims.map((claim) => ({
    id: claim.id,
    text: claim.text,
    anchorText: claim.anchor,
    section: claim.section,
    kind: claim.kind,
    topic: claim.topic,
    material: claim.material,
    sourceIds: [...claim.sourceIds],
    contradictingSourceIds: [...(claim.contradictingSourceIds ?? [])],
    verification: { status: claim.verification, reason: claim.verificationReason ?? null },
  }));
}

export function specMetadata(spec: ArticleSpec): EditorialMetadata {
  return {
    description: spec.metadata.description,
    category: spec.metadata.category,
    buildTime: spec.metadata.buildTime,
    revenueGoal: spec.metadata.revenueGoal,
    tools: [...spec.metadata.tools],
    audiences: [...spec.metadata.audiences],
    highlights: spec.metadata.highlights ?? null,
    og: spec.metadata.og ?? null,
  };
}

/**
 * Build a fixture-mode Editorial DTO v1 envelope from a demo spec. Engine
 * envelopes carry simulated checks evaluated against their own artifact
 * hash; legacy envelopes carry none.
 */
export async function buildFixtureEnvelope(spec: ArticleSpec, options: EnvelopeOptions): Promise<EditorialSubmission> {
  const markdown = buildArticleMarkdown(spec);
  const metadata = specMetadata(spec);
  const sources = specSources(spec, options.nowMs);
  const claims = specClaims(spec);
  const legacy = options.producer === "legacy-import";
  const artifactHash = await submissionArtifactHash({ title: spec.title, markdown, metadata, sources, claims });
  const checks = legacy
    ? []
    : runFixtureChecks({
        markdown,
        sources,
        artifactHash,
        policyVersion: options.policyVersion,
        nowMs: options.nowMs,
      }).map((check) => ({
        id: check.id,
        label: check.label,
        category: check.category,
        severity: check.severity,
        outcome: check.outcome,
        message: check.message,
        locations: check.locations,
        policyVersion: check.policyVersion,
        evaluatedHash: check.evaluatedHash,
        evaluatedAt: check.evaluatedAt,
      }));

  return {
    contractVersion: EDITORIAL_CONTRACT_VERSION,
    submissionId: options.submissionId,
    producer: options.producer,
    mode: legacy ? "legacy" : (options.mode ?? "fixture"),
    engineRunId: legacy ? null : (options.engineRunId ?? "run-fixture"),
    engineContractVersion: legacy ? null : 2,
    artifactHash,
    title: spec.title,
    proposedSlug: options.proposedSlug ?? spec.slug,
    buyer: spec.buyer,
    job: spec.job,
    wedge: spec.wedge,
    recommendation: legacy ? "unknown" : (options.recommendation ?? "accept"),
    recommendationReasons: legacy ? [] : (options.recommendationReasons ?? []),
    markdown,
    metadata,
    sources,
    claims,
    checks,
    legacy: legacy ? { firstPublishedAt: options.firstPublishedAt ?? null, bodyOrigin: "mdx" } : null,
  };
}
