import { z } from "zod";

import { EDITORIAL_LIMITS as L } from "./limits";
import { editorialMetadataSchema } from "./metadata";
import {
  editorialIdSchema,
  idempotencyKeySchema,
  markdownBodySchema,
  multiLineText,
  sha256Schema,
  singleLineText,
} from "./primitives";
import {
  CANDIDATE_STATES,
  PUBLICATION_STATES,
  REJECT_REASONS,
  RELEASE_STATES,
} from "./states";
import { CATEGORY_SLUGS } from "./taxonomy";
import { QUEUE_BUCKETS } from "./views";

export const reasonSchema = multiLineText(L.reasonChars);
export const noteSchema = multiLineText(L.noteChars);

/* ------------------------------------------------------------------ */
/* Listing filters (parsed from URL search params on the server)       */
/* ------------------------------------------------------------------ */

export const IDEA_SORTS = ["updated_desc", "updated_asc", "title_asc"] as const;
export const SEVERITY_FILTERS = ["blocking", "evidence", "warnings", "clean"] as const;
export const COVERAGE_FILTERS = ["complete", "partial", "none"] as const;
export const FRESHNESS_FILTERS = ["fresh", "aging", "stale", "unknown"] as const;

export const ideaFilterSchema = z.strictObject({
  scope: z.enum(["queue", "library"]),
  bucket: z.enum(QUEUE_BUCKETS).nullable(),
  decision: z.enum(CANDIDATE_STATES).nullable(),
  severity: z.enum(SEVERITY_FILTERS).nullable(),
  sourceAge: z.enum(FRESHNESS_FILTERS).nullable(),
  engineRunId: editorialIdSchema.nullable(),
  category: z.enum(CATEGORY_SLUGS).nullable(),
  search: z.string().trim().max(L.searchChars).nullable(),
  publication: z.enum(PUBLICATION_STATES).nullable(),
  coverage: z.enum(COVERAGE_FILTERS).nullable(),
  staleEvidence: z.boolean(),
  sort: z.enum(IDEA_SORTS),
});
export type IdeaFilter = z.infer<typeof ideaFilterSchema>;

export function defaultIdeaFilter(scope: IdeaFilter["scope"]): IdeaFilter {
  return {
    scope,
    bucket: null,
    decision: null,
    severity: null,
    sourceAge: null,
    engineRunId: null,
    category: null,
    search: null,
    publication: null,
    coverage: null,
    staleEvidence: false,
    sort: "updated_desc",
  };
}

export const RELEASE_GROUPS = ["attention", "in_flight", "preview_ready", "completed", "all"] as const;
export const releaseFilterSchema = z.strictObject({
  group: z.enum(RELEASE_GROUPS),
  ideaId: editorialIdSchema.nullable(),
});
export type ReleaseFilter = z.infer<typeof releaseFilterSchema>;

export const activityFilterSchema = z.strictObject({
  ideaId: editorialIdSchema.nullable(),
  outcome: z.enum(["succeeded", "denied", "failed"]).nullable(),
});
export type ActivityFilter = z.infer<typeof activityFilterSchema>;

export const cursorSchema = z.string().max(L.cursorChars).nullable();
export const pageSizeSchema = z.int().min(1).max(L.pageSizeMax);

/* ------------------------------------------------------------------ */
/* Command inputs                                                      */
/* ------------------------------------------------------------------ */

export const saveDraftPatchSchema = z
  .strictObject({
    title: singleLineText(L.titleChars).optional(),
    markdown: markdownBodySchema.optional(),
    metadata: editorialMetadataSchema.optional(),
  })
  .refine(
    (patch) => patch.title !== undefined || patch.markdown !== undefined || patch.metadata !== undefined,
    "Nothing to save",
  );
export type SaveDraftPatch = z.infer<typeof saveDraftPatchSchema>;

export const candidateDecisionSchema = z.discriminatedUnion("decision", [
  z.strictObject({ decision: z.literal("accepted"), rationale: reasonSchema }),
  z.strictObject({ decision: z.literal("needs_research"), question: multiLineText(L.questionChars) }),
  z
    .strictObject({
      decision: z.literal("rejected"),
      reasonCategory: z.enum(REJECT_REASONS),
      note: noteSchema.nullable(),
    })
    .refine((input) => input.reasonCategory !== "other" || input.note !== null, {
      message: "Explain the reason when choosing Other",
      path: ["note"],
    }),
  z.strictObject({ decision: z.literal("new"), reason: reasonSchema }),
]);
export type CandidateDecisionInput = z.infer<typeof candidateDecisionSchema>;

export const approvalInputSchema = z.strictObject({
  /** The explicit attestation. There is no implicit or bulk approval. */
  attest: z.literal(true),
  note: noteSchema.nullable(),
});
export type ApprovalInput = z.infer<typeof approvalInputSchema>;

export const flagInputSchema = z.strictObject({
  severity: z.enum(["high", "low"]),
  note: noteSchema,
});
export type FlagInput = z.infer<typeof flagInputSchema>;

export const noteTargetSchema = z.strictObject({
  kind: z.enum(["section", "claim", "source", "metadata"]),
  id: editorialIdSchema,
});

export const commandIdSchemas = {
  id: editorialIdSchema,
  hash: sha256Schema,
  idempotencyKey: idempotencyKeySchema,
  releaseState: z.enum(RELEASE_STATES),
} as const;

/* ------------------------------------------------------------------ */
/* Acknowledgements                                                    */
/* ------------------------------------------------------------------ */

export type ImportAck = {
  ideaId: string;
  revisionId: string;
  duplicate: boolean;
  quarantined: boolean;
  slugConflict: boolean;
};

export type SaveDraftAck = {
  revisionId: string;
  version: number;
  savedAt: string;
  artifactHash: string;
  /** Review attestations whose dependency hash no longer matches. */
  invalidatedReviews: number;
};

export type ReviewAck = {
  itemId: string;
  revisionId: string;
  reviewState: "draft" | "in_review" | "changes_requested" | "approved";
};
