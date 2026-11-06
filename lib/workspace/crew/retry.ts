/**
 * WP75-S2a. Retry classes for one crew step (`02` §6.2, the WP26 executor
 * classes). Pure: no Convex, no I/O, no clock, no randomness.
 *
 * The crew runner owns retries; workpool retries stay off (`retry: false`).
 * Every execution of a task is one `workflow_runs` row, and its `errorCode`
 * holds the class below, so the retry budget is counted from the rows, never
 * from memory.
 *
 * | Class                | Gateway failure                                             | What happens            |
 * |----------------------|-------------------------------------------------------------|-------------------------|
 * | `retryable_unbilled` | `provider` with `retryable` and `billed: none`;             | up to 2 retries         |
 * |                      | `duplicate_attempt` with `key_reused_for_different_call`    | with backoff            |
 * |                      | (the retry moves to `nextAttempt`)                          |                         |
 * | `indeterminate`      | `provider` with `billed: possible`, or a timeout; a         | one retry               |
 * |                      | same-call `duplicate_attempt` (an earlier execution's row,  |                         |
 * |                      | outcome unknown here)                                       |                         |
 * | `permanent`          | `config`, `refusal`, `schema_invalid` (after the gateway's   | task `failed`; refund   |
 * |                      | one re-ask), `internal`, any other `provider` failure,      | only when a debit       |
 * |                      | `UNAUTHENTICATED`, `RESOURCE_NOT_FOUND` on a live task       | exists                  |
 * | `parked`             | `meter_refused` `AI_DISABLED`, `WORKSPACE_DISABLED`,         | task `blocked`, no      |
 * |                      | `BUDGET_EXHAUSTED`                                           | automatic retry         |
 * | `closed`             | `meter_refused` `RESOURCE_NOT_FOUND` on a terminal task      | stop; no refund         |
 *
 * `closed` follows the gateway's note (`convex/ai/gatewayActions.ts`): the meter
 * checks the task before the attempt key, so a replay on a task that is already
 * `succeeded` / `failed` / `cancelled` comes back `RESOURCE_NOT_FOUND`. That
 * says the task was closed, not that the work failed, so it never refunds.
 *
 * A provider failure that billed (`billed: actual`, e.g. a truncated reply) is
 * permanent: it already cost the full call and a retry would most likely end
 * the same way.
 */

// ---------------------------------------------------------------------------
// Classes
// ---------------------------------------------------------------------------

export const RETRY_CLASSES = ["retryable_unbilled", "indeterminate", "permanent", "parked", "closed"] as const;
export type RetryClass = (typeof RETRY_CLASSES)[number];

export function isRetryClass(value: unknown): value is RetryClass {
  return typeof value === "string" && (RETRY_CLASSES as readonly string[]).includes(value);
}

/** Runner retries after a `retryable_unbilled` execution (the first run is not a retry). */
export const MAX_RETRYABLE_RETRIES = 2;

/** Runner retries after an `indeterminate` execution: the meter already charged its worst case. */
export const MAX_INDETERMINATE_RETRIES = 1;

/** Classes whose runs spend a task's retry budget. Parked, closed and permanent runs never do. */
export const BUDGET_SPENDING_CLASSES = ["retryable_unbilled", "indeterminate"] as const satisfies readonly RetryClass[];

export function spendsRetryBudget(code: string | undefined): boolean {
  return code !== undefined && (BUDGET_SPENDING_CLASSES as readonly string[]).includes(code);
}

/** Backoff before retry n (0-based) of a `retryable_unbilled` execution: 5 s, then 20 s. */
export const RETRYABLE_BACKOFF_MS = [5_000, 20_000] as const;

/** Backoff before the one `indeterminate` retry. */
export const INDETERMINATE_BACKOFF_MS = 30_000;

/**
 * How far a run's next attempt number moves when its outcome is unknown (the
 * runner crashed, or `runPrompt` threw instead of returning). One gateway run
 * reserves at most its first attempt and the re-ask (`MAX_REASKS` = 1), so
 * skipping two numbers can never land on a key that run used.
 */
