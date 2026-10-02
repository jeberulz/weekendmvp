import { ConvexError, v } from "convex/values";

import type { IngestionPrincipal } from "../../lib/editorial/contracts/principal";
import { SUBMISSION_PRODUCERS } from "../../lib/editorial/contracts/submission";
import { WORKER_STATES } from "../../lib/editorial/core/worker";
import { internalMutation, internalQuery } from "../_generated/server";
import { serviceRepository } from "./session";
import { literals } from "./validators";

/**
 * Internal editorial seams for trusted backend code (WP46-E4c). Browsers
 * cannot call these; an operator can, with deployment credentials.
 *
 * - `importSubmission`: the receiver for the authenticated ingestion endpoint
 *   (WP46-E5). The caller has authenticated the producer and established the
 *   verification authority; the core still validates everything else.
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
    authority: literals(["engine_receipt", "none"]),
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
