import { v, type Infer } from "convex/values";

import {
  CHECK_CATEGORIES,
  CHECK_OUTCOMES,
  CHECK_PRODUCERS,
  CHECK_SEVERITIES,
  type QualityCheck,
} from "../../lib/editorial/contracts/checks";
import {
  CLAIM_KINDS,
  CLAIM_TOPICS,
  CLAIM_VERIFICATION_STATUSES,
  SOURCE_TYPES,
  SOURCE_VERIFICATION_STATUSES,
  VERIFICATION_AUTHORITIES,
  type EditorialClaim,
  type EditorialSource,
} from "../../lib/editorial/contracts/evidence";
import type { EditorialMetadata } from "../../lib/editorial/contracts/metadata";
import type { SectionKey } from "../../lib/editorial/contracts/sections";
import {
  APPROVAL_STATUSES,
  CANDIDATE_STATES,
  LIFECYCLE_STATES,
  PUBLICATION_STATES,
  REJECT_REASONS,
  RELEASE_OPERATIONS,
  RELEASE_STATES,
  REVIEW_STATES,
  REVISION_KINDS,
} from "../../lib/editorial/contracts/states";
import { ENGINE_RECOMMENDATIONS } from "../../lib/editorial/contracts/submission";
import { ACTIVITY_ACTIONS } from "../../lib/editorial/contracts/views";
import type {
  ApprovalRecord,
  AttestationRecord,
  AuditRecord,
  FlagRecord,
  IdeaRecord,
  NoteRecord,
  ReleaseRecord,
  ResolutionRecord,
  RevisionRecord,
} from "../../lib/editorial/core/state";

/**
 * Convex validators for the private editorial tables (WP46-E4).
 *
 * Stored records are the editorial core's records with the record id stored
 * as `key` (`by_id` is a reserved index name). `Same` assertions fail the
 * typecheck if a validator and its core record drift apart. Contract enums
 * are literal unions; the publishing taxonomy (category, tools, audiences,
 * build time, revenue goal) is stored as strings, validated on the way in,
 * so a later taxonomy change cannot make stored drafts invalid.
 */

/** A union of string literals from one of the contract's `as const` lists. */
export function literals<const T extends readonly [string, string, ...string[]]>(values: T) {
  return v.union(...values.map((value: T[number]) => v.literal(value)));
}

/** Mutual assignability: every required field on each side exists on the other, with the same type. */
export type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
export type Assert<T extends true> = T;
/** One-way: every value of `A` can be stored as `B`. */
export type Storable<A, B> = [A] extends [B] ? true : false;

/** A core record as stored: `id` becomes `key`. */
export type Stored<T extends { id: string }> = Omit<T, "id"> & { key: string };

export const nullableString = v.union(v.string(), v.null());
export const nullableNumber = v.union(v.number(), v.null());

export const actorRefValidator = v.object({
  id: v.string(),
  kind: literals(["human", "service", "system"]),
  label: v.string(),
});

const sectionKeyValidator = literals([
  "problem",
  "solution",
  "market",
  "competition",
  "business-model",
  "tech-stack",
  "prompts",
  "sources",
]);
export type SectionKeyMatches = Assert<Same<Infer<typeof sectionKeyValidator>, SectionKey>>;

/* Revision content ---------------------------------------------------------- */

export const metadataValidator = v.object({
  description: v.string(),
  category: v.string(),
  buildTime: v.string(),
  revenueGoal: v.string(),
  tools: v.array(v.string()),
  audiences: v.array(v.string()),
  highlights: v.union(
    v.object({
      problemQuote: v.string(),
      stats: v.array(v.object({ value: v.string(), label: v.string(), source: nullableString })),
      competitors: v.union(v.array(v.object({ name: v.string(), price: v.string() })), v.null()),
      tiers: v.optional(v.array(v.object({ name: v.string(), price: v.string() }))),
    }),
    v.null(),
  ),
  og: v.union(v.object({ subject: v.string(), accent: v.string() }), v.null()),
});
export type MetadataStorable = Assert<Storable<EditorialMetadata, Infer<typeof metadataValidator>>>;

export const sourceValidator = v.object({
  id: v.string(),
  url: v.string(),
  publisher: nullableString,
  title: nullableString,
  sourceType: literals(SOURCE_TYPES),
  publishedAt: nullableString,
  retrievedAt: nullableString,
  excerpt: nullableString,
  context: nullableString,
  verification: v.object({
    status: literals(SOURCE_VERIFICATION_STATUSES),
    reason: nullableString,
    checkedAt: nullableString,
  }),
  excerptHash: nullableString,
  verificationAuthority: literals(VERIFICATION_AUTHORITIES),
});
export type SourceMatches = Assert<Same<Infer<typeof sourceValidator>, EditorialSource>>;

