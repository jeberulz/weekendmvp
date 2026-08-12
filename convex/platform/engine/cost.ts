import { ConvexError, v } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  type QueryCtx,
} from "../../_generated/server";
import type { StepBudget } from "./pipeline";
import { stepAt } from "./pipeline";
import {
  estimateKeywordUsd,
  estimateSearchUsd,
  estimateSynthesisUsd,
  REPORT_COST_CAP_USD,
} from "./providers/pricing";

/**
 * WP26-S4. The $4.00 per-report cap, enforced by pre-call reservation.
 *
 * **Why micro-USD integers.** Spend is accumulated in whole millionths of a
 * dollar, never in floats. Summing a dozen binary floats and comparing the
 * result against a boundary is exactly where a run lands at `4.0000000000001`
 * and a cap either leaks or fires spuriously. Every conversion from a float
 * estimate rounds **up**, so the reservation is never optimistic.
 */

export const CAP_MICRO_USD = Math.round(REPORT_COST_CAP_USD * 1_000_000);

/**
 * What one Validation Report costs the customer.
 *
 * Sourced from the plan's pricing table (§6.3, "Validation Report — additional
 * own ideas | ~15 credits"). **The plan writes it with a `~`, so this is a
 * product number that has not been frozen by an owner ruling** — recorded in
 * `docs/wp/wp26-progress.md` as needing one before activation. It is a
 * server-side constant precisely so no caller can ever supply the amount.
 */
export const VALIDATION_REPORT_CREDITS = 15n;

/** Rounds up: an under-stated cost is the only rounding error that can overspend. */
export function toMicroUsd(usd: number): number {
  if (!Number.isFinite(usd) || usd < 0) {
    throw new Error(`cost must be a non-negative finite number, got ${usd}`);
  }
  return Math.ceil(usd * 1_000_000);
}

export function fromMicroUsd(microUsd: number): number {
  return microUsd / 1_000_000;
}

/**
 * The most one attempt at this step can cost.
 *
 * Computed from the step's declared budget rather than from the request about
 * to be sent, so the reservation is knowable *before* the call — which is the
 * whole point of a pre-call check. The step is then obliged to stay inside the
 * budget it was reserved against.
 */
export function worstCaseMicroUsd(budget: StepBudget): number {
  switch (budget.role) {
    case "synthesis":
      return toMicroUsd(
        estimateSynthesisUsd({
          inputTokens: budget.maxInputTokens,
          // Worst case bills every input token at the uncached rate; assuming
          // a cache hit would reserve less than the call can actually cost.
          cachedInputTokens: 0,
          outputTokens: budget.maxOutputTokens,
        }),
      );
    case "search":
      return toMicroUsd(
        estimateSearchUsd({
          inputTokens: budget.maxInputTokens,
          outputTokens: budget.maxOutputTokens,
          requests: budget.requests,
          searchContextSize: budget.searchContextSize,
        }),
      );
    case "keywordData":
      return toMicroUsd(
        estimateKeywordUsd({ tasks: budget.tasks, items: budget.maxItems }),
      );
    case null:
      return 0;
  }
}

export class CostCapExceededError extends Error {
  readonly code = "COST_CAP_EXCEEDED" as const;

  constructor(
    readonly spentMicroUsd: number,
    readonly worstCaseMicroUsd: number,
  ) {
    super(
      `reservation of ${worstCaseMicroUsd}µ$ on top of ${spentMicroUsd}µ$ spent would exceed the ${CAP_MICRO_USD}µ$ cap`,
    );
    this.name = "CostCapExceededError";
  }
}

/**
 * The reservation decision.
 *
 * Compares `already-spent + this call's worst case` against the cap, **not** the
 * running total on its own. A post-hoc check on actual spend lets a run sit at
 * $3.90 and still issue a call that lands at $4.90; this is the check that
 * refuses that call before it is made.
 */
export function assertWithinCap(args: {
  spentMicroUsd: number;
  worstCaseMicroUsd: number;
}): void {
  if (args.spentMicroUsd + args.worstCaseMicroUsd > CAP_MICRO_USD) {
    throw new CostCapExceededError(args.spentMicroUsd, args.worstCaseMicroUsd);
  }
}

// ---------------------------------------------------------------------------
// Durable spend accounting
// ---------------------------------------------------------------------------

/**
 * Cost telemetry lives in `audit_events`.
 *
 * The frozen schema has no cost column anywhere, and `audit_events` is the one
 * append-only table built for "a system or provider did something worth
 * recording". Modelling spend as an append-only event is also what makes the
 * running total survive a crash: a resumed run re-reads what it already spent
 * instead of restarting its budget at zero and buying a second $4.00 of calls.
 *
 * Every field written here is a number or a fixed enum. There is no free-text
 * field, so no customer input can reach a cost row by construction.
 */
export const PROVIDER_COST_ACTION = "engine.provider_call";

/** Fails closed rather than under-counting if a run ever exceeds this. */
const MAX_COST_EVENTS_PER_RUN = 512;

type CostMetadata = {
  readonly position: number;
  readonly attempt: number;
  readonly reservedMicroUsd: number;
  readonly billedMicroUsd: number;
};

