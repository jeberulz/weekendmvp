/**
 * WP90-S3. Per-idea seed precompute: the runs, their items, and the write of
 * each audited seed into `idea_crew_seeds`. The Batch API calls live in
 * `seedsBatch.ts` (Node actions); everything here is a query or mutation.
 *
 * Operator flow (`scripts/crew-seeds.mjs`):
 * 1. dry run: `estimateItems` per chunk of sources. Writes nothing.
 * 2. `createRun` (one seed version), `addItems` per chunk of sources, then
 *    `seedsBatch:submitRun`, which reserves, submits and schedules the poll.
 * 3. `seedsBatch:pollRun` collects results: each reply is re-audited HERE
 *    against the stored source (`recordResult`), so a seed row only ever
 *    holds a draft that passed `auditSeedDraft` for this idea's own page.
 *
 * Rules:
 * - Seeds are platform rows (`projectId` unset) owned by the deployment's one
 *   active super admin; a run refuses to start when there is none or several.
 * - An idea whose stored source is unchanged since its seed at this version
 *   (same `sourceHash`) is skipped, so a re-run spends only on changed pages.
 * - `validated` comes from the source's research level and audit flag
 *   (`ideaIsValidated`), never from the model; unvalidated seeds carry no
 *   market block (owner ruling, 2026-11-07).
 * - Nothing here echoes model text into logs or errors. Audit findings are
 *   stored as code and field path only.
 * Internal functions only: no client can call any of this.
 */
import { v } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "../_generated/server";
import { soleActiveSuperAdminUserId } from "../admin/superAdmin";
import { readGlobalBudget } from "../ai/budgets";
import { AI_PROVIDER_MODE_ENV, PROVIDER_KEY_ENV, providerMode } from "../ai/providers/mode";
import { getOpsSettings } from "../ops/settings";
import { int64ToMicroUsd, utcDayKey } from "../../lib/workspace/contracts/metering";
import { ideaIsValidated, seedColumns } from "../../lib/workspace/contracts/seeds";
import { auditSeedDraft } from "../../lib/workspace/crew/seedAudit";
import { SeedSourceError, seedSourceFromJson, seedSourceHash, type SeedSource } from "../../lib/workspace/crew/seedSource";
import { SEED_PROMPT_REF, SEED_VERSION, seedRequestFor } from "./seedRequest";

/** Sources per `addItems` / `estimateItems` call (each is at most ~60 KB). */
export const SEED_ITEMS_PER_CALL = 25;
/** Ideas in one run (one Message Batch). The library has ~230. */
export const SEED_RUN_ITEMS_MAX = 400;
/** Polls before a run stops rescheduling itself: one a minute for 25 hours, the batch sweep window. */
export const SEED_POLL_MAX = 1_500;
/** Items read per page when the poll loads the requests it sent. */
export const SEED_SENT_PAGE = 50;
/** Earlier items for one idea and version looked at to number a new attempt. */
const ATTEMPTS_READ_MAX = 50;
/** Seed rows read per idea and version when checking for an unchanged source. */
const SEED_ROWS_READ_MAX = 20;

const itemInput = v.object({ ideaSlug: v.string(), sourceJson: v.string() });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** The seed rows' owner: the one active super admin. Refuses none or several. */
async function soleSuperAdmin(ctx: Pick<QueryCtx, "db">): Promise<Id<"users">> {
  const ownerId = await soleActiveSuperAdminUserId(ctx);
  if (ownerId === null) throw new Error("seed runs need exactly one active super admin to own the seed rows");
  return ownerId;
}

/** The source, read back with every bound re-checked, for this slug. */
function storedSource(ideaSlug: string, sourceJson: string): SeedSource {
  const source = seedSourceFromJson(sourceJson);
  if (source.slug !== ideaSlug) throw new SeedSourceError(`the source is for ${source.slug}, not ${ideaSlug}`);
  return source;
}

/** The platform seed row for this idea and version, if one exists. */
async function platformSeedAt(
  ctx: Pick<QueryCtx, "db">,
  ideaSlug: string,
  seedVersion: string,
): Promise<Doc<"idea_crew_seeds"> | null> {
  const rows = await ctx.db
    .query("idea_crew_seeds")
    .withIndex("by_ideaSlug_and_seedVersion", (q) => q.eq("ideaSlug", ideaSlug).eq("seedVersion", seedVersion))
    .take(SEED_ROWS_READ_MAX);
  return rows.find((row) => row.projectId === undefined) ?? null;
}

