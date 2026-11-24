import type { TeamCardStatus } from "../../../components/workspace/kit/types";
import type { ArtifactKind } from "../contracts/artifacts";
import { ROLE_KEYS, type RoleKey } from "../contracts/roster";
import type { LaunchHiredRole, LaunchSkippedRole, LaunchView } from "./launch";

export type TeamStepState = "waiting" | "queued" | "running" | "paused" | "succeeded" | "failed" | "skipped";

/** A launch step as `launchProgress` returns it. */
export type TeamStep = {
  readonly key: string;
  readonly title: string;
  readonly employee: RoleKey;
  /** True when the step has no generator yet: it reads "Coming soon", never "Queued". */
  readonly notBuilt: boolean;
  readonly state: TeamStepState;
  readonly reason?: string;
  readonly lastFailure?: { readonly failureClass: string; readonly detail: string };
  readonly retryable?: boolean;
};

/** A pending review as `pendingReviews` returns it. */
export type TeamReview = {
  readonly kind: ArtifactKind;
  readonly title: string;
  readonly changeRound: bigint | number;
};

/** `decidedBy: "lead"` (roster per idea, WP91): the Crew Lead's team proposal made this call. */
export type TeamHired = {
  readonly role: RoleKey;
  readonly name: string;
  readonly roleLabel: string;
  readonly reason: string;
  readonly decidedBy?: "lead";
};
export type TeamSkipped = { readonly role: RoleKey; readonly roleLabel: string; readonly reason: string; readonly decidedBy?: "lead" };

export function isRoleKey(value: string): value is RoleKey {
  return (ROLE_KEYS as readonly string[]).includes(value);
}

/** The ready roster with role keys narrowed; an unknown key (never expected) is dropped. */
export function readyRoster(launch: Extract<LaunchView, { state: "ready" }>): { hired: TeamHired[]; skipped: TeamSkipped[] } {
  const hired: TeamHired[] = [];
  for (const entry of launch.hired as readonly LaunchHiredRole[]) {
    if (isRoleKey(entry.roleKey)) {
      hired.push({
        role: entry.roleKey,
        name: entry.employeeName,
        roleLabel: entry.roleLabel,
        reason: entry.reason,
        ...(entry.decidedBy === undefined ? {} : { decidedBy: entry.decidedBy }),
      });
    }
  }
  const skipped: TeamSkipped[] = [];
  for (const entry of launch.skipped as readonly LaunchSkippedRole[]) {
    if (isRoleKey(entry.roleKey)) {
      skipped.push({
        role: entry.roleKey,
        roleLabel: entry.roleLabel,
        reason: entry.reason,
        ...(entry.decidedBy === undefined ? {} : { decidedBy: entry.decidedBy }),
      });
    }
  }
  return { hired, skipped };
}

/** Who owns the review for each artifact kind. */
export const REVIEW_OWNER: Readonly<Record<ArtifactKind, RoleKey>> = Object.freeze({
  blueprint: "lead",
  roster_plan: "lead",
  brand_kit: "brand",
  email_sequence: "email",
  social_pack: "social",
  landing_spec: "landing",
  seo_pack: "seo",
  launch_plan: "marketing",
  ads_drafts: "ads",
  build_pack: "engineering",
});

export type EmployeeStatusEntry = {
  readonly role: RoleKey;
  readonly name: string;
  readonly status: TeamCardStatus;
  readonly detail: string;
  readonly failureClass?: string;
  readonly blocker?: { readonly label: string; readonly detail?: string };
};

const lower = (text: string): string => text.charAt(0).toLowerCase() + text.slice(1);

function joinTitles(titles: readonly string[]): string {
  if (titles.length <= 1) return titles.join("");
  return `${titles.slice(0, -1).join(", ")} and ${titles[titles.length - 1]}`;
}

/**
 * One hired role's status. Rules, first match wins (steps the roster skipped or
 * that are not built are left out of rules 2-7 so a half-built role still reads
 * truthfully):
 * 1. a pending review it owns: needs_you;
 * 2. a step failed: failed (the reason);
 * 3. a step paused: needs_you (Resume exists);
 * 4. a step running: working;
 * 5. a step queued (waiting for a free slot): working;
 * 6. a step waiting on its parent: queued, with the reason as the blocker;
 * 7. every step done: done;
 * 8. nothing built to do: coming_soon, never "queued".
 */
function launchEmployeeStatus(
  hired: Pick<TeamHired, "role" | "name">,
  steps: readonly TeamStep[],
  reviews: readonly TeamReview[],
): EmployeeStatusEntry {
  const { role, name } = hired;
  const owned = steps.filter((step) => step.employee === role);
  const relevant = owned.filter((step) => !step.notBuilt && step.state !== "skipped");
  const base = { role, name };

  const mine = reviews.filter((review) => REVIEW_OWNER[review.kind] === role);
  if (mine.length > 0) {
    const first = mine[0];
    const round = Number(first.changeRound);
    const lead = round > 0 ? `${first.title} · change round ${round}` : first.title;
    const more = mine.length > 1 ? ` (+${mine.length - 1} more)` : "";
    return { ...base, status: "needs_you", detail: `${lead} ready for your OK${more}` };
  }
  const failed = relevant.find((step) => step.state === "failed");
  if (failed !== undefined) {
    return {
      ...base,
      status: "failed",
      detail: failed.lastFailure?.detail ?? failed.reason ?? `${failed.title} did not finish.`,
      ...(failed.lastFailure ? { failureClass: failed.lastFailure.failureClass } : {}),
      ...(failed.lastFailure && failed.retryable === false && failed.reason ? { blocker: { label: failed.reason } } : {}),
    };
  }
  const paused = relevant.find((step) => step.state === "paused");
  if (paused !== undefined) {
    return { ...base, status: "needs_you", detail: paused.reason ?? `${paused.title} is paused. Resume it below.` };
  }
  const running = relevant.find((step) => step.state === "running");
  if (running !== undefined) {
    return { ...base, status: "working", detail: `Writing the ${lower(running.title)}` };
  }
  if (relevant.some((step) => step.state === "queued")) {
    return { ...base, status: "working", detail: "Waiting for a free slot" };
  }
  const waiting = relevant.find((step) => step.state === "waiting");
  if (waiting !== undefined) {
    return {
      ...base,
      status: "queued",
      detail: "Starts after an earlier step finishes",
      blocker: { label: waiting.reason ?? "Waiting on an earlier step." },
    };
  }
  if (relevant.length > 0 && relevant.every((step) => step.state === "succeeded")) {
    return { ...base, status: "done", detail: `${joinTitles(relevant.map((step) => step.title))} done` };
  }
  const reason = owned.find((step) => step.reason !== undefined)?.reason;
  return { ...base, status: "coming_soon", detail: reason ?? "Nothing to do in this beta yet." };
}

