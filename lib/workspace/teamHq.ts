import { ConvexError } from "convex/values";

import type { TeamCardStatus } from "@/components/workspace/kit/types";
import { ROLE_CATALOGUE } from "@/convex/crew/roles";
import type { ArtifactKind } from "@/lib/workspace/contracts/artifacts";
import { CORE_ROLE_KEYS, ROLE_KEYS, type RoleKey } from "@/lib/workspace/contracts/roster";
import type { LaunchHiredRole, LaunchSkippedRole, LaunchView } from "@/lib/workspace/crew/launch";
import { needsYouTail } from "@/lib/workspace/needsYou";
import { TEAM_NOT_STARTED_COPY, TEAM_PARTNER_NAME } from "@/lib/workspace/reviewPages";
import { workspacePath } from "@/lib/workspace/routes";

/**
 * L1 UI fidelity: the pure rules behind Team HQ. Every status on the page is
 * derived here from what the backend gives (`launchStatus`, `launchProgress`,
 * `pendingReviews`); nothing is invented. Unit-tested in
 * `tests/platform/workspace-team-hq-helpers.test.ts`.
 */

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
  readonly retryable?: boolean;
};

/** A pending review as `pendingReviews` returns it. */
export type TeamReview = {
  readonly kind: ArtifactKind;
  readonly title: string;
  readonly changeRound: bigint | number;
};

/** `decidedBy: "lead"` (roster per idea, WP90): the Crew Lead's team proposal made this call. */
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

/**
 * The lead's name (the partner name), or the founder's chosen partner name, or
 * "Your co-founder", until the team is written.
 */
export function leadName(launch: LaunchView | undefined, partnerName?: string): string {
  if (launch !== undefined && launch.state === "ready") {
    const lead = launch.hired.find((entry) => entry.roleKey === "lead");
    if (lead !== undefined && lead.employeeName.trim() !== "") return lead.employeeName;
  }
  const chosen = partnerName?.trim();
  return chosen === undefined || chosen === "" ? TEAM_PARTNER_NAME : chosen;
}

// ---------------------------------------------------------------------------
// Per-employee status
// ---------------------------------------------------------------------------

