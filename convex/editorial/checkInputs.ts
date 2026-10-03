import { v } from "convex/values";

import { fail, ok } from "../../lib/editorial/contracts/errors";
import { LIVE_POLICY_VERSION } from "../../lib/editorial/core/live";
import { sha256Hex } from "../../lib/editorial/domain/hash";
import { internalMutation, internalQuery } from "../_generated/server";
import { checkValidator } from "./validators";
import { commandRepository, editorialSession } from "./session";

/** Private read for the authenticated Node audit action; never a browser API. */
export const load = internalQuery({
  args: { revisionId: v.string() },
  handler: async (ctx, args) => {
    const session = await editorialSession(ctx);
    if (session.principal?.capability !== "editorial_admin") {
      return fail("FORBIDDEN", "Editorial access is required to run checks.");
    }
    const revision = await ctx.db.query("editorial_revisions")
      .withIndex("by_key", (q) => q.eq("key", args.revisionId))
      .unique();
    if (!revision) return fail("NOT_FOUND", "That revision does not exist.");
    const idea = await ctx.db.query("editorial_ideas")
      .withIndex("by_key", (q) => q.eq("key", revision.ideaId))
      .unique();
    if (!idea || idea.origin !== "engine") {
      return fail("PRECONDITION_FAILED", "Only a validated engine idea can run this policy.");
    }
    const record = await ctx.db.query("editorial_engine_records")
      .withIndex("by_ideaId", (q) => q.eq("ideaId", idea.key))
      .unique();
    if (!record) return fail("PRECONDITION_FAILED", "This idea has no pinned validated engine record.");
    return ok({
      slug: idea.slug,
      revision: {
        title: revision.title,
        markdown: revision.markdown,
        metadata: revision.metadata,
        sources: revision.sources,
        claims: revision.claims,
      },
      record: {
        recordHash: record.recordHash,
        recordJson: record.recordJson,
        envelopeJson: record.envelopeJson,
        manifestJson: record.manifestJson,
      },
      policyVersion: LIVE_POLICY_VERSION,
    });
  },
});

/** The write transaction rechecks actor, record, policy and artifact fences. */
export const commit = internalMutation({
  args: {
    revisionId: v.string(),
    expectedArtifactHash: v.string(),
    expectedRecordHash: v.string(),
    expectedBindingHash: v.string(),
    expectedPolicyVersion: v.string(),
    checks: v.array(checkValidator),
  },
  handler: async (ctx, args) => {
    const revision = await ctx.db.query("editorial_revisions")
      .withIndex("by_key", (q) => q.eq("key", args.revisionId))
      .unique();
    if (!revision) return fail("NOT_FOUND", "That revision does not exist.");
    const record = await ctx.db.query("editorial_engine_records")
      .withIndex("by_ideaId", (q) => q.eq("ideaId", revision.ideaId))
      .unique();
    if (
      !record ||
      record.recordHash !== args.expectedRecordHash ||
      await sha256Hex(record.recordJson) !== args.expectedRecordHash ||
      await sha256Hex(JSON.stringify([record.envelopeJson, record.manifestJson])) !== args.expectedBindingHash
    ) {
      return fail("PRECONDITION_FAILED", "The pinned research record changed. Run checks again.");
    }
    return (await commandRepository(ctx)).applyTrustedChecks(
      args.revisionId,
      args.expectedArtifactHash,
      args.expectedPolicyVersion,
      args.checks,
    );
  },
});
