/**
 * WP77-S2 — change rounds (D17): which "Ask for changes" round an artifact is
 * on, and what that round costs. Pure: no Convex, no I/O, no side effects.
 * Reused by the approvals loop (`convex/workspace/changeRounds.ts`) and by the
 * WP75 and WP76 generators.
 *
 * The round is never stored as a counter and never read from a card. It is the
 * C-JOBS count (`lib/workspace/contracts/jobs.ts`): the number of non-failed,
 * non-cancelled tasks for the same (projectId, jobType, subject), the first
 * draft included. So the first "Ask for changes" is round 1, and raising,
 * superseding or cancelling approval cards cannot move it. A failed or
 * cancelled round gives the round back, as C-JOBS says.
 *
 * The price is C-JOBS `creditCostFor`, without an explicit action: rounds 1 and
 * 2 are free; round 3 and later cost the artifact's regenerate price, or are not
 * available while that price is `PRICE_NOT_SET`.
 */

import {
  FREE_CHANGE_ROUNDS,
  JobsContractError,
  creditCostFor,
  isJobType,
  type CreditActionKey,
  type CreditCost,
  type JobType,
  type WorkspacePlanId,
} from "./contracts/jobs";

// ---------------------------------------------------------------------------
// Which artifacts take change rounds
// ---------------------------------------------------------------------------

/**
 * Crew artifacts a founder can ask to change. Hires and Studio renders are not
 * revised: every run of those is a new, always-paid job.
 */
export const REVISABLE_JOB_TYPES = [
  "crew_blueprint",
  "crew_roster",
  "crew_brand_kit",
  "crew_landing",
  "crew_email_sequence",
  "crew_social_pack",
  "crew_seo_pack",
  "crew_launch_plan",
  "crew_ads_drafts",
  "crew_build_pack",
] as const satisfies readonly JobType[];

export type RevisableJobType = (typeof REVISABLE_JOB_TYPES)[number];

