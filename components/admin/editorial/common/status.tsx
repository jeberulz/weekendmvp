import type { ReleaseOperation, ReleaseState } from "@/lib/editorial/contracts/states";
import type { EvidenceFreshness, IdeaListItem } from "@/lib/editorial/contracts/views";
import {
  CANDIDATE_LABELS,
  FRESHNESS_LABELS,
  REVIEW_LABELS,
  pendingOperationLabel,
  revisionSummary,
} from "@/lib/editorial/presentation/format";
import { StatusBadge, type Tone } from "./primitives";

export const CANDIDATE_TONES: Record<IdeaListItem["candidate"]["state"], Tone> = {
  new: "info",
  accepted: "success",
  needs_research: "warning",
  rejected: "neutral",
  legacy: "neutral",
};

export function CandidateBadge({ item }: { item: Pick<IdeaListItem, "candidate"> }) {
  const label = item.candidate.state === "legacy" ? "Legacy" : CANDIDATE_LABELS[item.candidate.state];
  return <StatusBadge tone={CANDIDATE_TONES[item.candidate.state]}>{label}</StatusBadge>;
}

export function EngineRecommendation({ item }: { item: Pick<IdeaListItem, "engineRecommendation"> }) {
  if (!item.engineRecommendation) return null;
  const labels = { accept: "accept", needs_research: "research more", reject: "reject", unknown: "no call" } as const;
  return (
    <span className="text-xs text-(--ed-text-2)">
      Engine recommends: {labels[item.engineRecommendation.value]}
    </span>
  );
}

export function releaseTone(state: ReleaseState): Tone {
  if (state === "failed") return "danger";
  if (state === "needs_reconciliation") return "warning";
  if (state === "succeeded") return "success";
  if (state === "cancelled") return "neutral";
  return "info";
}

export function ReleaseStateBadge({ operation, state, label }: { operation: ReleaseOperation; state: ReleaseState; label: string }) {
  return (
    <StatusBadge tone={releaseTone(state)}>
      {operation === "unpublish" && state !== "succeeded" ? `Unpublish: ${label}` : label}
    </StatusBadge>
  );
}

export function PublicationCell({ item }: { item: IdeaListItem }) {
  const summary = revisionSummary(item);
  const pending = pendingOperationLabel(item);
  return (
    <div className="flex flex-col items-start gap-1">
      <span className={item.publication === "live" ? "font-medium" : "text-(--ed-text-2)"}>{summary.publication}</span>
      {pending && item.pendingOperation ? (
        <ReleaseStateBadge operation={item.pendingOperation.operation} state={item.pendingOperation.state} label={pending} />
      ) : null}
    </div>
  );
}

export function WorkingRevisionCell({ item }: { item: IdeaListItem }) {
  const working = item.workingRevision;
  if (!working) return <span className="text-(--ed-text-2)">None</span>;
  const summary = revisionSummary(item);
  const revoked = item.approval?.status === "revoked" && item.approval.revisionNumber === working.number;
  return (
    <div className="flex flex-col items-start gap-1">
      <span className="font-mono text-xs">{summary.working ?? `Live snapshot v${working.number}`}</span>
      {revoked ? (
        <StatusBadge tone="warning">Approval revoked</StatusBadge>
      ) : working.kind === "legacy_snapshot" ? null : (
        <StatusBadge tone={working.reviewState === "approved" ? "success" : working.reviewState === "changes_requested" ? "warning" : "neutral"}>
          {REVIEW_LABELS[working.reviewState]}
        </StatusBadge>
      )}
    </div>
  );
}

export function BlockersCell({ item }: { item: IdeaListItem }) {
  const { blocking, warnings } = item.blockers;
  if (item.workingRevision?.kind === "legacy_snapshot" && blocking === 0) {
    return <span className="text-xs text-(--ed-text-2)">Not under review</span>;
  }
  if (blocking === 0 && warnings === 0) return <span className="text-(--ed-text-2)">None</span>;
  return (
    <div className="flex flex-col items-start gap-1">
      {blocking > 0 ? (
        <StatusBadge tone="danger">
          {blocking} blocking{item.blockers.evidence > 0 ? ` (${item.blockers.evidence} evidence)` : ""}
        </StatusBadge>
      ) : null}
      {warnings > 0 ? <StatusBadge tone="warning">{warnings} warning{warnings === 1 ? "" : "s"}</StatusBadge> : null}
    </div>
  );
}

export function ReviewCoverageCell({ item }: { item: IdeaListItem }) {
  const { sectionsReviewed, sectionsTotal } = item.review;
  if (item.workingRevision?.kind === "legacy_snapshot" && sectionsReviewed === 0) {
    return <span className="text-xs text-(--ed-text-2)">Not reviewed</span>;
  }
  return (
    <span className="font-mono text-xs tabular-nums">
      {sectionsReviewed}/{sectionsTotal}
      <span className="sr-only"> sections reviewed</span>
    </span>
  );
}

const FRESHNESS_TONES: Record<EvidenceFreshness, Tone> = {
  fresh: "success",
  aging: "warning",
  stale: "danger",
  unknown: "neutral",
};

export function EvidenceCell({ item }: { item: IdeaListItem }) {
  const legacy = item.workingRevision?.kind === "legacy_snapshot";
  return (
    <div className="flex flex-col items-start gap-1">
      <StatusBadge tone={legacy ? "neutral" : FRESHNESS_TONES[item.evidence.freshness]}>
        {legacy ? "Not reverified" : FRESHNESS_LABELS[item.evidence.freshness]}
      </StatusBadge>
      {item.evidence.unavailableSources > 0 ? (
        <span className="text-xs text-(--ed-danger)">{item.evidence.unavailableSources} unavailable</span>
      ) : null}
      {item.evidence.staleSources > 0 ? (
        <span className="text-xs text-(--ed-warning)">{item.evidence.staleSources} stale</span>
      ) : null}
    </div>
  );
}