export const UNKNOWN_OUTCOME_ATTEMPT_STRIDE = 2;

// ---------------------------------------------------------------------------
// Gateway failures (structural: `GatewayRunResult["failure"]` fits this type)
// ---------------------------------------------------------------------------

export type GatewayBilled = "none" | "possible" | "actual";

export type CrewGatewayFailure =
  | { readonly kind: "config"; readonly message: string }
  | { readonly kind: "meter_refused"; readonly error: { readonly code: string; readonly scope?: string; readonly message?: string } }
  | {
      readonly kind: "duplicate_attempt";
      readonly attemptKey: string;
      readonly usageId?: string;
      readonly reason?: "key_reused_for_different_call";
      readonly message?: string;
    }
  | { readonly kind: "refusal"; readonly provider: string; readonly category: string | null; readonly explanation: string | null }
  | { readonly kind: "schema_invalid"; readonly issues: readonly string[] }
  | {
      readonly kind: "provider";
      readonly provider: string;
      readonly providerKind: string;
      readonly errorClass: string;
      readonly billed: GatewayBilled;
      readonly retryable: boolean;
      readonly message: string;
    }
  | { readonly kind: "internal"; readonly message: string; readonly usageId?: string };

/** Meter refusals that park the task until the founder or the next launch tick resumes it. */
export const PARKING_METER_CODES = ["AI_DISABLED", "WORKSPACE_DISABLED", "BUDGET_EXHAUSTED"] as const;
export type ParkingMeterCode = (typeof PARKING_METER_CODES)[number];

export function isParkingMeterCode(value: unknown): value is ParkingMeterCode {
  return typeof value === "string" && (PARKING_METER_CODES as readonly string[]).includes(value);
}

export type ClassifyContext = {
  /** The task is already `succeeded`, `failed` or `cancelled` (read in the same transaction). */
  readonly taskTerminal: boolean;
};

/** The retry class of one failed gateway run. */
export function classifyGatewayFailure(failure: CrewGatewayFailure, context: ClassifyContext): RetryClass {
  switch (failure.kind) {
    case "meter_refused": {
      const { code } = failure.error;
      if (isParkingMeterCode(code)) return "parked";
      if (code === "RESOURCE_NOT_FOUND" && context.taskTerminal) return "closed";
      return "permanent";
    }
    case "duplicate_attempt":
      // `key_reused_for_different_call`: the key belonged to another call (a
      // retry that landed on an earlier re-ask row). Nothing was sent; the retry
      // moves past it. Without that reason the meter found THIS call's own row
      // (C-METER returns its `usageId`): an earlier execution of the same call
      // whose outcome this run does not know, which may have billed. That is
      // indeterminate: one retry at `nextAttempt`, never an open-ended loop.
      return failure.reason === "key_reused_for_different_call" ? "retryable_unbilled" : "indeterminate";
    case "provider": {
      if (failure.billed === "actual") return "permanent";
      if (failure.billed === "possible" || failure.errorClass === "timeout" || failure.errorClass === "indeterminate") {
        return "indeterminate";
      }
      return failure.retryable ? "retryable_unbilled" : "permanent";
    }
    case "config":
    case "refusal":
    case "schema_invalid":
    case "internal":
      return "permanent";
  }
}

// ---------------------------------------------------------------------------
// Decisions
// ---------------------------------------------------------------------------

export type RetryDecision =
  /** Run the task again after `delayMs`, with the stored next attempt number. */
  | { readonly action: "retry"; readonly delayMs: number }
  /** Fail the task; refund only when a debit exists. `exhausted` when a retryable class ran out of retries. */
  | { readonly action: "fail"; readonly exhausted: boolean }
  /** Block the task and ask the founder; never retried automatically. */
  | { readonly action: "park" }
  /** Stop: the task was already closed. No refund, no status change. */
  | { readonly action: "close" };

