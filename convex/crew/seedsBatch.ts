"use node";

/**
 * WP90-S3. The seed precompute's Batch API calls: submit one run as one
 * Message Batch, then poll until it ends and record every result.
 *
 * Meter (C-METER, ownerless platform work):
 * - one reservation per idea, `batch: true`, attempt key
 *   `precompute:{ideaSlug}:{seedVersion}:crew-idea-seed@1:{attempt}`, the
 *   worst case at the batch rate. The batch request's `custom_id` is the
 *   reservation's `usageId`, so results settle by it in any order;
 * - a budget or kill-switch refusal stops reserving: the rest of the run is
 *   marked `not_reserved` and a later run picks them up. Nothing is ever sent
 *   without its reservation;
 * - `markSent` for every reserved row right before the batch is created; if
 *   the create fails, every row is failed with the error's billed state
 *   (`none` when the API answered with an error, `possible` when the reply
 *   never came, which charges the reservation);
 * - a succeeded result settles at its batch-rate cost; a refusal or an
 *   unusable reply fails billed `actual` with its cost; errored, canceled and
 *   expired results fail billed `none` (the Batch API bills only successes).
 *
 * Results are audited by `seeds:recordResult`, not here, so only a draft that
 * passes the audit against the item's stored source becomes a seed row.
 *
 * The bodies take their dependencies (`SeedBatchDeps`) so the tests run them
 * against the real meter and seed mutations with a fixture adapter.
 */
import { v } from "convex/values";

import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalAction, type ActionCtx } from "../_generated/server";
import { seedSourceFromJson } from "../../lib/workspace/crew/seedSource";
import { gatewayErrorDataOf } from "../ai/gateway";
import { gatewayEnv } from "../ai/gatewayActions";
import {
  createAnthropicBatchAdapter,
  type AnthropicBatchAdapter,
  type BatchItemOutcome,
  type BatchRequestItem,
} from "../ai/providers/anthropic";
import { isProviderError, type TextRequest } from "../ai/providers/types";
import { SEED_BATCH_CALL_TIMEOUT_MS, SEED_PROMPT_REF, precomputeAttemptKey, seedRequestFor } from "./seedRequest";
import { SEED_POLL_MAX } from "./seeds";

/** Minutes between polls of a live batch (most finish within an hour; the API allows 24). */
export const SEED_POLL_INTERVAL_MS = 60 * 1_000;

export type SeedBatchCtx = Pick<ActionCtx, "runQuery" | "runMutation" | "scheduler">;

export type SeedBatchDeps = {
  /** Replaces the env-built batch adapter (tests: a fixture adapter with scripted results). */
  readonly adapter?: AnthropicBatchAdapter;
  readonly now?: () => number;
};

export type SeedSubmitResult = {
  readonly status: "submitted" | "failed" | "nothing_to_send";
  readonly submitted: number;
  readonly notReserved: number;
  readonly batchId?: string;
  readonly note?: string;
};

export type SeedPollResult = {
  readonly status: "waiting" | "collected" | "gave_up" | "not_submitted";
  readonly written: number;
  readonly auditFailed: number;
  readonly failed: number;
};

type ItemView = {
  readonly itemId: Id<"idea_seed_items">;
  readonly ideaSlug: string;
  readonly attempt: number;
  readonly sourceJson: string;
  readonly usageId?: Id<"ai_usage">;
};

function adapterFor(deps: SeedBatchDeps): AnthropicBatchAdapter {
  return deps.adapter ?? createAnthropicBatchAdapter({ env: gatewayEnv(process.env) });
}

async function allItems(
  ctx: SeedBatchCtx,
  runId: Id<"idea_seed_runs">,
  status: "pending" | "sent",
): Promise<ItemView[]> {
  const items: ItemView[] = [];
  let cursor: string | null = null;
  for (;;) {
    const page: { items: ItemView[]; isDone: boolean; continueCursor: string } = await ctx.runQuery(
      internal.crew.seeds.itemsPage,
      { runId, status, cursor },
    );
    items.push(...page.items);
    if (page.isDone) return items;
    cursor = page.continueCursor;
  }
}

