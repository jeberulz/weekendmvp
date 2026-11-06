import type { RoleKey } from "../../lib/workspace/contracts/roster";
import type { CrewStepJobType } from "../../lib/workspace/crew/tasks";

/**
 * WP75-S2b — the launch step registry and the DAG rule, as data and pure
 * functions (no Convex calls). `./launch.ts` reads the facts from the database
 * and acts on what `evaluateLaunch` says.
 *
 * DAG (`02` §6.2, reordered by the 2026-11-06 roster ruling):
 *
 *   blueprint → roster → { brand kit text → logo marks ×3 → landing spec;
 *                          build pack;
 *                          WP76: launch plan, SEO pack, email sequence, social pack, ads drafts }
 *
 * Every step lists its job type, employee, inputs and parents. Only steps with
 * a generator are `built`; the rest are slots:
 * - `pending_story`: a WP75 story not built yet (S3b logo marks, S3c landing
 *   spec, S3d build pack);
 * - `pending_wp76`: a WP76 generator.
 * A slot has no task row and never makes a model call. It reads as `skipped`
 * with a plain reason, worked out here from the registry, never stored.
 *
 * The child rule. A step is DONE when it succeeded, or when it is a slot whose
 * own parents are all done (a slot below an unfinished parent reads `waiting`,
 * "Waiting on the <parent>"). A built step runs only when every parent is done.
 * A failed, waiting, queued, running or paused parent blocks it (its task, if
 * any, stays `queued` and is never enqueued). A step whose employee the roster
 * skipped is skipped with the roster's reason, and so is every step below it.
 *
 * Parents follow the story's DAG. Some inputs come from a sibling (the build
 * pack reads the brand kit's DESIGN.md; WP76's copy reads the kit's voice).
 * A slot may list such an input before it has the parent; the registry test
 * requires every BUILT step's step inputs to be among its ancestors, so S3d
 * and WP76 add the parent when they register a generator.
 */

export const LAUNCH_STEP_KEYS = [
  "blueprint",
  "roster",
  "brand_kit",
  "logo_marks",
  "landing_spec",
  "build_pack",
  "launch_plan",
  "seo_pack",
  "email_sequence",
  "social_pack",
  "ads_drafts",
] as const;

export type LaunchStepKey = (typeof LAUNCH_STEP_KEYS)[number];

/** What a step reads: another step's artifact, or a source outside the DAG. */
export type LaunchStepInput =
  | { readonly step: LaunchStepKey }
  | { readonly source: "wizard_answers" | "idea_seed" | "pro_max" | "landing_icons" | "idea_prompts" | "stack" };

export type LaunchStepStatus = "built" | "pending_story" | "pending_wp76";

export type LaunchStep = {
  readonly key: LaunchStepKey;
  readonly title: string;
  /** The task type. The roster's is `crew_roster` (no gateway call); logo marks share the brand kit's (S3b). */
  readonly jobType: CrewStepJobType | "crew_roster";
  readonly employee: RoleKey;
  readonly inputs: readonly LaunchStepInput[];
  readonly parents: readonly LaunchStepKey[];
  readonly status: LaunchStepStatus;
  /**
   * How a built step runs:
   * - `generator`: enqueued on `crewWorkpool` as `runCrewGeneratorStep` (server-built inputs, S3a);
   * - `roster`: never enqueued; written inside the blueprint step's finish (S1).
   */
  readonly runner?: "generator" | "roster";
  /** The story that builds a slot. */
  readonly pendingStory?: string;
};

