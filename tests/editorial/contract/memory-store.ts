import type { ActivityFilter } from "@/lib/editorial/contracts/commands";
import type { StateChanges } from "@/lib/editorial/core/changes";
import { decodeCursor, encodeCursor } from "@/lib/editorial/core/listing";
import type { ActivityPage, StoredSettings, WorkingSetStore } from "@/lib/editorial/core/partitioned";
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
} from "@/lib/editorial/core/state";
import type { IdeaSummary } from "@/lib/editorial/core/summary";

/**
 * A store that behaves like the Convex one, in memory: it holds every idea
 * but hands out one idea's records per transaction as copies, writes back
 * only a transaction's change set, refuses an insert over an existing id,
 * and runs one transaction at a time.
 */
export class MemoryWorkingSetStore implements WorkingSetStore {
  readonly ideas = new Map<string, IdeaRecord>();
  readonly revisions = new Map<string, RevisionRecord>();
  readonly attestations = new Map<string, AttestationRecord>();
  readonly flags = new Map<string, FlagRecord>();
  readonly resolutions = new Map<string, ResolutionRecord>();
  readonly notes = new Map<string, NoteRecord>();
  readonly approvals = new Map<string, ApprovalRecord>();
  readonly releases = new Map<string, ReleaseRecord>();
  readonly audit: AuditRecord[] = [];
  readonly idempotency = new Map<string, IdempotencyRecord>();
  readonly submissions = new Map<string, SubmissionRecord>();
  readonly slugs = new Map<string, string>();
  readonly summaries = new Map<string, IdeaSummary>();
  /** Transactions committed so far (each repository call is one). */
  commits = 0;
  private tail: Promise<void> = Promise.resolve();

  constructor(public settings: StoredSettings) {}

