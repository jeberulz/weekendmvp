/**
 * WP75-S2b. The launch step registry and the DAG rule (`./steps.ts`), pure.
 */
import { describe, expect, test } from "vitest";

import { CREW_STEP_ARTIFACTS } from "../../lib/workspace/crew/tasks";
import { RUN_LEASE_MS } from "./jobs";
import {
  LAUNCH_STEPS,
  LAUNCH_STEP_KEYS,
  MAX_ACTION_FAILURES,
  evaluateLaunch,
  isPoolStep,
  launchStep,
  readySteps,
  stepDoneDecision,
  waitingOnReason,
  type LaunchFacts,
  type LaunchStepKey,
  type LaunchStepState,
  type StepOutcome,
} from "./steps";

const HYDROTRAIL_HIRED = ["lead", "brand", "landing", "seo", "marketing", "email", "social", "engineering", "ads"];

function facts(partial: Partial<LaunchFacts> = {}): LaunchFacts {
  return { rosterWritten: false, hired: new Set(), skipped: new Map(), tasks: {}, ...partial };
}

const states = (input: LaunchFacts): Record<LaunchStepKey, LaunchStepState> =>
  Object.fromEntries(evaluateLaunch(input).map((entry) => [entry.key, entry.state])) as Record<LaunchStepKey, LaunchStepState>;

function ancestors(key: LaunchStepKey): Set<LaunchStepKey> {
  const out = new Set<LaunchStepKey>();
  const visit = (current: LaunchStepKey) => {
    for (const parent of LAUNCH_STEPS.find((step) => step.key === current)?.parents ?? []) {
      if (!out.has(parent)) {
        out.add(parent);
        visit(parent);
      }
    }
  };
  visit(key);
  return out;
}

describe("the registry", () => {
  test("lists every key once, in topological order", () => {
    expect(LAUNCH_STEPS.map((step) => step.key)).toEqual([...LAUNCH_STEP_KEYS]);
    LAUNCH_STEPS.forEach((step, index) => {
      for (const parent of step.parents) expect(LAUNCH_STEP_KEYS.indexOf(parent)).toBeLessThan(index);
    });
  });

  test("a built step's step inputs are all among its ancestors", () => {
    for (const step of LAUNCH_STEPS.filter((entry) => entry.status === "built")) {
      const above = ancestors(step.key);
      for (const input of step.inputs) {
        if ("step" in input) expect(above.has(input.step), `${step.key} reads ${input.step}`).toBe(true);
      }
    }
  });

  test("the blueprint, the brand kit, (WP76-S1a) the email sequence and (S2a) the social pack run on the pool; the roster is written by the blueprint's finish", () => {
    expect(LAUNCH_STEPS.filter(isPoolStep).map((step) => step.key)).toEqual(["blueprint", "brand_kit", "email_sequence", "social_pack"]);
    // The email sequence and the social pack run under the brand kit, never without its voice.
    expect(launchStep("email_sequence")).toMatchObject({ parents: ["brand_kit"], status: "built", runner: "generator" });
    // S2a: the social pack reads the blueprint and the kit only (no wizard answers).
    expect(launchStep("social_pack")).toMatchObject({
      parents: ["brand_kit"], status: "built", runner: "generator", inputs: [{ step: "blueprint" }, { step: "brand_kit" }],
    });
    expect(LAUNCH_STEPS.find((step) => step.key === "roster")).toMatchObject({ status: "built", runner: "roster" });
    for (const step of LAUNCH_STEPS.filter(isPoolStep)) {
      expect(step.jobType === "crew_roster" ? null : CREW_STEP_ARTIFACTS[step.jobType]).not.toBeNull();
    }
  });

  test("every slot names the story that builds it", () => {
    for (const step of LAUNCH_STEPS.filter((entry) => entry.status !== "built")) expect(step.pendingStory).toBeTruthy();
  });
});

