"use node";

import { v } from "convex/values";

import type { ImportAck } from "../../lib/editorial/contracts/commands";
import type { CommandResult } from "../../lib/editorial/contracts/errors";
import { validateEngineSubmission } from "../../lib/editorial/engine/validated-artifact";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";

/**
 * Operator-only ingestion. Validation and the deep MDX audit run in Node;
 * the internal mutation pins the normalized record and candidate atomically.
 * No browser/client token can invoke this action.
 */
export const validateAndImport = internalAction({
  args: { recordJson: v.string(), mdx: v.string(), manifestJson: v.string() },
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
