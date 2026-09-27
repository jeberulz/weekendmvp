import { SOURCE_TYPE_LABELS } from "../contracts/evidence";
import {
  CANDIDATE_LABELS,
  PUBLICATION_LABELS,
  REVIEW_LABELS,
  REVISION_KIND_LABELS,
  releaseStateLabel,
} from "../contracts/states";
import type { EvidenceFreshness, EvidenceLabel, IdeaListItem } from "../contracts/views";

export { CANDIDATE_LABELS, PUBLICATION_LABELS, REVIEW_LABELS, REVISION_KIND_LABELS, SOURCE_TYPE_LABELS };

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "27 Sep 2026, 12:42 UTC" — stable across server and client. */
export function formatAbsolute(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}, ${hours}:${minutes} UTC`;
}

export function formatDate(isoOrDate: string): string {
  const date = new Date(isoOrDate.length === 10 ? `${isoOrDate}T00:00:00Z` : isoOrDate);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

export function formatRelative(iso: string, nowMs: number): string {
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return "unknown";
  const delta = nowMs - at;
  if (delta < 0) return formatAbsolute(iso);
  if (delta < MINUTE) return "just now";
  if (delta < HOUR) return `${Math.floor(delta / MINUTE)} min ago`;
  if (delta < DAY) return `${Math.floor(delta / HOUR)} h ago`;
  if (delta < 14 * DAY) {
    const days = Math.floor(delta / DAY);
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }
  return formatDate(iso);
}

/** Publication and editorial status side by side, e.g. "Live v2 · Draft v3". */
export function revisionSummary(item: Pick<IdeaListItem, "publication" | "liveRevision" | "workingRevision" | "pendingOperation">): {
  publication: string;
  working: string | null;
} {
  const live = item.liveRevision ? `Live v${item.liveRevision.number}` : PUBLICATION_LABELS[item.publication];
  const working = item.workingRevision;
  let workingLabel: string | null = null;
  if (working && working.id !== item.liveRevision?.id) {
    const kind =
      working.kind === "draft"
        ? "Draft"
        : working.kind === "submitted"
          ? "Submitted"
          : working.kind === "approved_snapshot"
            ? "Approved"
            : "Snapshot";
    workingLabel = `${kind} v${working.number}`;
  }
  return { publication: live, working: workingLabel };
}

export const FRESHNESS_LABELS: Record<EvidenceFreshness, string> = {
  fresh: "Fresh",
  aging: "Ageing",
  stale: "Stale",
  unknown: "Unknown",
};

export const EVIDENCE_LABEL_TEXT: Record<EvidenceLabel, string> = {
  machine_verified: "Machine verified",
  reviewed_by_you: "Reviewed by you",
  unavailable: "Unavailable",
  changed_since_review: "Changed since review",
  provisional: "Provisional search summary",
  assumption: "Assumption",
  unverified: "Not verified",
};

export function blockerSummary(blockers: IdeaListItem["blockers"]): string {
  if (blockers.blocking === 0 && blockers.warnings === 0) return "None";
  const parts: string[] = [];
  if (blockers.blocking > 0) parts.push(`${blockers.blocking} blocking`);
  if (blockers.warnings > 0) parts.push(`${blockers.warnings} warning${blockers.warnings === 1 ? "" : "s"}`);
  return parts.join(" · ");
}

export function pendingOperationLabel(item: Pick<IdeaListItem, "pendingOperation">): string | null {
  if (!item.pendingOperation) return null;
  return releaseStateLabel(item.pendingOperation.operation, item.pendingOperation.state);
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function shortHash(hash: string): string {
  return hash.slice(0, 10);
}