/** The meter's refusal code when a reserve was refused for budget or a switch; null for anything else. */
function refusalCode(error: unknown): string | null {
  const data = gatewayErrorDataOf(error);
  if (data === null) return null;
  return data.code === "BUDGET_EXHAUSTED" || data.code === "AI_DISABLED" ? data.code : null;
}

async function failRows(
  ctx: SeedBatchCtx,
  usageIds: readonly Id<"ai_usage">[],
  billed: "none" | "possible",
  errorClass: "permanent" | "indeterminate" | "retryable" | "timeout",
  latencyMs: number,
): Promise<void> {
  for (const usageId of usageIds) {
    await ctx.runMutation(internal.ai.metering.fail, { usageId, billed, errorClass, latencyMs });
  }
}

/**
 * Reserves, marks sent and submits a preparing run's pending items as one
 * batch, then schedules the first poll.
 */
export async function submitSeedRun(
  ctx: SeedBatchCtx,
  args: { readonly runId: Id<"idea_seed_runs"> },
  deps: SeedBatchDeps = {},
): Promise<SeedSubmitResult> {
  const now = deps.now ?? Date.now;
  const run = await ctx.runQuery(internal.crew.seeds.runForBatch, { runId: args.runId });
  if (run.status !== "preparing") throw new Error(`the run is ${run.status}, not preparing`);
  const adapter = adapterFor(deps);
  const pending = await allItems(ctx, args.runId, "pending");
  if (pending.length === 0) {
    await ctx.runMutation(internal.crew.seeds.recordRunFailed, {
      runId: args.runId, itemIds: [], errorKind: "none", note: "Nothing to send: every idea is unchanged.",
    });
    return { status: "nothing_to_send", submitted: 0, notReserved: 0 };
  }

  const startedAt = now();
  const reserved: { itemId: Id<"idea_seed_items">; usageId: Id<"ai_usage">; reservedMicroUsd: number; request: TextRequest }[] = [];
  const notReserved: { itemId: Id<"idea_seed_items">; reason: string }[] = [];
  let stoppedBy: string | null = null;
  try {
    for (const item of pending) {
      if (stoppedBy !== null) {
        notReserved.push({ itemId: item.itemId, reason: stoppedBy });
        continue;
      }
      const seed = seedRequestFor(seedSourceFromJson(item.sourceJson));
      try {
        const result = await ctx.runMutation(internal.ai.metering.reserve, {
          attemptKey: precomputeAttemptKey(item.ideaSlug, run.seedVersion, item.attempt),
          promptRef: SEED_PROMPT_REF,
          provider: "anthropic",
          model: seed.model,
          tier: "deep",
          feature: "ai",
          reservedMicroUsd: seed.reservedMicroUsd,
          batch: true,
        });
        if (result.existing) throw new Error(`the attempt key for ${item.ideaSlug} already has a reservation`);
        reserved.push({
          itemId: item.itemId,
          usageId: result.usageId as Id<"ai_usage">,
          reservedMicroUsd: seed.reservedMicroUsd,
          request: seed.request,
        });
      } catch (error) {
        const code = refusalCode(error);
        if (code === null) throw error;
        stoppedBy = code;
        notReserved.push({ itemId: item.itemId, reason: code });
      }
    }
  } catch (error) {
    // Nothing has been sent: release what was reserved and close the run.
    await failRows(ctx, reserved.map((entry) => entry.usageId), "none", "permanent", now() - startedAt);
    await ctx.runMutation(internal.crew.seeds.recordRunFailed, {
      runId: args.runId,
      itemIds: pending.map((item) => item.itemId),
      errorKind: "config",
      note: `Stopped before sending: ${error instanceof Error ? error.message : "unknown error"}`.slice(0, 300),
    });
    return { status: "failed", submitted: 0, notReserved: 0, note: "stopped before sending" };
  }

  await ctx.runMutation(internal.crew.seeds.recordReservations, {
    runId: args.runId,
    reserved: reserved.map(({ itemId, usageId, reservedMicroUsd }) => ({ itemId, usageId, reservedMicroUsd })),
    notReserved,
  });
  const note = stoppedBy === null ? undefined : `${notReserved.length} ideas not reserved (${stoppedBy}); run them in a later run.`;
  if (reserved.length === 0) {
    await ctx.runMutation(internal.crew.seeds.recordRunFailed, {
      runId: args.runId, itemIds: [], errorKind: stoppedBy ?? "none", note: note ?? "Nothing reserved.",
    });
    return { status: "failed", submitted: 0, notReserved: notReserved.length, ...(note === undefined ? {} : { note }) };
  }

  for (const entry of reserved) await ctx.runMutation(internal.ai.metering.markSent, { usageId: entry.usageId });
  const batchItems: BatchRequestItem[] = reserved.map((entry) => ({ customId: entry.usageId, request: entry.request }));
  let batchId: string;
  try {
    batchId = (await adapter.submit(batchItems, { timeoutMs: SEED_BATCH_CALL_TIMEOUT_MS })).batchId;
  } catch (error) {
    const billed = isProviderError(error) && error.billed === "none" ? "none" : "possible";
    const errorClass = isProviderError(error) && error.errorClass === "timeout" ? "timeout" : billed === "none" ? "permanent" : "indeterminate";
    await failRows(ctx, reserved.map((entry) => entry.usageId), billed, errorClass, now() - startedAt);
    const kind = isProviderError(error) ? error.kind : "unknown";
    await ctx.runMutation(internal.crew.seeds.recordRunFailed, {
      runId: args.runId,
      itemIds: reserved.map((entry) => entry.itemId),
      errorKind: kind,
      note: `The batch could not be created (${kind}).`,
    });
    return { status: "failed", submitted: 0, notReserved: notReserved.length, note: `batch create failed (${kind})` };
  }

  await ctx.runMutation(internal.crew.seeds.recordSubmitted, {
    runId: args.runId,
    batchId,
    mode: adapter.mode,
    itemIds: reserved.map((entry) => entry.itemId),
    ...(note === undefined ? {} : { note }),
  });
  await ctx.scheduler.runAfter(adapter.mode === "fixture" ? 0 : SEED_POLL_INTERVAL_MS, internal.crew.seedsBatch.pollRun, {
    runId: args.runId,
  });
  return { status: "submitted", submitted: reserved.length, notReserved: notReserved.length, batchId, ...(note === undefined ? {} : { note }) };
}