export function isRevisableJobType(value: unknown): value is RevisableJobType {
  return isJobType(value) && (REVISABLE_JOB_TYPES as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// The next round, from the artifact's tasks
// ---------------------------------------------------------------------------

/** Task statuses that give a round back (C-JOBS: not counted). */
export const ROUND_RELEASING_TASK_STATUSES = ["failed", "cancelled"] as const;

/** Counted statuses that mean a draft is still being made: no new round may start. */
export const ROUND_BUSY_TASK_STATUSES = ["queued", "running", "blocked"] as const;

/** One task of an artifact's lineage: same project, job type and subject. */
export type LineageTask = {
  readonly id: string;
  readonly status: string;
  /** The job key's revision. */
  readonly revision: number;
};

export type ChangeRoundPosition =
  /** The reviewed draft is the newest finished one; `changeRound` is the next round. */
  | { readonly state: "ready"; readonly changeRound: number }
  /** A draft of this artifact is queued, running or blocked. */
  | { readonly state: "busy" }
  /** The reviewed draft is not the artifact's newest finished draft. */
  | { readonly state: "stale" }
  /** The tasks do not form one clean lineage (duplicate or missing revisions). Fails closed. */
  | { readonly state: "conflict" };

function releasesRound(status: string): boolean {
  return (ROUND_RELEASING_TASK_STATUSES as readonly string[]).includes(status);
}

function isBusy(status: string): boolean {
  return (ROUND_BUSY_TASK_STATUSES as readonly string[]).includes(status);
}

/**
 * Where an artifact stands, from every task of its lineage and the task that
 * made the draft under review. The next round is the count of counted tasks;
 * it is only offered when the reviewed draft is the newest, finished, and the
 * counted revisions are exactly 0..n-1.
 */
export function nextChangeRound(tasks: readonly LineageTask[], reviewedTaskId: string): ChangeRoundPosition {
  const counted = tasks.filter((task) => !releasesRound(task.status));
  if (counted.some((task) => isBusy(task.status))) return { state: "busy" };

  const revisions = counted.map((task) => task.revision);
  if (revisions.some((revision) => !Number.isSafeInteger(revision) || revision < 0)) return { state: "conflict" };
  if (new Set(revisions).size !== revisions.length) return { state: "conflict" };

  const reviewed = counted.find((task) => task.id === reviewedTaskId);
  if (reviewed === undefined || reviewed.status !== "succeeded") return { state: "stale" };
  const newest = Math.max(...revisions);
  if (reviewed.revision !== newest) return { state: "stale" };
  if (newest !== counted.length - 1) return { state: "conflict" };
  return { state: "ready", changeRound: counted.length };
}

// ---------------------------------------------------------------------------
// What the round costs
// ---------------------------------------------------------------------------

export type ChangeRoundUnavailableReason =
  /** Round 3+ of an artifact the owner has not priced yet (C-JOBS `PRICE_NOT_SET`). */
  | "price_not_set"
  /** The plan does not include the action that prices this round. */
  | "plan_gated"
  /** Not an artifact that takes change rounds. */
  | "not_revisable";

export type ChangeRoundDecision =
  | { readonly decision: "free"; readonly changeRound: number; readonly freeRoundsLeft: number }
  | {
    readonly decision: "spend";
    readonly changeRound: number;
    readonly costCredits: number;
    readonly action: CreditActionKey;
  }
  | { readonly decision: "not_available"; readonly changeRound: number; readonly reason: ChangeRoundUnavailableReason };

export type ChangeRoundInput = {
  readonly jobType: JobType;
  /** The round being asked for, 1 or more (from `nextChangeRound`, never a client). */
  readonly changeRound: number;
  readonly plan: WorkspacePlanId;
};

/**
 * Free, paid (with the exact C-JOBS price) or not available. Never returns a
 * free revision for round 3+: an unpriced round is `not_available`.
 */
export function decideChangeRound(input: ChangeRoundInput): ChangeRoundDecision {
  const { jobType, changeRound, plan } = input;
  if (!Number.isSafeInteger(changeRound) || changeRound < 1) {
    throw new JobsContractError("INVALID_CHANGE_ROUND", `a change round is 1 or more, got ${changeRound}`);
  }
  if (!isRevisableJobType(jobType)) return { decision: "not_available", changeRound, reason: "not_revisable" };

  let cost: CreditCost;
  try {
    cost = creditCostFor({ jobType, changeRound, plan });
  } catch (error) {
    if (error instanceof JobsContractError && error.code === "PRICE_NOT_SET") {
      return { decision: "not_available", changeRound, reason: "price_not_set" };
    }
    if (error instanceof JobsContractError && error.code === "PLAN_GATED") {
      return { decision: "not_available", changeRound, reason: "plan_gated" };
    }
    throw error;
  }

  if (cost.free) {
    return { decision: "free", changeRound, freeRoundsLeft: Math.max(FREE_CHANGE_ROUNDS - changeRound, 0) };
  }
  if (cost.reason !== "paid_change_round" || cost.action === undefined || cost.credits <= 0) {
    throw new JobsContractError("ACTION_NOT_APPLICABLE", `round ${changeRound} of ${jobType} priced as ${cost.reason}`);
  }
  return { decision: "spend", changeRound, costCredits: cost.credits, action: cost.action };
}

/**
 * The terms the debit site passes to `assertApproved` for a paid round's
 * `spend` card. Recompute the decision in the debit mutation; never copy the
 * terms from the card.
 */
export function spendTermsFor(decision: Extract<ChangeRoundDecision, { decision: "spend" }>): {
  readonly expectedCostCredits: bigint;
  readonly expectedChangeRound: bigint;
} {
  return { expectedCostCredits: BigInt(decision.costCredits), expectedChangeRound: BigInt(decision.changeRound) };
}
