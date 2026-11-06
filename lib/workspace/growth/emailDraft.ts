/**
 * WP76-S1a — the email sequence draft contract WP79 reads, as pure helpers.
 * No Convex imports, no I/O; relative imports only (the Convex bundler loads
 * this file).
 *
 * The rows (`convex/schema/growth.ts`, written by `convex/growth/drafts/emailSequence.ts`):
 * - `sequences`: at most one `draft` sequence per business; `title` is the
 *   C-ART sequence's `name`.
 * - `sequence_steps`: one row per email, `order` 0–3 in `EMAIL_KINDS` order,
 *   `delayHours` and `subject` copied from that email, `documentId` the one
 *   `email_sequence` document they were written from.
 *
 * A step's full content is `emailsInOrder(parse(document.body))[order]`.
 * `emailStepContent` returns it and fails closed when the row and the
 * document disagree (another document, an archived one, an order outside
 * 0–3, a subject or delay that does not match), so a sender never mails
 * something the founder did not review.
 */

import {
  EMAIL_KINDS,
  emailSequenceSchema,
  emailsInOrder,
  type Email,
  type EmailKind,
  type EmailSequence,
} from "../contracts/artifacts";

/** One step per email kind. */
export const EMAIL_DRAFT_STEP_COUNT = EMAIL_KINDS.length;

/** What a `sequence_steps` row copies from its email. */
export type DraftStepRow = {
  readonly order: number;
  readonly kind: EmailKind;
  readonly delayHours: number;
  readonly subject: string;
};

/** The four step rows for a sequence, in send order. */
export function draftStepRows(sequence: EmailSequence): DraftStepRow[] {
  return emailsInOrder(sequence).map(({ kind, email }, order) => ({
    order,
    kind,
    delayHours: email.delayHours,
    subject: email.subject,
  }));
}

/** The stored body as a C-ART email sequence, or null when it does not parse. */
export function parseEmailSequenceBody(body: string | undefined): EmailSequence | null {
  if (body === undefined) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch {
    return null;
  }
  const parsed = emailSequenceSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** The fields of a `sequence_steps` row the helper checks. */
export type StoredSequenceStep = {
  readonly order: bigint | number;
  readonly delayHours: number;
  readonly subject: string;
  readonly documentId: string;
};

/** The fields of a `documents` row the helper reads. */
export type StoredEmailDocument = {
  readonly _id: string;
  readonly kind: string;
  readonly body?: string;
  readonly archivedAt?: number;
};

export type EmailStepRefusal =
  | "document_mismatch"
  | "document_archived"
  | "document_unreadable"
  | "order_out_of_range"
  | "subject_mismatch"
  | "delay_mismatch";

export type EmailStepContent =
  | { readonly ok: true; readonly order: number; readonly kind: EmailKind; readonly email: Email }
  | { readonly ok: false; readonly reason: EmailStepRefusal };

function stepOrder(order: bigint | number): number | null {
  const value = typeof order === "bigint" ? Number(order) : order;
  return Number.isInteger(value) && value >= 0 && value < EMAIL_DRAFT_STEP_COUNT ? value : null;
}

/**
 * One step's email, read from the document it points at. Fails closed on any
 * disagreement between the row and the document.
 *
 * It does not check ownership: callers check that the step, its sequence and
 * the document belong to the same owner and business before calling it.
 */
export function emailStepContent(step: StoredSequenceStep, document: StoredEmailDocument): EmailStepContent {
  if (step.documentId !== document._id || document.kind !== "email_sequence") return { ok: false, reason: "document_mismatch" };
  if (document.archivedAt !== undefined) return { ok: false, reason: "document_archived" };
  if (stepOrder(step.order) === null) return { ok: false, reason: "order_out_of_range" };
  const sequence = parseEmailSequenceBody(document.body);
  if (sequence === null) return { ok: false, reason: "document_unreadable" };
  return emailStepFromSequence(step, sequence);
}

/**
 * The same check against a sequence the caller already parsed from the
 * step's own document (the caller has checked the document id, kind,
 * archive state and business), so a reader of four steps parses once.
 */
export function emailStepFromSequence(step: Omit<StoredSequenceStep, "documentId">, sequence: EmailSequence): EmailStepContent {
  const order = stepOrder(step.order);
  if (order === null) return { ok: false, reason: "order_out_of_range" };
  const entry = emailsInOrder(sequence)[order];
  if (entry === undefined) return { ok: false, reason: "order_out_of_range" };
  if (entry.email.subject !== step.subject) return { ok: false, reason: "subject_mismatch" };
  if (entry.email.delayHours !== step.delayHours) return { ok: false, reason: "delay_mismatch" };
  return { ok: true, order, kind: entry.kind, email: entry.email };
}

/**
 * Whether a draft sequence's existing steps can be rewritten in place: every
 * order in 0–3 at most once. Anything else (a fifth step, a duplicate order)
 * is not a shape this contract writes, so the rewrite fails closed.
 */
export function stepsRewritable(steps: readonly Pick<StoredSequenceStep, "order">[]): boolean {
  const seen = new Set<number>();
  for (const step of steps) {
    const order = stepOrder(step.order);
    if (order === null || seen.has(order)) return false;
    seen.add(order);
  }
  return true;
}
