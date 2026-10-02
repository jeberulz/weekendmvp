import type { CheckOutcome, CheckSeverity } from "../contracts/checks";
import type { SourceVerificationStatus } from "../contracts/evidence";
import type { ReviewItemKind, ReviewStatus } from "../contracts/views";

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  unreviewed: "Not reviewed",
  reviewed: "Reviewed",
  stale: "Changed since review",
  flagged: "Flagged",
};

export const REVIEW_ITEM_KIND_LABELS: Record<ReviewItemKind, string> = {
  section: "Sections",
  claim: "Claims",
  source: "Sources",
  assumptions: "Assumptions and economics",
  metadata: "Metadata and highlights",
  preview: "Final preview",
};

export const CHECK_OUTCOME_LABELS: Record<CheckOutcome, string> = {
  pass: "Passed",
  fail: "Failed",
  warning: "Warning",
  not_run: "Not run",
  error: "Could not run",
};

export const CHECK_SEVERITY_LABELS: Record<CheckSeverity, string> = {
  blocker: "Blocker",
  warning: "Warning",
  info: "Info",
};

export const SOURCE_VERIFICATION_LABELS: Record<SourceVerificationStatus, string> = {
  verified: "Excerpt matched on the page",
  unverified: "Not verified",
  unavailable: "Page unavailable",
  changed: "Page changed since verification",
  provisional: "Provisional: search summary only",
};

export const CLAIM_KIND_LABELS = {
  observed: "Observed",
  derived: "Derived",
  assumed: "Assumption",
} as const;

export const CLAIM_TOPIC_LABELS = {
  market_size: "Market size",
  pricing: "Pricing",
  competitor: "Competitor",
  pain: "Pain",
  usage: "Usage",
  economics: "Economics",
  other: "Other",
} as const;