  transaction<T>(run: () => Promise<T>): Promise<T> {
    const next = this.tail.then(run);
    this.tail = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  async loadSettings(): Promise<StoredSettings> {
    return { ...this.settings };
  }

  async ownerOfRevision(revisionId: string): Promise<string | null> {
    return this.revisions.get(revisionId)?.ideaId ?? null;
  }

  async ownerOfRelease(releaseId: string): Promise<string | null> {
    return this.releases.get(releaseId)?.ideaId ?? null;
  }

  async loadIdea(state: EditorialState, ideaId: string, options: { headerOnly?: boolean } = {}): Promise<boolean> {
    const idea = this.ideas.get(ideaId);
    if (!idea) return false;
    state.ideas.set(ideaId, structuredClone(idea));
    if (options.headerOnly) return true;
    for (const revision of this.revisions.values()) {
      if (revision.ideaId === ideaId) state.revisions.set(revision.id, structuredClone(revision));
    }
    for (const record of this.attestations.values()) if (record.ideaId === ideaId) state.attestations.push(structuredClone(record));
    for (const record of this.flags.values()) if (record.ideaId === ideaId) state.flags.push(structuredClone(record));
    for (const record of this.resolutions.values()) if (record.ideaId === ideaId) state.resolutions.push(structuredClone(record));
    for (const record of this.notes.values()) if (record.ideaId === ideaId) state.notes.push(structuredClone(record));
    for (const record of this.approvals.values()) if (record.ideaId === ideaId) state.approvals.set(record.id, structuredClone(record));
    for (const record of this.releases.values()) if (record.ideaId === ideaId) state.releases.set(record.id, structuredClone(record));
    const duplicate = idea.duplicateOfIdeaId ? this.ideas.get(idea.duplicateOfIdeaId) : undefined;
    if (duplicate && !state.ideas.has(duplicate.id)) state.ideas.set(duplicate.id, structuredClone(duplicate));
    return true;
  }

  async loadIdempotency(state: EditorialState, storeKey: string): Promise<void> {
    const record = this.idempotency.get(storeKey);
    if (record) state.idempotency.set(storeKey, structuredClone(record));
  }

  async loadSlug(state: EditorialState, slug: string): Promise<void> {
    const owner = this.slugs.get(slug);
    if (owner) state.slugs.set(slug, owner);
  }

  async loadSubmission(state: EditorialState, submissionKey: string): Promise<void> {
    const record = this.submissions.get(submissionKey);
    if (record) state.submissions.set(submissionKey, structuredClone(record));
  }

  async loadReleaseIndex(state: EditorialState): Promise<void> {
    for (const idea of this.ideas.values()) state.ideas.set(idea.id, structuredClone(idea));
    for (const release of this.releases.values()) state.releases.set(release.id, structuredClone(release));
  }

  async loadTrashedIdeas(state: EditorialState): Promise<void> {
    for (const idea of this.ideas.values()) {
      if (idea.lifecycle === "trashed") state.ideas.set(idea.id, structuredClone(idea));
    }
  }

  async listSummaries(): Promise<IdeaSummary[]> {
    return [...this.summaries.values()].map((summary) => structuredClone(summary));
  }

  async pageActivity(filter: ActivityFilter, cursor: string | null, pageSize: number): Promise<ActivityPage | null> {
    const matching = this.audit
      .filter((entry) => (filter.ideaId ? entry.ideaId === filter.ideaId : true))
      .filter((entry) => (filter.outcome ? entry.outcome === filter.outcome : true))
      .reverse();
    let start = 0;
    if (cursor) {
      const anchor = decodeCursor(cursor);
      const index = anchor?.length === 1 ? matching.findIndex((entry) => entry.id === anchor[0]) : -1;
      if (index === -1) return null;
      start = index + 1;
    }
    const entries = matching.slice(start, start + pageSize).map((entry) => structuredClone(entry));
    const last = entries[entries.length - 1];
    return {
      entries,
      nextCursor: start + pageSize < matching.length && last ? encodeCursor([last.id]) : null,
      total: matching.length,
    };
  }

  async ideaTitles(ideaIds: readonly string[]): Promise<Map<string, string>> {
    const titles = new Map<string, string>();
    for (const id of ideaIds) {
      const idea = this.ideas.get(id);
      if (idea) titles.set(id, idea.title);
    }
    return titles;
  }

  async commit(changes: StateChanges, summaries: ReadonlyMap<string, IdeaSummary>): Promise<void> {
    const upsert = <T extends { id: string }>(table: Map<string, T>, group: { inserted: T[]; updated: T[] }, name: string) => {
      for (const record of group.inserted) {
        if (table.has(record.id)) throw new Error(`${name}: insert over existing ${record.id}`);
        table.set(record.id, structuredClone(record));
      }
      for (const record of group.updated) {
        if (!table.has(record.id)) throw new Error(`${name}: update of unknown ${record.id}`);
        table.set(record.id, structuredClone(record));
      }
    };
    upsert(this.ideas, changes.ideas, "ideas");
    upsert(this.revisions, changes.revisions, "revisions");
    upsert(this.attestations, changes.attestations, "attestations");
    upsert(this.flags, changes.flags, "flags");
    upsert(this.resolutions, changes.resolutions, "resolutions");
    upsert(this.notes, changes.notes, "notes");
    upsert(this.approvals, changes.approvals, "approvals");
    upsert(this.releases, changes.releases, "releases");
    this.audit.push(...changes.audit.map((entry) => structuredClone(entry)));
    for (const { key, record } of [...changes.idempotency.inserted, ...changes.idempotency.updated]) {
      this.idempotency.set(key, structuredClone(record));
    }
    for (const { key, record } of [...changes.submissions.inserted, ...changes.submissions.updated]) {
      this.submissions.set(key, structuredClone(record));
    }
    for (const { slug, ideaId } of [...changes.slugs.inserted, ...changes.slugs.updated]) this.slugs.set(slug, ideaId);
    if (changes.settings) this.settings = { ...changes.settings };
    for (const [ideaId, summary] of summaries) this.summaries.set(ideaId, structuredClone(summary));
    this.commits += 1;
  }
}