export const LAUNCH_STEPS: readonly LaunchStep[] = [
  {
    key: "blueprint",
    title: "Blueprint",
    jobType: "crew_blueprint",
    employee: "lead",
    inputs: [{ source: "wizard_answers" }, { source: "idea_seed" }],
    parents: [],
    status: "built",
    runner: "generator",
  },
  {
    key: "roster",
    title: "Your team",
    jobType: "crew_roster",
    employee: "lead",
    inputs: [{ step: "blueprint" }, { source: "wizard_answers" }],
    parents: ["blueprint"],
    status: "built",
    runner: "roster",
  },
  {
    key: "brand_kit",
    title: "Brand kit",
    jobType: "crew_brand_kit",
    employee: "brand",
    inputs: [{ step: "blueprint" }, { source: "wizard_answers" }, { source: "pro_max" }],
    parents: ["roster"],
    status: "built",
    runner: "generator",
  },
  {
    key: "logo_marks",
    title: "Logo marks",
    // S3b: the marks are rendered inside the brand kit's own task and job key.
    jobType: "crew_brand_kit",
    employee: "brand",
    inputs: [{ step: "brand_kit" }],
    parents: ["brand_kit"],
    status: "pending_story",
    pendingStory: "WP75-S3b",
  },
  {
    key: "landing_spec",
    title: "Landing page",
    jobType: "crew_landing",
    employee: "landing",
    inputs: [{ step: "blueprint" }, { step: "brand_kit" }, { source: "landing_icons" }],
    parents: ["logo_marks"],
    status: "pending_story",
    pendingStory: "WP75-S3c",
  },
  {
    key: "build_pack",
    title: "Build pack",
    jobType: "crew_build_pack",
    employee: "engineering",
    inputs: [{ step: "roster" }, { source: "idea_prompts" }, { step: "brand_kit" }, { source: "stack" }],
    parents: ["roster"],
    status: "pending_story",
    pendingStory: "WP75-S3d",
  },
  {
    key: "launch_plan",
    title: "Launch plan",
    jobType: "crew_launch_plan",
    employee: "marketing",
    inputs: [{ step: "blueprint" }, { step: "roster" }],
    parents: ["roster"],
    status: "pending_wp76",
    pendingStory: "WP76",
  },
  {
    key: "seo_pack",
    title: "SEO pack",
    jobType: "crew_seo_pack",
    employee: "seo",
    inputs: [{ step: "blueprint" }],
    parents: ["roster"],
    status: "pending_wp76",
    pendingStory: "WP76",
  },
  {
    key: "email_sequence",
    title: "Email sequence",
    jobType: "crew_email_sequence",
    employee: "email",
    inputs: [{ step: "blueprint" }, { step: "brand_kit" }],
    parents: ["roster"],
    status: "pending_wp76",
    pendingStory: "WP76",
  },
  {
    key: "social_pack",
    title: "Social pack",
    jobType: "crew_social_pack",
    employee: "social",
    inputs: [{ step: "blueprint" }, { step: "brand_kit" }],
    parents: ["roster"],
    status: "pending_wp76",
    pendingStory: "WP76",
  },
  {
    key: "ads_drafts",
    title: "Ads drafts",
    jobType: "crew_ads_drafts",
    employee: "ads",
    inputs: [{ step: "blueprint" }, { step: "brand_kit" }],
    parents: ["roster"],
    status: "pending_wp76",
    pendingStory: "WP76",
  },
];

export function launchStep(key: LaunchStepKey): LaunchStep {
  const step = LAUNCH_STEPS.find((entry) => entry.key === key);
  if (step === undefined) throw new Error(`unknown launch step ${key}`);
  return step;
}

/** The step's place in the registry (`task_steps.position`). */
export function launchStepPosition(key: LaunchStepKey): number {
  return LAUNCH_STEPS.findIndex((entry) => entry.key === key);
}

/** Built steps that get a task of their own and run on the pool. */
export function isPoolStep(step: LaunchStep): boolean {
  return step.status === "built" && step.runner === "generator";
}

/** The plain reason a slot gives while it has no generator. */
export function pendingStepReason(step: LaunchStep): string {
  return step.status === "pending_wp76"
    ? `${step.title} is coming in a later update, so nothing was written for it yet.`
    : `${step.title} is not built yet, so nothing was written for it yet.`;
}

/** A slot whose parent is not done (failed, waiting, queued, running or paused). */
export function waitingOnReason(parent: LaunchStep): string {
  return `Waiting on the ${parent.key === "roster" ? "team" : parent.title.toLowerCase()}.`;
}

/** A child of a step the roster skipped. */
export function skippedParentReason(parent: LaunchStep): string {
  return `Needs the ${parent.title.toLowerCase()}, which this team skips.`;
}

/** The fallback when the roster skipped the employee but its plan row has no reason for it. */
export const ROLE_SKIPPED_REASON = "This team does not include this role.";

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