async function recordOutcome(
  ctx: SeedBatchCtx,
  item: ItemView & { readonly usageId: Id<"ai_usage"> },
  outcome: BatchItemOutcome,
  latencyMs: number,
): Promise<"written" | "audit_failed" | "failed" | "unchanged"> {
  if (outcome.ok) {
    const { result } = outcome;
    await ctx.runMutation(internal.ai.metering.settle, {
      usageId: item.usageId,
      inputTokens: result.usage.inputTokens,
      cacheReadTokens: result.usage.cacheReadTokens,
      cacheWriteTokens: result.usage.cacheWriteTokens,
      outputTokens: result.usage.outputTokens,
      costMicroUsd: result.cost.microUsd,
      estimated: result.cost.estimated,
      latencyMs,
      stopReason: result.stopReason,
    });
    return await ctx.runMutation(internal.crew.seeds.recordResult, {
      itemId: item.itemId,
      result: { kind: "succeeded", replyText: result.text, costMicroUsd: result.cost.microUsd },
    });
  }
  const { error } = outcome;
  const billed = error.billed === "actual" ? "actual" : "none";
  const costMicroUsd = billed === "actual" ? error.cost?.microUsd : undefined;
  await ctx.runMutation(internal.ai.metering.fail, {
    usageId: item.usageId,
    billed,
    ...(costMicroUsd === undefined ? {} : { costMicroUsd }),
    errorClass: error.errorClass,
    latencyMs,
  });
  return await ctx.runMutation(internal.crew.seeds.recordResult, {
    itemId: item.itemId,
    result: { kind: "failed", errorKind: error.kind, ...(costMicroUsd === undefined ? {} : { costMicroUsd }) },
  });
}

