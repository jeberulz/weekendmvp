import { ConvexError } from "convex/values";

import type { ActivityFilter } from "../../lib/editorial/contracts/commands";
import type { CommandResult } from "../../lib/editorial/contracts/errors";
import { EDITORIAL_LIMITS } from "../../lib/editorial/contracts/limits";
import type { StateChanges } from "../../lib/editorial/core/changes";
import { LIVE_POLICY_VERSION } from "../../lib/editorial/core/live";
import { decodeCursor, encodeCursor } from "../../lib/editorial/core/listing";
import type { ActivityPage, StoredSettings, WorkingSetStore } from "../../lib/editorial/core/partitioned";
import type {
  ApprovalRecord,
  AttestationRecord,
  AuditRecord,
  EditorialState,
  FlagRecord,
  IdeaRecord,
  NoteRecord,
  ReleaseRecord,
  ResolutionRecord,
  RevisionRecord,
} from "../../lib/editorial/core/state";
import type { IdeaSummary } from "../../lib/editorial/core/summary";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/**
 * The editorial `WorkingSetStore` over Convex (WP46-E4c). One instance lives
 * for one query or mutation, which Convex already runs as one serialisable
 * transaction, so `transaction` simply runs the call.
 *
 * Loads are bounded and fail loudly past their bound instead of returning a
 * silently partial list. Revisions are capped per idea by the core
 * (`revisionsPerIdea`), so an idea's working set stays readable.
 */

type Reader = QueryCtx["db"];
type Writer = MutationCtx["db"];

export const STORE_LIMITS = {
  revisionsPerIdea: EDITORIAL_LIMITS.revisionsPerIdea,
  childRowsPerIdea: 5_000,
  ideas: 2_500,
  releases: 4_000,
  /** Convex documents are limited to 1 MiB; leave room for field overhead. */
  documentBytes: 900_000,
} as const;

type RecordTable =
  | "editorial_ideas"
  | "editorial_revisions"
  | "editorial_attestations"
  | "editorial_flags"
  | "editorial_resolutions"
  | "editorial_notes"
  | "editorial_approvals"
  | "editorial_releases";

/** A stored record as the core's record: `key` back to `id`, system fields dropped. */
function toRecord<T extends { _id: string; _creationTime: number; key: string }>(doc: T) {
  const { _id, _creationTime, key, ...rest } = doc;
  void _id;
  void _creationTime;
  return { ...rest, id: key };
}

/** A core record as stored: `id` becomes `key`. */
function toDoc<T extends { id: string }>(record: T): Omit<T, "id"> & { key: string } {
  const { id, ...rest } = record;
  return { ...rest, key: id };
}

function bounded<T>(rows: T[], limit: number, what: string): T[] {
  if (rows.length > limit) {
    throw new Error(`Editorial store limit reached: more than ${limit} ${what}. This list needs indexed paging.`);
  }
  return rows;
}

function assertStorable(table: RecordTable, value: object) {
  const bytes = new TextEncoder().encode(JSON.stringify(value)).length;
  if (bytes > STORE_LIMITS.documentBytes) {
    throw new ConvexError({
      code: "TOO_LARGE",
      message:
        table === "editorial_revisions"
          ? "This revision is too large to store. Shorten the article or its evidence and try again."
          : "This record is too large to store.",
    });
  }
}

export class ConvexWorkingSetStore implements WorkingSetStore {
  /** Convex ids of the records loaded in this transaction, by table and record key. */
  private readonly loaded = new Map<RecordTable, Map<string, string>>();
  private readonly loadedIdempotency = new Map<string, Id<"editorial_idempotency">>();
  private settingsId: Id<"editorial_settings"> | null = null;

  constructor(
    private readonly db: Reader,
    private readonly writer: Writer | null,
  ) {}

  transaction<T>(run: () => Promise<T>): Promise<T> {
    return run();
  }

  private remember(table: RecordTable, key: string, id: string) {
    let byKey = this.loaded.get(table);
    if (!byKey) {
      byKey = new Map();
      this.loaded.set(table, byKey);
    }
    byKey.set(key, id);
  }

  /* Loading --------------------------------------------------------------- */

  async loadSettings(): Promise<StoredSettings> {
    const doc = await this.db
      .query("editorial_settings")
      .withIndex("by_key", (q) => q.eq("key", "settings"))
      .unique();
    this.settingsId = doc?._id ?? null;
    // Policy is code-owned. Old "not-connected" settings and submitted checks
    // cannot become current merely because the backend was upgraded.
    return { policyVersion: LIVE_POLICY_VERSION, killSwitchEngaged: doc?.killSwitchEngaged ?? false };
  }

  private ideaDoc(key: string) {
    return this.db
      .query("editorial_ideas")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
  }

