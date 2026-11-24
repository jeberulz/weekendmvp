/**
 * Pain Engine — the single-approval review queue.
 *
 * Drafts land here as JSON files under `engine/pain/review/{slug}.json`
 * with status "pending" and wait for ONE human decision: approve or reject.
 * Approving marks the record approved; it does NOT publish anything —
 * publishing stays a separate, human-operated step (the existing compile /
 * manifest flow), so nothing in this PR can make an idea public on its own.
 */
import fs from "node:fs";
import path from "node:path";
import type { ReviewRecord } from "./types.ts";

export function reviewDir(rootDir: string): string {
  return path.join(rootDir, "engine", "pain", "review");
}

export function reviewPath(rootDir: string, slug: string): string {
  return path.join(reviewDir(rootDir), `${slug}.json`);
}

export function saveReviewRecord(rootDir: string, record: ReviewRecord): string {
  const dir = reviewDir(rootDir);
  fs.mkdirSync(dir, { recursive: true });
  const file = reviewPath(rootDir, record.slug);
  // A rerun that produces the same deterministic slug must never erase a
  // decision: an approved/rejected record is final, so a fresh "pending"
  // record for the same slug is dropped and the decided record is kept.
  // Only a still-pending record may be replaced by a later run.
  const existing = loadReviewRecordIfExists(rootDir, record.slug);
  if (existing && existing.status !== "pending") return file;
  fs.writeFileSync(file, JSON.stringify(record, null, 2));
  return file;
}

export function loadReviewRecord(rootDir: string, slug: string): ReviewRecord {
  const raw = fs.readFileSync(reviewPath(rootDir, slug), "utf8");
  return JSON.parse(raw) as ReviewRecord;
}

/** The record for a slug, or null when no record exists (or it is unreadable). */
export function loadReviewRecordIfExists(
  rootDir: string,
  slug: string,
): ReviewRecord | null {
  try {
    return loadReviewRecord(rootDir, slug);
  } catch {
    return null;
  }
}

export function listReviewRecords(rootDir: string): ReviewRecord[] {
  const dir = reviewDir(rootDir);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as ReviewRecord)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** The single human decision. Approving does NOT publish the idea. */
export function decideReview(
  rootDir: string,
  slug: string,
  decision: "approved" | "rejected",
  reason?: string,
): ReviewRecord {
  const record = loadReviewRecord(rootDir, slug);
  if (record.status !== "pending") {
    throw new Error(`Review ${slug} is already ${record.status}; it cannot be decided again.`);
  }
  record.status = decision;
  record.decidedAt = new Date().toISOString();
  if (reason) record.decisionReason = reason;
  saveReviewRecord(rootDir, record);
  return record;
}

/**
 * Bookkeeping write for the editorial bridge (publish overrides + submission
 * marker). It may only record bridge bookkeeping on an already-decided
 * record: `status` and `decidedAt` are immutable here, so a bridge write
 * can never re-decide a review. Use `decideReview` for the decision itself.
 */
export function updateReviewRecordBookkeeping(
  rootDir: string,
  record: ReviewRecord,
): string {
  const existing = loadReviewRecord(rootDir, record.slug);
  if (existing.status !== record.status || existing.decidedAt !== record.decidedAt) {
    throw new Error(
      `Refusing bookkeeping write for ${record.slug}: status/decidedAt changed ` +
        `(was ${existing.status}, now ${record.status}). Decide the review with decideReview instead.`,
    );
  }
  const file = reviewPath(rootDir, record.slug);
  fs.writeFileSync(file, JSON.stringify(record, null, 2));
  return file;
}
