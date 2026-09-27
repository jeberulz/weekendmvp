import { z } from "zod";

import { qualityCheckInputSchema } from "./checks";
import { editorialClaimInputSchema, editorialSourceInputSchema } from "./evidence";
import { EDITORIAL_CONTRACT_VERSION, EDITORIAL_LIMITS as L } from "./limits";
import { editorialMetadataSchema } from "./metadata";
import {
  calendarDateSchema,
  editorialIdSchema,
  markdownBodySchema,
  sha256Schema,
  singleLineText,
  slugSchema,
} from "./primitives";

export const SUBMISSION_PRODUCERS = ["engine", "legacy-import", "manual"] as const;
export type SubmissionProducer = (typeof SUBMISSION_PRODUCERS)[number];

export const SUBMISSION_MODES = ["live", "fixture", "legacy"] as const;
export type SubmissionMode = (typeof SUBMISSION_MODES)[number];

export const ENGINE_RECOMMENDATIONS = ["accept", "needs_research", "reject", "unknown"] as const;
export type EngineRecommendation = (typeof ENGINE_RECOMMENDATIONS)[number];

/**
 * Editorial DTO v1 — the incoming envelope from the engine, the legacy
 * importer or a manual producer. It is a presentation/command boundary, not
 * WP45's research record: the E5 adapter maps its final records onto it.
 *
 * `producer`, `mode` and `artifactHash` are *claims*. The receiver checks them
 * against the authenticated credential and its own hash before storing
 * anything, and nothing here can express a human decision or approval.
 */
export const editorialSubmissionSchema = z
  .strictObject({
    contractVersion: z.literal(EDITORIAL_CONTRACT_VERSION),
    submissionId: editorialIdSchema,
    producer: z.enum(SUBMISSION_PRODUCERS),
    mode: z.enum(SUBMISSION_MODES),
    engineRunId: editorialIdSchema.nullable(),
    engineContractVersion: z.int().min(1).max(99).nullable(),
    artifactHash: sha256Schema,
    title: singleLineText(L.titleChars),
    proposedSlug: slugSchema,
    buyer: singleLineText(L.buyerChars),
    job: singleLineText(L.jobChars),
    wedge: singleLineText(L.wedgeChars),
    recommendation: z.enum(ENGINE_RECOMMENDATIONS),
    recommendationReasons: z
      .array(singleLineText(L.recommendationReasonChars))
      .max(L.recommendationReasons),
    markdown: markdownBodySchema,
    metadata: editorialMetadataSchema,
    sources: z.array(editorialSourceInputSchema).max(L.sources),
    claims: z.array(editorialClaimInputSchema).max(L.claims),
    checks: z.array(qualityCheckInputSchema).max(L.checks),
    /** Legacy imports preserve the original publication date and body origin. */
    legacy: z
      .strictObject({
        firstPublishedAt: calendarDateSchema.nullable(),
        bodyOrigin: z.enum(["mdx", "convex"]),
      })
      .nullable(),
  })
  .superRefine((submission, ctx) => {
    const legacyProducer = submission.producer === "legacy-import";
    if (legacyProducer !== (submission.legacy !== null)) {
      ctx.addIssue({
        code: "custom",
        path: ["legacy"],
        message: "Legacy details are required for, and only for, legacy imports",
      });
    }
    if (legacyProducer !== (submission.mode === "legacy")) {
      ctx.addIssue({
        code: "custom",
        path: ["mode"],
        message: "Only the legacy importer uses legacy mode, and it always does",
      });
    }
    if (submission.producer === "engine" && submission.engineRunId === null) {
      ctx.addIssue({
        code: "custom",
        path: ["engineRunId"],
        message: "Engine submissions name their run",
      });
    }
    if (submission.producer !== "engine" && submission.engineRunId !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["engineRunId"],
        message: "Only engine submissions carry an engine run",
      });
    }

    const sourceIds = new Set<string>();
    submission.sources.forEach((source, index) => {
      if (sourceIds.has(source.id)) {
        ctx.addIssue({ code: "custom", path: ["sources", index, "id"], message: "Duplicate source id" });
      }
      sourceIds.add(source.id);
    });

    const claimIds = new Set<string>();
    submission.claims.forEach((claim, index) => {
      if (claimIds.has(claim.id)) {
        ctx.addIssue({ code: "custom", path: ["claims", index, "id"], message: "Duplicate claim id" });
      }
      claimIds.add(claim.id);
      for (const ref of [...claim.sourceIds, ...claim.contradictingSourceIds]) {
        if (!sourceIds.has(ref)) {
          ctx.addIssue({
            code: "custom",
            path: ["claims", index],
            message: "Claim references a source that is not in this submission",
          });
          break;
        }
      }
    });

    const checkIds = new Set<string>();
    submission.checks.forEach((check, index) => {
      if (checkIds.has(check.id)) {
        ctx.addIssue({ code: "custom", path: ["checks", index, "id"], message: "Duplicate check id" });
      }
      checkIds.add(check.id);
      for (const location of check.locations) {
        if (
          (location.claimId !== null && !claimIds.has(location.claimId)) ||
          (location.sourceId !== null && !sourceIds.has(location.sourceId))
        ) {
          ctx.addIssue({
            code: "custom",
            path: ["checks", index, "locations"],
            message: "Check points at a claim or source that is not in this submission",
          });
          break;
        }
      }
    });
  });

export type EditorialSubmission = z.infer<typeof editorialSubmissionSchema>;

export type SubmissionIssue = { path: string; message: string };

/**
 * Validate an untrusted envelope. Issues carry paths and messages only —
 * never the offending values — so errors cannot echo submitted content.
 */
export function parseEditorialSubmission(
  input: unknown,
): { ok: true; submission: EditorialSubmission } | { ok: false; issues: SubmissionIssue[] } {
  const result = editorialSubmissionSchema.safeParse(input);
  if (result.success) return { ok: true, submission: result.data };
  return {
    ok: false,
    issues: result.error.issues.slice(0, 25).map((issue) => ({
      path: issue.path.map(String).join(".").slice(0, 120) || "(root)",
      // Unknown-key messages quote the submitted key; keep them short.
      message: issue.message.slice(0, 200),
    })),
  };
}
