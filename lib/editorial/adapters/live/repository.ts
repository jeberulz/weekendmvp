import "server-only";

import { fetchAction, fetchMutation, fetchQuery } from "convex/nextjs";
import { ConvexError } from "convex/values";

import { api } from "@/convex/_generated/api";
import type {
  ActivityFilter,
  ApprovalInput,
  CandidateDecisionInput,
  DraftCarry,
  FlagInput,
  IdeaFilter,
  ImportAck,
  ReleaseFilter,
  ReviewAck,
  SaveDraftAck,
  SaveDraftPatch,
} from "../../contracts/commands";
import { fail, ok, type CommandResult, type EditorialTarget } from "../../contracts/errors";
import type { IngestionCredential } from "../../contracts/principal";
import type { EditorialRepository } from "../../contracts/repository";
import type { ReleaseState } from "../../contracts/states";
import type {
  ActivityEntry,
  IdeaDetail,
  IdeaListItem,
  Page,
  QueueSummary,
  ReleaseView,
  RevisionView,
  SettingsView,
  TrashItem,
} from "../../contracts/views";
import { measureContent, sectionWordCount } from "../../domain/counts";
import { sectionsByKey, splitSections } from "../../domain/structure";

/**
 * The live editorial repository (WP46-E4d): every call goes to the private
 * Convex functions with the signed-in user's own token. Convex resolves the
 * caller from that token and re-checks the super-admin binding on every call;
 * nothing here decides access. Server-only: the token never reaches the
 * browser through this module.
 */

/** What the editorial shell needs to know about the signed-in editor. */
export type LiveEditor = {
  displayName: string;
  strongAuthAt: string | null;
  strongAuthFresh: boolean;
  signInMethod: "google" | "email" | null;
  email: string | null;
};

export type LiveSession = { signedIn: boolean; editor: LiveEditor | null };

const UNREACHABLE =
  "The editorial backend could not complete the request. Nothing is shown as saved; reload to see the current state.";

/** Convex refusals arrive as results; only transport and validation failures throw. */
function transportFailure<T>(error: unknown): CommandResult<T> {
  if (error instanceof ConvexError) {
    const data: unknown = error.data;
    if (data && typeof data === "object" && "code" in data && "message" in data) {
      const { code, message } = data as { code: unknown; message: unknown };
      if ((code === "TOO_LARGE" || code === "INVALID_INPUT") && typeof message === "string") {
        return fail("INVALID_INPUT", message.slice(0, 300));
      }
    }
  }
  return fail("WORKSPACE_UNAVAILABLE", UNREACHABLE);
}

async function guarded<T>(run: () => Promise<CommandResult<T>>): Promise<CommandResult<T>> {
  try {
    return await run();
  } catch (error) {
    return transportFailure<T>(error);
  }
}

/**
 * Word counts, reading time, prompts and code blocks need the Markdown
 * parser, which Convex functions do not load; they are measured here.
 */
export function withMeasuredCounts(view: RevisionView): RevisionView {
  const sections = sectionsByKey(splitSections(view.markdown));
  return {
    ...view,
    counts: measureContent(view.markdown),
    sections: view.sections.map((section) => {
      const block = sections.get(section.key);
      return { ...section, words: block ? sectionWordCount(block.body) : 0 };
    }),
  };
}

/** Whether this token belongs to the super-admin; `null` when the backend cannot say. */
export async function readLiveSession(token: string, nowMs: number): Promise<LiveSession | null> {
  try {
    return await fetchQuery(api.editorial.reads.session, { nowMs }, { token });
  } catch {
    return null;
  }
}

export class ConvexEditorialRepository implements EditorialRepository {
  readonly mode = "live" as const;

  constructor(
    private readonly token: string,
    private readonly now: () => number = () => Date.now(),
  ) {}

  private get auth() {
    return { token: this.token };
  }

  /* Reads ---------------------------------------------------------------- */

  getQueueSummary(): Promise<CommandResult<QueueSummary>> {
    return guarded(() => fetchQuery(api.editorial.reads.queueSummary, { nowMs: this.now() }, this.auth));
  }