/**
 * What to do after an execution of class `current`, given the `errorCode`s of
 * the task's earlier executions (any order; non-class codes are ignored).
 */
export function retryDecision(current: RetryClass, earlierErrorCodes: readonly (string | undefined)[]): RetryDecision {
  const used = (cls: RetryClass) => earlierErrorCodes.filter((code) => code === cls).length;
  switch (current) {
    case "retryable_unbilled": {
      const retries = used("retryable_unbilled");
      if (retries >= MAX_RETRYABLE_RETRIES) return { action: "fail", exhausted: true };
      return { action: "retry", delayMs: RETRYABLE_BACKOFF_MS[Math.min(retries, RETRYABLE_BACKOFF_MS.length - 1)] };
    }
    case "indeterminate": {
      if (used("indeterminate") >= MAX_INDETERMINATE_RETRIES) return { action: "fail", exhausted: true };
      return { action: "retry", delayMs: INDETERMINATE_BACKOFF_MS };
    }
    case "permanent":
      return { action: "fail", exhausted: false };
    case "parked":
      return { action: "park" };
    case "closed":
      return { action: "close" };
  }
}

/**
 * The calm, founder-facing reason shown on a parked employee's workstream.
 * Plain words, no codes, no blame.
 */
export function parkedReason(code: ParkingMeterCode): string {
  switch (code) {
    case "AI_DISABLED":
      return "Paused for now: AI work is switched off for a moment. Your team picks this up again when it is back on.";
    case "WORKSPACE_DISABLED":
      return "Paused for now: the workspace is offline for a moment. Your team picks this up again when it is back.";
    case "BUDGET_EXHAUSTED":
      // The meter's budget may be a daily cap or a lifetime ceiling: promise no date.
      return "Paused: the AI allowance available to you is used up for now. Resume this step when more is available.";
  }
}

/** The founder-facing note on a workstream whose step failed for good. */
export const FAILED_STEP_REASON =
  "This step could not finish. It used none of your credits; you can ask your team to try again.";

/**
 * The founder-facing note when a paid step failed in an archived business. The
 * refund cannot run there (the ledger refuses archived tasks and businesses),
 * so the credits stay spent; nothing is promised.
 */
export const FAILED_STEP_ARCHIVED_REASON =
  "This step could not finish. This business is archived, so its credits could not be returned automatically.";

/** The founder-facing note when a failed step's credits are being returned (the refund is scheduled). */
export const FAILED_STEP_REFUNDED_REASON =
  "This step could not finish, so its credits are being returned. You can ask your team to try again.";

/**
 * The founder-facing note when a step was interrupted (its action died and
 * nothing can re-run it) and no credits were taken. Failing frees the change
 * round, so trying again is always possible.
 */
export const FAILED_STEP_INTERRUPTED_REASON =
  "This step was interrupted before it finished. It used none of your credits; you can ask your team to try again.";

/** The same, when the interrupted step's credits are being returned (the refund is scheduled). */
export const FAILED_STEP_INTERRUPTED_REFUNDED_REASON =
  "This step was interrupted before it finished, so its credits are being returned. You can ask your team to try again.";

/**
 * The founder-facing note when a paid step had no recorded payment: it never
 * starts (it must not run on the free allowance), and nothing was charged.
 */
export const FAILED_STEP_UNPAID_REASON =
  "This step could not start because its payment was not recorded. Nothing was charged; you can ask your team to try again.";

/**
 * WP75-S3a: the founder-facing note when a draft failed the deterministic
 * quality checks (a faked proof, a market number in an own idea, a colour pair
 * below AA contrast). The draft is not shown; no credits were taken.
 */
export const FAILED_STEP_QUALITY_REASON =
  "This draft did not pass our quality checks, so your team did not show it. It used none of your credits; you can ask your team to try again.";

/** The same, when the step's credits are being returned (the refund is scheduled). */
export const FAILED_STEP_QUALITY_REFUNDED_REASON =
  "This draft did not pass our quality checks, so your team did not show it and its credits are being returned. You can ask your team to try again.";
