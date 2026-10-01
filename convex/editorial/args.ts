import { v, type Infer } from "convex/values";

import {
  COVERAGE_FILTERS,
  FRESHNESS_FILTERS,
  IDEA_SORTS,
  RELEASE_GROUPS,
  SEVERITY_FILTERS,
  type ActivityFilter,
  type ApprovalInput,
  type CandidateDecisionInput,
  type FlagInput,
  type IdeaFilter,
  type ReleaseFilter,
  type SaveDraftPatch,
} from "../../lib/editorial/contracts/commands";
import type { EditorialTarget } from "../../lib/editorial/contracts/errors";
import type { EditorialMetadata } from "../../lib/editorial/contracts/metadata";
import {
  CANDIDATE_STATES,
  PUBLICATION_STATES,
  REJECT_REASONS,
  RELEASE_STATES,
} from "../../lib/editorial/contracts/states";
import {
  AUDIENCE_SLUGS,
  BUILD_TIME_VALUES,
  CATEGORY_SLUGS,
  REVENUE_GOAL_SLUGS,
  TOOL_SLUGS,
} from "../../lib/editorial/contracts/taxonomy";
import { QUEUE_BUCKETS } from "../../lib/editorial/contracts/views";
import { literals, nullableString, type Assert, type Same } from "./validators";

/**
 * Argument validators for the public editorial functions. They mirror the
 * repository's parameter types exactly (checked below); the shared core then
 * applies the contract's bounds and rules with its own Zod schemas.
 */

export const ideaFilterArgs = v.object({
  scope: literals(["queue", "library"]),
  bucket: v.union(literals(QUEUE_BUCKETS), v.null()),
  decision: v.union(literals(CANDIDATE_STATES), v.null()),
  severity: v.union(literals(SEVERITY_FILTERS), v.null()),
  sourceAge: v.union(literals(FRESHNESS_FILTERS), v.null()),
  engineRunId: nullableString,
  category: v.union(literals(CATEGORY_SLUGS), v.null()),
  search: nullableString,
  publication: v.union(literals(PUBLICATION_STATES), v.null()),
  coverage: v.union(literals(COVERAGE_FILTERS), v.null()),
  staleEvidence: v.boolean(),
  sort: literals(IDEA_SORTS),
});
export type IdeaFilterArgsMatch = Assert<Same<Infer<typeof ideaFilterArgs>, IdeaFilter>>;

export const releaseFilterArgs = v.object({ group: literals(RELEASE_GROUPS), ideaId: nullableString });
export type ReleaseFilterArgsMatch = Assert<Same<Infer<typeof releaseFilterArgs>, ReleaseFilter>>;

export const activityFilterArgs = v.object({
  ideaId: nullableString,
  outcome: v.union(literals(["succeeded", "denied", "failed"]), v.null()),
});
export type ActivityFilterArgsMatch = Assert<Same<Infer<typeof activityFilterArgs>, ActivityFilter>>;

export const metadataArgs = v.object({
  description: v.string(),
  category: literals(CATEGORY_SLUGS),
  buildTime: literals(BUILD_TIME_VALUES),
  revenueGoal: literals(REVENUE_GOAL_SLUGS),
  tools: v.array(literals(TOOL_SLUGS)),
  audiences: v.array(literals(AUDIENCE_SLUGS)),
  highlights: v.union(
    v.object({
      problemQuote: v.string(),
      stats: v.array(v.object({ value: v.string(), label: v.string(), source: nullableString })),
      competitors: v.union(v.array(v.object({ name: v.string(), price: v.string() })), v.null()),
    }),
    v.null(),
  ),
  og: v.union(v.object({ subject: v.string(), accent: v.string() }), v.null()),
});
export type MetadataArgsMatch = Assert<Same<Infer<typeof metadataArgs>, EditorialMetadata>>;

export const saveDraftPatchArgs = v.object({
  title: v.optional(v.string()),
  markdown: v.optional(v.string()),
  metadata: v.optional(metadataArgs),
});
export type SaveDraftPatchArgsMatch = Assert<Same<Infer<typeof saveDraftPatchArgs>, SaveDraftPatch>>;

export const candidateDecisionArgs = v.union(
  v.object({ decision: v.literal("accepted"), rationale: v.string() }),
  v.object({ decision: v.literal("needs_research"), question: v.string() }),
  v.object({ decision: v.literal("rejected"), reasonCategory: literals(REJECT_REASONS), note: nullableString }),
  v.object({ decision: v.literal("new"), reason: v.string() }),
);
export type CandidateDecisionArgsMatch = Assert<Same<Infer<typeof candidateDecisionArgs>, CandidateDecisionInput>>;

export const flagArgs = v.object({ severity: literals(["high", "low"]), note: v.string() });
export type FlagArgsMatch = Assert<Same<Infer<typeof flagArgs>, FlagInput>>;

export const targetArgs = v.object({
  kind: literals(["section", "claim", "source", "check", "review_item", "metadata", "artifact", "idea"]),
  id: v.string(),
});
export type TargetArgsMatch = Assert<Same<Infer<typeof targetArgs>, EditorialTarget>>;

export const approvalArgs = v.object({ attest: v.literal(true), note: nullableString });
export type ApprovalArgsMatch = Assert<Same<Infer<typeof approvalArgs>, ApprovalInput>>;

export const releaseStateArgs = literals(RELEASE_STATES);
