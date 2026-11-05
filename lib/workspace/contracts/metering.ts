/**
 * C-METER — the AI spend meter's contract (WP69-S2).
 *
 * Claude defines it here; Codex implements it in WP70 as internal mutations in
 * `convex/ai/metering.ts` (`reserve`, `markSent`, `settle`, `fail`, plus the
 * sweep cron), and the WP71 gateway calls them around every provider call.
 * Sources: `02-architecture.md` §4.2 (`ai_usage`, `ai_budgets`, `ops_settings`)
 * and §5.1; `03-ai-cost-model.md` §9; ruling D3.
 *
 * Lifecycle of one provider call (one `ai_usage` row, never deleted):
 * 1. `reserve` — budget checks, then insert `{ status: "reserved" }`. Nothing
 *    has been sent. A duplicate `attemptKey` returns the existing `usageId`.
 * 2. `markSent` — immediately before the request leaves (for a batch, when the
 *    batch is submitted). From here the provider may bill.
 * 3. `settle` (actual usage) or `fail` (error) — the row becomes final.
 * 4. The sweep (Codex, WP70) finalises rows still `reserved` after `expiresAt`:
 *    with `sentAt` set it fails them `billed: "possible"` (charged the
 *    reservation, never zero); without `sentAt` it fails them `billed: "none"`
 *    (nothing went out, charged 0). See `sweepOutcome`.
 * 5. A settle that arrives after the sweep records `lateCostMicroUsd` and adds
 *    `max(0, actual − charged)` to the totals (`lateSettleAdjustment`).
 *
 * Batch requests (Message Batches; `deep` tier only): each request's
 * `custom_id` is its `usageId`, so results — which arrive in any order — settle
 * by `usageId`. Batch rows expire after `BATCH_RESERVATION_SWEEP_AFTER_MS`.
 *
 * Concurrency (decision (a)): the per-owner checks are exact — they read and
 * write one `ai_budgets` document, so Convex OCC serialises them, and WP70's
 * "parallel reservations never exceed the ceiling" test applies to the owner
 * ceilings. The global check is soft: it reads the sharded counter's total of
 * today's spend plus in-flight reservations (reservations MUST be counted) and
 * may overshoot by at most in-flight concurrency × the largest reservation
 * (`globalOvershootBoundMicroUsd`).
 *
 * Trust: the implementation derives the owner's plan itself (Codex's
 * `deriveMembership`), never from the caller, and verifies `creditDebitId`
 * (the task's debit ledger entry belongs to the same owner and task) before
 * treating a call as credit-funded.
 *
 * Tests and CI never call a provider; everything in this file is pure. Ids are
 * plain `string` so this file stays free of Convex imports; Codex maps them to
 * `Id<"users">`, `Id<"projects">`, `Id<"tasks">`, `Id<"credit_ledger">` and
 * `Id<"ai_usage">` in the validators. Money is integer micro-USD
 * (1 USD = 1_000_000), rounded up.
 *
 * Micro-USD storage: every amount in this contract is a safe-integer `number`
 * in application code. The Convex schema (C-DATA, WP68) stores micro-USD and
 * token counts as `v.int64()` (a `bigint`). The implementation converts at the
 * storage boundary only — `microUsdToInt64` on write, `int64ToMicroUsd` on
 * read — and never does arithmetic on `bigint`. Both throw rather than round or
 * wrap, so a value outside 0..`Number.MAX_SAFE_INTEGER` is a loud error.
 *
 * Gate errors: before `reserve`, the gateway's own checks may throw C-OPS
 * `assertFeatureEnabled` and C-AUTHZ `requireBusinessAccess` errors
 * (`WORKSPACE_GATE_ERROR_CODES`, shape `WorkspaceGateErrorData`). The gateway
 * maps them alongside `METER_ERROR_CODES` (`GatewayErrorCode`,
 * `isGatewayErrorData`). Nothing was sent, so a gate error refunds the task's
 * credits like any other pre-call failure (`REFUNDS_CREDITS`).
 */

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

export const MICRO_USD_PER_USD = 1_000_000;

/**
 * USD → integer micro-USD, rounded up. Mirrors `toMicroUsd` in
 * `lib/engine/cost.ts` (kept as a copy so Convex code importing this contract
 * does not pull in the engine's provider modules).
 */
export function toMicroUsd(usd: number): number {
  if (!Number.isFinite(usd) || usd < 0) {
    throw new Error(`cost must be a non-negative finite number, got ${usd}`);
  }
  return Math.ceil(usd * MICRO_USD_PER_USD);
}

