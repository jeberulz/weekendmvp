"use server";

import { z } from "zod";

import {
  approvalInputSchema,
  candidateDecisionSchema,
  flagInputSchema,
  noteSchema,
  noteTargetSchema,
} from "@/lib/editorial/contracts/commands";
import { ok, type CommandResult } from "@/lib/editorial/contracts/errors";
import { editorialIdSchema, sha256Schema } from "@/lib/editorial/contracts/primitives";
import type { EditorialRepository } from "@/lib/editorial/contracts/repository";
import type { RevisionView } from "@/lib/editorial/contracts/views";
import { withWorkspace } from "@/lib/editorial/runtime/action-support";

/*
 * Human review commands. Each is an explicit, single-item decision by the
 * signed-in editor; there is no bulk attestation. Every action returns the
 * fresh revision view so the checklist, blockers and Approve state update
 * without reloading the page.
 */

const versionSchema = z.int().min(0).max(1_000_000_000);
const itemIdSchema = z.string().min(1).max(200);
const target = { ideaId: editorialIdSchema, revisionId: editorialIdSchema };

async function withView<T>(
  repository: EditorialRepository,
  ideaId: string,
  revisionId: string,
  result: CommandResult<T>,
): Promise<CommandResult<{ value: T; view: RevisionView }>> {
  if (!result.ok) return result;
  const view = await repository.getRevision(ideaId, revisionId);
  if (!view.ok) return view;
  return ok({ value: result.value, view: view.value });
}

const decisionSchema = z.strictObject({ ...target, expectedVersion: versionSchema, input: candidateDecisionSchema });

/** Accept, request research, reject with a reason, or reopen as a new candidate. */
export async function decideCandidateAction(input: z.input<typeof decisionSchema>) {
  return withWorkspace(decisionSchema, input, async ({ repository }, data) =>
    withView(repository, data.ideaId, data.revisionId, await repository.setCandidateDecision(data.ideaId, data.expectedVersion, data.input)),
  );
}

const markSchema = z.strictObject({ ...target, itemId: itemIdSchema, dependencyHash: z.string().min(1).max(200), note: noteSchema.nullable() });

/** Attest one review item for the exact content hash on screen. */
export async function markReviewedAction(input: z.input<typeof markSchema>) {
  return withWorkspace(markSchema, input, async ({ repository }, data) =>
    withView(
      repository,
      data.ideaId,
      data.revisionId,
      await repository.markReviewed(data.revisionId, data.itemId, data.dependencyHash, data.note),
    ),
  );
}

const retractSchema = z.strictObject({ ...target, itemId: itemIdSchema });

export async function retractReviewAction(input: z.input<typeof retractSchema>) {
  return withWorkspace(retractSchema, input, async ({ repository }, data) =>
    withView(repository, data.ideaId, data.revisionId, await repository.retractReview(data.revisionId, data.itemId)),
  );
}

const flagSchema = z.strictObject({ ...target, itemId: itemIdSchema, dependencyHash: z.string().min(1).max(200), input: flagInputSchema });

/** Record a discrepancy. High-severity flags block approval until resolved with a note. */
export async function flagReviewItemAction(input: z.input<typeof flagSchema>) {
  return withWorkspace(flagSchema, input, async ({ repository }, data) =>
    withView(
      repository,
      data.ideaId,
      data.revisionId,
      await repository.flagReviewItem(data.revisionId, data.itemId, data.dependencyHash, data.input),
    ),
  );
}

const resolveSchema = z.strictObject({ ...target, issueId: itemIdSchema, dependencyHash: z.string().min(1).max(200), note: noteSchema });

/** Resolve a warning or a flag with a written reason. Blockers refuse. */
export async function resolveIssueAction(input: z.input<typeof resolveSchema>) {
  return withWorkspace(resolveSchema, input, async ({ repository }, data) =>
    withView(
      repository,
      data.ideaId,
      data.revisionId,
      await repository.resolveIssue(data.revisionId, data.issueId, data.dependencyHash, data.note),
    ),
  );
}

const noteActionSchema = z.strictObject({ ...target, target: noteTargetSchema, note: noteSchema });

export async function addNoteAction(input: z.input<typeof noteActionSchema>) {
  return withWorkspace(noteActionSchema, input, async ({ repository }, data) =>
    withView(repository, data.ideaId, data.revisionId, await repository.addNote(data.revisionId, data.target, data.note)),
  );
}

const changesSchema = z.strictObject({ ...target, note: noteSchema });

export async function requestChangesAction(input: z.input<typeof changesSchema>) {
  return withWorkspace(changesSchema, input, async ({ repository }, data) =>
    withView(repository, data.ideaId, data.revisionId, await repository.requestChanges(data.revisionId, data.note)),
  );
}

const resumeSchema = z.strictObject(target);

export async function resumeReviewAction(input: z.input<typeof resumeSchema>) {
  return withWorkspace(resumeSchema, input, async ({ repository }, data) =>
    withView(repository, data.ideaId, data.revisionId, await repository.resumeReview(data.revisionId)),
  );
}

const approveSchema = z.strictObject({ ...target, artifactHash: sha256Schema, input: approvalInputSchema });

/**
 * The explicit approval of one fixed revision: bound to its artifact hash,
 * the current policy and current checks. The server re-derives every
 * blocker; the client's disabled button is only a convenience.
 */
export async function approveRevisionAction(input: z.input<typeof approveSchema>) {
  return withWorkspace(approveSchema, input, async ({ repository }, data) =>
    withView(
      repository,
      data.ideaId,
      data.revisionId,
      await repository.approveRevision(data.revisionId, data.artifactHash, data.input),
    ),
  );
}