  listIdeas(filter: IdeaFilter, cursor: string | null, pageSize: number): Promise<CommandResult<Page<IdeaListItem>>> {
    return guarded(() =>
      fetchQuery(api.editorial.reads.listIdeas, { filter, cursor, pageSize, nowMs: this.now() }, this.auth),
    );
  }

  getIdea(ideaId: string): Promise<CommandResult<IdeaDetail>> {
    return guarded(() => fetchQuery(api.editorial.reads.getIdea, { ideaId, nowMs: this.now() }, this.auth));
  }

  async getRevision(ideaId: string, revisionId: string): Promise<CommandResult<RevisionView>> {
    const result = await guarded(() =>
      fetchQuery(api.editorial.reads.getRevision, { ideaId, revisionId, nowMs: this.now() }, this.auth),
    );
    return result.ok ? ok(withMeasuredCounts(result.value)) : result;
  }

  listReleases(filter: ReleaseFilter, cursor: string | null, pageSize: number): Promise<CommandResult<Page<ReleaseView>>> {
    return guarded(() =>
      fetchQuery(api.editorial.reads.listReleases, { filter, cursor, pageSize, nowMs: this.now() }, this.auth),
    );
  }

  listTrash(cursor: string | null, pageSize: number): Promise<CommandResult<Page<TrashItem>>> {
    return guarded(() => fetchQuery(api.editorial.reads.listTrash, { cursor, pageSize, nowMs: this.now() }, this.auth));
  }

  listActivity(
    filter: ActivityFilter,
    cursor: string | null,
    pageSize: number,
  ): Promise<CommandResult<Page<ActivityEntry, number | null>>> {
    return guarded(() =>
      fetchQuery(api.editorial.reads.listActivity, { filter, cursor, pageSize, nowMs: this.now() }, this.auth),
    );
  }

  getSettings(): Promise<CommandResult<SettingsView>> {
    return guarded(() => fetchQuery(api.editorial.reads.settings, { nowMs: this.now() }, this.auth));
  }

  /* Ingestion is not a workspace action ------------------------------------ */

  async importSubmission(envelope: unknown, credential: IngestionCredential): Promise<CommandResult<ImportAck>> {
    void envelope;
    void credential;
    return fail("UNAUTHENTICATED", "Submissions arrive through the ingestion service, not the editorial workspace.");
  }

  /* Revisions -------------------------------------------------------------- */

  createRevision(ideaId: string, fromRevisionId: string | null, idempotencyKey: string, carry: DraftCarry | null = null) {
    return guarded(() =>
      fetchMutation(api.editorial.commands.createRevision, { ideaId, fromRevisionId, idempotencyKey, carry }, this.auth),
    );
  }

  discardRevision(ideaId: string, revisionId: string, expectedVersion: number, reason: string) {
    return guarded(() =>
      fetchMutation(api.editorial.commands.discardRevision, { ideaId, revisionId, expectedVersion, reason }, this.auth),
    );
  }

  saveDraft(
    ideaId: string,
    revisionId: string,
    baseVersion: number,
    patch: SaveDraftPatch,
    idempotencyKey: string,
  ): Promise<CommandResult<SaveDraftAck>> {
    return guarded(() =>
      fetchMutation(api.editorial.commands.saveDraft, { ideaId, revisionId, baseVersion, patch, idempotencyKey }, this.auth),
    );
  }

  /* Decision and review ------------------------------------------------------ */

  setCandidateDecision(ideaId: string, expectedVersion: number, input: CandidateDecisionInput) {
    return guarded(() =>
      fetchMutation(api.editorial.commands.setCandidateDecision, { ideaId, expectedVersion, input }, this.auth),
    );
  }

  markReviewed(revisionId: string, reviewItemId: string, dependencyHash: string, note: string | null): Promise<CommandResult<ReviewAck>> {
    return guarded(() =>
      fetchMutation(api.editorial.commands.markReviewed, { revisionId, reviewItemId, dependencyHash, note }, this.auth),
    );
  }

  retractReview(revisionId: string, reviewItemId: string): Promise<CommandResult<ReviewAck>> {
    return guarded(() => fetchMutation(api.editorial.commands.retractReview, { revisionId, reviewItemId }, this.auth));
  }

