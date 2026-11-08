/**
 * WP92. The unattended seed run's decision: given the dry-run estimate and the
 * deployment's state, may an automatic `crew:seeds --auto` run submit a batch?
 *
 * The automatic run (`.github/workflows/crew-seeds.yml`) keeps per-idea seeds
 * current after idea pages change. It never decides how much to spend on its
 * own: every limit here is a number the owner sets.
 *
 * Rules, checked in this order:
 * 1. A run at this seed version is still open (preparing or submitted): skip.
 *    Its ideas have no seed row yet, so a second run would send them again.
 * 2. Nothing changed since the seeds at this version: nothing to send.
 * 3. The deployment is not in live provider mode: dry run only. A fixture
 *    run would write fixture seeds at this version, and an unchanged page is
 *    then skipped for good once live mode is switched on.
 * 4. Live spend is off (`applyEnabled` false): dry run only.
 * 5. The worst-case reservation is over the per-run cap: refuse. A seed
 *    version bump or a mass edit re-seeds most of the library; that stays an
 *    operator run (plan 09, "Running it").
 * 6. Reserving the worst case would leave less than `keepFreePoolShare` of
 *    today's free global pool for founders: wait for a later run.
 * Otherwise: apply.
 *
 * Pure: no I/O. `scripts/crew-seeds.mjs` feeds it, and the tests drive it.
 */

/** One dry-run row from `crew/seeds:estimateItems`. */
export type SeedEstimateRow =
  | { readonly ideaSlug: string; readonly status: "new"; readonly reservedMicroUsd: number; readonly validated: boolean }
  | { readonly ideaSlug: string; readonly status: "unchanged" }
  | { readonly ideaSlug: string; readonly status: "invalid"; readonly reason: string };

/** What `crew/seeds:autoRunState` reports about the deployment. */
export type SeedAutoRunState = {
  readonly openRun: boolean;
  readonly providerLive: boolean;
  /** Today's (UTC) free global pool budget, in micro-USD. */
  readonly freePoolBudgetMicroUsd: number;
  /** Spent plus in flight today in the free global pool, in micro-USD. */
  readonly freePoolUsedMicroUsd: number;
};

export type SeedAutoRunLimits = {
  /** Live spend switch: false means every run is a dry run. */
  readonly applyEnabled: boolean;
  /** Cap on one run's worst-case reservation, in micro-USD. */
  readonly maxReserveMicroUsd: number;
  /** Share of today's free pool that must stay unreserved after this run, 0..1. */
  readonly keepFreePoolShare: number;
};

export type SeedAutoRunDecision =
  | { readonly action: "skip_open_run" }
  | { readonly action: "nothing_to_send" }
  | { readonly action: "dry_run_not_live"; readonly wouldSend: number; readonly worstCaseMicroUsd: number }
  | { readonly action: "dry_run_apply_off"; readonly wouldSend: number; readonly worstCaseMicroUsd: number }
  | { readonly action: "refuse_over_cap"; readonly wouldSend: number; readonly worstCaseMicroUsd: number }
  | { readonly action: "wait_for_pool"; readonly wouldSend: number; readonly worstCaseMicroUsd: number; readonly headroomMicroUsd: number }
  | { readonly action: "apply"; readonly send: readonly string[]; readonly worstCaseMicroUsd: number };

/** Throws on limits that would make the guard meaningless (negative, NaN, a share outside 0..1). */
export function assertSeedAutoRunLimits(limits: SeedAutoRunLimits): void {
  if (!Number.isSafeInteger(limits.maxReserveMicroUsd) || limits.maxReserveMicroUsd <= 0) {
    throw new RangeError("maxReserveMicroUsd must be a positive whole number of micro-USD");
  }
  if (!Number.isFinite(limits.keepFreePoolShare) || limits.keepFreePoolShare < 0 || limits.keepFreePoolShare > 1) {
    throw new RangeError("keepFreePoolShare must be between 0 and 1");
  }
}

export function decideSeedAutoRun(
  estimate: readonly SeedEstimateRow[],
  state: SeedAutoRunState,
  limits: SeedAutoRunLimits,
): SeedAutoRunDecision {
  assertSeedAutoRunLimits(limits);
  if (state.openRun) return { action: "skip_open_run" };

  const fresh = estimate.filter((row): row is Extract<SeedEstimateRow, { status: "new" }> => row.status === "new");
  if (fresh.length === 0) return { action: "nothing_to_send" };
  const worstCaseMicroUsd = fresh.reduce((sum, row) => sum + row.reservedMicroUsd, 0);
  const wouldSend = fresh.length;

  if (!state.providerLive) return { action: "dry_run_not_live", wouldSend, worstCaseMicroUsd };
  if (!limits.applyEnabled) return { action: "dry_run_apply_off", wouldSend, worstCaseMicroUsd };
  if (worstCaseMicroUsd > limits.maxReserveMicroUsd) return { action: "refuse_over_cap", wouldSend, worstCaseMicroUsd };

  const headroomMicroUsd = Math.max(0, state.freePoolBudgetMicroUsd - state.freePoolUsedMicroUsd);
  const keepMicroUsd = Math.ceil(state.freePoolBudgetMicroUsd * limits.keepFreePoolShare);
  if (headroomMicroUsd - worstCaseMicroUsd < keepMicroUsd) {
    return { action: "wait_for_pool", wouldSend, worstCaseMicroUsd, headroomMicroUsd };
  }
  return { action: "apply", send: fresh.map((row) => row.ideaSlug), worstCaseMicroUsd };
}

/** `"2.50"` → 2_500_000. Throws on anything that is not a non-negative decimal dollar amount. */
export function usdToMicroUsd(text: string): number {
  if (!/^\d{1,6}(\.\d{1,6})?$/u.test(text.trim())) throw new RangeError(`not a dollar amount: ${text}`);
  const [whole, fraction = ""] = text.trim().split(".");
  return Number(whole) * 1_000_000 + Number(fraction.padEnd(6, "0"));
}
