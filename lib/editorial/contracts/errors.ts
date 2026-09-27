import type { SubmissionIssue } from "./submission";

export const EDITORIAL_ERROR_CODES = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "SERVICE_NOT_PERMITTED",
  "REAUTH_REQUIRED",
  "WORKSPACE_UNAVAILABLE",
  "NOT_FOUND",
  "INVALID_INPUT",
  "INVALID_SUBMISSION",
  "PRODUCER_MISMATCH",
  "MODE_REJECTED",
  "ARTIFACT_HASH_MISMATCH",
  "SUBMISSION_ID_REUSED",
  "IDEMPOTENCY_KEY_REUSED",
  "VERSION_CONFLICT",
  "REVISION_READ_ONLY",
  "STALE_REVIEW_TARGET",
  "INVALID_TRANSITION",
  "PRECONDITION_FAILED",
  "APPROVAL_BLOCKED",
  "APPROVAL_NOT_ACTIVE",
  "KILL_SWITCH_ENGAGED",
  "IDEA_TRASHED",
  "IDEA_LIVE",
  "RELEASE_IN_FLIGHT",
  "GENERATION_FENCED",
] as const;

export type EditorialErrorCode = (typeof EDITORIAL_ERROR_CODES)[number];

export const APPROVAL_BLOCKER_CODES = [
  "CANDIDATE_NOT_ACCEPTED",
  "IDEA_TRASHED",
  "NOT_WORKING_REVISION",
  "ALREADY_APPROVED",
  "CHANGES_REQUESTED",
  "QUARANTINED",
  "SLUG_CONFLICT",
  "MISSING_SECTION",
  "CHECKS_NOT_RUN",
  "CHECKS_STALE",
  "CHECK_BLOCKER",
  "UNRESOLVED_WARNING",
  "UNSUPPORTED_CLAIM",
  "CLAIM_WORDING_CHANGED",
  "UNRESOLVED_DISCREPANCY",
  "ITEM_UNREVIEWED",
] as const;

export type ApprovalBlockerCode = (typeof APPROVAL_BLOCKER_CODES)[number];

export type EditorialTarget = {
  kind: "section" | "claim" | "source" | "check" | "review_item" | "metadata" | "artifact" | "idea";
  id: string;
};

export type ApprovalBlocker = {
  code: ApprovalBlockerCode;
  message: string;
  target: EditorialTarget | null;
};

/** The newer server copy returned with `VERSION_CONFLICT`. */
export type DraftConflict = {
  revisionId: string;
  latestVersion: number;
  savedAt: string;
  savedBy: string;
  title: string;
  markdown: string;
  /** Set when the draft was frozen by an approval rather than edited. */
  frozen: boolean;
};

export type EditorialError = {
  code: EditorialErrorCode;
  /** Safe for display: no bodies, tokens or submitted values. */
  message: string;
  blockers?: ApprovalBlocker[];
  conflict?: DraftConflict;
  issues?: SubmissionIssue[];
};

export type CommandResult<T> = { ok: true; value: T } | { ok: false; error: EditorialError };

export function ok<T>(value: T): CommandResult<T> {
  return { ok: true, value };
}

export function fail<T = never>(
  code: EditorialErrorCode,
  message: string,
  extra: Omit<EditorialError, "code" | "message"> = {},
): CommandResult<T> {
  return { ok: false, error: { code, message, ...extra } };
}