export const claimValidator = v.object({
  id: v.string(),
  text: v.string(),
  anchorText: v.string(),
  section: sectionKeyValidator,
  kind: literals(CLAIM_KINDS),
  topic: literals(CLAIM_TOPICS),
  material: v.boolean(),
  sourceIds: v.array(v.string()),
  contradictingSourceIds: v.array(v.string()),
  verification: v.object({ status: literals(CLAIM_VERIFICATION_STATUSES), reason: nullableString }),
  verificationAuthority: literals(VERIFICATION_AUTHORITIES),
});
export type ClaimMatches = Assert<Same<Infer<typeof claimValidator>, EditorialClaim>>;

export const checkValidator = v.object({
  id: v.string(),
  label: v.string(),
  category: literals(CHECK_CATEGORIES),
  severity: literals(CHECK_SEVERITIES),
  outcome: literals(CHECK_OUTCOMES),
  message: nullableString,
  locations: v.array(
    v.object({
      section: v.union(sectionKeyValidator, v.null()),
      claimId: nullableString,
      sourceId: nullableString,
      line: nullableNumber,
    }),
  ),
  policyVersion: v.string(),
  evaluatedHash: v.string(),
  evaluatedAt: v.string(),
  producer: literals(CHECK_PRODUCERS),
});
export type CheckMatches = Assert<Same<Infer<typeof checkValidator>, QualityCheck>>;

/* Records -------------------------------------------------------------------- */

const ideaOriginValidator = literals(["engine", "legacy", "manual"]);

export const ideaRecordValidator = v.object({
  key: v.string(),
  slug: v.string(),
  slugConflict: v.boolean(),
  duplicateOfIdeaId: nullableString,
  title: v.string(),
  buyer: v.string(),
  job: v.string(),
  wedge: v.string(),
  origin: ideaOriginValidator,
  engineRunId: nullableString,
  engineRecommendation: v.union(
    v.object({ value: literals(ENGINE_RECOMMENDATIONS), reasons: v.array(v.string()) }),
    v.null(),
  ),
  candidate: v.object({
    state: literals(CANDIDATE_STATES),
    reasonCategory: v.union(literals(REJECT_REASONS), v.null()),
    note: nullableString,
    question: nullableString,
    decidedAt: nullableString,
    decidedBy: v.union(actorRefValidator, v.null()),
  }),
  lifecycle: literals(LIFECYCLE_STATES),
  trash: v.union(
    v.object({
      trashedAt: v.string(),
      trashedBy: actorRefValidator,
      reason: v.string(),
      previousCandidate: literals(CANDIDATE_STATES),
      previousPublication: literals(PUBLICATION_STATES),
    }),
    v.null(),
  ),
  publication: v.object({
    state: literals(PUBLICATION_STATES),
    liveReleaseId: nullableString,
    lastLiveReleaseId: nullableString,
    firstPublishedAt: nullableString,
    lastReleasedAt: nullableString,
    unpublishedAt: nullableString,
    unpublishReason: nullableString,
  }),
  workingRevisionId: v.string(),
  generation: v.number(),
  version: v.number(),
  labels: v.array(v.string()),
  legacy: v.union(
    v.object({
      importedAt: v.string(),
      bodyOrigin: literals(["mdx", "convex"]),
      firstPublishedAt: nullableString,
    }),
    v.null(),
  ),
  createdAt: v.string(),
  updatedAt: v.string(),
});
export type IdeaRecordMatches = Assert<Same<Infer<typeof ideaRecordValidator>, Stored<IdeaRecord>>>;

export const revisionRecordValidator = v.object({
  key: v.string(),
  ideaId: v.string(),
  number: v.number(),
  kind: literals(REVISION_KINDS),
  origin: literals(["engine", "legacy", "manual", "editor"]),
  parentRevisionId: nullableString,
  createdAt: v.string(),
  createdBy: actorRefValidator,
  updatedAt: v.string(),
  updatedBy: actorRefValidator,
  version: v.number(),
  title: v.string(),
  markdown: v.string(),
  metadata: metadataValidator,
  sources: v.array(sourceValidator),
  claims: v.array(claimValidator),
  checks: v.array(checkValidator),
  checksRunAt: nullableString,
  reviewState: literals(REVIEW_STATES),
  changesRequestedNote: nullableString,
  quarantine: v.union(v.object({ reasons: v.array(v.string()) }), v.null()),
  discarded: v.boolean(),
  submissionKey: nullableString,
});
export type StoredRevision = Infer<typeof revisionRecordValidator>;
export type RevisionRecordStorable = Assert<Storable<Stored<RevisionRecord>, StoredRevision>>;

export const attestationRecordValidator = v.object({
  key: v.string(),
  ideaId: v.string(),
  revisionId: v.string(),
  itemId: v.string(),
  dependencyHash: v.string(),
  note: nullableString,
  at: v.string(),
  actor: actorRefValidator,
  retracted: v.boolean(),
});
export type AttestationMatches = Assert<Same<Infer<typeof attestationRecordValidator>, Stored<AttestationRecord>>>;