/** Open runs (preparing or submitted) read per status; there is normally at most one per version. */
const OPEN_RUNS_READ_MAX = 100;

/**
 * Whether a run at this version is still preparing or submitted. Reads the
 * open statuses through `by_status`, not the version's history, so finished
 * runs at a long-lived version can never hide an open one (PR #280 review).
 */
async function hasOpenRunAt(ctx: Pick<QueryCtx, "db">, seedVersion: string): Promise<boolean> {
  for (const status of ["preparing", "submitted"] as const) {
    const open = await ctx.db
      .query("idea_seed_runs")
      .withIndex("by_status", (q) => q.eq("status", status))
      .take(OPEN_RUNS_READ_MAX);
    if (open.length >= OPEN_RUNS_READ_MAX) throw new Error(`${OPEN_RUNS_READ_MAX} or more seed runs are ${status}; finish or fail them first`);
    if (open.some((run) => run.seedVersion === seedVersion)) return true;
  }
  return false;
}

function assertSeedVersion(seedVersion: string): void {
  if (!SEED_VERSION.test(seedVersion)) throw new Error("seedVersion must be 1-40 of [0-9A-Za-z._-]");
}

async function requireRun(ctx: Pick<QueryCtx, "db">, runId: Id<"idea_seed_runs">): Promise<Doc<"idea_seed_runs">> {
  const run = await ctx.db.get("idea_seed_runs", runId);
  if (run === null) throw new Error("seed run not found");
  return run;
}

async function nextAttempt(ctx: Pick<QueryCtx, "db">, ideaSlug: string, seedVersion: string): Promise<number> {
  const earlier = await ctx.db
    .query("idea_seed_items")
    .withIndex("by_ideaSlug_and_seedVersion", (q) => q.eq("ideaSlug", ideaSlug).eq("seedVersion", seedVersion))
    .take(ATTEMPTS_READ_MAX);
  if (earlier.length >= ATTEMPTS_READ_MAX) throw new Error(`${ideaSlug} has ${ATTEMPTS_READ_MAX} attempts at ${seedVersion}; use a new seed version`);
  return earlier.reduce((max, item) => Math.max(max, item.attempt), 0) + 1;
}

// ---------------------------------------------------------------------------
// Dry run
// ---------------------------------------------------------------------------

const estimateRow = v.union(
  v.object({ ideaSlug: v.string(), status: v.literal("new"), reservedMicroUsd: v.number(), validated: v.boolean() }),
  v.object({ ideaSlug: v.string(), status: v.literal("unchanged") }),
  v.object({ ideaSlug: v.string(), status: v.literal("invalid"), reason: v.string() }),
);

/**
 * The dry run for a chunk of sources: per idea, whether it would be sent and
 * its worst-case reservation. Reads only; reserves and writes nothing.
 */
export const estimateItems = internalQuery({
  args: { seedVersion: v.string(), items: v.array(itemInput) },
  returns: v.array(estimateRow),
  handler: async (ctx, args) => {
    assertSeedVersion(args.seedVersion);
    if (args.items.length > SEED_ITEMS_PER_CALL) throw new Error(`at most ${SEED_ITEMS_PER_CALL} items per call`);
    const rows = [];
    for (const item of args.items) {
      let source: SeedSource;
      try {
        source = storedSource(item.ideaSlug, item.sourceJson);
      } catch (error) {
        rows.push({ ideaSlug: item.ideaSlug, status: "invalid" as const, reason: error instanceof SeedSourceError ? error.message : "invalid source" });
        continue;
      }
      const existing = await platformSeedAt(ctx, item.ideaSlug, args.seedVersion);
      if (existing !== null && existing.sourceHash === (await seedSourceHash(source))) {
        rows.push({ ideaSlug: item.ideaSlug, status: "unchanged" as const });
        continue;
      }
      const { reservedMicroUsd } = seedRequestFor(source);
      const validated = ideaIsValidated({ researchLevel: source.researchLevel, auditPassed: source.auditPassed });
      rows.push({ ideaSlug: item.ideaSlug, status: "new" as const, reservedMicroUsd, validated });
    }
    return rows;
  },
});

// ---------------------------------------------------------------------------
// Unattended runs (WP91)
// ---------------------------------------------------------------------------