/** Checks the batch; when it has ended, records every result and closes the run. Reschedules itself until then. */
export async function pollSeedRun(
  ctx: SeedBatchCtx,
  args: { readonly runId: Id<"idea_seed_runs"> },
  deps: SeedBatchDeps = {},
): Promise<SeedPollResult> {
  const now = deps.now ?? Date.now;
  const counts = { written: 0, auditFailed: 0, failed: 0 };
  const run = await ctx.runQuery(internal.crew.seeds.runForBatch, { runId: args.runId });
  if (run.status !== "submitted" || run.batchId === undefined) return { status: "not_submitted", ...counts };
  const adapter = adapterFor(deps);
  const polls = await ctx.runMutation(internal.crew.seeds.markPolled, { runId: args.runId });

  const status = await adapter.status(run.batchId, { timeoutMs: SEED_BATCH_CALL_TIMEOUT_MS });
  if (status.processingStatus !== "ended") {
    if (polls >= SEED_POLL_MAX) {
      await ctx.runMutation(internal.crew.seeds.finishRun, {
        runId: args.runId,
        note: "Stopped polling; the meter sweep closes the open reservations.",
      });
      return { status: "gave_up", ...counts };
    }
    await ctx.scheduler.runAfter(SEED_POLL_INTERVAL_MS, internal.crew.seedsBatch.pollRun, { runId: args.runId });
    return { status: "waiting", ...counts };
  }

  const sent = (await allItems(ctx, args.runId, "sent")).filter(
    (item): item is ItemView & { usageId: Id<"ai_usage"> } => item.usageId !== undefined,
  );
  const byUsageId = new Map(sent.map((item) => [item.usageId as string, item]));
  const requests = new Map<string, TextRequest>(
    sent.map((item) => [item.usageId as string, seedRequestFor(seedSourceFromJson(item.sourceJson)).request]),
  );
  const results = await adapter.results(run.batchId, requests, { timeoutMs: SEED_BATCH_CALL_TIMEOUT_MS });
  const latencyMs = Math.max(0, now() - (run.submittedAt ?? now()));
  for (const outcome of results.outcomes) {
    const item = byUsageId.get(outcome.customId);
    if (item === undefined) continue;
    const recorded = await recordOutcome(ctx, item, outcome, latencyMs);
    if (recorded === "written") counts.written += 1;
    else if (recorded === "audit_failed") counts.auditFailed += 1;
    else if (recorded === "failed") counts.failed += 1;
  }
  const missing = sent.length - results.outcomes.filter((outcome) => byUsageId.has(outcome.customId)).length;
  await ctx.runMutation(internal.crew.seeds.finishRun, {
    runId: args.runId,
    ...(missing > 0 ? { note: `${missing} sent ideas had no result; the meter sweep closes their reservations.` } : {}),
  });
  return { status: "collected", ...counts };
}

export const submitRun = internalAction({
  args: { runId: v.id("idea_seed_runs") },
  returns: v.object({
    status: v.string(),
    submitted: v.number(),
    notReserved: v.number(),
    batchId: v.optional(v.string()),
    note: v.optional(v.string()),
  }),
  handler: async (ctx, args) => await submitSeedRun(ctx, args),
});

export const pollRun = internalAction({
  args: { runId: v.id("idea_seed_runs") },
  returns: v.object({ status: v.string(), written: v.number(), auditFailed: v.number(), failed: v.number() }),
  handler: async (ctx, args) => await pollSeedRun(ctx, args),
});
