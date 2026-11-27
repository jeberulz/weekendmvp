"use node";

import { v } from "convex/values";

import type { ImportAck } from "../../lib/editorial/contracts/commands";
import type { CommandResult } from "../../lib/editorial/contracts/errors";
import { validateEngineSubmission } from "../../lib/editorial/engine/validated-artifact";
import { validatePainEngineSubmission } from "../../lib/editorial/engine/validated-pain-engine-artifact";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";

/**
 * Operator-only ingestion. Validation and the deep MDX audit run in Node;
 * the internal mutation pins the normalized record and candidate atomically.
 * No browser/client token can invoke this action.
 */
export const validateAndImport = internalAction({
  args: {
    recordJson: v.string(),
    mdx: v.string(),
    manifestJson: v.string(),
    sourceReviewJson: v.string(),
  },
  handler: async (ctx, args): Promise<CommandResult<ImportAck>> => {
    const validated = await validateEngineSubmission(args);
    return ctx.runMutation(internal.editorial.service.importValidatedEngine, {
      envelope: JSON.stringify(validated.envelope),
      recordJson: validated.recordJson,
      recordHash: validated.recordHash,
      manifestJson: args.manifestJson,
    });
  },
});

/**
 * Pain Engine equivalent of {@link validateAndImport}.
 *
 * The trust basis is the single human approval recorded in the review
 * record, carried as a "pain-engine-approval" source review whose sources
 * and claims are honestly marked "unverified". There is no Source Critic
 * PASS and no engine receipt for these submissions, so the import lands
 * with authority "none" and origin "manual", and follows the normal human
 * review flow in the admin panel (mark reviewed → resolve → approve).
 * Nothing here publishes anything and nothing touches the release switch.
 */
export const validateAndImportPainEngine = internalAction({
  args: {
    recordJson: v.string(),
    mdx: v.string(),
    manifestJson: v.string(),
    sourceReviewJson: v.string(),
  },
  handler: async (ctx, args): Promise<CommandResult<ImportAck>> => {
    const validated = await validatePainEngineSubmission(args);
    return ctx.runMutation(internal.editorial.service.importValidatedPainEngine, {
      envelope: JSON.stringify(validated.envelope),
      recordJson: validated.recordJson,
      recordHash: validated.recordHash,
      manifestJson: args.manifestJson,
    });
  },
});
