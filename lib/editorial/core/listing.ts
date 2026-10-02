import type { IdeaFilter } from "../contracts/commands";
import { fail, ok, type CommandResult } from "../contracts/errors";
import type { ReleaseState } from "../contracts/states";
import type { IdeaListItem, Page, QueueBucket } from "../contracts/views";

/**
 * Listing rules shared by every adapter: queue buckets, idea filters, sort
 * order and opaque cursors. The fixture lists from memory; the live adapter
 * applies the same functions to stored summaries.
 */

/* Cursors ------------------------------------------------------------- */

export function encodeCursor(value: readonly string[]): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeCursor(cursor: string): string[] | null {
  try {
    const base64 = cursor.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (Array.isArray(parsed) && parsed.every((part) => typeof part === "string")) return parsed;
    return null;
  } catch {
    return null;
  }
}

export function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Keyset pagination over an already sorted list. */
export function paginate<T>(
  sorted: readonly T[],
  keyOf: (item: T) => string[],
  compare: (a: string[], b: string[]) => number,
  cursor: string | null,
  pageSize: number,
): CommandResult<Page<T>> {
  let start = 0;
  if (cursor) {
    const anchor = decodeCursor(cursor);
    if (!anchor) return fail("INVALID_INPUT", "That page link is no longer valid.");
    start = sorted.findIndex((item) => compare(keyOf(item), anchor) > 0);
    if (start === -1) start = sorted.length;
  }
  const items = sorted.slice(start, start + pageSize);
  const last = items[items.length - 1];
  const hasMore = start + pageSize < sorted.length;
  return ok({
    items,
    nextCursor: hasMore && last !== undefined ? encodeCursor(keyOf(last)) : null,
    total: sorted.length,
  });
}

/* Queue and library ------------------------------------------------------ */

export function queueBucketFor(item: IdeaListItem): QueueBucket | null {
  if (item.lifecycle !== "active") return null;
  if (item.candidate.state === "rejected") return "rejected";
  if (item.candidate.state === "needs_research") return "needs_research";
  if (item.candidate.state === "new") return "new";
  const working = item.workingRevision;
  if (!working) return null;
  if (working.reviewState === "changes_requested") return "changes_requested";
  // A legacy snapshot with no draft has nothing new to review.
  if (working.kind === "legacy_snapshot") return null;
  const approved = item.approval?.status === "active" && item.approval.revisionNumber === working.number;
  const liveUnchanged = item.liveRevision?.id === working.id;
  if (approved || liveUnchanged) return null;
  return "awaiting_review";
}

/** Whether an active idea's list item passes a (validated) queue or library filter. */
export function ideaMatchesFilter(item: IdeaListItem, f: IdeaFilter): boolean {
  if (item.lifecycle !== "active") return false;
  const bucket = queueBucketFor(item);
  if (f.scope === "queue") {
    if (!bucket) return false;
    if (f.bucket && bucket !== f.bucket) return false;
  }
  if (f.decision && item.candidate.state !== f.decision) return false;
  if (f.severity === "blocking" && item.blockers.blocking === 0) return false;
  if (f.severity === "evidence" && item.blockers.evidence === 0) return false;
  if (f.severity === "warnings" && (item.blockers.warnings === 0 || item.blockers.blocking > 0)) return false;
  if (f.severity === "clean" && (item.blockers.blocking > 0 || item.blockers.warnings > 0)) return false;
  if (f.sourceAge && item.evidence.freshness !== f.sourceAge) return false;
  if (f.engineRunId && item.engineRunId !== f.engineRunId) return false;
  if (f.category && item.category !== f.category) return false;
  if (f.publication && item.publication !== f.publication) return false;
  if (f.staleEvidence && item.evidence.staleSources === 0) return false;
  if (f.coverage) {
    const { sectionsReviewed, sectionsTotal } = item.review;
    const coverage = sectionsReviewed === 0 ? "none" : sectionsReviewed >= sectionsTotal ? "complete" : "partial";
    if (coverage !== f.coverage) return false;
  }
  const search = f.search?.toLowerCase().trim() || null;
  if (search) {
    const haystack = `${item.title} ${item.slug} ${item.buyer} ${item.job}`.toLowerCase();
    if (!haystack.includes(search)) return false;
  }
  return true;
}

/** Sort and page the matching items in the filter's order. */
export function pageIdeaItems(
  items: IdeaListItem[],
  f: IdeaFilter,
  cursor: string | null,
  pageSize: number,
): CommandResult<Page<IdeaListItem>> {
  const keyOf = (item: IdeaListItem) =>
    f.sort === "title_asc" ? [item.title.toLowerCase(), item.id] : [item.updatedAt, item.id];
  const compare = (a: string[], b: string[]) => {
    const primary = compareStrings(a[0], b[0]);
    if (primary !== 0) return f.sort === "updated_desc" ? -primary : primary;
    return compareStrings(a[1], b[1]);
  };
  const sorted = [...items].sort((a, b) => compare(keyOf(a), keyOf(b)));
  return paginate(sorted, keyOf, compare, cursor, pageSize);
}

/* Releases --------------------------------------------------------------- */

export type ReleaseGroup = "attention" | "preview_ready" | "completed" | "in_flight";

export function releaseGroupOf(state: ReleaseState): ReleaseGroup {
  return state === "failed" || state === "needs_reconciliation"
    ? "attention"
    : state === "preview_ready"
      ? "preview_ready"
      : state === "succeeded" || state === "cancelled"
        ? "completed"
        : "in_flight";
}
