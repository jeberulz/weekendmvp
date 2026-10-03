"use server";

import { z } from "zod";

import { commandIdSchemas, reasonSchema } from "@/lib/editorial/contracts/commands";
import { fail } from "@/lib/editorial/contracts/errors";
import { editorialIdSchema, idempotencyKeySchema } from "@/lib/editorial/contracts/primitives";
import { withWorkspace } from "@/lib/editorial/runtime/action-support";

/*
 * Release and lifecycle commands. Every one names the state it expects
 * (release state, live release or idea version) so a stale screen is
 * refused instead of acting on something that changed. In the local demo
 * nothing is deployed: the fixture adapter simulates each stage.
 */

const versionSchema = z.int().min(0).max(1_000_000_000);
const releaseState = commandIdSchemas.releaseState;

const prepareSchema = z.strictObject({
  revisionId: editorialIdSchema,
  expectedLiveReleaseId: editorialIdSchema.nullable(),
  idempotencyKey: idempotencyKeySchema,
});

/** Stage a protected preview of one approved revision. */
export async function prepareReleaseAction(input: z.input<typeof prepareSchema>) {
  return withWorkspace(prepareSchema, input, ({ repository }, data) =>
    repository.prepareRelease(data.revisionId, data.expectedLiveReleaseId, data.idempotencyKey),
  );
}

const publishSchema = z.strictObject({
  releaseId: editorialIdSchema,
  expectedState: releaseState,
  approvalId: editorialIdSchema,
  idempotencyKey: idempotencyKeySchema,
});

/** Record the production release intent. Needs recent strong authentication. */
export async function publishReleaseAction(input: z.input<typeof publishSchema>) {
  return withWorkspace(publishSchema, input, ({ repository }, data) =>
    repository.publishRelease(data.releaseId, data.expectedState, data.approvalId, data.idempotencyKey),
  );
}

const cancelSchema = z.strictObject({ releaseId: editorialIdSchema, expectedState: releaseState, reason: reasonSchema });

export async function cancelReleaseAction(input: z.input<typeof cancelSchema>) {
  return withWorkspace(cancelSchema, input, ({ repository }, data) =>
    repository.cancelRelease(data.releaseId, data.expectedState, data.reason),
  );
}

const retrySchema = z.strictObject({ releaseId: editorialIdSchema, expectedState: releaseState, idempotencyKey: idempotencyKeySchema });

export async function retryReleaseAction(input: z.input<typeof retrySchema>) {
  return withWorkspace(retrySchema, input, ({ repository }, data) =>
    repository.retryRelease(data.releaseId, data.expectedState, data.idempotencyKey),
  );
}

const reconcileSchema = z.strictObject({ releaseId: editorialIdSchema });

/** Probe an uncertain activation and record what actually happened; never a blind retry. */
export async function reconcileReleaseAction(input: z.input<typeof reconcileSchema>) {
  return withWorkspace(reconcileSchema, input, ({ repository }, data) => repository.reconcileRelease(data.releaseId));
}

const rollbackSchema = z.strictObject({
  ideaId: editorialIdSchema,
  targetReleaseId: editorialIdSchema,
  expectedLiveReleaseId: editorialIdSchema,
  reason: reasonSchema,
  idempotencyKey: idempotencyKeySchema,
});

export async function requestRollbackAction(input: z.input<typeof rollbackSchema>) {
  return withWorkspace(rollbackSchema, input, async ({ repository }, data) => {
    const detail = await repository.getIdea(data.ideaId);
    if (!detail.ok) return fail(detail.error.code, detail.error.message);
    const target = detail.value.releases.find((release) => release.id === data.targetReleaseId);
    if (!target?.revisionId) return fail("NOT_FOUND", "Choose an earlier release with a saved revision.");
    const revision = await repository.getRevision(data.ideaId, target.revisionId);
    if (!revision.ok) return fail(revision.error.code, revision.error.message);
    const checked = await repository.runChecks(target.revisionId, revision.value.hashes.artifact);
    if (!checked.ok) return fail(checked.error.code, checked.error.message);
    return repository.requestRollback(data.ideaId, data.targetReleaseId, data.expectedLiveReleaseId, data.reason, data.idempotencyKey);
  });
}

const unpublishSchema = z.strictObject({
  ideaId: editorialIdSchema,
  expectedLiveReleaseId: editorialIdSchema,
  reason: reasonSchema,
  idempotencyKey: idempotencyKeySchema,
});

/** Emergency removal stays available even when checks fail. */
export async function unpublishIdeaAction(input: z.input<typeof unpublishSchema>) {
  return withWorkspace(unpublishSchema, input, ({ repository }, data) =>
    repository.unpublishIdea(data.ideaId, data.expectedLiveReleaseId, data.reason, data.idempotencyKey),
  );
}

const lifecycleSchema = z.strictObject({ ideaId: editorialIdSchema, expectedVersion: versionSchema, reason: reasonSchema });

/** Refused for live ideas: unpublish first. */
export async function trashIdeaAction(input: z.input<typeof lifecycleSchema>) {
  return withWorkspace(lifecycleSchema, input, ({ repository }, data) =>
    repository.trashIdea(data.ideaId, data.expectedVersion, data.reason),
  );
}

/** Restores to unpublished and awaiting review, never straight to live. */
export async function restoreIdeaAction(input: z.input<typeof lifecycleSchema>) {
  return withWorkspace(lifecycleSchema, input, ({ repository }, data) =>
    repository.restoreIdea(data.ideaId, data.expectedVersion, data.reason),
  );
}