export type LaunchTaskStatus = "queued" | "running" | "blocked" | "succeeded" | "failed" | "cancelled";

export type LaunchStepFact = {
  readonly status: LaunchTaskStatus;
  /** Handed to the pool and not finished (a `running` `task_steps` row). */
  readonly enqueued: boolean;
};

export type LaunchFacts = {
  /** The roster task succeeded (the team is written). */
  readonly rosterWritten: boolean;
  /** Hired role keys (from `roster_plans`); empty until the roster is written. */
  readonly hired: ReadonlySet<string>;
  /** Skipped role key → the roster's reason. */
  readonly skipped: ReadonlyMap<string, string>;
  /** The task of each step that has one (the blueprint, built pool steps). */
  readonly tasks: Partial<Record<LaunchStepKey, LaunchStepFact>>;
};

/**
 * - `waiting`: a parent is not done yet (or the step's task is not inserted yet);
 * - `queued`: every parent is done; waiting for a free slot (the owner's cap);
 * - `running`: on the pool or executing;
 * - `paused`: parked (the gateway refused for a budget or a switch); waits for `resumeLaunch`;
 * - `succeeded`, `failed`;
 * - `skipped`: a slot with no generator, a role the roster skipped, or below one.
 */
export type LaunchStepState = "waiting" | "queued" | "running" | "paused" | "succeeded" | "failed" | "skipped";

export type EvaluatedStep = {
  readonly key: LaunchStepKey;
  readonly state: LaunchStepState;
  /** Done for its children: succeeded, or a slot whose own parents are done. */
  readonly done: boolean;
  /** Skipped because of the roster (its role, or a parent's), so every child is skipped too. */
  readonly skippedByRoster: boolean;
  readonly reason?: string;
};

function taskState(fact: LaunchStepFact | undefined): LaunchStepState {
  if (fact === undefined) return "waiting";
  switch (fact.status) {
    case "queued":
      return fact.enqueued ? "running" : "queued";
    case "running":
      return "running";
    case "blocked":
      return "paused";
    case "succeeded":
      return "succeeded";
    case "failed":
    case "cancelled":
      return "failed";
  }
}

/** Every step's state, in registry order (the registry is topologically ordered). */
export function evaluateLaunch(facts: LaunchFacts, steps: readonly LaunchStep[] = LAUNCH_STEPS): EvaluatedStep[] {
  const byKey = new Map<LaunchStepKey, EvaluatedStep>();
  const out: EvaluatedStep[] = [];
  const add = (step: EvaluatedStep): void => {
    byKey.set(step.key, step);
    out.push(step);
  };
  for (const step of steps) {
    const parents = step.parents.map((key) => {
      const parent = byKey.get(key);
      if (parent === undefined) throw new Error(`launch step ${step.key} lists ${key} before it`);
      return parent;
    });
    const parentsDone = parents.every((parent) => parent.done);

    if (step.key === "roster") {
      add({ key: step.key, state: facts.rosterWritten ? "succeeded" : "waiting", done: facts.rosterWritten, skippedByRoster: false });
      continue;
    }
    if (step.key !== "blueprint" && facts.rosterWritten && step.employee !== "lead" && !facts.hired.has(step.employee)) {
      add({
        key: step.key,
        state: "skipped",
        done: false,
        skippedByRoster: true,
        reason: facts.skipped.get(step.employee) ?? ROLE_SKIPPED_REASON,
      });
      continue;
    }
    const skippedParent = parents.find((parent) => parent.skippedByRoster);
    if (skippedParent !== undefined) {
      add({ key: step.key, state: "skipped", done: false, skippedByRoster: true, reason: skippedParentReason(launchStep(skippedParent.key)) });
      continue;
    }
    if (step.status !== "built") {
      // A slot is skipped (and done for its children) once its own parents are done; until then it waits on them.
      const blocking = parents.find((parent) => !parent.done);
      add(blocking === undefined
        ? { key: step.key, state: "skipped", done: true, skippedByRoster: false, reason: pendingStepReason(step) }
        : { key: step.key, state: "waiting", done: false, skippedByRoster: false, reason: waitingOnReason(launchStep(blocking.key)) });
      continue;
    }
    const state = parentsDone ? taskState(facts.tasks[step.key]) : "waiting";
    add({ key: step.key, state, done: state === "succeeded", skippedByRoster: false });
  }
  return out;
}