describe("evaluateLaunch", () => {
  test("a fresh launch: the blueprint is ready, everything below it waits", () => {
    const s = states(facts({ tasks: { blueprint: { status: "queued", enqueued: false } } }));
    expect(s.blueprint).toBe("queued");
    expect(s.roster).toBe("waiting");
    expect(s.brand_kit).toBe("waiting");
  });

  test("an enqueued queued task reads as running; blocked as paused; failed and cancelled as failed", () => {
    expect(states(facts({ tasks: { blueprint: { status: "queued", enqueued: true } } })).blueprint).toBe("running");
    expect(states(facts({ tasks: { blueprint: { status: "blocked", enqueued: true } } })).blueprint).toBe("paused");
    expect(states(facts({ tasks: { blueprint: { status: "failed", enqueued: false } } })).blueprint).toBe("failed");
    expect(states(facts({ tasks: { blueprint: { status: "cancelled", enqueued: false } } })).blueprint).toBe("failed");
  });

  test("after the roster: the brand kit is ready; a slot under it waits on it; others are skipped with a reason; skipped roles carry the roster's reason", () => {
    const evaluated = evaluateLaunch(facts({
      rosterWritten: true,
      hired: new Set(HYDROTRAIL_HIRED.filter((role) => role !== "seo")),
      skipped: new Map([["seo", "No search intent"]]),
      tasks: { blueprint: { status: "succeeded", enqueued: false }, brand_kit: { status: "queued", enqueued: false } },
    }));
    const byKey = new Map(evaluated.map((entry) => [entry.key, entry]));
    expect(byKey.get("roster")).toMatchObject({ state: "succeeded", done: true });
    expect(byKey.get("brand_kit")).toMatchObject({ state: "queued" });
    // A slot whose parent is not done yet waits on it by name (S2b review nit); it reads "skipped" only once its parents are done.
    expect(byKey.get("logo_marks")).toMatchObject({ state: "waiting", done: false, reason: "Waiting on the brand kit." });
    expect(byKey.get("build_pack")).toMatchObject({ state: "skipped", done: true, reason: expect.stringContaining("not built yet") });
    expect(byKey.get("seo_pack")).toMatchObject({ state: "skipped", skippedByRoster: true, reason: "No search intent" });
    expect(byKey.get("launch_plan")).toMatchObject({ state: "skipped", reason: expect.stringContaining("later update") });
    expect(readySteps(evaluated).map((step) => step.key)).toEqual(["brand_kit"]);
  });

  test("a child of a step whose role the roster skipped is skipped too", () => {
    const evaluated = evaluateLaunch(facts({
      rosterWritten: true,
      hired: new Set(["lead", "landing"]),
      skipped: new Map([["brand", "No brand"]]),
      tasks: { blueprint: { status: "succeeded", enqueued: false } },
    }));
    const byKey = new Map(evaluated.map((entry) => [entry.key, entry]));
    expect(byKey.get("brand_kit")).toMatchObject({ state: "skipped", reason: "No brand" });
    // Logo marks are the brand designer's too, so they carry the roster's reason; the landing page below them cascades.
    expect(byKey.get("logo_marks")).toMatchObject({ state: "skipped", skippedByRoster: true, reason: "No brand" });
    expect(byKey.get("landing_spec")).toMatchObject({ state: "skipped", skippedByRoster: true, reason: "Needs the logo marks, which this team skips." });
    expect(readySteps(evaluated)).toEqual([]);
  });

  test("a failed, running, queued or paused parent blocks its built child", () => {
    const steps = LAUNCH_STEPS.map((step) => step.key === "build_pack"
      ? { ...step, status: "built" as const, runner: "generator" as const, parents: ["brand_kit" as const] }
      : step);
    for (const parent of ["failed", "running", "queued", "blocked"] as const) {
      const evaluated = evaluateLaunch(facts({
        rosterWritten: true,
        hired: new Set(HYDROTRAIL_HIRED),
        tasks: {
          blueprint: { status: "succeeded", enqueued: false },
          brand_kit: { status: parent, enqueued: false },
          build_pack: { status: "queued", enqueued: false },
        },
      }), steps);
      expect(evaluated.find((entry) => entry.key === "build_pack")?.state, parent).toBe("waiting");
      expect(readySteps(evaluated, steps).map((step) => step.key)).not.toContain("build_pack");
    }
    const ok = evaluateLaunch(facts({
      rosterWritten: true,
      hired: new Set(HYDROTRAIL_HIRED),
      tasks: {
        blueprint: { status: "succeeded", enqueued: false },
        brand_kit: { status: "succeeded", enqueued: false },
        build_pack: { status: "queued", enqueued: false },
      },
    }), steps);
    expect(readySteps(ok, steps).map((step) => step.key)).toEqual(["build_pack"]);
  });

  test("a child of a pending slot runs once the slot's own parents are done", () => {
    const steps = LAUNCH_STEPS.map((step) => step.key === "landing_spec"
      ? { ...step, status: "built" as const, runner: "generator" as const }
      : step);
    const evaluated = evaluateLaunch(facts({
      rosterWritten: true,
      hired: new Set(HYDROTRAIL_HIRED),
      tasks: {
        blueprint: { status: "succeeded", enqueued: false },
        brand_kit: { status: "succeeded", enqueued: false },
        landing_spec: { status: "queued", enqueued: false },
      },
    }), steps);
    expect(evaluated.find((entry) => entry.key === "logo_marks")).toMatchObject({ state: "skipped", done: true });
    expect(readySteps(evaluated, steps).map((step) => step.key)).toEqual(["landing_spec"]);
  });
});

