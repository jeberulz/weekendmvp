import type { ApprovalBlocker, ApprovalBlockerCode } from "../contracts/errors";
import { SECTION_DEFINITIONS, type SectionKey } from "../contracts/sections";
import {
  APPROVABLE_CANDIDATE_STATES,
  type CandidateState,
  type LifecycleState,
  type ReviewState,
} from "../contracts/states";
import type { CheckView, ClaimView, IssueView, ReviewItemView } from "../contracts/views";
import { truncateLabel } from "./review-items";

export type IssueResolution = { dependencyHash: string; note: string; at: string };

type DerivedIssue = IssueView & { blockerCode: ApprovalBlockerCode | null };

const CLAIM_SUPPORT_MESSAGES: Record<ClaimView["verification"]["status"], string> = {
  verified: "",
  not_applicable: "",
  unverified: "Not verified against its source",
  unavailable: "Its supporting source could not be read",
  changed: "Its source changed after verification",
  provisional: "Only a search summary supports it",
};

/**
 * Navigable issues for one revision. Blockers are security, evidence or
 * contract failures that only a content/evidence change can clear. Warnings
 * are editorial judgements a reviewer may resolve with a written reason.
 * There is intentionally no aggregate score.
 */
export function deriveIssues(input: {
  checks: readonly CheckView[];
  requiredCheckIds: readonly string[];
  checksCurrent: boolean;
  missingSections: readonly SectionKey[];
  claims: readonly ClaimView[];
  reviewItems: readonly ReviewItemView[];
  resolutions: ReadonlyMap<string, IssueResolution>;
}): DerivedIssue[] {
  const issues: DerivedIssue[] = [];
  const resolutionFor = (id: string, dependencyHash: string) => {
    const resolution = input.resolutions.get(id);
    return resolution && resolution.dependencyHash === dependencyHash
      ? { note: resolution.note, at: resolution.at }
      : null;
  };

  for (const key of input.missingSections) {
    const title = SECTION_DEFINITIONS.find((section) => section.key === key)?.title ?? key;
    issues.push({
      id: `section:${key}:missing`,
      severity: "blocker",
      category: "structure",
      message: `Missing required section “${title}”`,
      target: { kind: "section", id: key },
      resolvable: false,
      resolution: null,
      dependencyHash: key,
      blockerCode: "MISSING_SECTION",
    });
  }

  if (!input.checksCurrent) {
    issues.push({
      id: "checks:stale",
      severity: "blocker",
      category: "content",
      message:
        input.checks.length === 0
          ? "Checks have not run on this revision yet."
          : "Checks are out of date for this revision. Run checks again.",
      target: { kind: "artifact", id: "checks" },
      resolvable: false,
      resolution: null,
      dependencyHash: "stale",
      blockerCode: "CHECKS_STALE",
    });
  } else {
    const present = new Set(input.checks.map((check) => check.id));
    for (const id of input.requiredCheckIds) {
      if (present.has(id)) continue;
      issues.push({
        id: `checks:missing:${id}`,
        severity: "blocker",
        category: "content",
        message: `Required check “${id}” has not run`,
        target: { kind: "check", id },
        resolvable: false,
        resolution: null,
        dependencyHash: id,
        blockerCode: "CHECKS_NOT_RUN",
      });
    }
    for (const check of input.checks) {
      const failing = check.outcome === "fail" || check.outcome === "error";
      const blocking = check.severity === "blocker" && (failing || check.outcome === "not_run");
      const warning =
        check.severity === "warning" && (check.outcome === "warning" || failing);
      if (!blocking && !warning) continue;
      const id = `check:${check.id}`;
      const firstLocation = check.locations[0];
      issues.push({
        id,
        severity: blocking ? "blocker" : "warning",
        category: check.category,
        message: check.message ?? `${check.label}: ${check.outcome}`,
        target: firstLocation?.claimId
          ? { kind: "claim", id: firstLocation.claimId }
          : firstLocation?.sourceId
            ? { kind: "source", id: firstLocation.sourceId }
            : firstLocation?.section
              ? { kind: "section", id: firstLocation.section }
              : { kind: "check", id: check.id },
        resolvable: !blocking,
        resolution: blocking ? null : resolutionFor(id, check.evaluatedHash),
        dependencyHash: check.evaluatedHash,
        blockerCode: blocking ? "CHECK_BLOCKER" : "UNRESOLVED_WARNING",
      });
    }
  }

  for (const claim of input.claims) {
    if (!claim.material) continue;
    const label = truncateLabel(claim.text, 70);
    if (!claim.anchorPresent) {
      issues.push({
        id: `claim:${claim.id}:wording`,
        severity: "blocker",
        category: "evidence",
        message: `The verified wording of “${label}” was edited — restore it or request re-verification.`,
        target: { kind: "claim", id: claim.id },
        resolvable: false,
        resolution: null,
        dependencyHash: claim.id,
        blockerCode: "CLAIM_WORDING_CHANGED",
      });
    }
    if (claim.kind !== "assumed" && claim.verification.status !== "verified") {
      issues.push({
        id: `claim:${claim.id}:support`,
        severity: "blocker",
        category: "evidence",
        message: `Unsupported claim: “${label}”. ${CLAIM_SUPPORT_MESSAGES[claim.verification.status]}.`,
        target: { kind: "claim", id: claim.id },
        resolvable: false,
        resolution: null,
        dependencyHash: claim.verification.status,
        blockerCode: "UNSUPPORTED_CLAIM",
      });
    }
    if (claim.contradictingSourceIds.length > 0) {
      const id = `claim:${claim.id}:contradiction`;
      const dependencyHash = claim.contradictingSourceIds.join(",");
      issues.push({
        id,
        severity: "warning",
        category: "evidence",
        message: `A source contradicts “${label}”. Explain how the article handles it.`,
        target: { kind: "claim", id: claim.id },
        resolvable: true,
        resolution: resolutionFor(id, dependencyHash),
        dependencyHash,
        blockerCode: "UNRESOLVED_WARNING",
      });
    }
  }

  for (const item of input.reviewItems) {
    if (!item.flag || item.flag.resolved) continue;
    issues.push({
      id: `flag:${item.id}`,
      severity: item.flag.severity === "high" ? "blocker" : "warning",
      category: "evidence",
      message: `Discrepancy on “${item.label}”: ${truncateLabel(item.flag.note, 120)}`,
      target: item.target ?? { kind: "review_item", id: item.id },
      // A reviewer's own flag is resolved with a written resolution note.
      resolvable: true,
      resolution: null,
      dependencyHash: item.id,
      blockerCode: "UNRESOLVED_DISCREPANCY",
    });
  }

  return issues;
}