  async ownerOfRevision(revisionId: string): Promise<string | null> {
    const doc = await this.db
      .query("editorial_revisions")
      .withIndex("by_key", (q) => q.eq("key", revisionId))
      .unique();
    return doc?.ideaId ?? null;
  }

  async ownerOfRelease(releaseId: string): Promise<string | null> {
    const doc = await this.db
      .query("editorial_releases")
      .withIndex("by_key", (q) => q.eq("key", releaseId))
      .unique();
    return doc?.ideaId ?? null;
  }

  private putIdea(state: EditorialState, doc: Doc<"editorial_ideas">) {
    this.remember("editorial_ideas", doc.key, doc._id);
    state.ideas.set(doc.key, toRecord(doc) satisfies IdeaRecord);
  }

  async loadIdea(state: EditorialState, ideaId: string, options: { headerOnly?: boolean } = {}): Promise<boolean> {
    const idea = await this.ideaDoc(ideaId);
    if (idea === null) return false;
    this.putIdea(state, idea);
    if (options.headerOnly) return true;

    const revisions = bounded(
      await this.db
        .query("editorial_revisions")
        .withIndex("by_ideaId_and_number", (q) => q.eq("ideaId", ideaId))
        .take(STORE_LIMITS.revisionsPerIdea + 1),
      STORE_LIMITS.revisionsPerIdea,
      "revisions for one idea",
    );
    for (const doc of revisions) {
      this.remember("editorial_revisions", doc.key, doc._id);
      // Taxonomy fields are stored as plain strings; they were validated when written.
      state.revisions.set(doc.key, toRecord(doc) as RevisionRecord);
    }

    const limit = STORE_LIMITS.childRowsPerIdea;
    const attestations = await this.db
      .query("editorial_attestations")
      .withIndex("by_ideaId", (q) => q.eq("ideaId", ideaId))
      .take(limit + 1);
    for (const doc of bounded(attestations, limit, "attestations for one idea")) {
      this.remember("editorial_attestations", doc.key, doc._id);
      state.attestations.push(toRecord(doc) satisfies AttestationRecord);
    }
    const flags = await this.db
      .query("editorial_flags")
      .withIndex("by_ideaId", (q) => q.eq("ideaId", ideaId))
      .take(limit + 1);
    for (const doc of bounded(flags, limit, "flags for one idea")) {
      this.remember("editorial_flags", doc.key, doc._id);
      state.flags.push(toRecord(doc) satisfies FlagRecord);
    }
    const resolutions = await this.db
      .query("editorial_resolutions")
      .withIndex("by_ideaId", (q) => q.eq("ideaId", ideaId))
      .take(limit + 1);
    for (const doc of bounded(resolutions, limit, "resolutions for one idea")) {
      this.remember("editorial_resolutions", doc.key, doc._id);
      state.resolutions.push(toRecord(doc) satisfies ResolutionRecord);
    }
    const notes = await this.db
      .query("editorial_notes")
      .withIndex("by_ideaId", (q) => q.eq("ideaId", ideaId))
      .take(limit + 1);
    for (const doc of bounded(notes, limit, "notes for one idea")) {
      this.remember("editorial_notes", doc.key, doc._id);
      state.notes.push(toRecord(doc) satisfies NoteRecord);
    }
    const approvals = await this.db
      .query("editorial_approvals")
      .withIndex("by_ideaId", (q) => q.eq("ideaId", ideaId))
      .take(limit + 1);
    for (const doc of bounded(approvals, limit, "approvals for one idea")) {
      this.remember("editorial_approvals", doc.key, doc._id);
      state.approvals.set(doc.key, toRecord(doc) satisfies ApprovalRecord);
    }
    const releases = await this.db
      .query("editorial_releases")
      .withIndex("by_ideaId", (q) => q.eq("ideaId", ideaId))
      .take(limit + 1);
    for (const doc of bounded(releases, limit, "releases for one idea")) {
      this.remember("editorial_releases", doc.key, doc._id);
      state.releases.set(doc.key, toRecord(doc) satisfies ReleaseRecord);
    }

    const duplicateKey = idea.duplicateOfIdeaId;
    if (duplicateKey && !state.ideas.has(duplicateKey)) {
      const duplicate = await this.ideaDoc(duplicateKey);
      if (duplicate) this.putIdea(state, duplicate);
    }
    return true;
  }

  async loadIdempotency(state: EditorialState, storeKey: string): Promise<void> {
    const doc = await this.db
      .query("editorial_idempotency")
      .withIndex("by_storeKey", (q) => q.eq("storeKey", storeKey))
      .unique();
    if (doc === null) return;
    this.loadedIdempotency.set(storeKey, doc._id);
    // Written by `commit` below from a CommandResult.
    const result = JSON.parse(doc.result) as CommandResult<unknown>;
    state.idempotency.set(storeKey, { requestHash: doc.requestHash, result });
  }