describe("stepDoneDecision", () => {
  const live = { status: "running" as const, archived: false };
  const ok = (returnValue: StepOutcome) => ({ kind: "success" as const, returnValue });

  test("retry: again after the runner's delay, failures reset", () => {
    expect(stepDoneDecision(ok({ kind: "retry", delayMs: 4_000 }), live, 2, RUN_LEASE_MS)).toEqual({ kind: "reenqueue", delayMs: 4_000, actionFailures: 0 });
  });

  test("in_flight: again after the lease", () => {
    expect(stepDoneDecision(ok({ kind: "skipped", reason: "in_flight" }), { status: "queued", archived: false }, 0, RUN_LEASE_MS))
      .toEqual({ kind: "reenqueue", delayMs: RUN_LEASE_MS, actionFailures: 0 });
  });

  test(`action failure: again after the lease, counted; abandoned at ${MAX_ACTION_FAILURES} in a row`, () => {
    expect(stepDoneDecision({ kind: "failed" }, live, 0, RUN_LEASE_MS)).toEqual({ kind: "reenqueue", delayMs: RUN_LEASE_MS, actionFailures: 1 });
    expect(stepDoneDecision({ kind: "canceled" }, live, 1, RUN_LEASE_MS)).toEqual({ kind: "reenqueue", delayMs: RUN_LEASE_MS, actionFailures: 2 });
    expect(stepDoneDecision({ kind: "failed" }, live, MAX_ACTION_FAILURES - 1, RUN_LEASE_MS)).toEqual({ kind: "abandon" });
  });

  test("the task decides once it is terminal or parked, whatever the outcome says", () => {
    for (const status of ["succeeded", "failed", "cancelled"] as const) {
      expect(stepDoneDecision({ kind: "failed" }, { status, archived: false }, 0, RUN_LEASE_MS)).toEqual({ kind: "settle" });
      expect(stepDoneDecision(ok({ kind: "skipped", reason: "terminal" }), { status, archived: false }, 0, RUN_LEASE_MS)).toEqual({ kind: "settle" });
    }
    expect(stepDoneDecision(ok({ kind: "parked" }), { status: "blocked", archived: false }, 0, RUN_LEASE_MS)).toEqual({ kind: "park" });
    expect(stepDoneDecision(ok({ kind: "retry", delayMs: 1 }), { status: "running", archived: true }, 0, RUN_LEASE_MS)).toEqual({ kind: "settle" });
  });

  test("a final-looking outcome on a task still live (a stale finish) is retried like an action failure", () => {
    expect(stepDoneDecision(ok({ kind: "stale" }), live, 0, RUN_LEASE_MS)).toEqual({ kind: "reenqueue", delayMs: RUN_LEASE_MS, actionFailures: 1 });
  });
});

describe("waitingOnReason", () => {
  test("names the parent a step waits on, and the roster as the team", () => {
    expect(waitingOnReason(launchStep("brand_kit"))).toBe("Waiting on the brand kit.");
    expect(waitingOnReason(launchStep("roster"))).toBe("Waiting on the team.");
  });
});