/**
 * What an unattended run (`crew:seeds --auto`) needs before it may submit,
 * fed to `decideSeedAutoRun` (`lib/workspace/crew/seedAutoRun.ts`):
 * - `openRun`: a run at this version is still preparing or submitted, so its
 *   ideas have no seed row yet and would be sent twice;
 * - `providerLive`: `AI_PROVIDER_MODE=live` with an Anthropic key set (only
 *   whether one is set; the key never leaves the deployment);
 * - today's (UTC) free global pool: its budget and what is spent or in flight.
 * Reads only.
 */
export const autoRunState = internalQuery({
  args: { seedVersion: v.string() },
  returns: v.object({
    openRun: v.boolean(),
    providerLive: v.boolean(),
    freePoolBudgetMicroUsd: v.number(),
    freePoolUsedMicroUsd: v.number(),
  }),
  handler: async (ctx, args) => {
    assertSeedVersion(args.seedVersion);
    const openRun = await hasOpenRunAt(ctx, args.seedVersion);
    const env = {
      [AI_PROVIDER_MODE_ENV]: process.env[AI_PROVIDER_MODE_ENV],
    };
    const keySet = (process.env[PROVIDER_KEY_ENV.anthropic] ?? "").trim().length > 0;
    const settings = await getOpsSettings(ctx);
    const pool = await readGlobalBudget(ctx, "free", utcDayKey(Date.now()));
    return {
      openRun,
      providerLive: providerMode(env) === "live" && keySet,
      freePoolBudgetMicroUsd: int64ToMicroUsd(settings.globalDailyBudgetMicroUsd),
      freePoolUsedMicroUsd: pool.spentTodayMicroUsd + pool.inFlightMicroUsd,
    };
  },
});

// ---------------------------------------------------------------------------
// Preparing a run
// ---------------------------------------------------------------------------

export const createRun = internalMutation({
  args: { seedVersion: v.string() },
  returns: v.id("idea_seed_runs"),
  handler: async (ctx, args) => {
    assertSeedVersion(args.seedVersion);
    const ownerId = await soleSuperAdmin(ctx);
    if (await hasOpenRunAt(ctx, args.seedVersion)) {
      throw new Error(`a run at ${args.seedVersion} is still open; let it finish first`);
    }
    return await ctx.db.insert("idea_seed_runs", {
      ownerId,
      seedVersion: args.seedVersion,
      promptRef: SEED_PROMPT_REF,
      status: "preparing",
      itemCount: 0,
      submittedCount: 0,
      reservedMicroUsd: 0,
      polls: 0,
      createdAt: Date.now(),
    });
  },
});

export const addItems = internalMutation({
  args: { runId: v.id("idea_seed_runs"), items: v.array(itemInput) },
  returns: v.object({ added: v.number(), unchanged: v.number() }),
  handler: async (ctx, args) => {
    if (args.items.length > SEED_ITEMS_PER_CALL) throw new Error(`at most ${SEED_ITEMS_PER_CALL} items per call`);
    const run = await requireRun(ctx, args.runId);
    if (run.status !== "preparing") throw new Error("items can only be added while the run is preparing");
    if (run.itemCount + args.items.length > SEED_RUN_ITEMS_MAX) throw new Error(`a run takes at most ${SEED_RUN_ITEMS_MAX} items`);
    const now = Date.now();
    let added = 0;
    let unchanged = 0;
    const slugs = new Set<string>();
    for (const item of args.items) {
      if (slugs.has(item.ideaSlug)) throw new Error(`${item.ideaSlug} appears twice in one call`);
      slugs.add(item.ideaSlug);
      const source = storedSource(item.ideaSlug, item.sourceJson);
      seedRequestFor(source);
      const sourceHash = await seedSourceHash(source);
      const earlier = await ctx.db
        .query("idea_seed_items")
        .withIndex("by_ideaSlug_and_seedVersion", (q) => q.eq("ideaSlug", item.ideaSlug).eq("seedVersion", run.seedVersion))
        .take(ATTEMPTS_READ_MAX);
      if (earlier.some((row) => row.runId === args.runId)) throw new Error(`${item.ideaSlug} is already in this run`);
      const existing = await platformSeedAt(ctx, item.ideaSlug, run.seedVersion);
      const status = existing !== null && existing.sourceHash === sourceHash ? "skipped" : "pending";
      await ctx.db.insert("idea_seed_items", {
        ownerId: run.ownerId,
        runId: args.runId,
        ideaSlug: item.ideaSlug,
        seedVersion: run.seedVersion,
        sourceJson: item.sourceJson,
        sourceHash,
        attempt: await nextAttempt(ctx, item.ideaSlug, run.seedVersion),
        status,
        createdAt: now,
        updatedAt: now,
      });
      if (status === "pending") added += 1;
      else unchanged += 1;
    }
    await ctx.db.patch("idea_seed_runs", args.runId, { itemCount: run.itemCount + args.items.length });
    return { added, unchanged };
  },
});