export type EmployeeStatusEntry = {
  readonly role: RoleKey;
  readonly name: string;
  readonly status: TeamCardStatus;
  readonly detail: string;
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
export function employeeStatus(
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
    return { ...base, status: "failed", detail: failed.reason ?? `${failed.title} did not finish.` };
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
): EmployeeStatusEntry[] {
  return hired.map((entry) => employeeStatus(entry, steps, reviews));
}

export type HeadCounts = Record<TeamCardStatus, number> & { all: number };

export function headCounts(statuses: readonly Pick<EmployeeStatusEntry, "status">[]): HeadCounts {
  const counts: HeadCounts = { all: statuses.length, queued: 0, working: 0, needs_you: 0, done: 0, failed: 0, coming_soon: 0 };
  for (const entry of statuses) counts[entry.status] += 1;
  return counts;
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export type TeamFilter = "all" | TeamCardStatus;

export const FILTER_LABELS: Record<TeamFilter, string> = {
  all: "All",
  needs_you: "Needs you",
  working: "Working",
  queued: "Queued",
  done: "Done",
  failed: "Failed",
  coming_soon: "Coming soon",
};

/** All, Needs you, Working, Queued and Done always show; Failed and Coming soon only when something is in them. */
export function visibleFilters(counts: HeadCounts): TeamFilter[] {
  const filters: TeamFilter[] = ["all", "needs_you", "working", "queued", "done"];
  if (counts.failed > 0) filters.push("failed");
  if (counts.coming_soon > 0) filters.push("coming_soon");
  return filters;
}

export function applyFilter<T extends { status: TeamCardStatus }>(entries: readonly T[], filter: TeamFilter): T[] {
  return filter === "all" ? [...entries] : entries.filter((entry) => entry.status === filter);
}

export function filterStatusLine(shown: number, total: number, filter: TeamFilter): string {
  const base = `Showing ${shown} of ${total} ${total === 1 ? "specialist" : "specialists"}.`;
  return filter === "all" ? base : `${base} Filter: ${FILTER_LABELS[filter]}.`;
}

export function filterEmptyCopy(filter: TeamFilter, lead: string): string {
  if (filter === "needs_you") return `Nobody needs you right now. ${lead} will bring the next decision here.`;
  if (filter === "all") return "No specialists on the team yet.";
  return `No one is ${lower(FILTER_LABELS[filter])} right now.`;
}

// ---------------------------------------------------------------------------
// Workstream links (only pages that are built)
// ---------------------------------------------------------------------------

const WORKSTREAM_PAGES: Partial<Record<RoleKey, { slug: string; label: string }>> = {
  brand: { slug: "brand", label: "Open Brand kit" },
  email: { slug: "email", label: "Open Email" },
  social: { slug: "social", label: "Open Social" },
};

/** The built page that holds this role's output, or null (the card says "Workstream coming soon"). */
export function workstreamFor(role: RoleKey, projectId: string): { href: string; label: string } | null {
  const page = WORKSTREAM_PAGES[role];
  if (page === undefined) return null;
  return { href: workspacePath(projectId, page.slug), label: page.label };
}

/** What a specialist does, from the role catalogue. */
export function roleSpecialty(role: RoleKey): string {
  return ROLE_CATALOGUE.find((entry) => entry.key === role)?.does ?? "";
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

export type TeamHeaderCopy = {
  readonly lead: string;
  readonly tail?: string;
  readonly summary: string;
  /** The "Why this team?" link points at a table that only exists once the team is written. */
  readonly showWhy: boolean;
};

const reviewsPhrase = (count: number): string => `${count} ${count === 1 ? "review" : "reviews"}`;

export type TeamHeaderInput = {
  readonly launch: LaunchView;
  readonly lead: string;
  /** Statuses of every hired role (ready only). */
  readonly statuses: readonly EmployeeStatusEntry[];
  /** Open (unexpired) reviews: the one "need you" count (`lib/workspace/needsYou.ts`). Paused steps are not counted. */
  readonly reviewCount: number;
};

export function teamHeaderCopy(input: TeamHeaderInput): TeamHeaderCopy {
  const { launch, lead, statuses, reviewCount } = input;
  switch (launch.state) {
    case "not_started":
      return { lead: "Team HQ", summary: TEAM_NOT_STARTED_COPY, showWhy: false };
    case "assembling":
      return {
        lead: "Team HQ.",
        tail: "Your team is on its way.",
        summary: `${lead} is putting your team together. This takes about a minute.`,
        showWhy: false,
      };
    case "failed":
      return {
        lead: "Team HQ",
        summary: launch.retryable
          ? `${lead} couldn't put your team together this time. Use Try again in the card below.`
          : `${lead} couldn't put your team together from what this business has so far. Your business is saved.`,
        showWhy: false,
      };
    case "ready": {
      const counts = headCounts(statuses);
      const specialists = statuses.filter((entry) => entry.role !== "lead");
      const spec = headCounts(specialists);
      const parts: string[] = [
        reviewCount === 0 ? `${lead} has no reviews waiting.` : `${lead} is routing ${reviewsPhrase(reviewCount)}.`,
      ];
      if (specialists.length > 0) {
        // "Need you" lives only in the h1 tail (open reviews, `needsYou.ts`), so no second count can disagree.
        const clauses: string[] = [];
        if (spec.working > 0) clauses.push(`${spec.working} working`);
        if (spec.queued > 0) clauses.push(`${spec.queued} queued`);
        if (spec.done > 0) clauses.push(`${spec.done} done`);
        if (spec.failed > 0) clauses.push(`${spec.failed} failed`);
        if (spec.coming_soon > 0) clauses.push(`${spec.coming_soon} coming soon`);
        if (clauses.length > 0) {
          parts.push(`Of ${specialists.length} ${specialists.length === 1 ? "specialist" : "specialists"}: ${clauses.join(", ")}.`);
        }
      }
      parts.push("Nothing sends, posts or spends without your OK.");
      return {
        lead: `${counts.all} on the team.`,
        tail: needsYouTail(reviewCount),
        summary: parts.join(" "),
        showWhy: true,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Team-stage copy (a minimal copy of the wizard's wording, so Team HQ does not import the wizard)
// ---------------------------------------------------------------------------

export type TeamStageView = "assembling" | "failed" | "terminal" | "ready" | "not_started";

export function teamStageView(launch: LaunchView): TeamStageView {
  if (launch.state === "failed") return launch.retryable ? "failed" : "terminal";
  return launch.state;
}

/** What the lead card's polite live region says about the team, so each change is read once. */
export function teamStageAnnouncement(launch: LaunchView, lead: string): string {
  switch (teamStageView(launch)) {
    case "not_started":
      return "";
    case "assembling":
      return `${lead} is putting your team together.`;
    case "failed":
      return launch.state === "failed" && launch.paused
        ? `${lead} paused putting your team together. You can try again.`
        : `${lead} could not put your team together. You can try again.`;
    case "terminal":
      return `${lead} could not put your team together for this business.`;
    case "ready":
      return launch.state === "ready"
        ? `Your team is ready: ${launch.hired.length} hired, ${launch.skipped.length} skipped for now.`
        : "";
  }
}

export function teamFailureCopy(launch: Extract<LaunchView, { state: "failed" }>, lead: string): string {
  if (!launch.retryable) {
    return `${lead} could not put your team together from what this business has so far. Nothing was charged, and trying again will not change it. Your business is saved.`;
  }
  return launch.paused
    ? `${lead} paused putting your team together. Nothing was charged.`
    : `${lead} could not put your team together this time. Nothing was charged.`;
}

const LAUNCH_ERROR_COPY: Readonly<Record<string, string>> = {
  AI_DISABLED: "AI work is switched off right now. Try again later.",
  WORKSPACE_DISABLED: "Building is switched off right now. Try again later.",
  UNAUTHENTICATED: "Your session ended. Sign in again to carry on.",
  RESOURCE_NOT_FOUND: "We could not find this business.",
};

/** A retry or resume refusal in plain words; never the raw error. */
export function launchErrorMessage(error: unknown): string {
  if (error instanceof ConvexError && typeof error.data === "object" && error.data !== null) {
    const data: { code?: unknown; kind?: unknown } = error.data;
    if (data.kind === "RateLimited") return "You have started a lot of crew work this hour. Try again in a little while.";
    if (typeof data.code === "string" && LAUNCH_ERROR_COPY[data.code]) return LAUNCH_ERROR_COPY[data.code];
  }
  return "Something went wrong. Try again.";
}

// ---------------------------------------------------------------------------
// Plan by owner
// ---------------------------------------------------------------------------

/** The step pill set: running reads Working, succeeded Done, an unbuilt step Coming soon, a roster-skipped one Skipped. */
export function stepPillStatus(step: Pick<TeamStep, "state" | "notBuilt">):
  "waiting" | "queued" | "working" | "paused" | "done" | "failed" | "coming_soon" | "skipped" {
  if (step.notBuilt) return "coming_soon";
  switch (step.state) {
    case "running":
      return "working";
    case "succeeded":
      return "done";
    default:
      return step.state;
  }
}

/** Steps in the plan: built ones (grouped by owner, first appearance first), then the ones coming later. */
export function planGroups(steps: readonly TeamStep[]): { now: TeamStep[]; later: TeamStep[] } {
  const later = steps.filter((step) => step.notBuilt);
  const built = steps.filter((step) => !step.notBuilt);
  const owners: RoleKey[] = [];
  for (const step of built) if (!owners.includes(step.employee)) owners.push(step.employee);
  const now = owners.flatMap((owner) => built.filter((step) => step.employee === owner));
  return { now, later };
}

/** "3 of 5 steps done. 6 coming later." Unbuilt steps can never finish, so they are counted apart. */
export function planSummary(steps: readonly Pick<TeamStep, "state" | "notBuilt">[]): string {
  const later = steps.filter((step) => step.notBuilt).length;
  const skipped = steps.filter((step) => !step.notBuilt && step.state === "skipped").length;
  const counted = steps.length - later - skipped;
  const done = steps.filter((step) => !step.notBuilt && step.state === "succeeded").length;
  return `${done} of ${counted} steps done.${later === 0 ? "" : ` ${later} coming later.`}${
    skipped === 0 ? "" : ` ${skipped} skipped for this team.`
  }`;
}

// ---------------------------------------------------------------------------
// Why this team
// ---------------------------------------------------------------------------

/**
 * - `core`: Lead, Brand, Email or Social, on every team.
 * - `lead`: hired because the Crew Lead chose it for this idea (roster per idea, WP90).
 * - `added`: hired by a rule (a paid push, a course) or by the founder.
 * - `skipped`: not on the team for now.
 */
export type WhyDecision = "core" | "lead" | "added" | "skipped";

export type WhyRow = {
  readonly role: RoleKey;
  readonly roleLabel: string;
  readonly decision: WhyDecision;
  /** The pill text, for example "Hired · Juno chose". */
  readonly label: string;
  readonly reason: string;
};

const CORE: ReadonlySet<RoleKey> = new Set<RoleKey>(CORE_ROLE_KEYS);

/** The hired role's decision: core, the lead's call, or added. */
export function hiredDecision(role: RoleKey, decidedBy: "lead" | undefined): Exclude<WhyDecision, "skipped"> {
  if (CORE.has(role)) return "core";
  return decidedBy === "lead" ? "lead" : "added";
}

/** The Crew Lead's name on this team, or a plain fallback. */
export function leadNameOf(hired: readonly TeamHired[]): string {
  return hired.find((entry) => entry.role === "lead")?.name ?? "Your Crew Lead";
}

/** Every role the roster decided on, hired or skipped, in catalogue order. */
export function whyRows(hired: readonly TeamHired[], skipped: readonly TeamSkipped[]): WhyRow[] {
  const leadName = leadNameOf(hired);
  const labels: Readonly<Record<WhyDecision, string>> = {
    core: "Hired · core",
    lead: `Hired · ${leadName} chose`,
    added: "Hired · added",
    skipped: "Skipped",
  };
  const rows: WhyRow[] = [];
  for (const role of ROLE_KEYS) {
    const h = hired.find((entry) => entry.role === role);
    if (h !== undefined) {
      const decision = hiredDecision(role, h.decidedBy);
      rows.push({ role, roleLabel: h.roleLabel, decision, label: labels[decision], reason: h.reason });
      continue;
    }
    const s = skipped.find((entry) => entry.role === role);
    if (s !== undefined) rows.push({ role, roleLabel: s.roleLabel, decision: "skipped", label: labels.skipped, reason: s.reason });
  }
  return rows;
}
