import type { EditorialClaim, EditorialSource } from "../contracts/evidence";
import { EDITORIAL_CONTRACT_VERSION } from "../contracts/limits";
import type { EditorialMetadata } from "../contracts/metadata";
import { hashCanonical, sha256Hex } from "./hash";
import { normalizeNewlines } from "./structure";

type SourceContentFields = Pick<
  EditorialSource,
  "id" | "url" | "publisher" | "title" | "sourceType" | "publishedAt" | "retrievedAt" | "excerpt" | "context"
>;
type ClaimContentFields = Pick<
  EditorialClaim,
  | "id"
  | "text"
  | "anchorText"
  | "section"
  | "kind"
  | "topic"
  | "material"
  | "sourceIds"
  | "contradictingSourceIds"
>;

/** The archived part of a source. Verification is assessed separately. */
export function sourceContent(source: SourceContentFields) {
  return {
    id: source.id,
    url: source.url,
    publisher: source.publisher,
    title: source.title,
    sourceType: source.sourceType,
    publishedAt: source.publishedAt,
    retrievedAt: source.retrievedAt,
    excerpt: source.excerpt,
    context: source.context,
  };
}

export function claimContent(claim: ClaimContentFields) {
  return {
    id: claim.id,
    text: claim.text,
    anchorText: claim.anchorText,
    section: claim.section,
    kind: claim.kind,
    topic: claim.topic,
    material: claim.material,
    sourceIds: [...claim.sourceIds],
    contradictingSourceIds: [...claim.contradictingSourceIds],
  };
}

export type ArtifactInput = {
  title: string;
  markdown: string;
  metadata: EditorialMetadata;
  sources: readonly SourceContentFields[];
  claims: readonly ClaimContentFields[];
};

export type RevisionHashes = {
  content: string;
  metadata: string;
  evidence: string;
  artifact: string;
};

/**
 * The artifact hash binds the exact reviewed bytes: body, title, metadata,
 * and archived evidence content. Verification results change over time
 * (a page moves, a price changes) without rewriting the artifact, so they
 * live in the assessment digest instead and invalidate reviews from there.
 */
export async function computeRevisionHashes(input: ArtifactInput): Promise<RevisionHashes> {
  const content = await sha256Hex(`markdown\n${normalizeNewlines(input.markdown)}`);
  const metadata = await hashCanonical({ title: input.title, metadata: input.metadata });
  const evidence = await hashCanonical({
    sources: input.sources.map(sourceContent),
    claims: input.claims.map(claimContent),
  });
  const artifact = await hashCanonical({
    contractVersion: EDITORIAL_CONTRACT_VERSION,
    content,
    metadata,
    evidence,
  });
  return { content, metadata, evidence, artifact };
}

/** Digest of current verification results; changes revoke dependent sign-offs. */
export async function assessmentDigest(
  sources: readonly Pick<EditorialSource, "id" | "verification" | "verificationAuthority">[],
  claims: readonly Pick<EditorialClaim, "id" | "verification" | "verificationAuthority">[],
): Promise<string> {
  return hashCanonical({
    sources: sources.map((source) => ({
      id: source.id,
      status: source.verification.status,
      reason: source.verification.reason,
      checkedAt: source.verification.checkedAt,
      authority: source.verificationAuthority,
    })),
    claims: claims.map((claim) => ({
      id: claim.id,
      status: claim.verification.status,
      reason: claim.verification.reason,
      authority: claim.verificationAuthority,
    })),
  });
}

/** Hash an envelope's artifact exactly as the receiver will. */
export async function submissionArtifactHash(input: ArtifactInput): Promise<string> {
  return (await computeRevisionHashes(input)).artifact;
}