export function toIssueViews(issues: readonly DerivedIssue[]): IssueView[] {
  return issues.map((issue) => ({
    id: issue.id,
    severity: issue.severity,
    category: issue.category,
    message: issue.message,
    target: issue.target,
    resolvable: issue.resolvable,
    resolution: issue.resolution,
    dependencyHash: issue.dependencyHash,
  }));
}

/**
 * Everything standing between this revision and an approval. The same
 * function drives the disabled Approve button's reasons and the server's
 * refusal, so the UI can only ever explain what the backend enforces.
 */
export function computeApprovalBlockers(input: {
  candidateState: CandidateState;
  lifecycle: LifecycleState;
  isWorkingRevision: boolean;
  hasActiveApproval: boolean;
  reviewState: ReviewState;
  quarantined: boolean;
  slugConflict: boolean;
  issues: readonly DerivedIssue[];
  reviewItems: readonly ReviewItemView[];
}): ApprovalBlocker[] {
  const blockers: ApprovalBlocker[] = [];
  const idea = { kind: "idea" as const, id: "idea" };

  if (!APPROVABLE_CANDIDATE_STATES.includes(input.candidateState)) {
    blockers.push({
      code: "CANDIDATE_NOT_ACCEPTED",
      message: "Accept the idea before approving a revision",
      target: idea,
    });
  }
  if (input.lifecycle === "trashed") {
    blockers.push({ code: "IDEA_TRASHED", message: "Restore the idea from Trash first", target: idea });
  }
  if (!input.isWorkingRevision) {
    blockers.push({
      code: "NOT_WORKING_REVISION",
      message: "Only the current working revision can be approved",
      target: null,
    });
  }
  if (input.hasActiveApproval) {
    blockers.push({ code: "ALREADY_APPROVED", message: "This revision is already approved", target: null });
  }
  if (input.reviewState === "changes_requested") {
    blockers.push({
      code: "CHANGES_REQUESTED",
      message: "Changes were requested. Resume review when they are done.",
      target: null,
    });
  }
  if (input.quarantined) {
    blockers.push({
      code: "QUARANTINED",
      message: "Unsafe markup is quarantined. Correct it in a new revision.",
      target: { kind: "artifact", id: "quarantine" },
    });
  }
  if (input.slugConflict) {
    blockers.push({
      code: "SLUG_CONFLICT",
      message: "The proposed slug belongs to another idea",
      target: idea,
    });
  }

  for (const issue of input.issues) {
    if (!issue.blockerCode) continue;
    if (issue.severity === "warning" && issue.resolution) continue;
    blockers.push({ code: issue.blockerCode, message: issue.message, target: issue.target });
  }

  for (const item of input.reviewItems) {
    if (item.status === "reviewed" || item.status === "flagged") continue;
    blockers.push({
      code: "ITEM_UNREVIEWED",
      message:
        item.status === "stale"
          ? `Changed since your review: ${item.label}`
          : `Not yet reviewed: ${item.label}`,
      target: { kind: "review_item", id: item.id },
    });
  }

  return blockers;
}

export type { DerivedIssue };
