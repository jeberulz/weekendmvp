import { z } from "zod";

import { EDITORIAL_LIMITS as L } from "./limits";
import {
  editorialIdSchema,
  sha256Schema,
  singleLineText,
  utcTimestampSchema,
} from "./primitives";
import { SECTION_KEYS } from "./sections";

export const CHECK_CATEGORIES = [
  "structure",
  "safety",
  "evidence",
  "content",
  "metadata",
  "render",
] as const;
export type CheckCategory = (typeof CHECK_CATEGORIES)[number];

/**
 * `blocker`: security/evidence/contract failures. No human checkbox clears
 * them; the content or evidence must change. `warning`: editorial judgement
 * that a reviewer may resolve with a written reason. `info`: context only.
 */
export const CHECK_SEVERITIES = ["blocker", "warning", "info"] as const;
export type CheckSeverity = (typeof CHECK_SEVERITIES)[number];

export const CHECK_OUTCOMES = ["pass", "fail", "warning", "not_run", "error"] as const;
export type CheckOutcome = (typeof CHECK_OUTCOMES)[number];

/** Set by the receiving adapter; a submission cannot claim to be the engine. */
export const CHECK_PRODUCERS = ["engine", "fixture_simulated"] as const;
export type CheckProducer = (typeof CHECK_PRODUCERS)[number];

export const checkLocationSchema = z.strictObject({
  section: z.enum(SECTION_KEYS).nullable(),
  claimId: editorialIdSchema.nullable(),
  sourceId: editorialIdSchema.nullable(),
  line: z.int().min(1).max(100_000).nullable(),
});

export const qualityCheckInputSchema = z
  .strictObject({
    id: editorialIdSchema,
    label: singleLineText(L.checkLabelChars),
    category: z.enum(CHECK_CATEGORIES),
    severity: z.enum(CHECK_SEVERITIES),
    outcome: z.enum(CHECK_OUTCOMES),
    message: singleLineText(L.checkMessageChars).nullable(),
    locations: z.array(checkLocationSchema).max(L.checkLocations),
    policyVersion: singleLineText(L.policyVersionChars),
    /** Artifact hash the check evaluated. A different hash means stale. */
    evaluatedHash: sha256Schema,
    evaluatedAt: utcTimestampSchema,
  })
  .superRefine((check, ctx) => {
    if (check.outcome === "warning" && check.severity !== "warning") {
      ctx.addIssue({
        code: "custom",
        path: ["outcome"],
        message: "Only warning-severity checks can report a warning outcome",
      });
    }
  });

export type QualityCheckInput = z.infer<typeof qualityCheckInputSchema>;
export type CheckLocation = z.infer<typeof checkLocationSchema>;

export type QualityCheck = QualityCheckInput & { producer: CheckProducer };