  async loadSlug(state: EditorialState, slug: string): Promise<void> {
    const doc = await this.db
      .query("editorial_slugs")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (doc) state.slugs.set(slug, doc.ideaId);
  }

  async loadSubmission(state: EditorialState, submissionKey: string): Promise<void> {
    const doc = await this.db
      .query("editorial_submissions")
      .withIndex("by_submissionKey", (q) => q.eq("submissionKey", submissionKey))
      .unique();
    if (doc) {
      state.submissions.set(submissionKey, { artifactHash: doc.artifactHash, ideaId: doc.ideaId, revisionId: doc.revisionId });
    }
  }

  async loadReleaseIndex(state: EditorialState): Promise<void> {
    const releases = bounded(
      await this.db.query("editorial_releases").take(STORE_LIMITS.releases + 1),
      STORE_LIMITS.releases,
      "releases",
    );
    const ideaKeys = new Set<string>();
    for (const doc of releases) {
      state.releases.set(doc.key, toRecord(doc) satisfies ReleaseRecord);
      ideaKeys.add(doc.ideaId);
    }
    for (const key of ideaKeys) {
      const idea = await this.ideaDoc(key);
      if (idea) state.ideas.set(idea.key, toRecord(idea) satisfies IdeaRecord);
    }
  }

  async loadTrashedIdeas(state: EditorialState): Promise<void> {
    const trashed = bounded(
      await this.db
        .query("editorial_ideas")
        .withIndex("by_lifecycle", (q) => q.eq("lifecycle", "trashed"))
        .take(STORE_LIMITS.ideas + 1),
      STORE_LIMITS.ideas,
      "trashed ideas",
    );
    for (const doc of trashed) state.ideas.set(doc.key, toRecord(doc) satisfies IdeaRecord);
  }

  async listSummaries(): Promise<IdeaSummary[]> {
    const rows = bounded(
      await this.db.query("editorial_idea_summaries").take(STORE_LIMITS.ideas + 1),
      STORE_LIMITS.ideas,
      "ideas",
    );
    // Written by `commit` below from `summarizeIdea`.
    return rows.map((row) => JSON.parse(row.summary) as IdeaSummary);
  }

  /** Newest first, keyed on the unique `_creationTime` so cursors stay short. */
  async pageActivity(filter: ActivityFilter, cursor: string | null, pageSize: number): Promise<ActivityPage | null> {
    let before: number | null = null;
    if (cursor) {
      const anchor = decodeCursor(cursor);
      const value = anchor?.length === 1 ? Number(anchor[0]) : Number.NaN;
      if (!Number.isFinite(value)) return null;
      before = value;
    }
    const table = this.db.query("editorial_audit");
    const { ideaId, outcome } = filter;
    const query =
      ideaId !== null && outcome !== null
        ? table.withIndex("by_ideaId_and_outcome", (q) => {
            const range = q.eq("ideaId", ideaId).eq("outcome", outcome);
            return before === null ? range : range.lt("_creationTime", before);
          })
        : ideaId !== null
          ? table.withIndex("by_ideaId", (q) => {
              const range = q.eq("ideaId", ideaId);
              return before === null ? range : range.lt("_creationTime", before);
            })
          : outcome !== null
            ? table.withIndex("by_outcome", (q) => {
                const range = q.eq("outcome", outcome);
                return before === null ? range : range.lt("_creationTime", before);
              })
            : table.withIndex("by_creation_time", (q) => (before === null ? q : q.lt("_creationTime", before)));
    const rows = await query.order("desc").take(pageSize + 1);
    const page = rows.slice(0, pageSize);
    const last = page[page.length - 1];
    return {
      entries: page.map((doc) => toRecord(doc) satisfies AuditRecord),
      nextCursor: rows.length > pageSize && last ? encodeCursor([String(last._creationTime)]) : null,
      total: null,
    };
  }

  async ideaTitles(ideaIds: readonly string[]): Promise<Map<string, string>> {
    const titles = new Map<string, string>();
    for (const key of ideaIds) {
      const idea = await this.ideaDoc(key);
      if (idea) titles.set(key, idea.title);
    }
    return titles;
  }

  /* Writing ----------------------------------------------------------------- */

  private requireWriter(): Writer {
    if (this.writer === null) throw new Error("This editorial store was opened read-only.");
    return this.writer;
  }

  /** The Convex id of a record loaded in this transaction (updates only touch loaded records). */
  private loadedId<T extends RecordTable>(table: T, key: string): Id<T> {
    const raw = this.loaded.get(table)?.get(key);
    const id = raw === undefined ? null : this.db.normalizeId(table, raw);
    if (id === null) throw new Error(`${table}: update of a record that was not loaded`);
    return id;
  }

