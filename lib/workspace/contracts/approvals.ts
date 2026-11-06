/**
 * C-APPROVAL — approval kinds, subjects, versions and error codes (WP77-S1).
 *
 * Consumers: Codex's publisher (WP78 `publishLanding(projectId, siteVersionId,
 * approvalId)`), tenant email (WP79 `activateSequence(sequenceId, approvalId)`),
 * social and ads connectors (WP83), and Claude's generators, change rounds (S2)
 * and Wren's cards (S4). The Convex side lives in `convex/workspace/approvals.ts`.
 * Sources: `02-architecture.md` §4.2 (`approvals`), §6.3, §14; `04-build-plan.md`
 * WP77-S1; rulings D12 (owner only), D13 (Autopilot never spends or launches ads),
 * D17 (change rounds).
 *
 * Types, constants and pure helpers only: no Convex imports, no I/O, no side
 * effects at import.
 *
 * Subject. Every approval names exactly one subject: `{ projectId, kind,
 * subjectTable, subjectId }`. The side-effect caller builds the same object from
 * the thing it is about to publish, send, post, launch or debit, and
 * `assertApproved(ctx, approvalId, subject)` compares the two field by field.
 * Which tables a kind may name is closed (`APPROVAL_SUBJECT_TABLES`), so a
 * `send` approval can never authorise a publish.
 *
 * Version. The `approvals` table has no version column yet (see
 * `APPROVAL_VERSION_POLICY` and "Needs from Codex" in `docs/wp/wp77-progress.md`).
 * Until it has one, "the subject's current version" means: the subject row, and
 * every row whose content it carries (the document of a site version, the steps
 * and step documents of a sequence), was last written no later than the moment
 * the approval was created. A write after that, including a status-only patch,
 * makes the approval stale and every check fails closed with
 * `APPROVAL_SUBJECT_CHANGED`. Callers therefore call `assertApproved` before they
 * patch the subject in the same mutation.
 */

// ---------------------------------------------------------------------------
// Kinds, statuses, decisions (mirror C-DATA `approvals` validators)
// ---------------------------------------------------------------------------

export const APPROVAL_KINDS = [
  "artifact_review",
  "send",
  "post",
  "publish",
  "spend",
  "ad_launch",
  "upgrade",
] as const;
export type ApprovalKind = (typeof APPROVAL_KINDS)[number];

export function isApprovalKind(value: unknown): value is ApprovalKind {
  return typeof value === "string" && (APPROVAL_KINDS as readonly string[]).includes(value);
}

export const APPROVAL_STATUSES = [
  "pending",
  "approved",
  "changes_requested",
  "expired",
  "cancelled",
] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

/** Every status except `pending` is terminal: an approval transitions at most once. */
export type TerminalApprovalStatus = Exclude<ApprovalStatus, "pending">;

/** What the founder can do with a pending card. Expiry is the system's, never a founder decision. */
export const APPROVAL_DECISIONS = ["approve", "request_changes", "cancel"] as const;
export type ApprovalDecision = (typeof APPROVAL_DECISIONS)[number];

export const APPROVAL_DECISION_STATUS = {
  approve: "approved",
  request_changes: "changes_requested",
  cancel: "cancelled",
} as const satisfies Record<ApprovalDecision, TerminalApprovalStatus>;

// ---------------------------------------------------------------------------
// Subjects
// ---------------------------------------------------------------------------

export const APPROVAL_SUBJECT_TABLE_NAMES = [
  "documents",
  "site_versions",
  "sequences",
  "sequence_steps",
  "social_posts",
  "ad_campaigns",
  "outbound_messages",
  "tasks",
  "projects",
] as const;
export type ApprovalSubjectTable = (typeof APPROVAL_SUBJECT_TABLE_NAMES)[number];