// ---------------------------------------------------------------------------
// Submit bookkeeping (called by `seedsBatch:submitRun`)
// ---------------------------------------------------------------------------

const runForAction = v.object({
  runId: v.id("idea_seed_runs"),
  seedVersion: v.string(),
  status: v.string(),
  batchId: v.optional(v.string()),
  submittedAt: v.optional(v.number()),
  polls: v.number(),
});

export const runForBatch = internalQuery({
  args: { runId: v.id("idea_seed_runs") },
  returns: runForAction,
  handler: async (ctx, args) => {
    const run = await requireRun(ctx, args.runId);
    return {
      runId: run._id,
      seedVersion: run.seedVersion,
      status: run.status,
      ...(run.batchId === undefined ? {} : { batchId: run.batchId }),
      ...(run.submittedAt === undefined ? {} : { submittedAt: run.submittedAt }),
      polls: run.polls,
    };
  },
});

const itemForAction = v.object({
  itemId: v.id("idea_seed_items"),
  ideaSlug: v.string(),
  attempt: v.number(),
  sourceJson: v.string(),
  usageId: v.optional(v.id("ai_usage")),
});

function itemView(item: Doc<"idea_seed_items">) {
  return {
    itemId: item._id,
    ideaSlug: item.ideaSlug,
    attempt: item.attempt,
    sourceJson: item.sourceJson,
    ...(item.usageId === undefined ? {} : { usageId: item.usageId }),
  };
}

/** One page of a run's items in a status, with their sources. */
export const itemsPage = internalQuery({
  args: {
    runId: v.id("idea_seed_runs"),
    status: v.union(v.literal("pending"), v.literal("sent")),
    cursor: v.union(v.string(), v.null()),
  },
  returns: v.object({ items: v.array(itemForAction), isDone: v.boolean(), continueCursor: v.string() }),
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("idea_seed_items")
      .withIndex("by_runId_and_status", (q) => q.eq("runId", args.runId).eq("status", args.status))
      .paginate({ numItems: SEED_SENT_PAGE, cursor: args.cursor });
    return { items: page.page.map(itemView), isDone: page.isDone, continueCursor: page.continueCursor };
  },
});

/** Stores the reservations made, and marks the items the meter refused (budget) as not reserved. */
export const recordReservations = internalMutation({
  args: {
    runId: v.id("idea_seed_runs"),
    reserved: v.array(v.object({ itemId: v.id("idea_seed_items"), usageId: v.id("ai_usage"), reservedMicroUsd: v.number() })),
    notReserved: v.array(v.object({ itemId: v.id("idea_seed_items"), reason: v.string() })),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await requireRun(ctx, args.runId);
    if (run.status !== "preparing") throw new Error("reservations belong to a preparing run");
    const now = Date.now();
    let total = run.reservedMicroUsd;
    for (const entry of args.reserved) {
      const item = await ctx.db.get("idea_seed_items", entry.itemId);
      if (item === null || item.runId !== args.runId || item.status !== "pending") throw new Error("not a pending item of this run");
      await ctx.db.patch("idea_seed_items", entry.itemId, { usageId: entry.usageId, reservedMicroUsd: entry.reservedMicroUsd, updatedAt: now });
      total += entry.reservedMicroUsd;
    }
    for (const entry of args.notReserved) {
      const item = await ctx.db.get("idea_seed_items", entry.itemId);
      if (item === null || item.runId !== args.runId || item.status !== "pending") throw new Error("not a pending item of this run");
      await ctx.db.patch("idea_seed_items", entry.itemId, { status: "not_reserved", errorKind: entry.reason, updatedAt: now });
    }
    await ctx.db.patch("idea_seed_runs", args.runId, { reservedMicroUsd: total });
    return null;
  },
});

