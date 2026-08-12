import { ProviderCallError, ProviderConfigError } from "./providers/types";
import { decideReconcile, type ReplaySafety } from "./reconcile";

/**
 * WP26-S3. The paid-step executor: one place that decides whether a provider
 * call may be issued, retried, or must fail closed.
 *
 * Deliberately free of Convex and of `fetch` — every effect is injected — so the
 * money-relevant branches can be tested exhaustively without a backend, a
 * network, or a clock.
 */

/** The ruled policy allows one retry, so at most two paid attempts per step. */
export const MAX_ATTEMPTS = 2;

/**
 * How a failed attempt constrains the next one.
 *
 * The distinction that matters is not "was this error transient" but **"do we
 * know the provider did not bill us"**. Retrying a call that may already have
 * been billed spends the customer's money twice for one step, so only the
 * `retryable-unbilled` class may be retried.
 */
export type FailureClass =
  /**
   * The provider answered with a rejection it does not bill for — 429, or a
   * 5xx. The request demonstrably did not produce a billable result, so a
   * second attempt cannot double-charge.
   */
  | "retryable-unbilled"
  /**
   * We do not know whether the provider billed us: our own timeout fired, the
   * connection dropped after the request was sent, or a 200 came back that we
   * could not turn into a usable result. The call may well have been charged.
   */
  | "indeterminate"
  /**
   * The provider answered definitively and a second identical call would fail
   * identically: a 4xx that is not 429, or a misconfiguration. Retrying spends
   * the retry budget to reproduce the same failure.
   */
  | "permanent";

export function classifyFailure(error: unknown): FailureClass {
  if (error instanceof ProviderConfigError) return "permanent";
  if (error instanceof ProviderCallError) {
    const status = error.status;
    if (status === undefined) {
      // No HTTP status means we never saw a complete, well-formed response:
      // network failure, unparseable body, or a 200 whose content was unusable.
      // All of those may already have been billed.
      return "indeterminate";
    }
    if (status === 429 || status >= 500) return "retryable-unbilled";
    return "permanent";
  }
  // An unrecognised throw is not evidence that nothing was billed.
  return "indeterminate";
}

/**
 * Whether a failed attempt may already have been billed.
 *
 * Owned here because the executor is what mints these codes. `S4` charges a
 * `billed-unknown` failure its full worst-case reservation: we cannot measure
 * what the provider actually charged, and assuming zero would let a run that
 * timed out three times keep issuing calls against a budget it had already
 * spent.
 *
 * Only the *last* attempt of a step can be `billed-unknown` — every class that
 * permits a retry is one we know was not billed — so recording spend for the
 * final attempt alone is complete, not a shortcut.
 */
export function billedOnFailure(errorCode: string): "billed-unknown" | "unbilled" {
  switch (errorCode) {
    // Nothing was sent, or the provider rejected it without billing.
    case "COST_RESERVATION_REJECTED":
    case "STEP_ATTEMPTS_EXHAUSTED":
    case "PROVIDER_CONFIG_ERROR":
      return "unbilled";
    default:
      break;
  }
  // A request the provider answered with an error status is not billed,
  // whatever the status was.
  if (/^PROVIDER_HTTP_\d{3}$/.test(errorCode)) return "unbilled";
  // STEP_TIMEOUT, PROVIDER_CALL_FAILED, UNSETTLED_ATTEMPT_NOT_REPLAYABLE,
  // RECONCILE_LOOKUP_UNIMPLEMENTED, and any unrecognised code: the request may
  // have reached the provider and produced a charge we never saw.
  return "billed-unknown";
}

export class StepTimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`step exceeded ${timeoutMs}ms`);
    this.name = "StepTimeoutError";
  }
}

/** A durable record of a paid attempt, read back on resume. */
export type AttemptRecord = {
  /** How many paid attempts have been issued for this step. */
  readonly attempt: number;
  /** False means an attempt was issued and never settled — the crash window. */
  readonly settled: boolean;
};

export type StepOutcome<T> =
  | { readonly status: "succeeded"; readonly value: T; readonly attempts: number }
  | {
      readonly status: "failed";
      readonly errorCode: string;
      readonly attempts: number;
    }
  | { readonly status: "cancelled"; readonly attempts: number };

export type PaidStepDeps<T> = {
  /**
   * Whether an unsettled earlier attempt for this key may be re-issued.
   * Injected rather than read from the policy table so the call site states
   * which policy it is applying; production passes `replaySafetyFor(role)`.
   */
  readonly replaySafety: ReplaySafety;
  readonly idempotencyKey: string;
  readonly timeoutMs: number;
  /** Durable read of any prior attempt for this exact key. */
  readonly readAttempt: () => Promise<AttemptRecord | null>;
  /**
   * Durably records "attempt N is about to be issued". Must be committed before
   * the provider call — that write is the only reason a crashed step can later
   * tell that money may have been spent.
   */
  readonly beginAttempt: (attempt: number) => Promise<void>;
  readonly settleAttempt: (
    attempt: number,
    outcome: "succeeded" | "failed",
    errorCode?: string,
  ) => Promise<void>;
  /**
   * `S4`'s pre-call cost reservation. Invoked before **every** attempt,
   * including the retry, so a retry cannot carry a run past the $4.00 cap.
   * Throws to reject the call.
   */
  readonly reserve: (attempt: number) => Promise<void>;
  /** Cooperative cancellation: checked before any new paid call is issued. */
  readonly isCancelled: () => Promise<boolean>;
  /** The paid provider call itself. */
  readonly call: (args: {
    readonly idempotencyKey: string;
    readonly attempt: number;
  }) => Promise<T>;
  /** Injected so tests need no timers. */
  readonly withTimeout: <R>(
    promise: () => Promise<R>,
    timeoutMs: number,
  ) => Promise<R>;
};

