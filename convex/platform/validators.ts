import { ConvexError, v, type Infer, type VLiteral } from "convex/values";

type LiteralValues = readonly [string, string, ...string[]];

function stringLiteralUnion<const Values extends LiteralValues>(values: Values) {
  const members = values.map((value) => v.literal(value)) as unknown as [
    VLiteral<Values[number]>,
    VLiteral<Values[number]>,
    ...VLiteral<Values[number]>[],
  ];
  return v.union(...members);
}

export const PROJECT_SOURCE_VALUES = ["repository_idea", "own_idea"] as const;
export const projectSourceValidator = stringLiteralUnion(PROJECT_SOURCE_VALUES);
export type ProjectSource = Infer<typeof projectSourceValidator>;

export const PROJECT_STATUS_VALUES = [
  "draft",
  "validating",
  "ready",
  "building",
  "published",
] as const;
export const projectStatusValidator = stringLiteralUnion(PROJECT_STATUS_VALUES);
export type ProjectStatus = Infer<typeof projectStatusValidator>;

export const BRIEF_STATUS_VALUES = ["draft", "confirmed", "superseded"] as const;
export const briefStatusValidator = stringLiteralUnion(BRIEF_STATUS_VALUES);
export type BriefStatus = Infer<typeof briefStatusValidator>;

export const SUBMISSION_STATUS_VALUES = [
  "draft",
  "submitted",
  "accepted",
  "rejected",
] as const;
export const submissionStatusValidator = stringLiteralUnion(
  SUBMISSION_STATUS_VALUES,
);
export type SubmissionStatus = Infer<typeof submissionStatusValidator>;

export const INTENT_FLAG_VALUES = ["saved", "interested"] as const;
export const intentFlagValidator = stringLiteralUnion(INTENT_FLAG_VALUES);
export type IntentFlag = Infer<typeof intentFlagValidator>;

export const TASK_TYPE_VALUES = [
  "research",
  "validation_report",
  "landing_page",
  "publish",
] as const;
export const taskTypeValidator = stringLiteralUnion(TASK_TYPE_VALUES);
export type TaskType = Infer<typeof taskTypeValidator>;

export const TASK_STATUS_VALUES = [
  "queued",
  "running",
  "blocked",
  "succeeded",
  "failed",
  "cancelled",
] as const;
export const taskStatusValidator = stringLiteralUnion(TASK_STATUS_VALUES);
export type TaskStatus = Infer<typeof taskStatusValidator>;

export const STEP_TYPE_VALUES = [
  "research",
  "generate",
  "review",
  "render",
  "publish",
] as const;
export const stepTypeValidator = stringLiteralUnion(STEP_TYPE_VALUES);
export type StepType = Infer<typeof stepTypeValidator>;

export const STEP_STATUS_VALUES = [
  "pending",
  "running",
  "succeeded",
  "failed",
  "skipped",
] as const;
export const stepStatusValidator = stringLiteralUnion(STEP_STATUS_VALUES);
export type StepStatus = Infer<typeof stepStatusValidator>;

export const DOCUMENT_KIND_VALUES = [
  "research",
  "validation_report",
  "brief",
  "landing_page",
  "site_copy",
] as const;
export const documentKindValidator = stringLiteralUnion(DOCUMENT_KIND_VALUES);
export type DocumentKind = Infer<typeof documentKindValidator>;

export const DOCUMENT_FORMAT_VALUES = ["text", "markdown", "json"] as const;
export const documentFormatValidator = stringLiteralUnion(
  DOCUMENT_FORMAT_VALUES,
);
export type DocumentFormat = Infer<typeof documentFormatValidator>;

export const SITE_STATUS_VALUES = ["draft", "ready", "published"] as const;
export const siteStatusValidator = stringLiteralUnion(SITE_STATUS_VALUES);
export type SiteStatus = Infer<typeof siteStatusValidator>;

export const SITE_VERSION_STATUS_VALUES = [
  "draft",
  "ready",
  "published",
  "retired",
] as const;
export const siteVersionStatusValidator = stringLiteralUnion(
  SITE_VERSION_STATUS_VALUES,
);
export type SiteVersionStatus = Infer<typeof siteVersionStatusValidator>;

export const PURCHASE_PROVIDER_VALUES = ["stripe"] as const;
export const purchaseProviderValidator = v.literal("stripe");
export type PurchaseProvider = Infer<typeof purchaseProviderValidator>;

export const PURCHASE_STATUS_VALUES = [
  "pending",
  "paid",
  "failed",
  "disputed",
  "refunded",
] as const;
export const purchaseStatusValidator = stringLiteralUnion(
  PURCHASE_STATUS_VALUES,
);
export type PurchaseStatus = Infer<typeof purchaseStatusValidator>;

export const LEDGER_REASON_VALUES = [
  "purchase_grant",
  "task_debit",
  "task_refund",
  "purchase_refund",
  "dispute",
] as const;
export const ledgerReasonValidator = stringLiteralUnion(LEDGER_REASON_VALUES);
export type LedgerReason = Infer<typeof ledgerReasonValidator>;

export const WORKFLOW_TYPE_VALUES = [
  "research",
  "validation_report",
  "landing_page",
  "publish",
] as const;
export const workflowTypeValidator = stringLiteralUnion(WORKFLOW_TYPE_VALUES);
export type WorkflowType = Infer<typeof workflowTypeValidator>;

export const WORKFLOW_RUN_STATUS_VALUES = [
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
] as const;
export const workflowRunStatusValidator = stringLiteralUnion(
  WORKFLOW_RUN_STATUS_VALUES,
);
export type WorkflowRunStatus = Infer<typeof workflowRunStatusValidator>;

export const AUDIT_ACTOR_VALUES = ["user", "system", "provider"] as const;
export const auditActorValidator = stringLiteralUnion(AUDIT_ACTOR_VALUES);
export type AuditActor = Infer<typeof auditActorValidator>;

export const APPEND_ONLY_TABLE_NAMES = ["audit_events", "credit_ledger"] as const;
export type AppendOnlyTable = (typeof APPEND_ONLY_TABLE_NAMES)[number];

export const MAX_GENERATED_DOCUMENT_BODY_BYTES = 256 * 1024;

/**
 * Convex string validators cannot enforce encoded size. Every later write path
 * that accepts or generates a document body must call this helper before insert
 * or patch so the 256 KiB contract is byte-accurate for non-ASCII text too.
 */
export function assertGeneratedDocumentBody(body: string): string {
  if (new TextEncoder().encode(body).byteLength > MAX_GENERATED_DOCUMENT_BODY_BYTES) {
    throw new ConvexError({ code: "DOCUMENT_BODY_TOO_LARGE" });
  }
  return body;
}
