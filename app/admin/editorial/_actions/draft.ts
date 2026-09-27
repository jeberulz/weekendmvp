"use server";

import { z } from "zod";

import { reasonSchema, saveDraftPatchSchema, type SaveDraftAck } from "@/lib/editorial/contracts/commands";
import { fail, ok, type CommandResult } from "@/lib/editorial/contracts/errors";
import { EDITORIAL_LIMITS } from "@/lib/editorial/contracts/limits";
import { editorialMetadataSchema } from "@/lib/editorial/contracts/metadata";
import {
  editorialIdSchema,
  idempotencyKeySchema,
  markdownBodySchema,
  sha256Schema,
  singleLineText,
} from "@/lib/editorial/contracts/primitives";
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
  /** Null forks the idea's current working (or live) revision. */
  fromRevisionId: editorialIdSchema.nullable(),
  idempotencyKey: idempotencyKeySchema,
  /** Unsaved editor text to carry into the new draft, e.g. after an approval froze the old one. */
  carry: z
    .strictObject({
      title: singleLineText(EDITORIAL_LIMITS.titleChars),
      markdown: markdownBodySchema,
      metadata: editorialMetadataSchema,
      idempotencyKey: idempotencyKeySchema,
    })
    .nullable(),
});

export async function createRevisionAction(
  input: z.input<typeof createSchema>,
): Promise<CommandResult<{ revisionId: string; number: number }>> {
  return withWorkspace(createSchema, input, async ({ repository }, data) => {
    let fromRevisionId = data.fromRevisionId;
    if (fromRevisionId === null) {
      const detail = await repository.getIdea(data.ideaId);
      if (!detail.ok) return detail;
      fromRevisionId = detail.value.idea.workingRevision?.id ?? detail.value.idea.liveRevision?.id ?? null;
      if (fromRevisionId === null) return fail("NOT_FOUND", "This idea has no revision to start from.");
    }
    const created = await repository.createRevision(data.ideaId, fromRevisionId, data.idempotencyKey);
    if (!created.ok || !data.carry) return created;
    const draft = await repository.getRevision(data.ideaId, created.value.revisionId);
    if (!draft.ok) return draft;
    const carried = await repository.saveDraft(
      data.ideaId,
      created.value.revisionId,
      draft.value.version,
      { title: data.carry.title, markdown: data.carry.markdown, metadata: data.carry.metadata },
      data.carry.idempotencyKey,
    );
    return carried.ok ? created : carried;
  });
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
