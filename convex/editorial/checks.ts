"use node";

import { v } from "convex/values";

import { fail } from "../../lib/editorial/contracts/errors";
import type { CommandResult } from "../../lib/editorial/contracts/errors";
import { editorialMetadataSchema } from "../../lib/editorial/contracts/metadata";
import { computeRevisionHashes } from "../../lib/editorial/domain/artifact";
import { sha256Hex } from "../../lib/editorial/domain/hash";
import { runEngineChecks } from "../../lib/editorial/engine/check-runner";
import { internal } from "../_generated/api";
import { action } from "../_generated/server";

/** Authenticated deep audit of the exact saved revision, with a write fence. */
export const run = action({
  args: { revisionId: v.string(), expectedArtifactHash: v.string() },
  handler: async (ctx, args): Promise<CommandResult<{ checksRunAt: string }>> => {
    const loaded = await ctx.runQuery(internal.editorial.checkInputs.load, { revisionId: args.revisionId });
    if (!loaded.ok) return loaded;
    const revision = {
      ...loaded.value.revision,
      metadata: editorialMetadataSchema.parse(loaded.value.revision.metadata),
    };
    const hashes = await computeRevisionHashes(revision);
    if (hashes.artifact !== args.expectedArtifactHash) {
      return fail("STALE_REVIEW_TARGET", "The revision changed. Save and run checks on the latest version.");
    }
    const checks = await runEngineChecks({
      record: loaded.value.record,
      revision,
      slug: loaded.value.slug,
      artifactHash: hashes.artifact,
      nowMs: Date.now(),
    });
    return ctx.runMutation(internal.editorial.checkInputs.commit, {
      revisionId: args.revisionId,
      expectedArtifactHash: hashes.artifact,
      expectedRecordHash: loaded.value.record.recordHash,
      expectedBindingHash: await sha256Hex(JSON.stringify([
        loaded.value.record.envelopeJson,
        loaded.value.record.manifestJson,
      ])),
      expectedPolicyVersion: loaded.value.policyVersion,
      checks,
    });
  },
});