/**
 * Runs one paid pipeline step to a terminal outcome.
 *
 * Never issues more than `MAX_ATTEMPTS` paid calls, never issues one at all
 * once cancelled, and never issues one that could duplicate an unsettled
 * earlier call.
 */
export async function executePaidStep<T>(
  deps: PaidStepDeps<T>,
): Promise<StepOutcome<T>> {
  const prior = await deps.readAttempt();

  // Resume path. An unsettled prior attempt means the process died between
  // issuing a paid call and recording its result, so the provider may already
  // have billed for work we never received.
  if (prior !== null && !prior.settled) {
    const decision = decideReconcile(deps.replaySafety);
    if (decision.action === "fail-closed") {
      await deps.settleAttempt(
        prior.attempt,
        "failed",
        "UNSETTLED_ATTEMPT_NOT_REPLAYABLE",
      );
      return {
        status: "failed",
        errorCode: "UNSETTLED_ATTEMPT_NOT_REPLAYABLE",
        attempts: prior.attempt,
      };
    }
    if (decision.action === "lookup") {
      // No provider is configured for `lookup` today. Reaching here means a
      // role was promoted in `reconcile.ts` without its lookup implemented;
      // failing closed is the only safe response to that mismatch.
      await deps.settleAttempt(prior.attempt, "failed", "RECONCILE_LOOKUP_UNIMPLEMENTED");
      return {
        status: "failed",
        errorCode: "RECONCILE_LOOKUP_UNIMPLEMENTED",
        attempts: prior.attempt,
      };
    }
    // `resend`: the provider dedupes on our key, so re-issuing under the same
    // key returns the original result rather than buying a second one. The
    // attempt counter deliberately does not advance — this is the same attempt.
  }

  /** Paid calls issued for this step so far, across process lifetimes. */
  let attempt = prior?.attempt ?? 0;

  /**
   * True only for the single re-issue permitted by a `resend` reconciliation.
   * It reuses the existing attempt number and its existing `beginAttempt`
   * record, because the provider treats it as the same call — and it is
   * cleared after one pass so it can never suppress the counter twice.
   */
  let pendingResend = prior !== null && !prior.settled;

  // The attempt ceiling has to be enforced on entry, not only inside the retry
  // branch. A step whose attempts are already spent and which is then
  // re-entered — by a resumed workflow, or a redelivered step — would otherwise
  // walk straight past the loop guard and buy one more call. A `resend` is
  // exempt: it re-issues an existing call under a key the provider dedupes, so
  // it buys nothing new.
  if (attempt >= MAX_ATTEMPTS && !pendingResend) {
    return {
      status: "failed",
      errorCode: "STEP_ATTEMPTS_EXHAUSTED",
      attempts: attempt,
    };
  }

  for (;;) {
    if (await deps.isCancelled()) {
      return { status: "cancelled", attempts: attempt };
    }

    const thisAttempt = pendingResend ? attempt : attempt + 1;

    try {
      await deps.reserve(thisAttempt);
    } catch (error) {
      // Rejected before any call was issued, so `attempt` — the number of paid
      // calls actually made — is unchanged.
      return {
        status: "failed",
        errorCode: errorCodeOf(error, "COST_RESERVATION_REJECTED"),
        attempts: attempt,
      };
    }

    if (!pendingResend) {
      attempt = thisAttempt;
      await deps.beginAttempt(attempt);
    }
    pendingResend = false;

    try {
      const value = await deps.withTimeout(
        () => deps.call({ idempotencyKey: deps.idempotencyKey, attempt }),
        deps.timeoutMs,
      );
      await deps.settleAttempt(attempt, "succeeded");
      return { status: "succeeded", value, attempts: attempt };
    } catch (error) {
      const errorCode = errorCodeOf(error, "STEP_FAILED");
      // Settle before deciding: a crash between here and the retry must not
      // read as an in-flight call, which would fail the resumed step closed
      // over an attempt we already know the outcome of.
      await deps.settleAttempt(attempt, "failed", errorCode);

      if (classifyFailure(error) === "retryable-unbilled" && attempt < MAX_ATTEMPTS) {
        continue;
      }
      return { status: "failed", errorCode, attempts: attempt };
    }
  }
}

function errorCodeOf(error: unknown, fallback: string): string {
  if (error instanceof StepTimeoutError) return "STEP_TIMEOUT";
  if (error instanceof ProviderConfigError) return "PROVIDER_CONFIG_ERROR";
  if (error instanceof ProviderCallError) {
    return error.status === undefined
      ? "PROVIDER_CALL_FAILED"
      : `PROVIDER_HTTP_${error.status}`;
  }
  return fallback;
}

/** Real-clock timeout wrapper. Tests inject their own. */
export function realWithTimeout<R>(
  promise: () => Promise<R>,
  timeoutMs: number,
): Promise<R> {
  return new Promise<R>((resolve, reject) => {
    const timer = setTimeout(() => reject(new StepTimeoutError(timeoutMs)), timeoutMs);
    promise().then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