/**
 * The tables each kind may name. Closed: anything else is refused at creation
 * (`APPROVAL_INVALID_SUBJECT`) and at check time (`APPROVAL_SUBJECT_MISMATCH`).
 * - `artifact_review`: a crew document, or a landing page version.
 * - `publish`: the exact `site_versions` row `publishLanding` will make live.
 * - `send`: a whole sequence (`activateSequence`), one step (per-step approval),
 *   or one outbound message to an attested list (D9).
 * - `post`: one social post. `ad_launch`: one campaign (its budget is on the row).
 * - `spend`: the artifact a paid change round revises, or the queued job it debits.
 * - `upgrade`: the business itself.
 */
export const APPROVAL_SUBJECT_TABLES = {
  artifact_review: ["documents", "site_versions"],
  publish: ["site_versions"],
  send: ["sequences", "sequence_steps", "outbound_messages"],
  post: ["social_posts"],
  ad_launch: ["ad_campaigns"],
  spend: ["documents", "tasks"],
  upgrade: ["projects"],
} as const satisfies Record<ApprovalKind, readonly ApprovalSubjectTable[]>;

export function isSubjectTableAllowed(kind: ApprovalKind, table: string): table is ApprovalSubjectTable {
  return (APPROVAL_SUBJECT_TABLES[kind] as readonly string[]).includes(table);
}

/**
 * The C-APPROVAL subject. `ProjectId` and `OwnerId` are the Convex id types on
 * the server (`Id<"projects">`, `Id<"users">`); plain strings here.
 * `subjectId` is the subject row's id as a string (`approvals.subjectId`).
 * `ownerId` is optional: pass it when the caller already holds the business
 * owner, and the check also requires the approval to be that owner's.
 */
export type ApprovalSubject<ProjectId extends string = string, OwnerId extends string = string> = {
  readonly projectId: ProjectId;
  readonly kind: ApprovalKind;
  readonly subjectTable: ApprovalSubjectTable;
  readonly subjectId: string;
  readonly ownerId?: OwnerId;
};

// ---------------------------------------------------------------------------
// Versions
// ---------------------------------------------------------------------------

/**
 * How each subject table's version is read while `approvals` has no version
 * column. Each entry lists the write timestamps that must all be at or before
 * the approval's `createdAt`:
 * - `site_versions`: content is immutable per row (WP28 publish and rollback
 *   insert a new row, never patch content), so the row id is the version; its
 *   linked document's `updatedAt` is still checked because documents can be
 *   patched in place.
 * - `documents`: `updatedAt` (documents carry no workflow status).
 * - `sequences`: the row, every step (at most `MAX_SEQUENCE_STEPS`) and every
 *   step's document.
 * - `sequence_steps`, `social_posts`, `outbound_messages`: the row and its
 *   document (`outbound_messages` also its list, which carries the attestation).
 * - `ad_campaigns`, `tasks`: the row.
 * - `projects` (`upgrade` only): identity. A business is patched constantly and
 *   an upgrade card does not depend on its content.
 *
 * Known gap: on mutable workflow rows `updatedAt` also moves on status-only
 * patches, so a status change after creation invalidates the approval (fails
 * closed). The fix is an additive `approvals.subjectVersion` content
 * fingerprint, requested from Codex.
 */
export const APPROVAL_VERSION_POLICY = {
  documents: "updated_at",
  site_versions: "immutable_row",
  sequences: "updated_at_with_children",
  sequence_steps: "updated_at_with_children",
  social_posts: "updated_at_with_children",
  ad_campaigns: "updated_at",
  outbound_messages: "updated_at_with_children",
  tasks: "updated_at",
  projects: "identity",
} as const satisfies Record<ApprovalSubjectTable, "updated_at" | "updated_at_with_children" | "immutable_row" | "identity">;

/** A sequence with more steps than this cannot be approved (fails closed). */
export const MAX_SEQUENCE_STEPS = 20;

/**
 * True when every write timestamp is at or before the approval's creation time.
 * Equal is allowed so a generator can write a draft and raise its card in one
 * mutation. An empty list is unchanged (identity policy).
 */