/** The batch is in: the reserved items are sent and the run waits for results. */
export const recordSubmitted = internalMutation({
  args: {
    runId: v.id("idea_seed_runs"),
    batchId: v.string(),
    mode: v.union(v.literal("fixture"), v.literal("live")),
    itemIds: v.array(v.id("idea_seed_items")),
    note: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await requireRun(ctx, args.runId);
    if (run.status !== "preparing") throw new Error("only a preparing run can be submitted");
    const now = Date.now();
    for (const itemId of args.itemIds) {
      const item = await ctx.db.get("idea_seed_items", itemId);
      if (item === null || item.runId !== args.runId || item.usageId === undefined) throw new Error("not a reserved item of this run");
      await ctx.db.patch("idea_seed_items", itemId, { status: "sent", updatedAt: now });
    }
    await ctx.db.patch("idea_seed_runs", args.runId, {
      status: "submitted",
      batchId: args.batchId,
      mode: args.mode,
      submittedCount: args.itemIds.length,
      submittedAt: now,
      ...(args.note === undefined ? {} : { note: args.note }),
    });
    return null;
  },
});

/** Nothing could be sent (no reservation passed, or the batch create failed): the run is over. */
export const recordRunFailed = internalMutation({
  args: {
    runId: v.id("idea_seed_runs"),
    itemIds: v.array(v.id("idea_seed_items")),
    errorKind: v.string(),
    note: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await requireRun(ctx, args.runId);
    if (run.status !== "preparing") throw new Error("only a preparing run can fail at submit");
    const now = Date.now();
    for (const itemId of args.itemIds) {
      const item = await ctx.db.get("idea_seed_items", itemId);
      if (item === null || item.runId !== args.runId) throw new Error("not an item of this run");
      await ctx.db.patch("idea_seed_items", itemId, { status: "failed", errorKind: args.errorKind, updatedAt: now });
    }
    await ctx.db.patch("idea_seed_runs", args.runId, { status: "failed", note: args.note, collectedAt: now });
    return null;
  },
});

// ---------------------------------------------------------------------------
// Results (called by `seedsBatch:pollRun`)
// ---------------------------------------------------------------------------

export const markPolled = internalMutation({
  args: { runId: v.id("idea_seed_runs") },
  returns: v.number(),
  handler: async (ctx, args) => {
    const run = await requireRun(ctx, args.runId);
    const polls = run.polls + 1;
    await ctx.db.patch("idea_seed_runs", args.runId, { polls });
    return polls;
  },
});

const resultInput = v.union(
  v.object({ kind: v.literal("succeeded"), replyText: v.string(), costMicroUsd: v.number() }),
  v.object({ kind: v.literal("failed"), errorKind: v.string(), costMicroUsd: v.optional(v.number()) }),
);

/** The largest reply the audit reads: the seed's bounds keep a valid draft far below this. */
export const SEED_REPLY_MAX_CHARS = 120_000;

/**
 * One result. A succeeded reply is parsed and audited here against the
 * item's stored source; only a passing seed is written. Idempotent: an item
 * that is no longer `sent` is left as it is.
 */
export const recordResult = internalMutation({
  args: { itemId: v.id("idea_seed_items"), result: resultInput },
  returns: v.union(v.literal("written"), v.literal("audit_failed"), v.literal("failed"), v.literal("unchanged")),
  handler: async (ctx, args) => {
    const item = await ctx.db.get("idea_seed_items", args.itemId);
    if (item === null) throw new Error("seed item not found");
    if (item.status !== "sent") return "unchanged" as const;
    const run = await requireRun(ctx, item.runId);
    const now = Date.now();
    if (args.result.kind === "failed") {
      await ctx.db.patch("idea_seed_items", item._id, {
        status: "failed",
        errorKind: args.result.errorKind,
        ...(args.result.costMicroUsd === undefined ? {} : { costMicroUsd: args.result.costMicroUsd }),
        updatedAt: now,
      });
      return "failed" as const;
    }
    const auditFailed = async (issues: { code: string; path: string }[]) => {
      await ctx.db.patch("idea_seed_items", item._id, { status: "audit_failed", issues, costMicroUsd: args.result.costMicroUsd, updatedAt: now });
      return "audit_failed" as const;
    };
    if (args.result.replyText.length > SEED_REPLY_MAX_CHARS) return await auditFailed([{ code: "schema", path: "(reply too long)" }]);
    let candidate: unknown;
    try {
      candidate = JSON.parse(args.result.replyText);
    } catch {
      return await auditFailed([{ code: "schema", path: "(not JSON)" }]);
    }
    const source = storedSource(item.ideaSlug, item.sourceJson);
    const audit = auditSeedDraft(candidate, source);
    if (!audit.ok) return await auditFailed(audit.issues.slice(0, 20).map((issue) => ({ code: issue.code, path: issue.path })));
    const seedId = await writeSeed(ctx, {
      ownerId: run.ownerId,
      runId: run._id,
      ideaSlug: item.ideaSlug,
      seedVersion: item.seedVersion,
      sourceHash: item.sourceHash,
      columns: seedColumns(audit.seed),
      now,
    });
    await ctx.db.patch("idea_seed_items", item._id, { status: "written", seedId, costMicroUsd: args.result.costMicroUsd, updatedAt: now });
    return "written" as const;
  },
});