export const flagRecordValidator = v.object({
  key: v.string(),
  ideaId: v.string(),
  revisionId: v.string(),
  itemId: v.string(),
  dependencyHash: v.string(),
  severity: literals(["high", "low"]),
  note: v.string(),
  at: v.string(),
  actor: actorRefValidator,
  resolution: v.union(v.object({ note: v.string(), at: v.string(), actor: actorRefValidator }), v.null()),
});
export type FlagMatches = Assert<Same<Infer<typeof flagRecordValidator>, Stored<FlagRecord>>>;

export const resolutionRecordValidator = v.object({
  key: v.string(),
  ideaId: v.string(),
  issueId: v.string(),
  dependencyHash: v.string(),
  note: v.string(),
  at: v.string(),
  actor: actorRefValidator,
});
export type ResolutionMatches = Assert<Same<Infer<typeof resolutionRecordValidator>, Stored<ResolutionRecord>>>;

export const noteRecordValidator = v.object({
  key: v.string(),
  ideaId: v.string(),
  revisionId: v.string(),
  target: v.object({ kind: literals(["section", "claim", "source", "metadata"]), id: v.string() }),
  note: v.string(),
  at: v.string(),
  actor: actorRefValidator,
});
export type NoteMatches = Assert<Same<Infer<typeof noteRecordValidator>, Stored<NoteRecord>>>;

export const approvalRecordValidator = v.object({
  key: v.string(),
  ideaId: v.string(),
  revisionId: v.string(),
  revisionNumber: v.number(),
  artifactHash: v.string(),
  policyVersion: v.string(),
  assessmentDigest: v.string(),
  statement: v.string(),
  note: nullableString,
  approvedAt: v.string(),
  approvedBy: actorRefValidator,
  status: literals(APPROVAL_STATUSES),
  revokedAt: nullableString,
  revokedReason: nullableString,
});
export type ApprovalMatches = Assert<Same<Infer<typeof approvalRecordValidator>, Stored<ApprovalRecord>>>;

const releaseStateValidator = literals(RELEASE_STATES);

export const releaseRecordValidator = v.object({
  key: v.string(),
  ideaId: v.string(),
  operation: literals(RELEASE_OPERATIONS),
  state: releaseStateValidator,
  revisionId: nullableString,
  revisionNumber: nullableNumber,
  approvalId: nullableString,
  expectedLiveReleaseId: nullableString,
  rollbackTargetReleaseId: nullableString,
  generation: v.number(),
  attempt: v.number(),
  reason: nullableString,
  idempotencyKey: nullableString,
  createdAt: v.string(),
  updatedAt: v.string(),
  requestedBy: actorRefValidator,
  steps: v.array(v.object({ state: releaseStateValidator, at: v.string(), detail: nullableString })),
  error: v.union(v.object({ code: v.string(), message: v.string() }), v.null()),
  observation: v.union(v.object({ activated: v.boolean(), observedAt: v.string() }), v.null()),
});
export type ReleaseMatches = Assert<Same<Infer<typeof releaseRecordValidator>, Stored<ReleaseRecord>>>;

export const activityActionValidator = literals(ACTIVITY_ACTIONS);
export const auditOutcomeValidator = literals(["succeeded", "denied", "failed"]);

/**
 * One append-only activity entry. `revisionNumber` is copied in when the
 * entry is written, so the activity feed never loads revision bodies.
 */
export const auditRecordValidator = v.object({
  key: v.string(),
  at: v.string(),
  actor: actorRefValidator,
  action: activityActionValidator,
  outcome: auditOutcomeValidator,
  ideaId: nullableString,
  revisionId: nullableString,
  revisionNumber: nullableNumber,
  releaseId: nullableString,
  reason: nullableString,
  detail: nullableString,
  code: nullableString,
  correlationId: v.string(),
});
export type StoredAuditRecord = Infer<typeof auditRecordValidator>;
export type AuditRecordMatches = Assert<Same<StoredAuditRecord, Stored<AuditRecord>>>;

/* Indexes and caches ------------------------------------------------------------- */

/** First successful result for a request key (JSON of a CommandResult). */
export const idempotencyValidator = v.object({
  storeKey: v.string(),
  requestHash: v.string(),
  result: v.string(),
});

export const submissionKeyValidator = v.object({
  submissionKey: v.string(),
  artifactHash: v.string(),
  ideaId: v.string(),
  revisionId: v.string(),
});

export const slugValidator = v.object({ slug: v.string(), ideaId: v.string() });

/**
 * The queue/library summary of one idea: a derived cache, rebuilt by every
 * command that touches the idea and never edited, so it is stored as JSON
 * (as `preview_capabilities.renderSpec` is) rather than as typed fields.
 */
export const ideaSummaryValidator = v.object({ ideaKey: v.string(), summary: v.string() });

export const settingsValidator = v.object({
  key: v.literal("settings"),
  policyVersion: v.string(),
  killSwitchEngaged: v.boolean(),
  updatedAt: v.number(),
});
