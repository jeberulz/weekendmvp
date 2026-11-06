import { WORKSPACE_PLAN_REFERENCE, type WorkspacePlanId } from "../../../lib/workspace/contracts/jobs.ts";

export type TenantSendCounts = {
  /** All tenant enqueues for the owner, including confirmations and paid periods. */
  lifetime: number;
  /** Tenant enqueues in the current UTC calendar month. */
  month: number;
};

export type TenantSendAllowance = {
  allowed: boolean;
  warnSoftCap: boolean;
  limit: number;
  countBeforeSend: number;
};

/** Every tenant message passes through this decision, including confirmation. */
export function tenantSendAllowance(
  plan: WorkspacePlanId,
  counts: TenantSendCounts,
): TenantSendAllowance {
  if (!Number.isSafeInteger(counts.lifetime) || counts.lifetime < 0 ||
      !Number.isSafeInteger(counts.month) || counts.month < 0 ||
      counts.month > counts.lifetime) {
    throw new Error("INVALID_TENANT_SEND_COUNTS");
  }
  const policy = WORKSPACE_PLAN_REFERENCE[plan].limits.tenantEmailSends;
  const countBeforeSend = policy.period === "lifetime" ? counts.lifetime : counts.month;
  const reached = countBeforeSend >= policy.count;
  return {
    allowed: policy.enforcement === "soft" || !reached,
    warnSoftCap: policy.enforcement === "soft" && reached,
    limit: policy.count,
    countBeforeSend,
  };
}

/** Stable calendar key; never use a rolling 30-day window for monthly caps. */
export function utcSendMonth(timestampMs: number): string {
  if (!Number.isFinite(timestampMs)) throw new Error("INVALID_SEND_TIME");
  return new Date(timestampMs).toISOString().slice(0, 7);
}
