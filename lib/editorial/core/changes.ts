import { canonicalJson, type Canonicalizable } from "../domain/hash";
import type {
  ApprovalRecord,
  AttestationRecord,
  AuditRecord,
  EditorialState,
  FlagRecord,
  IdeaRecord,
  IdempotencyRecord,
  NoteRecord,
  ReleaseRecord,
  ResolutionRecord,
  RevisionRecord,
  SubmissionRecord,
} from "./state";

/**
 * Unit of work for stores that load part of the editorial state for one
 * transaction (the Convex adapter). Snapshot the loaded records, run the core
 * rules, then collect exactly what was inserted or changed. Records are
 * never deleted by the rules: history is append-only or soft.
 */

type Upserts<T> = { inserted: T[]; updated: T[] };

export type StateChanges = {
  ideas: Upserts<IdeaRecord>;
  revisions: Upserts<RevisionRecord>;
  attestations: Upserts<AttestationRecord>;
  flags: Upserts<FlagRecord>;
  resolutions: Upserts<ResolutionRecord>;
  notes: Upserts<NoteRecord>;
  approvals: Upserts<ApprovalRecord>;
  releases: Upserts<ReleaseRecord>;
  /** Audit entries are appended; everything in `state.audit` was written by this run. */
  audit: AuditRecord[];
  idempotency: Upserts<{ key: string; record: IdempotencyRecord }>;
  submissions: Upserts<{ key: string; record: SubmissionRecord }>;
  slugs: Upserts<{ slug: string; ideaId: string }>;
  settings: { policyVersion: string; killSwitchEngaged: boolean } | null;
};

export type StateSnapshot = {
  ideas: Map<string, string>;
  revisions: Map<string, string>;
  attestations: Map<string, string>;
  flags: Map<string, string>;
  resolutions: Map<string, string>;
  notes: Map<string, string>;
  approvals: Map<string, string>;
  releases: Map<string, string>;
  idempotency: Map<string, string>;
  submissions: Map<string, string>;
  slugs: Map<string, string>;
  settings: string;
};

const fingerprint = (value: unknown) => canonicalJson(value as Canonicalizable);

function keyed<T extends { id: string }>(records: Iterable<T>): Map<string, string> {
  const map = new Map<string, string>();
  for (const record of records) map.set(record.id, fingerprint(record));
  return map;
}

function settingsOf(state: EditorialState) {
  return { policyVersion: state.policyVersion, killSwitchEngaged: state.killSwitchEngaged };
}

/** Call after loading and before running a command. The state must not hold audit entries yet. */
export function snapshotState(state: EditorialState): StateSnapshot {
  if (state.audit.length > 0) throw new Error("Snapshot a freshly loaded state (it already has audit entries).");
  return {
    ideas: keyed(state.ideas.values()),
    revisions: keyed(state.revisions.values()),
    attestations: keyed(state.attestations),
    flags: keyed(state.flags),
    resolutions: keyed(state.resolutions),
    notes: keyed(state.notes),
    approvals: keyed(state.approvals.values()),
    releases: keyed(state.releases.values()),
    idempotency: new Map([...state.idempotency].map(([key, record]) => [key, fingerprint(record)])),
    submissions: new Map([...state.submissions].map(([key, record]) => [key, fingerprint(record)])),
    slugs: new Map([...state.slugs].map(([slug, ideaId]) => [slug, ideaId])),
    settings: fingerprint(settingsOf(state)),
  };
}

function diff<T>(
  entries: Iterable<[string, T]>,
  before: Map<string, string>,
  print: (value: T) => string,
): Upserts<T> {
  const result: Upserts<T> = { inserted: [], updated: [] };
  for (const [key, value] of entries) {
    const previous = before.get(key);
    if (previous === undefined) result.inserted.push(value);
    else if (previous !== print(value)) result.updated.push(value);
  }
  return result;
}

function diffRecords<T extends { id: string }>(records: Iterable<T>, before: Map<string, string>): Upserts<T> {
  const entries: [string, T][] = [];
  for (const record of records) entries.push([record.id, record]);
  return diff(entries, before, fingerprint);
}

export function collectChanges(state: EditorialState, snapshot: StateSnapshot): StateChanges {
  const settings = settingsOf(state);
  return {
    ideas: diffRecords(state.ideas.values(), snapshot.ideas),
    revisions: diffRecords(state.revisions.values(), snapshot.revisions),
    attestations: diffRecords(state.attestations, snapshot.attestations),
    flags: diffRecords(state.flags, snapshot.flags),
    resolutions: diffRecords(state.resolutions, snapshot.resolutions),
    notes: diffRecords(state.notes, snapshot.notes),
    approvals: diffRecords(state.approvals.values(), snapshot.approvals),
    releases: diffRecords(state.releases.values(), snapshot.releases),
    audit: [...state.audit],
    idempotency: diff(
      [...state.idempotency].map(([key, record]): [string, { key: string; record: IdempotencyRecord }] => [key, { key, record }]),
      snapshot.idempotency,
      (entry) => fingerprint(entry.record),
    ),
    submissions: diff(
      [...state.submissions].map(([key, record]): [string, { key: string; record: SubmissionRecord }] => [key, { key, record }]),
      snapshot.submissions,
      (entry) => fingerprint(entry.record),
    ),
    slugs: diff(
      [...state.slugs].map(([slug, ideaId]): [string, { slug: string; ideaId: string }] => [slug, { slug, ideaId }]),
      snapshot.slugs,
      (entry) => entry.ideaId,
    ),
    settings: fingerprint(settings) === snapshot.settings ? null : settings,
  };
}

/** True when a command left nothing to write. */
export function isEmptyChange(changes: StateChanges): boolean {
  const upserts = [
    changes.ideas,
    changes.revisions,
    changes.attestations,
    changes.flags,
    changes.resolutions,
    changes.notes,
    changes.approvals,
    changes.releases,
    changes.idempotency,
    changes.submissions,
    changes.slugs,
  ];
  return (
    changes.audit.length === 0 &&
    changes.settings === null &&
    upserts.every((group) => group.inserted.length === 0 && group.updated.length === 0)
  );
}