function parseCostMetadata(raw: string | undefined): CostMetadata | null {
  if (raw === undefined) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const billed = (parsed as { billedMicroUsd?: unknown }).billedMicroUsd;
  if (typeof billed !== "number" || !Number.isFinite(billed) || billed < 0) {
    return null;
  }
  const record = parsed as Record<string, number>;
  return {
    position: record.position ?? -1,
    attempt: record.attempt ?? 0,
    reservedMicroUsd: record.reservedMicroUsd ?? 0,
    billedMicroUsd: billed,
  };
}

async function readSpentMicroUsd(
  ctx: QueryCtx,
  taskId: Id<"tasks">,
): Promise<number> {
  const task = await ctx.db.get("tasks", taskId);
  if (!task) throw new ConvexError({ code: "RESOURCE_NOT_FOUND" });

  const events = await ctx.db
    .query("audit_events")
    .withIndex("by_projectId_and_createdAt", (query) =>
      query.eq("projectId", task.projectId).gte("createdAt", task.createdAt),
    )
    .take(MAX_COST_EVENTS_PER_RUN);

  // Hitting the ceiling would silently under-count spend and let the cap leak,
  // so it fails the reservation instead of returning a partial sum.
  if (events.length === MAX_COST_EVENTS_PER_RUN) {
    throw new ConvexError({ code: "COST_EVENT_SCAN_OVERFLOW" });
  }

  let total = 0;
  for (const event of events) {
    if (event.action !== PROVIDER_COST_ACTION) continue;
    if (event.subjectId !== taskId) continue;
    const metadata = parseCostMetadata(event.metadata);
    // An unreadable cost row must not silently count as $0 — that is spend we
    // know happened and can no longer measure.
    if (metadata === null) throw new ConvexError({ code: "COST_ROW_UNREADABLE" });
    total += metadata.billedMicroUsd;
  }
  return total;
}

export const spentMicroUsd = internalQuery({
  args: { taskId: v.id("tasks") },
  returns: v.number(),
  handler: async (ctx, args) => await readSpentMicroUsd(ctx, args.taskId),
});

/**
 * The pre-call reservation check.
 *
 * A query rather than a mutation because a run's steps execute strictly
 * sequentially (see `workflow.ts`), so there is no second call racing this one
 * between the check and the spend. **If steps are ever parallelised, this must
 * become a mutation that writes a reservation row**, or two concurrent steps
 * will both read the same pre-spend total and both pass.
 */
export const assertReservation = internalQuery({
  args: { taskId: v.id("tasks"), position: v.int64() },
  returns: v.object({
    spentMicroUsd: v.number(),
    reservedMicroUsd: v.number(),
  }),
  handler: async (ctx, args) => {
    const step = stepAt(Number(args.position));
    const reserved = worstCaseMicroUsd(step.budget);
    const spent = await readSpentMicroUsd(ctx, args.taskId);
    assertWithinCap({ spentMicroUsd: spent, worstCaseMicroUsd: reserved });
    return { spentMicroUsd: spent, reservedMicroUsd: reserved };
  },
});

/**
 * Records what a settled attempt actually cost.
 *
 * Idempotent on `(taskId, position, attempt)`: a redelivered settle must not
 * double-count spend, which would push a healthy run into a false cap breach.
 */
export const recordProviderCost = internalMutation({
  args: {
    taskId: v.id("tasks"),
    position: v.int64(),
    attempt: v.number(),
    reservedMicroUsd: v.number(),
    billedMicroUsd: v.number(),
  },
  returns: v.object({ recorded: v.boolean() }),
  handler: async (ctx, args) => {
    const task = await ctx.db.get("tasks", args.taskId);
    if (!task) throw new ConvexError({ code: "RESOURCE_NOT_FOUND" });
    if (args.billedMicroUsd < 0 || !Number.isFinite(args.billedMicroUsd)) {
      throw new ConvexError({ code: "INVALID_COST" });
    }

    const existing = await ctx.db
      .query("audit_events")
      .withIndex("by_projectId_and_createdAt", (query) =>
        query.eq("projectId", task.projectId).gte("createdAt", task.createdAt),
      )
      .take(MAX_COST_EVENTS_PER_RUN);
    const duplicate = existing.some((event) => {
      if (event.action !== PROVIDER_COST_ACTION) return false;
      if (event.subjectId !== args.taskId) return false;
      const metadata = parseCostMetadata(event.metadata);
      return (
        metadata !== null &&
        metadata.position === Number(args.position) &&
        metadata.attempt === args.attempt
      );
    });
    if (duplicate) return { recorded: false };

    const metadata: CostMetadata = {
      position: Number(args.position),
      attempt: args.attempt,
      reservedMicroUsd: args.reservedMicroUsd,
      billedMicroUsd: args.billedMicroUsd,
    };
    await ctx.db.insert("audit_events", {
      ownerId: task.ownerId,
      projectId: task.projectId,
      actorType: "provider",
      action: PROVIDER_COST_ACTION,
      subjectType: "task",
      subjectId: args.taskId,
      metadata: JSON.stringify(metadata),
      createdAt: Date.now(),
    });
    return { recorded: true };
  },
});