export function isMicroUsd(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

/**
 * Application micro-USD → the `v.int64()` storage value. Throws unless `n` is a
 * safe non-negative integer (no rounding: round with `toMicroUsd` first).
 */
export function microUsdToInt64(n: number): bigint {
  if (!isMicroUsd(n)) {
    throw new RangeError(`micro-USD must be a safe non-negative integer, got ${String(n)}`);
  }
  return BigInt(n);
}

/**
 * The `v.int64()` storage value → application micro-USD. Throws below 0 or
 * above `Number.MAX_SAFE_INTEGER`, where a `number` would lose precision.
 */
export function int64ToMicroUsd(b: bigint): number {
  if (typeof b !== "bigint") {
    throw new TypeError(`int64 micro-USD must be a bigint, got ${typeof b}`);
  }
  if (b < BigInt(0) || b > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError(`int64 micro-USD must be within 0..${Number.MAX_SAFE_INTEGER}, got ${b.toString()}`);
  }
  return Number(b);
}

/**
 * Rounds a non-negative micro-USD amount up to an integer, ignoring float noise
 * below a thousandth of a micro-dollar (so 0.1 × 1000 is 100, not 101).
 */
function ceilMicroUsd(amount: number): number {
  return Math.ceil(Math.round(amount * 1_000) / 1_000);
}

function assertCount(name: string, value: unknown): asserts value is number {
  if (!isMicroUsd(value)) {
    throw new RangeError(`${name} must be a safe non-negative integer, got ${String(value)}`);
  }
}

// ---------------------------------------------------------------------------
// Unions (defined locally so this file stays independent of C-PROMPT / C-JOBS)
// ---------------------------------------------------------------------------

export const METER_PLANS = ["free", "builders_hub", "growth"] as const;
export type MeterPlan = (typeof METER_PLANS)[number];

export const METER_PROVIDERS = ["anthropic", "openai_images", "recraft", "video"] as const;
export type MeterProvider = (typeof METER_PROVIDERS)[number];

/** The prompt tiers (`fast`, `draft`, `deep`) plus the two media lanes. */
export const METER_TIERS = ["fast", "draft", "deep", "image", "video"] as const;
export type MeterTier = (typeof METER_TIERS)[number];
export type MeterModelTier = Extract<MeterTier, "fast" | "draft" | "deep">;

/** Which kill switch gates the call. `studioVideo` calls are also gated by `ai`. */
export const METER_FEATURES = ["ai", "studioVideo"] as const;
export type MeterFeature = (typeof METER_FEATURES)[number];

export const AI_USAGE_STATUSES = ["reserved", "settled", "failed"] as const;
export type AiUsageStatus = (typeof AI_USAGE_STATUSES)[number];
export type AiUsageFinalStatus = Exclude<AiUsageStatus, "reserved">;

/** Whether the provider may have billed a failed call. */
export const BILLED_STATES = ["none", "possible", "actual"] as const;
export type BilledState = (typeof BILLED_STATES)[number];

/** The WP26 executor's failure classes, plus refusals, schema failures and timeouts. */
export const METER_ERROR_CLASSES = [
  "retryable",
  "indeterminate",
  "permanent",
  "refusal",
  "schema_invalid",
  "timeout",
] as const;
export type MeterErrorClass = (typeof METER_ERROR_CLASSES)[number];

/**
 * Two global daily budgets. `paid`: credit-funded work and all work for
 * paid-plan owners. `free`: Free owners' non-credit work, and ownerless calls
 * (per-idea precompute, evals).
 */
export const GLOBAL_POOLS = ["free", "paid"] as const;
export type GlobalPool = (typeof GLOBAL_POOLS)[number];

function inList<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (list as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Budgets and limits (D3; `03` §9)
// ---------------------------------------------------------------------------

/** Default `ops_settings.globalDailyBudgetMicroUsd` (the free pool) during the beta: $50 a day. */
export const FREE_GLOBAL_DAILY_BUDGET_DEFAULT_MICRO_USD = 50_000_000;

/**
 * Default paid-pool budget (new `ops_settings.paidGlobalDailyBudgetMicroUsd`):
 * $50 a day. Provisional — the owner has not set it (`03` §9 names "a separate
 * paid budget" without a figure).
 */
export const PAID_GLOBAL_DAILY_BUDGET_DEFAULT_MICRO_USD = 50_000_000;

/** Free owner's lifetime AI ceiling: $1.50, not counting credit-funded work (D3). */
export const FREE_LIFETIME_CEILING_MICRO_USD = 1_500_000;

/** Free owner's daily cap: $1.00, so a whole launch fits in one evening. */
export const FREE_OWNER_DAILY_CAP_MICRO_USD = 1_000_000;

/** Paid owner's default daily cap: $5.00. A super admin can raise one owner. */
export const PAID_OWNER_DAILY_CAP_MICRO_USD = 5_000_000;

export const OWNER_DAILY_CAP_MICRO_USD = {
  free: FREE_OWNER_DAILY_CAP_MICRO_USD,
  builders_hub: PAID_OWNER_DAILY_CAP_MICRO_USD,
  growth: PAID_OWNER_DAILY_CAP_MICRO_USD,
} as const satisfies Record<MeterPlan, number>;

/**
 * Largest single reservation the meter accepts: $2. Covers a 30 s launch film
 * on the cheapest video tier ($1.50) and any model call within the token caps.
 * Provisional until the spike (WP69-S4) measures media costs.
 */
export const MAX_RESERVATION_MICRO_USD = 2_000_000;

/** `deep` escalations one owner may reserve per UTC day. Provisional. */
export const DEEP_ESCALATIONS_PER_OWNER_PER_DAY = 3;

/**
 * Input-token ceilings a model reservation may assume, by lane. Mirrors C-PROMPT
 * `TIER_MAX_INPUT_TOKENS` (a test keeps them equal).
 */
export const METER_MAX_INPUT_TOKENS = {
  fast: 40_000,
  draft: 60_000,
  deep_realtime: 60_000,
  deep_batch: 120_000,
} as const;

export function meterMaxInputTokens(tier: MeterModelTier, batch: boolean): number {
  if (tier === "deep") return batch ? METER_MAX_INPUT_TOKENS.deep_batch : METER_MAX_INPUT_TOKENS.deep_realtime;
  return METER_MAX_INPUT_TOKENS[tier];
}

/** Alarm thresholds (`03` §9). */
export const METER_ALARMS = {
  /** Alert at 80% and 100% of each global daily budget. */
  globalDailyBudgetPercents: [80, 100],
  /** Any owner past $3 in one UTC day. */
  ownerDailyMicroUsd: 3_000_000,
  /** Median launch cost over $0.75 across the last 50 launches. */
  medianLaunchMicroUsd: 750_000,
  medianLaunchWindow: 50,
  /** Cache hit rate under 50% on any prompt with more than 100 calls a day. */
  minCacheHitPercent: 50,
  cacheHitMinCallsPerDay: 100,
  /** Refusal or schema-failure rate over 5%. */
  maxRefusalOrSchemaFailurePercent: 5,
} as const;

/** Realtime rows still `reserved` this long after creation are swept. */
export const RESERVATION_SWEEP_AFTER_MS = 15 * 60 * 1_000;

/** Batch rows are swept after 25 hours (Message Batches can take up to 24). */
export const BATCH_RESERVATION_SWEEP_AFTER_MS = 25 * 60 * 60 * 1_000;

/** The `expiresAt` to store on a new row. */
export function reservationExpiresAt(createdAt: number, batch: boolean): number {
  assertCount("createdAt", createdAt);
  return createdAt + (batch ? BATCH_RESERVATION_SWEEP_AFTER_MS : RESERVATION_SWEEP_AFTER_MS);
}

/** The UTC date, `YYYY-MM-DD`: `ai_budgets.dayKey`, `ai_usage.dayKey` and the global counter's day. */
export function utcDayKey(epochMs: number): string {
  if (!Number.isFinite(epochMs)) throw new RangeError(`epochMs must be finite, got ${epochMs}`);
  return new Date(epochMs).toISOString().slice(0, 10);
}

/** Which global pool a call counts against. `plan` is undefined for ownerless calls. */
export function globalPoolFor(args: { readonly plan: MeterPlan | undefined; readonly creditFunded: boolean }): GlobalPool {
  if (args.creditFunded) return "paid";
  return args.plan === undefined || args.plan === "free" ? "free" : "paid";
}

/**
 * The most the soft global check can overshoot a pool's budget: every in-flight
 * check passing at once with the largest reservation. For the ops console.
 */
export function globalOvershootBoundMicroUsd(args: {
  readonly maxInFlightReservations: number;
  readonly largestReservationMicroUsd?: number;
}): number {
  assertCount("maxInFlightReservations", args.maxInFlightReservations);
  const largest = args.largestReservationMicroUsd ?? MAX_RESERVATION_MICRO_USD;
  assertCount("largestReservationMicroUsd", largest);
  return args.maxInFlightReservations * largest;
}

// ---------------------------------------------------------------------------
// Attempt keys (idempotency of `reserve`)
// ---------------------------------------------------------------------------

/**
 * One provider call attempt. A duplicate `reserve` with the same key returns
 * the existing `usageId` (index `by_attemptKey`). A re-ask after a schema
 * failure is a new attempt (`attempt + 1`, `reask: true`). Forms:
 * - crew and Studio jobs: `{jobKey}:{attempt}` (`jobAttemptKey`);
 * - Wren chat: `chat:{projectId}:{chatMessageId}:{attempt}` (`chatAttemptKey`);
 * - ownerless work: `precompute:{ideaSlug}:{seedVersion}:{promptRef}:{attempt}`
 *   and `eval:{runId}:{caseId}:{attempt}`.
 * `attempt` starts at 1 and counts across every task that has held the job key.
 */
export function jobAttemptKey(jobKey: string, attempt: number): string {
  if (typeof jobKey !== "string" || !jobKey.startsWith("crew:")) {
    throw new RangeError("jobKey must be a C-JOBS job key");
  }
  return `${jobKey}:${positiveAttempt(attempt)}`;
}

export function chatAttemptKey(projectId: string, chatMessageId: string, attempt: number): string {
  for (const [name, part] of [["projectId", projectId], ["chatMessageId", chatMessageId]] as const) {
    if (typeof part !== "string" || part.length === 0 || part.includes(":")) {
      throw new RangeError(`${name} must be a non-empty string without ':'`);
    }
  }
  return `chat:${projectId}:${chatMessageId}:${positiveAttempt(attempt)}`;
}

function positiveAttempt(attempt: number): number {
  if (!Number.isSafeInteger(attempt) || attempt < 1) {
    throw new RangeError(`attempt must be a positive integer, got ${attempt}`);
  }
  return attempt;
}

/** Longest attempt key the meter accepts. */
export const ATTEMPT_KEY_MAX_LENGTH = 256;

// ---------------------------------------------------------------------------
// reserve / markSent / settle / fail
// ---------------------------------------------------------------------------

/**
 * `reserve(args) → { usageId }` or throws `ConvexError<MeterErrorData>`.
 *
 * The implementation validates with `assertReserveArgs`, returns the existing
 * `usageId` for a known `attemptKey`, derives the owner's plan, verifies
 * `creditDebitId`, then checks in this order (`firstReserveFailure`):
 * 1. kill switch: `ops_settings.killSwitches.ai`, plus `studioVideo` for that
 *    feature → `AI_DISABLED`;
 * 2. the call's global pool → `BUDGET_EXHAUSTED` scope `global_daily_free` or
 *    `global_daily_paid` (soft; see the header);
 * 3. Free owner's lifetime ceiling ($1.50, D3; Free non-credit work only) →
 *    `owner_free_lifetime`;
 * 4. owner daily cap (Free $1.00, paid $5.00) → `owner_daily`;
 * 5. for an escalation, `DEEP_ESCALATIONS_PER_OWNER_PER_DAY` → `owner_daily_escalations`.
 * Owner checks run whenever `ownerId` is set; a missing `ai_budgets` row counts
 * as a zero row. On success it inserts the row and applies `reserveDeltas`.
 */
export type ReserveArgs = {
  readonly ownerId?: string;
  readonly projectId?: string;
  readonly taskId?: string;
  /** Idempotency key for this attempt (see `jobAttemptKey`, `chatAttemptKey`). */
  readonly attemptKey: string;
  /** `id@version` from C-PROMPT `promptRef`; media calls use their own refs. */
  readonly promptRef: string;
  readonly provider: MeterProvider;
  readonly model: string;
  readonly tier: MeterTier;
  readonly feature: MeterFeature;
  /** Worst case, integer > 0 and ≤ `MAX_RESERVATION_MICRO_USD` (`worstCaseReservation`, `mediaReservation`). */
  readonly reservedMicroUsd: number;
  /**
   * The task's debit entry in `credit_ledger`, when the founder is paying
   * credits for this call. The implementation verifies it belongs to the same
   * owner and `taskId`, then stores `creditFunded: true`. Credit-funded spend
   * counts toward the daily caps and the paid global pool, not the Free
   * lifetime ceiling (D3 excludes the starter credits).
   */
  readonly creditDebitId?: string;
  /** A Message Batches request (`deep` only). Its `custom_id` is the `usageId`. */
  readonly batch?: true;
  /** The one capped `deep` escalation after a failed quality check (realtime `deep` only). */
  readonly escalation?: true;
  /** A re-ask after an invalid structured output (a new attempt with its own reservation). */
  readonly reask?: true;
};

export type ReserveResult = {
  readonly usageId: string;
  /** True when `attemptKey` already had a row and nothing new was reserved. */
  readonly existing: boolean;
};

/**
 * `markSent({ usageId })`: sets `sentAt` once, right before the request leaves.
 * Idempotent: a second call, or a call on a final row, changes nothing.
 */
export type MarkSentArgs = { readonly usageId: string };
export type MarkSentResult = {
  readonly usageId: string;
  readonly changed: boolean;
  readonly sentAt?: number;
};

/**
 * `settle(args)`: the gateway computes `costMicroUsd` from actual usage and the
 * dated rate card; metering stores it, sets `status: "settled"`, and applies
 * `spendDeltas` (release the reservation, add the cost).
 */
export type SettleArgs = {
  readonly usageId: string;
  readonly inputTokens: number;
  readonly cacheReadTokens: number;
  readonly cacheWriteTokens: number;
  readonly outputTokens: number;
  readonly images?: number;
  readonly videoSeconds?: number;
  readonly costMicroUsd: number;
  /** True when the cost came from an estimate (e.g. a provider that returns no usage). */
  readonly estimated: boolean;
  readonly latencyMs: number;
  readonly stopReason?: string;
};

/**
 * `fail(args)`: `status: "failed"`, charged `chargeOnFail(...)`. When the
 * provider may have billed, the charge is the worst case (the reservation),
 * never zero; when actual usage is known, it is that.
 */
export type FailArgs = {
  readonly usageId: string;
  readonly billed: BilledState;
  readonly costMicroUsd?: number;
  readonly errorClass: MeterErrorClass;
  readonly latencyMs: number;
};

/**
 * Result of `settle` and `fail`, idempotent by `usageId`. Once a row is final
 * (`settled` or `failed`), a second settle or fail changes nothing and returns
 * `alreadyFinal: true` — except a settle on a row the sweep finalised that has
 * no `lateCostMicroUsd` yet: it records the late cost and returns the
 * adjustment it added (`lateSettleAdjustment`). Otherwise the adjustment is 0.
 * An unknown `usageId` is a programming error and throws a plain error.
 */
export type FinalizeResult =
  | {
      readonly usageId: string;
      readonly alreadyFinal: false;
      readonly status: AiUsageFinalStatus;
      readonly costMicroUsd: number;
    }
  | {
      readonly usageId: string;
      readonly alreadyFinal: true;
      readonly status: AiUsageFinalStatus;
      readonly costMicroUsd: number;
      readonly lateAdjustmentMicroUsd: number;
    };

// ---------------------------------------------------------------------------
// Stored shapes
// ---------------------------------------------------------------------------

/**
 * What Codex's `ai_usage` table must hold. The first block is the `02` §4.2
 * list; the rest are additions this contract needs.
 * Indexes: `by_attemptKey`, `by_status_and_expiresAt` (sweep), plus §4.2's
 * `by_ownerId_and_createdAt`, `by_status_and_createdAt`, `by_projectId_and_createdAt`.
 */
export type AiUsageRow = {
  readonly ownerId?: string;
  readonly projectId?: string;
  readonly taskId?: string;
  readonly promptRef: string;
  readonly provider: MeterProvider;
  readonly model: string;
  readonly tier: MeterTier;
  readonly status: AiUsageStatus;
  readonly reservedMicroUsd: number;
  /** What the row was charged; 0 while reserved. */
  readonly costMicroUsd: number;
  readonly inputTokens: number;
  readonly cacheReadTokens: number;
  readonly cacheWriteTokens: number;
  readonly outputTokens: number;
  readonly images?: number;
  readonly videoSeconds?: number;
  readonly estimated: boolean;
  readonly latencyMs: number;
  readonly stopReason?: string;
  // Additions.
  readonly attemptKey: string;
  readonly createdAt: number;
  /** UTC day of the reservation; settle and release adjust that day. */
  readonly dayKey: string;
  /** When the sweep may finalise the row (`reservationExpiresAt`). */
  readonly expiresAt: number;
  readonly feature: MeterFeature;
  /** Derived by the implementation at reserve; absent for ownerless calls. */
  readonly plan?: MeterPlan;
  readonly globalPool: GlobalPool;
  /** Derived: `creditDebitId` was verified. */
  readonly creditFunded: boolean;
  readonly creditDebitId?: string;
  readonly batch?: true;
  readonly escalation?: true;
  readonly reask?: true;
  readonly sentAt?: number;
  readonly finalizedAt?: number;
  /** Set when the sweep finalised the row. */
  readonly sweptAt?: number;
  readonly billed?: BilledState;
  readonly errorClass?: MeterErrorClass;
  /** Actual cost from a settle that arrived after the sweep. */
  readonly lateCostMicroUsd?: number;
};

/**
 * One owner's `ai_budgets` row. Day fields belong to `dayKey`; roll the row
 * forward with `rollBudgetsToDay` before applying a new reservation.
 */
export type AiBudgetsRow = {
  readonly ownerId: string;
  readonly freeLifetimeSpentMicroUsd: number;
  /** Every in-flight reservation (counts toward the daily cap). */
  readonly reservedMicroUsd: number;
  /** In-flight reservations of Free non-credit work (count toward the lifetime ceiling). */
  readonly freeReservedMicroUsd: number;
  readonly dayKey: string;
  readonly daySpentMicroUsd: number;
  readonly dayEscalations: number;
};

/** What a missing `ai_budgets` row counts as (fail closed: caps still apply). */
export function zeroAiBudgets(ownerId: string, dayKey: string): AiBudgetsRow {
  return {
    ownerId,
    freeLifetimeSpentMicroUsd: 0,
    reservedMicroUsd: 0,
    freeReservedMicroUsd: 0,
    dayKey,
    daySpentMicroUsd: 0,
    dayEscalations: 0,
  };
}

/** The row with its day fields reset when `dayKey` has moved on. Reservations carry over. */
export function rollBudgetsToDay(budgets: AiBudgetsRow, dayKey: string): AiBudgetsRow {
  if (budgets.dayKey === dayKey) return budgets;
  return { ...budgets, dayKey, daySpentMicroUsd: 0, dayEscalations: 0 };
}

function assertBudgets(budgets: AiBudgetsRow): void {
  assertCount("freeLifetimeSpentMicroUsd", budgets.freeLifetimeSpentMicroUsd);
  assertCount("reservedMicroUsd", budgets.reservedMicroUsd);
  assertCount("freeReservedMicroUsd", budgets.freeReservedMicroUsd);
  assertCount("daySpentMicroUsd", budgets.daySpentMicroUsd);
  assertCount("dayEscalations", budgets.dayEscalations);
  if (typeof budgets.dayKey !== "string") throw new RangeError("dayKey must be a string");
}

// ---------------------------------------------------------------------------
// Errors (thrown as `ConvexError` data by the implementation)
// ---------------------------------------------------------------------------

export const METER_ERROR_CODES = ["BUDGET_EXHAUSTED", "AI_DISABLED"] as const;
export type MeterErrorCode = (typeof METER_ERROR_CODES)[number];

/**
 * Errors the gateway may see before `reserve`, raised outside the meter: C-OPS
 * `assertFeatureEnabled` (`AI_DISABLED`, `WORKSPACE_DISABLED`, and
 * `RESOURCE_NOT_FOUND` for an owner outside the cohort), C-AUTHZ
 * `requireBusinessAccess` (`RESOURCE_NOT_FOUND`), and the signed-in-user check
 * inside the public `assertFeatureEnabled` that job-starting mutations call
 * (`UNAUTHENTICATED`). The gateway maps them
 * alongside `METER_ERROR_CODES`; `AI_DISABLED` is in both lists and means the
 * same thing. A gate error is a pre-call failure: nothing was sent, no
 * provider cost was incurred, and the task's credits are refunded.
 */
export const WORKSPACE_GATE_ERROR_CODES = [
  "AI_DISABLED",
  "WORKSPACE_DISABLED",
  "RESOURCE_NOT_FOUND",
  "UNAUTHENTICATED",
] as const;
export type WorkspaceGateErrorCode = (typeof WORKSPACE_GATE_ERROR_CODES)[number];

/** Every error code the gateway maps around a provider call: meter codes plus gate codes. */
export type GatewayErrorCode = MeterErrorCode | WorkspaceGateErrorCode;

export const METER_BUDGET_SCOPES = [
  "global_daily_free",
  "global_daily_paid",
  "owner_free_lifetime",
  "owner_daily",
  "owner_daily_escalations",
] as const;
export type MeterBudgetScope = (typeof METER_BUDGET_SCOPES)[number];

/**
 * `BUDGET_EXHAUSTED` always names its budget. `AI_DISABLED` names the kill
 * switch that is on when there is one (`ai` or `studioVideo`).
 */
export type MeterErrorData =
  | { readonly code: "AI_DISABLED"; readonly scope?: MeterFeature; readonly message: string }
  | { readonly code: "BUDGET_EXHAUSTED"; readonly scope: MeterBudgetScope; readonly message: string };

/** Type guard for `ConvexError.data` (or anything else) on the caller's side. */
export function isMeterErrorData(value: unknown): value is MeterErrorData {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const { code, scope, message } = value as Record<string, unknown>;
  if (typeof message !== "string") return false;
  if (code === "AI_DISABLED") return scope === undefined || inList(METER_FEATURES, scope);
  if (code === "BUDGET_EXHAUSTED") return inList(METER_BUDGET_SCOPES, scope);
  return false;
}

/**
 * The `ConvexError.data` shape C-OPS and C-AUTHZ must throw for a gate error.
 * C-OPS currently throws `{ code }` alone, so `message` is optional here.
 * `AI_DISABLED` may name a scope, and if it does the scope must be a
 * `METER_FEATURES` value (`ai` or `studioVideo`) — the same rule as the
 * meter's own `AI_DISABLED`. C-OPS must not put any other feature name there.
 * `WORKSPACE_DISABLED`, `RESOURCE_NOT_FOUND` and `UNAUTHENTICATED` carry no
 * scope.
 */
export type WorkspaceGateErrorData =
  | { readonly code: "AI_DISABLED"; readonly scope?: MeterFeature; readonly message?: string }
  | { readonly code: "WORKSPACE_DISABLED"; readonly message?: string }
  | { readonly code: "RESOURCE_NOT_FOUND"; readonly message?: string }
  | { readonly code: "UNAUTHENTICATED"; readonly message?: string };

/** Anything the gateway maps around a provider call. */
export type GatewayErrorData = MeterErrorData | WorkspaceGateErrorData;

/** Type guard for a gate error's `ConvexError.data`. */
export function isWorkspaceGateErrorData(value: unknown): value is WorkspaceGateErrorData {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const { code, scope, message } = value as Record<string, unknown>;
  if (message !== undefined && typeof message !== "string") return false;
  if (code === "AI_DISABLED") return scope === undefined || inList(METER_FEATURES, scope);
  if (code === "WORKSPACE_DISABLED" || code === "RESOURCE_NOT_FOUND" || code === "UNAUTHENTICATED") {
    return scope === undefined;
  }
  return false;
}

/** Type guard for meter and gate errors together. */
export function isGatewayErrorData(value: unknown): value is GatewayErrorData {
  return isMeterErrorData(value) || isWorkspaceGateErrorData(value);
}

/**
 * Whether an error code refunds the task's credits. Every gate code and every
 * meter code is raised before `markSent` (nothing went out), so all refund.
 * The table stays total even for codes that in practice fire before any debit
 * (`UNAUTHENTICATED`), so a refund is never looked up on a missing key.
 * Failures after `markSent` are classed by `METER_ERROR_CLASSES`, not by these
 * codes, and follow `chargeOnFail`.
 */
export const REFUNDS_CREDITS = {
  BUDGET_EXHAUSTED: true,
  AI_DISABLED: true,
  WORKSPACE_DISABLED: true,
  RESOURCE_NOT_FOUND: true,
  UNAUTHENTICATED: true,
} as const satisfies Record<GatewayErrorCode, boolean>;

export function refundsCredits(code: GatewayErrorCode): boolean {
  return REFUNDS_CREDITS[code];
}

// ---------------------------------------------------------------------------
// Reservation sizing
// ---------------------------------------------------------------------------

export type RatePerMTok = {
  /** USD per million input tokens. */
  readonly input: number;
  /** USD per million output tokens (thinking bills as output). */
  readonly output: number;
  /** USD per million cache-write tokens, when the request writes the cache (e.g. 1.25× input). */
  readonly cacheWrite?: number;
};

/**
 * Worst-case cost of one model call in micro-USD, rounded up and at least 1:
 * every input token at the dearer of the input and cache-write rates, plus
 * `maxTokens` of output (which includes thinking). Tokens × USD-per-MTok is
 * micro-USD. Pass `maxInputTokens` (`meterMaxInputTokens`) to refuse an input
 * estimate over the lane's ceiling. The caller picks the rate card's tier
 * (e.g. Haiku's > 100K-token prices) and halves batch rates.
 */
export function worstCaseReservation(args: {
  readonly inputTokensEstimate: number;
  readonly maxTokens: number;
  readonly ratePerMTok: RatePerMTok;
  readonly maxInputTokens?: number;
}): number {
  const { inputTokensEstimate, maxTokens, ratePerMTok, maxInputTokens } = args;
  assertCount("inputTokensEstimate", inputTokensEstimate);
  if (!Number.isSafeInteger(maxTokens) || maxTokens < 1) {
    throw new RangeError(`maxTokens must be a positive integer, got ${maxTokens}`);
  }
  if (maxInputTokens !== undefined) {
    assertCount("maxInputTokens", maxInputTokens);
    if (inputTokensEstimate > maxInputTokens) {
      throw new RangeError(`inputTokensEstimate ${inputTokensEstimate} is over the lane ceiling ${maxInputTokens}`);
    }
  }
  const rates = [ratePerMTok.input, ratePerMTok.output, ratePerMTok.cacheWrite ?? 0];
  if (rates.some((rate) => !Number.isFinite(rate) || rate < 0)) {
    throw new RangeError("rates must be non-negative finite numbers");
  }
  const inputRate = Math.max(ratePerMTok.input, ratePerMTok.cacheWrite ?? 0);
  return Math.max(1, ceilMicroUsd(inputTokensEstimate * inputRate + maxTokens * ratePerMTok.output));
}

export type MediaReservationInput =
  | { readonly kind: "image"; readonly unitMicroUsd: number; readonly count: number }
  | { readonly kind: "video"; readonly microUsdPerSecond: number; readonly maxSeconds: number };

/** Worst-case cost of a media render in micro-USD, rounded up and at least 1. */
export function mediaReservation(input: MediaReservationInput): number {
  if (input.kind === "image") {
    if (!Number.isFinite(input.unitMicroUsd) || input.unitMicroUsd < 0) {
      throw new RangeError(`unitMicroUsd must be a non-negative number, got ${input.unitMicroUsd}`);
    }
    if (!Number.isSafeInteger(input.count) || input.count < 1) {
      throw new RangeError(`count must be a positive integer, got ${input.count}`);
    }
    return Math.max(1, ceilMicroUsd(input.unitMicroUsd * input.count));
  }
  if (!Number.isFinite(input.microUsdPerSecond) || input.microUsdPerSecond < 0) {
    throw new RangeError(`microUsdPerSecond must be a non-negative number, got ${input.microUsdPerSecond}`);
  }
  if (!Number.isFinite(input.maxSeconds) || input.maxSeconds <= 0) {
    throw new RangeError(`maxSeconds must be a positive number, got ${input.maxSeconds}`);
  }
  return Math.max(1, ceilMicroUsd(input.microUsdPerSecond * input.maxSeconds));
}

// ---------------------------------------------------------------------------
// Validation and decisions
// ---------------------------------------------------------------------------

/** Throws a `RangeError` for args no caller should send. The implementation runs it first. */
export function assertReserveArgs(args: ReserveArgs): void {
  if (typeof args.attemptKey !== "string" || args.attemptKey.length === 0 || args.attemptKey.length > ATTEMPT_KEY_MAX_LENGTH) {
    throw new RangeError(`attemptKey must be 1-${ATTEMPT_KEY_MAX_LENGTH} characters`);
  }
  if (typeof args.promptRef !== "string" || args.promptRef.length === 0) throw new RangeError("promptRef is required");
  if (typeof args.model !== "string" || args.model.length === 0) throw new RangeError("model is required");
  if (!inList(METER_PROVIDERS, args.provider)) throw new RangeError(`unknown provider ${String(args.provider)}`);
  if (!inList(METER_TIERS, args.tier)) throw new RangeError(`unknown tier ${String(args.tier)}`);
  if (!inList(METER_FEATURES, args.feature)) throw new RangeError(`unknown feature ${String(args.feature)}`);
  assertCount("reservedMicroUsd", args.reservedMicroUsd);
  if (args.reservedMicroUsd < 1 || args.reservedMicroUsd > MAX_RESERVATION_MICRO_USD) {
    throw new RangeError(`reservedMicroUsd must be 1..${MAX_RESERVATION_MICRO_USD}, got ${args.reservedMicroUsd}`);
  }
  const modelTier = args.tier === "fast" || args.tier === "draft" || args.tier === "deep";
  if (modelTier !== (args.provider === "anthropic")) {
    throw new RangeError(`provider ${args.provider} does not serve tier ${args.tier}`);
  }
  if (args.feature === "studioVideo" && args.tier !== "video") {
    throw new RangeError("the studioVideo feature is for video renders only");
  }
  if (args.batch !== undefined && (args.batch !== true || args.tier !== "deep")) {
    throw new RangeError("batch: true is for deep (precompute) requests only");
  }
  if (args.escalation !== undefined && (args.escalation !== true || args.tier !== "deep" || args.batch === true)) {
    throw new RangeError("escalation: true is for realtime deep requests only");
  }
  if (args.reask !== undefined && args.reask !== true) throw new RangeError("reask is true or absent");
  if (args.creditDebitId !== undefined) {
    if (typeof args.creditDebitId !== "string" || args.creditDebitId.length === 0) {
      throw new RangeError("creditDebitId must be a ledger entry id");
    }
    if (args.ownerId === undefined || args.taskId === undefined) {
      throw new RangeError("creditDebitId needs ownerId and taskId");
    }
  }
}

/** What `reserve` reads before deciding. Every amount is a safe non-negative integer. */
export type ReserveState = {
  /** Today's UTC day (`utcDayKey(now)`). */
  readonly dayKey: string;
  /** `ops_settings.killSwitches`; `true` means the switch is on (feature disabled). */
  readonly killSwitches: { readonly ai: boolean; readonly studioVideo: boolean };
  /**
   * Per pool: `ops_settings` budget, and the sharded counter's totals for today
   * (settled spend and in-flight reservations; both MUST be counted).
   */
  readonly global: {
    readonly [P in GlobalPool]: {
      readonly budgetMicroUsd: number;
      readonly spentTodayMicroUsd: number;
      readonly inFlightMicroUsd: number;
    };
  };
  /** Required when the call has an `ownerId`. */
  readonly owner?: {
    /** Derived by the implementation (`deriveMembership`), never from the caller. */
    readonly plan: MeterPlan;
    /** The `ai_budgets` row, or null when the owner has none yet (counts as zero). */
    readonly budgets: AiBudgetsRow | null;
    /** A super admin's raised daily cap for this owner, when set. */
    readonly dailyCapOverrideMicroUsd?: number;
  };
};

export type ReserveDecisionInput = Pick<ReserveArgs, "ownerId" | "feature" | "reservedMicroUsd" | "escalation"> & {
  /** True only after the implementation has verified `creditDebitId`. */
  readonly creditFunded: boolean;
};

function assertReserveState(state: ReserveState): void {
  if (typeof state.dayKey !== "string" || state.dayKey.length === 0) throw new RangeError("dayKey is required");
  for (const pool of GLOBAL_POOLS) {
    const entry = state.global[pool];
    assertCount(`global.${pool}.budgetMicroUsd`, entry.budgetMicroUsd);
    assertCount(`global.${pool}.spentTodayMicroUsd`, entry.spentTodayMicroUsd);
    assertCount(`global.${pool}.inFlightMicroUsd`, entry.inFlightMicroUsd);
  }
  if (state.owner) {
    if (!inList(METER_PLANS, state.owner.plan)) throw new RangeError(`unknown plan ${String(state.owner.plan)}`);
    if (state.owner.budgets) assertBudgets(state.owner.budgets);
    if (state.owner.dailyCapOverrideMicroUsd !== undefined) {
      assertCount("dailyCapOverrideMicroUsd", state.owner.dailyCapOverrideMicroUsd);
    }
  }
}

/**
 * The first check `reserve` fails, in contract order, or null when the call may
 * be reserved. A budget fails when its spent + in-flight + this reservation
 * would exceed it. Throws a `RangeError` on malformed state (NaN, negative,
 * fractional, an owner call without owner state): fail closed.
 */
export function firstReserveFailure(state: ReserveState, input: ReserveDecisionInput): MeterErrorData | null {
  assertReserveState(state);
  assertCount("reservedMicroUsd", input.reservedMicroUsd);
  if (input.reservedMicroUsd < 1) throw new RangeError("reservedMicroUsd must be at least 1");
  if (input.ownerId !== undefined && state.owner === undefined) {
    throw new RangeError("owner state is required for an owner call (derive the plan first)");
  }

  if (state.killSwitches.ai) {
    return { code: "AI_DISABLED", scope: "ai", message: "AI generation is switched off." };
  }
  if (input.feature === "studioVideo" && state.killSwitches.studioVideo) {
    return { code: "AI_DISABLED", scope: "studioVideo", message: "Studio video is switched off." };
  }

  const owner = input.ownerId === undefined ? undefined : state.owner;
  const pool = globalPoolFor({ plan: owner?.plan, creditFunded: input.creditFunded });
  const global = state.global[pool];
  if (global.spentTodayMicroUsd + global.inFlightMicroUsd + input.reservedMicroUsd > global.budgetMicroUsd) {
    return {
      code: "BUDGET_EXHAUSTED",
      scope: pool === "free" ? "global_daily_free" : "global_daily_paid",
      message: "Today's AI budget is used up.",
    };
  }
  if (input.ownerId === undefined || owner === undefined) return null;

  const budgets = rollBudgetsToDay(owner.budgets ?? zeroAiBudgets(input.ownerId, state.dayKey), state.dayKey);
  if (owner.plan === "free" && !input.creditFunded) {
    const lifetime = budgets.freeLifetimeSpentMicroUsd + budgets.freeReservedMicroUsd + input.reservedMicroUsd;
    if (lifetime > FREE_LIFETIME_CEILING_MICRO_USD) {
      return {
        code: "BUDGET_EXHAUSTED",
        scope: "owner_free_lifetime",
        message: "This free account has used its AI allowance.",
      };
    }
  }
  const dailyCap = owner.dailyCapOverrideMicroUsd ?? OWNER_DAILY_CAP_MICRO_USD[owner.plan];
  if (budgets.daySpentMicroUsd + budgets.reservedMicroUsd + input.reservedMicroUsd > dailyCap) {
    return { code: "BUDGET_EXHAUSTED", scope: "owner_daily", message: "Today's AI allowance is used up." };
  }
  if (input.escalation === true && budgets.dayEscalations >= DEEP_ESCALATIONS_PER_OWNER_PER_DAY) {
    return {
      code: "BUDGET_EXHAUSTED",
      scope: "owner_daily_escalations",
      message: "Today's extra-careful redos are used up.",
    };
  }
  return null;
}

/** Whether a row's spend counts toward the Free lifetime ceiling. */
export function countsTowardFreeLifetime(row: Pick<AiUsageRow, "plan" | "creditFunded">): boolean {
  return row.plan === "free" && !row.creditFunded;
}

/** Changes `reserve` applies, after `rollBudgetsToDay(budgets, row.dayKey)`. */
export type ReserveDeltas = {
  readonly owner: {
    readonly reservedMicroUsd: number;
    readonly freeReservedMicroUsd: number;
    readonly dayEscalations: number;
  } | null;
  readonly global: { readonly pool: GlobalPool; readonly dayKey: string; readonly inFlightMicroUsd: number };
};

export function reserveDeltas(
  row: Pick<AiUsageRow, "ownerId" | "plan" | "creditFunded" | "reservedMicroUsd" | "escalation" | "globalPool" | "dayKey">,
): ReserveDeltas {
  return {
    owner:
      row.ownerId === undefined
        ? null
        : {
            reservedMicroUsd: row.reservedMicroUsd,
            freeReservedMicroUsd: countsTowardFreeLifetime(row) ? row.reservedMicroUsd : 0,
            dayEscalations: row.escalation === true ? 1 : 0,
          },
    global: { pool: row.globalPool, dayKey: row.dayKey, inFlightMicroUsd: row.reservedMicroUsd },
  };
}

/** Changes a settle, fail, sweep or late settle applies. Negative numbers release. */
export type SpendDeltas = {
  readonly owner: {
    readonly reservedMicroUsd: number;
    readonly freeReservedMicroUsd: number;
    /** Applied only when the budgets row is still on the reservation's day (else 0). */
    readonly daySpentMicroUsd: number;
    readonly freeLifetimeSpentMicroUsd: number;
  } | null;
  /** Applied to the counter shard for the reservation's day and pool. */
  readonly global: {
    readonly pool: GlobalPool;
    readonly dayKey: string;
    readonly spentMicroUsd: number;
    readonly inFlightMicroUsd: number;
  };
};

/**
 * Pure budget arithmetic for finalising a row. `spendMicroUsd` is the charge
 * (or a late adjustment); `releaseReservation` is true for settle, fail and
 * sweep, false for a late settle (already released). The Free lifetime add
 * applies only when `plan === "free"` and the row is not credit-funded.
 */
export function spendDeltas(args: {
  readonly row: Pick<
    AiUsageRow,
    "ownerId" | "plan" | "creditFunded" | "reservedMicroUsd" | "globalPool" | "dayKey"
  >;
  readonly spendMicroUsd: number;
  readonly releaseReservation: boolean;
  /** The owner's `ai_budgets.dayKey` at the time of the update. */
  readonly budgetsDayKey: string | null;
}): SpendDeltas {
  const { row, spendMicroUsd, releaseReservation, budgetsDayKey } = args;
  assertCount("spendMicroUsd", spendMicroUsd);
  const release = releaseReservation ? -row.reservedMicroUsd : 0;
  const free = countsTowardFreeLifetime(row);
  return {
    owner:
      row.ownerId === undefined
        ? null
        : {
            reservedMicroUsd: release,
            freeReservedMicroUsd: free ? release : 0,
            daySpentMicroUsd: budgetsDayKey === row.dayKey ? spendMicroUsd : 0,
            freeLifetimeSpentMicroUsd: free ? spendMicroUsd : 0,
          },
    global: { pool: row.globalPool, dayKey: row.dayKey, spentMicroUsd: spendMicroUsd, inFlightMicroUsd: release },
  };
}

/**
 * What a failed call is charged:
 * - `none`: the provider did not bill → 0.
 * - `possible`: the worst case — the larger of the reservation and any known
 *   cost. Never zero (the reservation is > 0).
 * - `actual`: the known cost; if it is missing, the reservation (never under-charge).
 */
export function chargeOnFail(args: {
  readonly reservedMicroUsd: number;
  readonly billed: BilledState;
  readonly costMicroUsd?: number;
}): number {
  const { reservedMicroUsd, billed, costMicroUsd } = args;
  if (!Number.isSafeInteger(reservedMicroUsd) || reservedMicroUsd < 1) {
    throw new RangeError(`reservedMicroUsd must be a positive integer, got ${reservedMicroUsd}`);
  }
  if (costMicroUsd !== undefined) assertCount("costMicroUsd", costMicroUsd);
  switch (billed) {
    case "none":
      return 0;
    case "possible":
      return Math.max(reservedMicroUsd, costMicroUsd ?? 0);
    case "actual":
      return costMicroUsd ?? reservedMicroUsd;
    default: {
      const unreachable: never = billed;
      throw new RangeError(`unknown billed state: ${String(unreachable)}`);
    }
  }
}

/**
 * What the sweep does with a row, or null when it should leave it. A row still
 * `reserved` at or after `expiresAt` fails with `errorClass: "timeout"`:
 * `billed: "possible"` (charged the reservation) when `sentAt` is set, else
 * `billed: "none"` (charged 0 — nothing went out).
 */
export function sweepOutcome(
  row: Pick<AiUsageRow, "status" | "expiresAt" | "sentAt" | "reservedMicroUsd">,
  nowMs: number,
): { readonly billed: "possible" | "none"; readonly chargeMicroUsd: number; readonly errorClass: "timeout" } | null {
  assertCount("nowMs", nowMs);
  if (row.status !== "reserved" || nowMs < row.expiresAt) return null;
  if (row.sentAt === undefined) return { billed: "none", chargeMicroUsd: 0, errorClass: "timeout" };
  return {
    billed: "possible",
    chargeMicroUsd: chargeOnFail({ reservedMicroUsd: row.reservedMicroUsd, billed: "possible" }),
    errorClass: "timeout",
  };
}

/** A late settle's addition to the totals: `max(0, actual − charged)`. */
export function lateSettleAdjustment(args: { readonly chargedMicroUsd: number; readonly actualMicroUsd: number }): number {
  assertCount("chargedMicroUsd", args.chargedMicroUsd);
  assertCount("actualMicroUsd", args.actualMicroUsd);
  return Math.max(0, args.actualMicroUsd - args.chargedMicroUsd);
}
