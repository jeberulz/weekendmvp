"use server";

import { z } from "zod";

import { draftCarrySchema, reasonSchema, saveDraftPatchSchema, type SaveDraftAck } from "@/lib/editorial/contracts/commands";
import { ok, type CommandResult } from "@/lib/editorial/contracts/errors";
import { editorialIdSchema, idempotencyKeySchema, sha256Schema } from "@/lib/editorial/contracts/primitives";
import type { RevisionView } from "@/lib/editorial/contracts/views";
import { withWorkspace } from "@/lib/editorial/runtime/action-support";

/*
 * Draft commands for the idea workspace. Each action is a public POST
 * endpoint: `withWorkspace` re-resolves the workspace (always unavailable in
 * production until the live adapter lands), validates the untrusted input,
 * and the repository re-checks identity, state and version fences.
 * Navigation after a command is the client's job, so no action refreshes a
 * page that may hold unsaved text.
 */

const versionSchema = z.int().min(0).max(1_000_000_000);

const saveSchema = z.strictObject({
  ideaId: editorialIdSchema,
  revisionId: editorialIdSchema,
  baseVersion: versionSchema,
  patch: saveDraftPatchSchema,
  idempotencyKey: idempotencyKeySchema,
});

/**
 * Autosave and Cmd/Ctrl-S. Returns the acknowledgement plus the fresh
 * revision view (review items, issues and counts change with the text), so
 * the editor never reloads the page mid-sentence.
 */
export async function saveDraftAction(
  input: z.input<typeof saveSchema>,
): Promise<CommandResult<{ ack: SaveDraftAck; view: RevisionView }>> {
  return withWorkspace(saveSchema, input, async ({ repository }, data) => {
    const saved = await repository.saveDraft(data.ideaId, data.revisionId, data.baseVersion, data.patch, data.idempotencyKey);
    if (!saved.ok) return saved;
    const view = await repository.getRevision(data.ideaId, data.revisionId);
    if (!view.ok) return view;
    return ok({ ack: saved.value, view: view.value });
  });
}

const createSchema = z.strictObject({
  ideaId: editorialIdSchema,
  /** Null forks the idea's current working revision, resolved by the command itself. */
  fromRevisionId: editorialIdSchema.nullable(),
  idempotencyKey: idempotencyKeySchema,
  /** Unsaved editor text to carry into the new draft, e.g. after an approval froze the old one. */
  carry: draftCarrySchema.nullable(),
});

/**
 * One command: the new draft and any carried text are created together, and
 * the same request key replays the first result, so a retry after a lost
 * response can neither strand the text nor create a second draft.
 */
export async function createRevisionAction(
  input: z.input<typeof createSchema>,
): Promise<CommandResult<{ revisionId: string; number: number }>> {
  return withWorkspace(createSchema, input, ({ repository }, data) =>
    repository.createRevision(data.ideaId, data.fromRevisionId, data.idempotencyKey, data.carry),
  );
}

const discardSchema = z.strictObject({
  ideaId: editorialIdSchema,
  revisionId: editorialIdSchema,
  expectedVersion: versionSchema,
  reason: reasonSchema,
});

export async function discardRevisionAction(
  input: z.input<typeof discardSchema>,
): Promise<CommandResult<{ workingRevisionId: string }>> {
  return withWorkspace(discardSchema, input, ({ repository }, data) =>
    repository.discardRevision(data.ideaId, data.revisionId, data.expectedVersion, data.reason),
  );
}

const checksSchema = z.strictObject({
  ideaId: editorialIdSchema,
  revisionId: editorialIdSchema,
  expectedArtifactHash: sha256Schema,
});

const viewSchema = z.strictObject({ ideaId: editorialIdSchema, revisionId: editorialIdSchema });

/** Re-read one revision, e.g. after choosing "Use theirs" in a conflict. */
export async function getRevisionAction(input: z.input<typeof viewSchema>): Promise<CommandResult<RevisionView>> {
  return withWorkspace(viewSchema, input, ({ repository }, data) => repository.getRevision(data.ideaId, data.revisionId));
}

/** Checks run against the saved artifact; a stale hash is refused, not silently re-targeted. */
export async function runChecksAction(input: z.input<typeof checksSchema>): Promise<CommandResult<RevisionView>> {
  return withWorkspace(checksSchema, input, async ({ repository }, data) => {
    const run = await repository.runChecks(data.revisionId, data.expectedArtifactHash);
    if (!run.ok) return run;
    return repository.getRevision(data.ideaId, data.revisionId);
  });
}