export function isSubjectUnchangedSince(writeTimes: readonly number[], approvalCreatedAt: number): boolean {
  if (!Number.isFinite(approvalCreatedAt)) return false;
  return writeTimes.every((time) => Number.isFinite(time) && time <= approvalCreatedAt);
}

// ---------------------------------------------------------------------------
// Expiry and limits
// ---------------------------------------------------------------------------

/** A pending card older than this expires. Long enough to outlast a weekend launch. */
export const APPROVAL_PENDING_TTL_MS = 7 * 24 * 60 * 60 * 1_000;

export function approvalExpiresAt(createdAt: number): number {
  return createdAt + APPROVAL_PENDING_TTL_MS;
}

export function isPendingApprovalStale(createdAt: number, now: number): boolean {
  return now >= approvalExpiresAt(createdAt);
}

/** Most rows one expiry batch touches. */
export const APPROVAL_EXPIRY_BATCH_MAX = 100;
export const APPROVAL_EXPIRY_BATCH_DEFAULT = 50;

/** Most pending cards the founder-facing list returns. */
export const APPROVAL_LIST_LIMIT = 50;

/** Longest "Ask for changes" note, after trimming. */
export const APPROVAL_NOTE_MAX_LENGTH = 2_000;

/**
 * The note stored with a decision: trimmed, empty becomes undefined, too long
 * returns null (the caller refuses with `APPROVAL_INVALID_NOTE`).
 */
export function normalizeApprovalNote(note: string | undefined): string | undefined | null {
  if (note === undefined) return undefined;
  const trimmed = note.trim();
  if (trimmed.length === 0) return undefined;
  if (trimmed.length > APPROVAL_NOTE_MAX_LENGTH) return null;
  return trimmed;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * `ConvexError({ code, ... })` codes thrown by `convex/workspace/approvals.ts`.
 * Founder-facing functions answer a missing or foreign approval with C-AUTHZ's
 * `RESOURCE_NOT_FOUND` (no probing) and a switched-off workspace with C-OPS's
 * `WORKSPACE_DISABLED`; `assertApproved` adds the specific codes below so a
 * publisher or sender can log why it refused. Every one is a refusal: callers
 * must not perform the side effect.
 */
export const APPROVAL_ERROR_CODES = [
  /** The approval id does not exist (or is not an approvals id). */
  "APPROVAL_NOT_FOUND",
  /** Status is not `approved`; the error data carries `status`. */
  "APPROVAL_NOT_APPROVED",
  /** The approval's kind differs from the subject's. */
  "APPROVAL_KIND_MISMATCH",
  /** Different business, a different or archived owner chain, or a different `ownerId`. */
  "APPROVAL_PROJECT_MISMATCH",
  /** Different subject table or id, or the subject row names another approval. */
  "APPROVAL_SUBJECT_MISMATCH",
  /** The subject row is gone, archived, or not in the approval's business. */
  "APPROVAL_SUBJECT_NOT_FOUND",
  /** The subject (or content it carries) was written after the approval was created. */
  "APPROVAL_SUBJECT_CHANGED",
  /** A decision on an approval that already left `pending` with a different outcome. */
  "APPROVAL_ALREADY_DECIDED",
  /** Creation named a table the kind does not allow, or an id of the wrong table. */
  "APPROVAL_INVALID_SUBJECT",
  /** The note is longer than `APPROVAL_NOTE_MAX_LENGTH`. */
  "APPROVAL_INVALID_NOTE",
  /** A negative change round or credit cost. */
  "APPROVAL_INVALID_INPUT",
] as const;
export type ApprovalErrorCode = (typeof APPROVAL_ERROR_CODES)[number];

export function isApprovalErrorCode(value: unknown): value is ApprovalErrorCode {
  return typeof value === "string" && (APPROVAL_ERROR_CODES as readonly string[]).includes(value);
}
