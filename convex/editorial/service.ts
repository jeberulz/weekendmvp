import { ConvexError, v } from "convex/values";

import type { IngestionPrincipal } from "../../lib/editorial/contracts/principal";
import { editorialSubmissionSchema, SUBMISSION_PRODUCERS } from "../../lib/editorial/contracts/submission";
import { sha256Hex } from "../../lib/editorial/domain/hash";
import { WORKER_STATES } from "../../lib/editorial/core/worker";
import { internalMutation, internalQuery } from "../_generated/server";
import { serviceRepository } from "./session";
import { literals } from "./validators";

/**
 * Internal editorial seams for trusted backend code (WP46-E4c). Browsers
 * cannot call these; an operator can, with deployment credentials.
 *
 * - `importSubmission`: legacy/manual private imports with no engine authority.
 *   Validated engine submissions must use `ingest.validateAndImport` instead.
 * - `workerQueue` / `workerAdvance`: the release worker (WP46-E6) reports
 *   what happened outside; the shared rules re-check the kill switch,
 *   approval and generation fence before every move. Nothing calls them yet,
 *   and the live environment refuses release intents until E6.
 * - `setKillSwitch`: the operator's publishing stop.
 */

const OPERATOR = { id: "deployment-operator", kind: "system" as const, label: "Deployment operator" };

export const importSubmission = internalMutation({
  args: {
    /** The envelope exactly as received; the receiver parses and validates it. */
    envelope: v.string(),
    producer: literals(SUBMISSION_PRODUCERS),
    authority: v.literal("none"),
  },
  handler: async (ctx, args) => {
    let envelope: unknown = null;
    try {
      envelope = JSON.parse(args.envelope);
    } catch {
      // Not JSON: the receiver refuses it as an invalid submission.
    }
    const ingestion: IngestionPrincipal = {
      kind: "service",
      id: `ingestion-${args.producer}`,
      role: "ingestion",
      producer: args.producer,
    };
    return serviceRepository(ctx).importTrusted(ingestion, envelope, args.authority);
  },
});

/**
 * Commit only an engine artifact that the Node ingestion action audited. This
 * private mutation also pins the normalized research record in the same
 * transaction as the candidate import, so a later check never relies on a
 * local file that may have changed or disappeared.
 */
export const importValidatedEngine = internalMutation({
  args: {
    envelope: v.string(),
    recordJson: v.string(),
    recordHash: v.string(),
    manifestJson: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.recordJson.length > 512_000 || args.manifestJson.length > 32_000 || args.envelope.length > 250_000) {
      throw new ConvexError({ code: "INVALID_INPUT", message: "Engine submission exceeds its size limit." });
    }
    if (await sha256Hex(args.recordJson) !== args.recordHash) {
      throw new ConvexError({ code: "RECORD_HASH_MISMATCH", message: "Research record hash mismatch." });
    }
    let rawRecord: unknown;
    let rawEnvelope: unknown;
    try {
      rawRecord = JSON.parse(args.recordJson);
      rawEnvelope = JSON.parse(args.envelope);
    } catch {
      throw new ConvexError({ code: "INVALID_INPUT", message: "Engine submission is not valid JSON." });
    }
    // The Node action runs the full contract-v2 parser and MDX audit before
    // calling this private mutation. Keep this transaction edge-compatible:
    // the full parser imports Node APIs and cannot be bundled into a mutation.
    const record = rawRecord !== null && typeof rawRecord === "object" && !Array.isArray(rawRecord)
      ? rawRecord as Record<string, unknown>
      : null;
    const brief = record?.brief !== null && typeof record?.brief === "object" && !Array.isArray(record.brief)
      ? record.brief as Record<string, unknown>
      : null;
    const parsed = editorialSubmissionSchema.safeParse(rawEnvelope);
    if (
      record?.contractVersion !== 2 ||
      record.mode !== "live" ||
      !parsed.success ||
      parsed.data.producer !== "engine" ||
      parsed.data.mode !== "live" ||
      parsed.data.proposedSlug !== brief?.slug ||
      parsed.data.title !== brief.title ||
      parsed.data.engineContractVersion !== 2 ||
      parsed.data.submissionId !== `eng_${args.recordHash.slice(0, 32)}` ||
      parsed.data.engineRunId !== `run_${args.recordHash.slice(0, 32)}` ||
      parsed.data.checks.length !== 0
    ) {
      throw new ConvexError({ code: "INVALID_ENGINE_SUBMISSION", message: "Engine record and editorial envelope disagree." });
    }
    const ingestion: IngestionPrincipal = {
      kind: "service",
      id: "ingestion-engine",
      role: "ingestion",
      producer: "engine",
    };
    const result = await serviceRepository(ctx).importTrusted(ingestion, parsed.data, "engine_receipt");
    if (!result.ok) return result;
    const existing = await ctx.db.query("editorial_engine_records")
      .withIndex("by_ideaId", (q) => q.eq("ideaId", result.value.ideaId))
      .unique();
    if (existing) {
      if (existing.recordHash !== args.recordHash || existing.submissionId !== parsed.data.submissionId) {
        throw new ConvexError({ code: "RECORD_CONFLICT", message: "A different research record is already bound to this idea." });
      }
    } else {
      await ctx.db.insert("editorial_engine_records", {
        ideaId: result.value.ideaId,
        submissionId: parsed.data.submissionId,
        recordHash: args.recordHash,
        recordJson: args.recordJson,
        envelopeJson: args.envelope,
        manifestJson: args.manifestJson,
        createdAt: new Date(Date.now()).toISOString(),
      });
    }
    return result;
  },
});

const QUEUE_LIMIT = 100;

export const workerQueue = internalQuery({
  args: {},
  returns: v.array(v.object({ releaseId: v.string(), ideaId: v.string(), state: v.string(), createdAt: v.string() })),
  handler: async (ctx) => {
    const rows = [];
    for (const state of WORKER_STATES) {
      const inState = await ctx.db
        .query("editorial_releases")
        .withIndex("by_state", (q) => q.eq("state", state))
        .take(QUEUE_LIMIT);
      rows.push(...inState);
    }
    return rows
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
      .slice(0, QUEUE_LIMIT)
      .map((row) => ({ releaseId: row.key, ideaId: row.ideaId, state: row.state, createdAt: row.createdAt }));
  },
});

const workerReport = v.union(
  v.object({ kind: v.literal("completed") }),
  v.object({ kind: v.literal("failed"), code: v.string(), message: v.string() }),
  v.object({ kind: v.literal("uncertain"), observation: v.union(v.object({ activated: v.boolean() }), v.null()) }),
);

export const workerAdvance = internalMutation({
  args: { releaseId: v.string(), report: workerReport },
  returns: v.object({ moved: v.boolean() }),
  handler: async (ctx, args) => {
    const report =
      args.report.kind === "failed"
        ? { kind: "failed" as const, code: args.report.code.slice(0, 64), message: args.report.message.slice(0, 600) }
        : args.report;
    return serviceRepository(ctx).workerAdvance(args.releaseId, report);
  },
});

export const setKillSwitch = internalMutation({
  args: { engaged: v.boolean(), reason: v.string() },
  returns: v.object({ engaged: v.boolean() }),
  handler: async (ctx, args) => {
    const reason = args.reason.trim();
    if (reason.length < 3 || reason.length > 500) {
      throw new ConvexError({ code: "INVALID_INPUT", message: "Give a reason of 3 to 500 characters." });
    }
    return serviceRepository(ctx).setKillSwitch(args.engaged, OPERATOR, reason);
  },
});
