import { describe, expect, test } from "vitest";
import {
  classifyFailure,
  executePaidStep,
  MAX_ATTEMPTS,
  realWithTimeout,
  StepTimeoutError,
  type AttemptRecord,
  type PaidStepDeps,
} from "./executor";
import {
  decideReconcile,
  PROVIDER_REPLAY_SAFETY,
  replaySafetyFor,
  type ReplaySafety,
} from "./reconcile";
import { ProviderCallError, ProviderConfigError } from "./providers/types";

/**
 * WP26-S3. The executor decides whether the customer's money gets spent, so
 * these tests count paid calls rather than asserting on status strings alone:
 * "failed" is only correct if it failed after the right number of calls.
 */

type Harness<T> = {
  deps: PaidStepDeps<T>;
  /** Every effect, in order, so ordering bugs are visible and not inferred. */
  log: string[];
  callCount: () => number;
};

function harness<T>(options: {
  replaySafety?: ReplaySafety;
  prior?: AttemptRecord | null;
  cancelled?: boolean | (() => boolean);
  reserve?: (attempt: number) => void;
  responses: Array<() => T>;
}): Harness<T> {
  const log: string[] = [];
  let calls = 0;
  const cancelled = options.cancelled ?? false;

  const deps: PaidStepDeps<T> = {
    replaySafety: options.replaySafety ?? "none",
    idempotencyKey: "task-key:step:1",
    timeoutMs: 1_000,
    readAttempt: async () => options.prior ?? null,
    beginAttempt: async (attempt) => {
      log.push(`begin:${attempt}`);
    },
    settleAttempt: async (attempt, outcome, errorCode) => {
      log.push(`settle:${attempt}:${outcome}${errorCode ? `:${errorCode}` : ""}`);
    },
    reserve: async (attempt) => {
      log.push(`reserve:${attempt}`);
      options.reserve?.(attempt);
    },
    isCancelled: async () =>
      typeof cancelled === "function" ? cancelled() : cancelled,
    call: async ({ attempt }) => {
      log.push(`call:${attempt}`);
      const response = options.responses[calls];
      calls += 1;
      if (response === undefined) {
        throw new Error(`unexpected call #${calls} — executor over-called`);
      }
      return response();
    },
    withTimeout: (promise) => promise(),
  };

  return { deps, log, callCount: () => calls };
}

const ok = <T,>(value: T) => () => value;
const httpError = (status: number) => () => {
  throw new ProviderCallError("search", `provider returned ${status}`, {
    retryable: status === 429 || status >= 500,
    status,
  });
};
const networkError = () => {
  throw new ProviderCallError("search", "request failed", { retryable: true });
};

describe("classifyFailure", () => {
  test("429 and 5xx are the only classes safe to retry", () => {
    expect(classifyFailure(new ProviderCallError("search", "", { retryable: true, status: 429 }))).toBe(
      "retryable-unbilled",
    );
    expect(classifyFailure(new ProviderCallError("search", "", { retryable: true, status: 503 }))).toBe(
      "retryable-unbilled",
    );
  });

  test("a 4xx that is not 429 is permanent — a retry reproduces it", () => {
    for (const status of [400, 401, 403, 404, 422]) {
      expect(
        classifyFailure(new ProviderCallError("search", "", { retryable: false, status })),
      ).toBe("permanent");
    }
  });

  test("a missing HTTP status is indeterminate, not retryable", () => {
    // S2 marks network failures and unparseable 200s `retryable: true`. That
    // flag describes whether the error is transient, not whether we were
    // billed — an unparseable 200 was billed. The executor must not inherit it.
    const unparseable = new ProviderCallError("synthesis", "unparseable response", {
      retryable: true,
    });
    expect(unparseable.retryable).toBe(true);
    expect(classifyFailure(unparseable)).toBe("indeterminate");
  });

  test("a config error is permanent and an unknown throw is indeterminate", () => {
    expect(classifyFailure(new ProviderConfigError("synthesis", "missing key"))).toBe(
      "permanent",
    );
    expect(classifyFailure(new Error("boom"))).toBe("indeterminate");
  });
});

describe("executePaidStep — the happy path", () => {
  test("succeeds on one call, reserving before it", async () => {
    const h = harness({ responses: [ok("result")] });
    const outcome = await executePaidStep(h.deps);

    expect(outcome).toEqual({ status: "succeeded", value: "result", attempts: 1 });
    expect(h.log).toEqual(["reserve:1", "begin:1", "call:1", "settle:1:succeeded"]);
  });

  test("records the attempt durably BEFORE issuing the call", async () => {
    // If `begin` landed after the call, a crash in between would leave no
    // evidence that money was spent, and the resumed step would resend.
    const h = harness({ responses: [ok("result")] });
    await executePaidStep(h.deps);

    expect(h.log.indexOf("begin:1")).toBeLessThan(h.log.indexOf("call:1"));
  });

  test("passes the stable idempotency key to the provider", async () => {
    let seen: string | null = null;
    const h = harness({ responses: [ok("x")] });
    const outcome = await executePaidStep({
      ...h.deps,
      call: async ({ idempotencyKey }) => {
        seen = idempotencyKey;
        return "x";
      },
    });

    expect(outcome.status).toBe("succeeded");
    expect(seen).toBe("task-key:step:1");
  });
});

