/**
 * WP75-S1. Pure helpers for a launch's roster: what the roster writes for each
 * planned role, and the launch state Meet your co-founder reads. No Convex, no
 * I/O; `convex/crew/launchRoster.ts` and `convex/crew/roster.ts` call these.
 *
 * Owner ruling 2026-11-06 (Q13, `docs/wp/RULINGS.md`): the roster gets no
 * `artifact_review` card. The team just appears, hired and skipped roles with
 * their C-ROSTER reasons, and the crew carries on after the blueprint.
 */

import type { RoleKey, RosterPlan } from "../contracts/roster";

/** The roster task's title (a `crew_roster` task, no gateway call). */
export const ROSTER_TASK_TITLE = "Your team";

/** The roster document's title (`documents` kind `roster_plan`). */
export const ROSTER_DOCUMENT_TITLE = "Team";

/**
 * Each specialist's workstream title. The Crew Lead has none: Wren routes the
 * crew's work and owns no artifact (`02` §6.1).
 */
export const WORKSTREAM_TITLES = {
  brand: "Brand kit",
  landing: "Landing page",
  seo: "SEO pack",
  marketing: "Launch plan",
  email: "Email sequence",
  social: "Social pack",
  engineering: "Build pack",
  ads: "Ads drafts",
  curriculum: "Curriculum",
  community: "Community",
  merch: "Merch",
  outbound: "Outbound",
} as const satisfies Record<Exclude<RoleKey, "lead">, string>;

export type CrewMemberRow = {
  readonly roleKey: RoleKey;
  readonly displayName: string;
  readonly status: "queued" | "skipped";
  /** The workstream a hired specialist gets; null for the Crew Lead and for skipped roles. */
  readonly workstreamTitle: string | null;
};

/**
 * One `crew_members` row per planned role: hired roles `queued` (named by
 * their employee), skipped roles `skipped` (named by their role). Every row
 * is hired by rule with autopilot off; the writer sets those.
 */
export function rosterMemberRows(plan: RosterPlan): CrewMemberRow[] {
  return [
    ...plan.hired.map((entry): CrewMemberRow => ({
      roleKey: entry.roleKey,
      displayName: entry.employeeName,
      status: "queued",
      workstreamTitle: entry.roleKey === "lead" ? null : WORKSTREAM_TITLES[entry.roleKey],
    })),
    ...plan.skipped.map((entry): CrewMemberRow => ({
      roleKey: entry.roleKey,
      displayName: entry.roleLabel,
      status: "skipped",
      workstreamTitle: null,
    })),
  ];
}

// ---------------------------------------------------------------------------
// Launch state (what Meet your co-founder shows)
// ---------------------------------------------------------------------------

/** `roleKey` is a C-ROSTER role key, typed as text for the client (it is a list key, not an internal id). */
export type LaunchHiredRole = {
  readonly roleKey: string;
  readonly employeeName: string;
  readonly roleLabel: string;
  readonly reason: string;
  /** Roster per idea (WP90): present when the Crew Lead's team proposal made this call. */
  readonly decidedBy?: "lead";
};

export type LaunchSkippedRole = {
  readonly roleKey: string;
  readonly roleLabel: string;
  readonly reason: string;
  /** Roster per idea (WP90): present when the Crew Lead's team proposal made this call. */
  readonly decidedBy?: "lead";
};

/**
 * - `not_started`: no launch yet (Meet your co-founder starts one).
 * - `assembling`: the blueprint step is queued or running ("putting your team together").
 * - `failed`: the blueprint failed, or is paused (`paused`), with no roster. `retryable` says whether the
 *   founder's retry can help; false means no retry will (the team cannot be planned from what is stored), so the
 *   page offers none.
 * - `ready`: the roster, hired and skipped roles with their reasons.
 */
export type LaunchView =
  | { readonly state: "not_started" }
  | { readonly state: "assembling" }
  | { readonly state: "failed"; readonly paused: boolean; readonly retryable: boolean }
  | {
    readonly state: "ready";
    readonly hired: LaunchHiredRole[];
    readonly skipped: LaunchSkippedRole[];
  };

/** The founder-facing roster: names, labels and reasons only. */
export function readyLaunchView(plan: RosterPlan): Extract<LaunchView, { state: "ready" }> {
  return {
    state: "ready",
    hired: plan.hired.map((entry) => ({
      roleKey: entry.roleKey,
      employeeName: entry.employeeName,
      roleLabel: entry.roleLabel,
      reason: entry.reason,
      ...(entry.decidedBy === undefined ? {} : { decidedBy: entry.decidedBy }),
    })),
    skipped: plan.skipped.map((entry) => ({
      roleKey: entry.roleKey,
      roleLabel: entry.roleLabel,
      reason: entry.reason,
      ...(entry.decidedBy === undefined ? {} : { decidedBy: entry.decidedBy }),
    })),
  };
}

/** A blueprint first-draft task's status, as the launch reads it. */
export type LaunchBlueprintStatus = "queued" | "running" | "blocked" | "succeeded" | "failed" | "cancelled";

/**
 * The launch state before the roster exists, from the newest first-draft
 * blueprint task (null: none). A paused, failed or missing blueprint can be
 * retried. A succeeded blueprint with no roster is read by the caller, which
 * knows whether the team can still be planned from it; here it reads as
 * retryable.
 */
export function pendingLaunchView(blueprint: LaunchBlueprintStatus | null): Exclude<LaunchView, { state: "ready" | "not_started" }> {
  switch (blueprint) {
    case "queued":
    case "running":
      return { state: "assembling" };
    case "blocked":
      return { state: "failed", paused: true, retryable: true };
    case null:
    case "succeeded":
    case "failed":
    case "cancelled":
      return { state: "failed", paused: false, retryable: true };
  }
}
