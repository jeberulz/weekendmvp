import { v, type Infer } from "convex/values";

import { ACTIVITY_ACTIONS } from "../../lib/editorial/contracts/views";
import type { AuditRecord } from "../../lib/editorial/core/state";

/**
 * Convex validators for the private editorial tables (WP46-E4).
 *
 * Stored records are the editorial core's records with the record id stored
 * as `key` (`by_id` is a reserved index name). The `Same` assertions fail the
 * typecheck if a validator and its core record type drift apart.
 */

/** A union of string literals from one of the contract's `as const` lists. */
export function literals<const T extends readonly [string, string, ...string[]]>(values: T) {
  return v.union(...values.map((value: T[number]) => v.literal(value)));
}

/** Mutual assignability: every required field on each side exists on the other, with the same type. */
export type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
export type Assert<T extends true> = T;

/** A core record as stored: `id` becomes `key`. */
export type Stored<T extends { id: string }> = Omit<T, "id"> & { key: string };

export const nullableString = v.union(v.string(), v.null());
export const nullableNumber = v.union(v.number(), v.null());

export const actorRefValidator = v.object({
  id: v.string(),
  kind: literals(["human", "service", "system"]),
  label: v.string(),
});

export const activityActionValidator = literals(ACTIVITY_ACTIONS);
export const auditOutcomeValidator = literals(["succeeded", "denied", "failed"]);

/**
 * One append-only activity entry. `revisionNumber` is copied in when the
 * entry is written, so the activity feed never loads revision bodies.
 */
export const auditRecordValidator = v.object({
  key: v.string(),
  at: v.string(),
  actor: actorRefValidator,
  action: activityActionValidator,
  outcome: auditOutcomeValidator,
  ideaId: nullableString,
  revisionId: nullableString,
  revisionNumber: nullableNumber,
  releaseId: nullableString,
  reason: nullableString,
  detail: nullableString,
  code: nullableString,
  correlationId: v.string(),
});
export type StoredAuditRecord = Infer<typeof auditRecordValidator>;
export type AuditRecordMatches = Assert<Same<StoredAuditRecord, Stored<AuditRecord>>>;