  async commit(changes: StateChanges, summaries: ReadonlyMap<string, IdeaSummary>): Promise<void> {
    const writer = this.requireWriter();
    const checked = <D extends object>(table: RecordTable, doc: D): D => {
      assertStorable(table, doc);
      return doc;
    };

    for (const record of changes.ideas.inserted) {
      this.remember("editorial_ideas", record.id, await writer.insert("editorial_ideas", checked("editorial_ideas", toDoc(record))));
    }
    for (const record of changes.ideas.updated) {
      await writer.replace("editorial_ideas", this.loadedId("editorial_ideas", record.id), checked("editorial_ideas", toDoc(record)));
    }
    for (const record of changes.revisions.inserted) {
      const id = await writer.insert("editorial_revisions", checked("editorial_revisions", toDoc(record)));
      this.remember("editorial_revisions", record.id, id);
    }
    for (const record of changes.revisions.updated) {
      const id = this.loadedId("editorial_revisions", record.id);
      await writer.replace("editorial_revisions", id, checked("editorial_revisions", toDoc(record)));
    }
    for (const record of changes.attestations.inserted) {
      await writer.insert("editorial_attestations", checked("editorial_attestations", toDoc(record)));
    }
    for (const record of changes.attestations.updated) {
      const id = this.loadedId("editorial_attestations", record.id);
      await writer.replace("editorial_attestations", id, checked("editorial_attestations", toDoc(record)));
    }
    for (const record of changes.flags.inserted) {
      await writer.insert("editorial_flags", checked("editorial_flags", toDoc(record)));
    }
    for (const record of changes.flags.updated) {
      await writer.replace("editorial_flags", this.loadedId("editorial_flags", record.id), checked("editorial_flags", toDoc(record)));
    }
    for (const record of changes.resolutions.inserted) {
      await writer.insert("editorial_resolutions", checked("editorial_resolutions", toDoc(record)));
    }
    for (const record of changes.resolutions.updated) {
      const id = this.loadedId("editorial_resolutions", record.id);
      await writer.replace("editorial_resolutions", id, checked("editorial_resolutions", toDoc(record)));
    }
    for (const record of changes.notes.inserted) {
      await writer.insert("editorial_notes", checked("editorial_notes", toDoc(record)));
    }
    for (const record of changes.notes.updated) {
      await writer.replace("editorial_notes", this.loadedId("editorial_notes", record.id), checked("editorial_notes", toDoc(record)));
    }
    for (const record of changes.approvals.inserted) {
      await writer.insert("editorial_approvals", checked("editorial_approvals", toDoc(record)));
    }
    for (const record of changes.approvals.updated) {
      const id = this.loadedId("editorial_approvals", record.id);
      await writer.replace("editorial_approvals", id, checked("editorial_approvals", toDoc(record)));
    }
    for (const record of changes.releases.inserted) {
      await writer.insert("editorial_releases", checked("editorial_releases", toDoc(record)));
    }
    for (const record of changes.releases.updated) {
      const id = this.loadedId("editorial_releases", record.id);
      await writer.replace("editorial_releases", id, checked("editorial_releases", toDoc(record)));
    }

    for (const entry of changes.audit) await writer.insert("editorial_audit", toDoc(entry));

    for (const { key, record } of [...changes.idempotency.inserted, ...changes.idempotency.updated]) {
      const doc = { storeKey: key, requestHash: record.requestHash, result: JSON.stringify(record.result) };
      const id = this.loadedIdempotency.get(key);
      if (id) await writer.replace("editorial_idempotency", id, doc);
      else this.loadedIdempotency.set(key, await writer.insert("editorial_idempotency", doc));
    }
    if (changes.submissions.updated.length > 0) throw new Error("Submission keys are never rewritten.");
    for (const { key, record } of changes.submissions.inserted) {
      await writer.insert("editorial_submissions", { submissionKey: key, ...record });
    }
    if (changes.slugs.updated.length > 0) throw new Error("Slug reservations are never moved.");
    for (const { slug, ideaId } of changes.slugs.inserted) await writer.insert("editorial_slugs", { slug, ideaId });

    if (changes.settings) {
      const doc = { key: "settings" as const, ...changes.settings, updatedAt: Date.now() };
      if (this.settingsId) await writer.replace("editorial_settings", this.settingsId, doc);
      else this.settingsId = await writer.insert("editorial_settings", doc);
    }

    for (const [ideaKey, summary] of summaries) {
      const existing = await this.db
        .query("editorial_idea_summaries")
        .withIndex("by_ideaKey", (q) => q.eq("ideaKey", ideaKey))
        .unique();
      const doc = { ideaKey, summary: JSON.stringify(summary) };
      if (existing) await writer.replace("editorial_idea_summaries", existing._id, doc);
      else await writer.insert("editorial_idea_summaries", doc);
    }
  }
}