/** Built pool steps that may be enqueued now (every parent done, task queued and not on the pool). */
export function readySteps(evaluated: readonly EvaluatedStep[], steps: readonly LaunchStep[] = LAUNCH_STEPS): LaunchStep[] {
  return evaluated
    .filter((entry) => entry.state === "queued")
    .map((entry) => steps.find((step) => step.key === entry.key))
    .filter((step): step is LaunchStep => step !== undefined && isPoolStep(step));
}

// ---------------------------------------------------------------------------
// stepDone's decision
// ---------------------------------------------------------------------------

/** Consecutive action failures (the action threw or died) before the step gives up. */
export const MAX_ACTION_FAILURES = 3;

/** What the runner returned, as far as `stepDone` cares. */
export type StepOutcome =
  | { readonly kind: "retry"; readonly delayMs: number }
  | { readonly kind: "skipped"; readonly reason: string }
  | { readonly kind: "parked" }
  | { readonly kind: "finished" | "failed" | "rejected" | "closed" | "stale" };

export type StepRunResult =
  | { readonly kind: "success"; readonly returnValue: StepOutcome }
  | { readonly kind: "failed" }
  | { readonly kind: "canceled" };

export type StepDoneDecision =
  /** Enqueue the same step again after `delayMs`; the step keeps its slot. */
  | { readonly kind: "reenqueue"; readonly delayMs: number; readonly actionFailures: number }
  /** The action keeps dying without settling the task: fail it as interrupted. */
  | { readonly kind: "abandon" }
  /** The task is terminal: record the step and fill free slots. */
  | { readonly kind: "settle" }
  /** The task is parked: wait for `resumeLaunch`; the slot is free. */
  | { readonly kind: "park" };

const TERMINAL: readonly LaunchTaskStatus[] = ["succeeded", "failed", "cancelled"];

/**
 * `stepDone`'s rule (S2a review N1). Re-invocations:
 * - `retry`: again after the runner's `delayMs`;
 * - `skipped: in_flight`: again after `RUN_LEASE_MS` (`leaseMs`);
 * - the action failed (it threw, died or timed out, so its run may be open):
 *   again after `RUN_LEASE_MS`; the next `startCrewRun` closes the abandoned
 *   run with the indeterminate decision recovery uses. After
 *   `MAX_ACTION_FAILURES` in a row with the task still live, the task fails
 *   as interrupted, so a step can never loop for ever.
 * Otherwise the task's own status decides, so whichever of `stepDone` and
 * `recoverStaleCrewRuns` settles first wins:
 * - terminal: `settle` (succeeded, or failed: `skipped: terminal`, `failed`,
 *   `rejected`, `closed`, `exhausted`, `unpaid` all end here);
 * - blocked: `park` (wait for `resumeLaunch`);
 * - still queued or running after a final-looking outcome (a `stale` finish,
 *   say): again after the lease, counted like an action failure.
 */
export function stepDoneDecision(
  result: StepRunResult,
  task: { readonly status: LaunchTaskStatus; readonly archived: boolean },
  actionFailures: number,
  leaseMs: number,
): StepDoneDecision {
  if (task.archived || TERMINAL.includes(task.status)) return { kind: "settle" };
  if (task.status === "blocked") return { kind: "park" };
  const failedAgain = (): StepDoneDecision =>
    actionFailures + 1 >= MAX_ACTION_FAILURES
      ? { kind: "abandon" }
      : { kind: "reenqueue", delayMs: leaseMs, actionFailures: actionFailures + 1 };
  if (result.kind !== "success") return failedAgain();
  const outcome = result.returnValue;
  if (outcome.kind === "retry") return { kind: "reenqueue", delayMs: Math.max(0, outcome.delayMs), actionFailures: 0 };
  if (outcome.kind === "skipped" && outcome.reason === "in_flight") return { kind: "reenqueue", delayMs: leaseMs, actionFailures: 0 };
  return failedAgain();
}