/** Inserts the platform seed row for this idea and version, or replaces it. */
async function writeSeed(
  ctx: MutationCtx,
  args: {
    readonly ownerId: Id<"users">;
    readonly runId: Id<"idea_seed_runs">;
    readonly ideaSlug: string;
    readonly seedVersion: string;
    readonly sourceHash: string;
    readonly columns: ReturnType<typeof seedColumns>;
    readonly now: number;
  },
): Promise<Id<"idea_crew_seeds">> {
  const fields = {
    ownerId: args.ownerId,
    ideaSlug: args.ideaSlug,
    seedVersion: args.seedVersion,
    ...args.columns,
    sourceHash: args.sourceHash,
    runId: args.runId,
    promptRefs: [SEED_PROMPT_REF],
    createdAt: args.now,
  };
  const existing = await platformSeedAt(ctx, args.ideaSlug, args.seedVersion);
  if (existing === null) return await ctx.db.insert("idea_crew_seeds", fields);
  await ctx.db.replace("idea_crew_seeds", existing._id, fields);
  return existing._id;
}

/** Every sent item has a result (or the poll gave up): the run is over. */
export const finishRun = internalMutation({
  args: { runId: v.id("idea_seed_runs"), note: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await requireRun(ctx, args.runId);
    if (run.status !== "submitted") return null;
    await ctx.db.patch("idea_seed_runs", args.runId, {
      status: "collected",
      collectedAt: Date.now(),
      ...(args.note === undefined ? {} : { note: run.note === undefined ? args.note : `${run.note} ${args.note}` }),
    });
    return null;
  },
});

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

const ITEM_STATUSES = ["pending", "skipped", "not_reserved", "sent", "written", "audit_failed", "failed"] as const;
/** Items counted per status in a summary (a run holds at most `SEED_RUN_ITEMS_MAX`). */
const SUMMARY_READ_MAX = SEED_RUN_ITEMS_MAX;

/** A run's status for the operator: counts per item status, spend, and the audit findings by code. */
export const runSummary = internalQuery({
  args: { runId: v.id("idea_seed_runs") },
  returns: v.object({
    seedVersion: v.string(),
    status: v.string(),
    mode: v.optional(v.string()),
    batchId: v.optional(v.string()),
    note: v.optional(v.string()),
    polls: v.number(),
    reservedMicroUsd: v.number(),
    costMicroUsd: v.number(),
    counts: v.record(v.string(), v.number()),
    auditFindings: v.array(v.object({ ideaSlug: v.string(), code: v.string(), path: v.string() })),
    failures: v.array(v.object({ ideaSlug: v.string(), status: v.string(), errorKind: v.string() })),
  }),
  handler: async (ctx, args) => {
    const run = await requireRun(ctx, args.runId);
    const counts: Record<string, number> = {};
    let costMicroUsd = 0;
    const auditFindings: { ideaSlug: string; code: string; path: string }[] = [];
    const failures: { ideaSlug: string; status: string; errorKind: string }[] = [];
    for (const status of ITEM_STATUSES) {
      const items = await ctx.db
        .query("idea_seed_items")
        .withIndex("by_runId_and_status", (q) => q.eq("runId", args.runId).eq("status", status))
        .take(SUMMARY_READ_MAX);
      counts[status] = items.length;
      for (const item of items) {
        costMicroUsd += item.costMicroUsd ?? 0;
        for (const issue of item.issues ?? []) {
          if (auditFindings.length < 100) auditFindings.push({ ideaSlug: item.ideaSlug, code: issue.code, path: issue.path });
        }
        if ((status === "failed" || status === "not_reserved") && failures.length < 100) {
          failures.push({ ideaSlug: item.ideaSlug, status, errorKind: item.errorKind ?? "unknown" });
        }
      }
    }
    return {
      seedVersion: run.seedVersion,
      status: run.status,
      ...(run.mode === undefined ? {} : { mode: run.mode }),
      ...(run.batchId === undefined ? {} : { batchId: run.batchId }),
      ...(run.note === undefined ? {} : { note: run.note }),
      polls: run.polls,
      reservedMicroUsd: run.reservedMicroUsd,
      costMicroUsd,
      counts,
      auditFindings,
      failures,
    };
  },
});