describe("executePaidStep — retry-once", () => {
  test("retries exactly once after a 429 and succeeds", async () => {
    const h = harness({ responses: [httpError(429), ok("second")] });
    const outcome = await executePaidStep(h.deps);

    expect(outcome).toEqual({ status: "succeeded", value: "second", attempts: 2 });
    expect(h.callCount()).toBe(2);
  });

  test("both attempts failing costs exactly two calls — not one, not three", async () => {
    const h = harness({ responses: [httpError(503), httpError(503)] });
    const outcome = await executePaidStep(h.deps);

    expect(outcome.status).toBe("failed");
    expect(h.callCount()).toBe(2);
    expect(h.callCount()).toBe(MAX_ATTEMPTS);
  });

  test("reserves before the retry as well as before the first attempt", async () => {
    const h = harness({ responses: [httpError(503), ok("second")] });
    await executePaidStep(h.deps);

    expect(h.log.filter((entry) => entry.startsWith("reserve:"))).toEqual([
      "reserve:1",
      "reserve:2",
    ]);
  });

  test("settles the failed first attempt before the retry is issued", async () => {
    // Otherwise a crash between the two attempts looks like an in-flight call
    // and the resumed step fails closed over an outcome we already knew.
    const h = harness({ responses: [httpError(503), ok("second")] });
    await executePaidStep(h.deps);

    expect(h.log.indexOf("settle:1:failed:PROVIDER_HTTP_503")).toBeLessThan(
      h.log.indexOf("call:2"),
    );
  });
});

describe("executePaidStep — failures that must not be retried", () => {
  test("a 4xx stops after one call", async () => {
    const h = harness({ responses: [httpError(400)] });
    const outcome = await executePaidStep(h.deps);

    expect(outcome).toEqual({
      status: "failed",
      errorCode: "PROVIDER_HTTP_400",
      attempts: 1,
    });
    expect(h.callCount()).toBe(1);
  });

  test("a config error stops after one call", async () => {
    const h = harness({
      responses: [
        () => {
          throw new ProviderConfigError("synthesis", "missing OPENAI_API_KEY");
        },
      ],
    });
    const outcome = await executePaidStep(h.deps);

    expect(outcome.status).toBe("failed");
    expect(h.callCount()).toBe(1);
  });

  test("an indeterminate failure stops after one call rather than risking a double charge", async () => {
    const h = harness({ responses: [networkError] });
    const outcome = await executePaidStep(h.deps);

    expect(outcome).toEqual({
      status: "failed",
      errorCode: "PROVIDER_CALL_FAILED",
      attempts: 1,
    });
    expect(h.callCount()).toBe(1);
  });

  test("a timeout stops after one call and reports STEP_TIMEOUT", async () => {
    const h = harness<string>({ responses: [ok("never seen")] });
    const outcome = await executePaidStep({
      ...h.deps,
      withTimeout: async () => {
        throw new StepTimeoutError(1_000);
      },
    });

    expect(outcome).toEqual({
      status: "failed",
      errorCode: "STEP_TIMEOUT",
      attempts: 1,
    });
  });
});

