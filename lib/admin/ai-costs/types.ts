/**
 * WP93. Shapes the AI cost console reads and shows. Metadata only: nothing
 * here can hold prompt, reply, chat or artifact text (WP38).
 *
 * Money and token counts are integer micro-USD / counts as safe-integer
 * `number`s. The Convex reads convert `v.int64()` with the meter's own
 * `int64ToMicroUsd`, so no rounding happens on the way in.
 */

export type UsageStatus = "reserved" | "settled" | "failed";
export type UsageTier = "fast" | "draft" | "deep" | "image" | "video";
export type UsagePlan = "free" | "builders_hub" | "growth";
export type UsagePool = "free" | "paid";
export type UsageBilled = "none" | "possible" | "actual";
export type UsageErrorClass =
  | "retryable"
  | "indeterminate"
  | "permanent"
  | "refusal"
  | "schema_invalid"
  | "timeout";

/** One `ai_usage` row, projected for the console. Ids are plain strings. */
export type UsageRow = {
  readonly id: string;
  readonly ownerId: string | null;
  readonly projectId: string | null;
  readonly promptRef: string;
  readonly provider: string;
  readonly model: string;
  readonly tier: UsageTier;
  readonly plan: UsagePlan | null;
  readonly globalPool: UsagePool;
  readonly creditFunded: boolean;
  readonly batch: boolean;
  readonly escalation: boolean;
  readonly reask: boolean;
  readonly status: UsageStatus;
  readonly reservedMicroUsd: number;
  readonly costMicroUsd: number;
  readonly lateCostMicroUsd: number | null;
  readonly inputTokens: number;
  readonly cacheReadTokens: number;
  readonly cacheWriteTokens: number;
  readonly outputTokens: number;
  readonly images: number | null;
  readonly estimated: boolean;
  readonly latencyMs: number;
  readonly stopReason: string | null;
  readonly billed: UsageBilled | null;
  readonly errorClass: UsageErrorClass | null;
  readonly swept: boolean;
  readonly createdAt: number;
  readonly dayKey: string;
};

/** A row in a founder's call timeline: the usage row plus a seed item's error details when there is one. */
export type TimelineRow = UsageRow & {
  readonly errorKind: string | null;
  readonly errorDetail: string | null;
};

/** What `ownerSummaries` returns for one founder. */
export type OwnerSummary = {
  readonly ownerId: string;
  /** Super admin only. Null when the account has no email. */
  readonly email: string | null;
  readonly plan: UsagePlan;
  readonly inCohort: boolean;
  /** `ai_budgets`, rolled to the requested UTC day. Zero when the owner has no row yet. */
  readonly daySpentMicroUsd: number;
  readonly dayCapMicroUsd: number;
  readonly reservedMicroUsd: number;
  readonly freeLifetimeSpentMicroUsd: number;
  readonly freeLifetimeCeilingMicroUsd: number;
  readonly businesses: number;
  readonly launches: number;
  /** True when more businesses exist than were read. */
  readonly businessesTruncated: boolean;
  readonly lastActiveAt: number | null;
};

/** The full cost of one business, read through `by_projectId_and_createdAt` (not cut by the range). */
export type ProjectCost = {
  readonly projectId: string;
  readonly ownerId: string | null;
  readonly hasLaunch: boolean;
  readonly firstCallAt: number | null;
  readonly lastCallAt: number | null;
  readonly calls: number;
  readonly failedCalls: number;
  /** Every non-Wren call on the business: the launch, its change rounds, images. */
  readonly launchMicroUsd: number;
  readonly wrenMicroUsd: number;
  /** True when the business has more calls than one read takes; its cost is then a floor. */
  readonly truncated: boolean;
};

export type SpendAlarmDay = {
  readonly dayKey: string;
  readonly free80: boolean;
  readonly free100: boolean;
  readonly paid80: boolean;
  readonly paid100: boolean;
};

/** Ops settings and today's pool counters (the meter's own sharded counters). */
export type ControlRoom = {
  readonly configured: boolean;
  readonly workspaceEnabled: boolean;
  readonly cohortMode: "allowlist" | "open";
  readonly cohortSize: number;
  readonly cohortSizeTruncated: boolean;
  readonly freeBudgetMicroUsd: number;
  readonly paidBudgetMicroUsd: number;
  readonly killSwitches: Readonly<Record<"ai" | "studioVideo" | "publish" | "email" | "social" | "ads", boolean>>;
  readonly spendAlarmState: SpendAlarmDay | null;
  readonly dayKey: string;
  readonly free: { readonly spentMicroUsd: number; readonly inFlightMicroUsd: number };
  readonly paid: { readonly spentMicroUsd: number; readonly inFlightMicroUsd: number };
};