/** Status for every hired role, in roster order. */
export function employeeStatuses(
  hired: readonly Pick<TeamHired, "role" | "name">[],
  steps: readonly TeamStep[],
  reviews: readonly TeamReview[],
  assignments: readonly CrewAssignment[] = [],
  spend: readonly (TeamReview & { costCredits: bigint })[] = [],
  now?: number,
): EmployeeStatusEntry[] {
  return hired.map((entry) => {
    const paid = spend.find((card) => REVIEW_OWNER[card.kind] === entry.role);
    if (paid) return { role: entry.role, name: entry.name, status: "needs_you", detail:
      `${paid.title} · change round ${paid.changeRound} needs your approval for ${paid.costCredits} credits.` };
    return employeeStatus(entry, steps, reviews, assignments.find((item) => item.role === entry.role), now);
  });
}


export type CrewAssignment = {
  role: RoleKey;
  title: string;
  round: number;
  status: "queued" | "running" | "blocked" | "succeeded" | "failed" | "cancelled";
  taskId: string;
  documentId?: string;
  blocker?: "blueprint" | "brand_kit";
  failure?: string;
  failureClass?: string;
  changedFields?: string[];
  changePreview?: string[];
  handoff?: "requested" | "queued" | "spend_required" | "not_available";
  handoffReason?: string;
  handoffSpendExpiresAt?: number;
  source?: "current" | "stale" | "unknown";
};

const handoffDetail: Record<NonNullable<CrewAssignment["handoff"]>, string> = {
  requested: "Email follow-up requested after brand approval.",
  queued: "The email follow-up was handed to Elle.",
  spend_required: "A spend approval was requested for Elle’s follow-up.",
  not_available: "The email follow-up could not start.",
};

function revisionActivity(
  assignment: CrewAssignment,
  reviews: readonly TeamReview[],
): Pick<EmployeeStatusEntry, "status" | "detail" | "blocker" | "failureClass"> {
  const title = `${assignment.title} · change round ${assignment.round}`;
  switch (assignment.status) {
    case "queued":
      return assignment.blocker === undefined
        ? { status: "queued", detail: `${title} is queued.` }
        : {
          status: "queued",
          detail: `${title} is waiting.`,
          blocker: { label: assignment.blocker === "blueprint" ? "Waiting for blueprint approval." : "Waiting for brand kit approval." },
        };
    case "running": return { status: "working", detail: `${title} is in progress.` };
    case "blocked": return { status: "needs_you", detail: `${title} is paused.` };
    case "cancelled": return { status: "failed", detail: `${title} was cancelled.` };
    case "failed": return {
      status: "failed", detail: assignment.failure ? `${title} failed. ${assignment.failure}` : `${title} failed.`,
      ...(assignment.failureClass ? { failureClass: assignment.failureClass } : {}),
    };
    case "succeeded": {
      if (!assignment.documentId) return { status: "failed", detail: `${title} has no saved draft.` };
      const review = reviews.find((item) => REVIEW_OWNER[item.kind] === assignment.role && Number(item.changeRound) === assignment.round);
      return review === undefined
        ? { status: "done", detail: `${title} was saved.` }
        : { status: "needs_you", detail: `${title} is ready for your OK.` };
    }
  }
}

/** One projection for the lead and Team HQ. Later change rounds supersede launch-only progress. */
export function employeeStatus(
  hired: Pick<TeamHired, "role" | "name">,
  steps: readonly TeamStep[],
  reviews: readonly TeamReview[],
  assignment?: CrewAssignment,
  now?: number,
): EmployeeStatusEntry {
  const entry = assignment !== undefined && assignment.round > 0
    ? { role: hired.role, name: hired.name, ...revisionActivity(assignment, reviews) }
    : launchEmployeeStatus(hired, steps, reviews);
  const detail = [entry.detail];
  if (assignment?.source === "stale") detail.push("This draft uses earlier brand copy.");
  if (assignment?.changedFields?.length) detail.push(`Changed ${assignment.changedFields.join(", ")}.`);
  if (assignment?.changePreview?.length) detail.push(...assignment.changePreview);
  if (assignment?.handoff !== undefined) {
    if (assignment.handoff === "spend_required" && now !== undefined &&
        assignment.handoffSpendExpiresAt !== undefined && now >= assignment.handoffSpendExpiresAt) {
      detail.push("The spend approval for Elle’s follow-up expired.");
    } else {
      detail.push(handoffDetail[assignment.handoff]);
      if (assignment.handoffReason) detail.push(assignment.handoffReason);
    }
  }
  return { ...entry, detail: detail.join(" ") };
}
