import { ConvexError } from "convex/values";
import type {
  BriefStatus,
  ProjectStatus,
  PurchaseStatus,
  SiteStatus,
  SiteVersionStatus,
  StepStatus,
  SubmissionStatus,
  TaskStatus,
  WorkflowRunStatus,
} from "./validators";

type TransitionMap<State extends string> = Readonly<
  Record<State, readonly State[]>
>;

export const projectTransitions = {
  draft: ["validating"],
  validating: ["ready"],
  ready: ["building"],
  building: ["published"],
  published: [],
} as const satisfies TransitionMap<ProjectStatus>;

export const briefTransitions = {
  draft: ["confirmed"],
  confirmed: ["superseded"],
  superseded: [],
} as const satisfies TransitionMap<BriefStatus>;

export const submissionTransitions = {
  draft: ["submitted"],
  submitted: ["accepted", "rejected"],
  accepted: [],
  rejected: [],
} as const satisfies TransitionMap<SubmissionStatus>;

export const taskTransitions = {
  queued: ["running", "cancelled"],
  running: ["blocked", "succeeded", "failed", "cancelled"],
  blocked: ["running", "failed", "cancelled"],
  succeeded: [],
  failed: [],
  cancelled: [],
} as const satisfies TransitionMap<TaskStatus>;

export const stepTransitions = {
  pending: ["running", "skipped"],
  running: ["succeeded", "failed"],
  succeeded: [],
  failed: [],
  skipped: [],
} as const satisfies TransitionMap<StepStatus>;

export const siteTransitions = {
  draft: ["ready"],
  ready: ["published"],
  published: [],
} as const satisfies TransitionMap<SiteStatus>;

export const siteVersionTransitions = {
  draft: ["ready"],
  ready: ["published"],
  published: ["retired"],
  retired: [],
} as const satisfies TransitionMap<SiteVersionStatus>;

export const purchaseTransitions = {
  pending: ["paid", "failed"],
  paid: ["disputed", "refunded"],
  failed: [],
  disputed: ["refunded"],
  refunded: [],
} as const satisfies TransitionMap<PurchaseStatus>;

export const workflowRunTransitions = {
  queued: ["running", "cancelled"],
  running: ["succeeded", "failed", "cancelled"],
  succeeded: [],
  failed: [],
  cancelled: [],
} as const satisfies TransitionMap<WorkflowRunStatus>;

type TransitionFamily =
  | "project"
  | "brief"
  | "submission"
  | "task"
  | "step"
  | "site"
  | "site_version"
  | "purchase"
  | "workflow_run";

function assertTransition<State extends string>(
  family: TransitionFamily,
  current: State,
  next: State,
  transitions: TransitionMap<State>,
): State {
  if (!transitions[current].includes(next)) {
    throw new ConvexError({
      code: "INVALID_STATE_TRANSITION",
      family,
      current,
      next,
    });
  }
  return next;
}

export function assertProjectTransition(
  current: ProjectStatus,
  next: ProjectStatus,
): ProjectStatus {
  return assertTransition("project", current, next, projectTransitions);
}

export function assertBriefTransition(
  current: BriefStatus,
  next: BriefStatus,
): BriefStatus {
  return assertTransition("brief", current, next, briefTransitions);
}

export function assertSubmissionTransition(
  current: SubmissionStatus,
  next: SubmissionStatus,
): SubmissionStatus {
  return assertTransition("submission", current, next, submissionTransitions);
}

export function assertTaskTransition(
  current: TaskStatus,
  next: TaskStatus,
): TaskStatus {
  return assertTransition("task", current, next, taskTransitions);
}

export function assertStepTransition(
  current: StepStatus,
  next: StepStatus,
): StepStatus {
  return assertTransition("step", current, next, stepTransitions);
}

export function assertSiteTransition(
  current: SiteStatus,
  next: SiteStatus,
): SiteStatus {
  return assertTransition("site", current, next, siteTransitions);
}

export function assertSiteVersionTransition(
  current: SiteVersionStatus,
  next: SiteVersionStatus,
): SiteVersionStatus {
  return assertTransition(
    "site_version",
    current,
    next,
    siteVersionTransitions,
  );
}

export function assertPurchaseTransition(
  current: PurchaseStatus,
  next: PurchaseStatus,
): PurchaseStatus {
  return assertTransition("purchase", current, next, purchaseTransitions);
}

export function assertWorkflowRunTransition(
  current: WorkflowRunStatus,
  next: WorkflowRunStatus,
): WorkflowRunStatus {
  return assertTransition(
    "workflow_run",
    current,
    next,
    workflowRunTransitions,
  );
}

/** WP24 may issue a task credit refund only after that task failed. */
export function assertTaskRefundEligible(status: TaskStatus): "failed" {
  if (status !== "failed") {
    throw new ConvexError({ code: "TASK_REFUND_NOT_ALLOWED" });
  }
  return status;
}

/** Archive is an explicit patch; a second archive attempt fails closed. */
export function assertCanArchive(archivedAt: number | undefined): void {
  if (archivedAt !== undefined) {
    throw new ConvexError({ code: "ALREADY_ARCHIVED" });
  }
}