  flagReviewItem(revisionId: string, reviewItemId: string, dependencyHash: string, input: FlagInput): Promise<CommandResult<ReviewAck>> {
    return guarded(() =>
      fetchMutation(api.editorial.commands.flagReviewItem, { revisionId, reviewItemId, dependencyHash, input }, this.auth),
    );
  }

  resolveIssue(revisionId: string, issueId: string, dependencyHash: string, note: string) {
    return guarded(() =>
      fetchMutation(api.editorial.commands.resolveIssue, { revisionId, issueId, dependencyHash, note }, this.auth),
    );
  }

  addNote(revisionId: string, target: EditorialTarget, note: string) {
    return guarded(() => fetchMutation(api.editorial.commands.addNote, { revisionId, target, note }, this.auth));
  }

  requestChanges(revisionId: string, note: string): Promise<CommandResult<ReviewAck>> {
    return guarded(() => fetchMutation(api.editorial.commands.requestChanges, { revisionId, note }, this.auth));
  }

  resumeReview(revisionId: string): Promise<CommandResult<ReviewAck>> {
    return guarded(() => fetchMutation(api.editorial.commands.resumeReview, { revisionId }, this.auth));
  }

  runChecks(revisionId: string, expectedArtifactHash: string) {
    return guarded(() => fetchAction(api.editorial.checks.run, { revisionId, expectedArtifactHash }, this.auth));
  }

  approveRevision(revisionId: string, artifactHash: string, input: ApprovalInput) {
    return guarded(() =>
      fetchMutation(api.editorial.commands.approveRevision, { revisionId, artifactHash, input }, this.auth),
    );
  }

  /* Releases and lifecycle ------------------------------------------------------ */

  prepareRelease(revisionId: string, expectedLiveReleaseId: string | null, idempotencyKey: string) {
    return guarded(() =>
      fetchMutation(api.editorial.commands.prepareRelease, { revisionId, expectedLiveReleaseId, idempotencyKey }, this.auth),
    );
  }

  publishRelease(releaseId: string, expectedState: ReleaseState, approvalId: string, idempotencyKey: string) {
    return guarded(() =>
      fetchMutation(
        api.editorial.commands.publishRelease,
        { releaseId, expectedState, approvalId, idempotencyKey },
        this.auth,
      ),
    );
  }

  cancelRelease(releaseId: string, expectedState: ReleaseState, reason: string) {
    return guarded(() =>
      fetchMutation(api.editorial.commands.cancelRelease, { releaseId, expectedState, reason }, this.auth),
    );
  }

  retryRelease(releaseId: string, expectedState: ReleaseState, idempotencyKey: string) {
    return guarded(() =>
      fetchMutation(api.editorial.commands.retryRelease, { releaseId, expectedState, idempotencyKey }, this.auth),
    );
  }

  reconcileRelease(releaseId: string) {
    return guarded(() => fetchMutation(api.editorial.commands.reconcileRelease, { releaseId }, this.auth));
  }

  requestRollback(ideaId: string, targetReleaseId: string, expectedLiveReleaseId: string, reason: string, idempotencyKey: string) {
    return guarded(() =>
      fetchMutation(
        api.editorial.commands.requestRollback,
        { ideaId, targetReleaseId, expectedLiveReleaseId, reason, idempotencyKey },
        this.auth,
      ),
    );
  }

  unpublishIdea(ideaId: string, expectedLiveReleaseId: string, reason: string, idempotencyKey: string) {
    return guarded(() =>
      fetchMutation(
        api.editorial.commands.unpublishIdea,
        { ideaId, expectedLiveReleaseId, reason, idempotencyKey },
        this.auth,
      ),
    );
  }

  trashIdea(ideaId: string, expectedVersion: number, reason: string) {
    return guarded(() => fetchMutation(api.editorial.commands.trashIdea, { ideaId, expectedVersion, reason }, this.auth));
  }

  restoreIdea(ideaId: string, expectedVersion: number, reason: string) {
    return guarded(() => fetchMutation(api.editorial.commands.restoreIdea, { ideaId, expectedVersion, reason }, this.auth));
  }
}
