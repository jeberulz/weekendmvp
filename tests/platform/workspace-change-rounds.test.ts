/**
 * WP77-S2 — the pure change-round helpers (`lib/workspace/changeRounds.ts`):
 * the next round from an artifact's tasks, and the D17 price decision.
 */
import { describe, expect, test } from "vitest";

import {
  REVISABLE_JOB_TYPES,
  decideChangeRound,
  nextChangeRound,
  spendTermsFor,
  type LineageTask,
} from "../../lib/workspace/changeRounds";
import {
  CREDIT_ACTIONS,
  PRICE_TBD_JOB_TYPES,
  REGENERATE_ACTION_BY_JOB_TYPE,
  WORKSPACE_PLAN_IDS,
} from "../../lib/workspace/contracts/jobs";

const task = (id: string, revision: number, status = "succeeded"): LineageTask => ({ id, revision, status });

describe("nextChangeRound", () => {
  test("the first draft alone gives round 1; each finished round adds one", () => {
    expect(nextChangeRound([task("a", 0)], "a")).toEqual({ state: "ready", changeRound: 1 });
    expect(nextChangeRound([task("a", 0), task("b", 1), task("c", 2)], "c")).toEqual({ state: "ready", changeRound: 3 });
  });

  test("failed and cancelled rounds give the round back", () => {
    const tasks = [task("a", 0), task("x", 1, "failed"), task("y", 1, "cancelled"), task("b", 1)];
    expect(nextChangeRound(tasks, "b")).toEqual({ state: "ready", changeRound: 2 });
  });

  test("a queued, running or blocked draft is busy", () => {
    for (const status of ["queued", "running", "blocked"]) {
      expect(nextChangeRound([task("a", 0), task("b", 1, status)], "a")).toEqual({ state: "busy" });
    }
  });

  test("an older, failed or unknown reviewed draft is stale", () => {
    expect(nextChangeRound([task("a", 0), task("b", 1)], "a")).toEqual({ state: "stale" });
    expect(nextChangeRound([task("a", 0), task("b", 1, "failed")], "b")).toEqual({ state: "stale" });
    expect(nextChangeRound([task("a", 0)], "zzz")).toEqual({ state: "stale" });
    expect(nextChangeRound([], "a")).toEqual({ state: "stale" });
  });

  test("duplicate, negative or missing revisions fail closed", () => {
    expect(nextChangeRound([task("a", 0), task("b", 0)], "b")).toEqual({ state: "conflict" });
    expect(nextChangeRound([task("a", 0), task("b", 2)], "b")).toEqual({ state: "conflict" });
    expect(nextChangeRound([task("a", -1)], "a")).toEqual({ state: "conflict" });
  });
});

describe("decideChangeRound", () => {
  test("rounds 1 and 2 are free for every revisable artifact on every plan", () => {
    for (const jobType of REVISABLE_JOB_TYPES) {
      for (const plan of WORKSPACE_PLAN_IDS) {
        expect(decideChangeRound({ jobType, changeRound: 1, plan })).toEqual({ decision: "free", changeRound: 1, freeRoundsLeft: 1 });
        expect(decideChangeRound({ jobType, changeRound: 2, plan })).toEqual({ decision: "free", changeRound: 2, freeRoundsLeft: 0 });
      }
    }
  });

  test("round 3+ of a priced artifact costs exactly its C-JOBS regenerate price", () => {
    for (const [jobType, action] of Object.entries(REGENERATE_ACTION_BY_JOB_TYPE)) {
      for (const changeRound of [3, 4, 9]) {
        expect(decideChangeRound({ jobType: jobType as keyof typeof REGENERATE_ACTION_BY_JOB_TYPE, changeRound, plan: "free" }))
          .toEqual({ decision: "spend", changeRound, costCredits: CREDIT_ACTIONS[action].credits, action });
      }
    }
    expect(decideChangeRound({ jobType: "crew_brand_kit", changeRound: 3, plan: "free" })).toMatchObject({ costCredits: 11 });
  });

  test("round 3+ of an unpriced artifact is not available, never free", () => {
    for (const jobType of PRICE_TBD_JOB_TYPES) {
      expect(decideChangeRound({ jobType, changeRound: 3, plan: "growth" }))
        .toEqual({ decision: "not_available", changeRound: 3, reason: "price_not_set" });
    }
  });

  test("hires and Studio renders are not revisable; round 0 and bad rounds throw", () => {
    for (const jobType of ["crew_hire", "studio_image", "studio_video"] as const) {
      expect(decideChangeRound({ jobType, changeRound: 1, plan: "growth" })).toMatchObject({ decision: "not_available", reason: "not_revisable" });
    }
    for (const changeRound of [0, -1, 1.5, Number.NaN]) {
      expect(() => decideChangeRound({ jobType: "crew_brand_kit", changeRound, plan: "free" })).toThrow(/change round/);
    }
  });

  test("spendTermsFor gives the bigint terms assertApproved expects", () => {
    const decision = decideChangeRound({ jobType: "crew_landing", changeRound: 3, plan: "free" });
    if (decision.decision !== "spend") throw new Error("expected spend");
    expect(spendTermsFor(decision)).toEqual({ expectedCostCredits: 5n, expectedChangeRound: 3n });
  });
});