describe("executePaidStep — the crash window", () => {
  test("an unsettled prior attempt issues NO call under the default policy", async () => {
    const h = harness({
      prior: { attempt: 1, settled: false },
      responses: [ok("must not happen")],
    });
    const outcome = await executePaidStep(h.deps);

    expect(outcome).toEqual({
      status: "failed",
      errorCode: "UNSETTLED_ATTEMPT_NOT_REPLAYABLE",
      attempts: 1,
    });
    expect(h.callCount()).toBe(0);
    expect(h.log).toEqual(["settle:1:failed:UNSETTLED_ATTEMPT_NOT_REPLAYABLE"]);
  });

  test("a settled prior failure resumes into the remaining retry", async () => {
    const h = harness({
      prior: { attempt: 1, settled: true },
      responses: [ok("resumed")],
    });
    const outcome = await executePaidStep(h.deps);

    expect(outcome).toEqual({ status: "succeeded", value: "resumed", attempts: 2 });
    expect(h.log).toEqual(["reserve:2", "begin:2", "call:2", "settle:2:succeeded"]);
  });

  test("a re-entered step with both attempts spent issues no third call", async () => {
    // `responses` is deliberately non-empty: if the ceiling were only checked
    // inside the retry branch, this step would happily buy a third call and the
    // test would go green on a `succeeded` outcome.
    const h = harness({
      prior: { attempt: MAX_ATTEMPTS, settled: true },
      responses: [ok("a third paid call")],
    });
    const outcome = await executePaidStep(h.deps);

    expect(outcome).toEqual({
      status: "failed",
      errorCode: "STEP_ATTEMPTS_EXHAUSTED",
      attempts: MAX_ATTEMPTS,
    });
    expect(h.callCount()).toBe(0);
    expect(h.log).toEqual([]);
  });

  test("under a dedupe-capable provider it resends under the SAME attempt number", async () => {
    const h = harness({
      replaySafety: "idempotency-key",
      prior: { attempt: 1, settled: false },
      responses: [ok("original")],
    });
    const outcome = await executePaidStep(h.deps);

    expect(outcome).toEqual({ status: "succeeded", value: "original", attempts: 1 });
    // No second `begin:1` — the durable record already exists, and the counter
    // must not advance or the resend would consume the retry budget.
    expect(h.log).toEqual(["reserve:1", "call:1", "settle:1:succeeded"]);
  });

  test("a resend that then hits a 429 still gets exactly one retry", async () => {
    const h = harness({
      replaySafety: "idempotency-key",
      prior: { attempt: 1, settled: false },
      responses: [httpError(429), ok("second")],
    });
    const outcome = await executePaidStep(h.deps);

    expect(outcome).toEqual({ status: "succeeded", value: "second", attempts: 2 });
    expect(h.callCount()).toBe(2);
  });

  test("a role promoted to lookup without an implementation fails closed", async () => {
    const h = harness({
      replaySafety: "lookup",
      prior: { attempt: 1, settled: false },
      responses: [ok("must not happen")],
    });
    const outcome = await executePaidStep(h.deps);

    expect(outcome).toEqual({
      status: "failed",
      errorCode: "RECONCILE_LOOKUP_UNIMPLEMENTED",
      attempts: 1,
    });
    expect(h.callCount()).toBe(0);
  });
});

describe("executePaidStep — cancellation", () => {
  test("a cancelled run issues no call at all", async () => {
    const h = harness({ cancelled: true, responses: [ok("must not happen")] });
    const outcome = await executePaidStep(h.deps);

    expect(outcome).toEqual({ status: "cancelled", attempts: 0 });
    expect(h.callCount()).toBe(0);
    expect(h.log).toEqual([]);
  });

  test("cancelling between attempts settles the in-flight call and then stops", async () => {
    let cancelled = false;
    const h = harness({
      cancelled: () => cancelled,
      responses: [
        () => {
          cancelled = true;
          throw new ProviderCallError("search", "503", {
            retryable: true,
            status: 503,
          });
        },
      ],
    });
    const outcome = await executePaidStep(h.deps);

    expect(outcome).toEqual({ status: "cancelled", attempts: 1 });
    // The first attempt was settled — not abandoned — before stopping.
    expect(h.log).toContain("settle:1:failed:PROVIDER_HTTP_503");
    expect(h.callCount()).toBe(1);
  });
});

describe("executePaidStep — the cost seam", () => {
  test("a rejected reservation issues no call and records none", async () => {
    const h = harness({
      reserve: () => {
        throw new Error("cap would be exceeded");
      },
      responses: [ok("must not happen")],
    });
    const outcome = await executePaidStep(h.deps);

    expect(outcome).toEqual({
      status: "failed",
      errorCode: "COST_RESERVATION_REJECTED",
      attempts: 0,
    });
    expect(h.callCount()).toBe(0);
    expect(h.log).toEqual(["reserve:1"]);
  });

  test("a reservation that rejects only the retry leaves exactly one paid call", async () => {
    const h = harness({
      reserve: (attempt) => {
        if (attempt === 2) throw new Error("retry would exceed the cap");
      },
      responses: [httpError(503), ok("must not happen")],
    });
    const outcome = await executePaidStep(h.deps);

    expect(outcome).toEqual({
      status: "failed",
      errorCode: "COST_RESERVATION_REJECTED",
      attempts: 1,
    });
    expect(h.callCount()).toBe(1);
  });
});

describe("reconcile policy", () => {
  test("every provider role defaults to the fail-closed policy", () => {
    // Promoting a role is a money decision gated on live verification with
    // credentials. If this fails, that evidence must exist first.
    for (const role of ["synthesis", "search", "keywordData"] as const) {
      expect(replaySafetyFor(role)).toBe("none");
    }
    expect(Object.values(PROVIDER_REPLAY_SAFETY).every((s) => s === "none")).toBe(true);
  });

  test("maps each safety level to its one permitted action", () => {
    expect(decideReconcile("none").action).toBe("fail-closed");
    expect(decideReconcile("idempotency-key").action).toBe("resend");
    expect(decideReconcile("lookup").action).toBe("lookup");
  });
});

describe("realWithTimeout", () => {
  test("rejects with StepTimeoutError when the work outlasts the budget", async () => {
    await expect(
      realWithTimeout(() => new Promise((resolve) => setTimeout(resolve, 50)), 5),
    ).rejects.toBeInstanceOf(StepTimeoutError);
  });

  test("passes a fast result straight through", async () => {
    await expect(realWithTimeout(async () => "quick", 1_000)).resolves.toBe("quick");
  });
});
