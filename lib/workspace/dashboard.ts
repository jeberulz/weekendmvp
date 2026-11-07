import { ConvexError } from "convex/values";

import type { ArtifactKind } from "@/lib/workspace/contracts/artifacts";
import { ROLE_KEYS, type RoleKey } from "@/lib/workspace/contracts/roster";
import type { LaunchHiredRole, LaunchView } from "@/lib/workspace/crew/launch";
import { workspacePath } from "@/lib/workspace/routes";

/**
 * L1 UI fidelity: the pure rules behind the workspace Dashboard. Everything on
 * the page is derived here from `launchStatus`, `launchProgress` and
 * `pendingReviews`; nothing is invented (no dates, no counts the backend did
 * not give, no balances). Unit-tested in `tests/platform/workspace-dashboard.test.tsx`.
 */

export type DashStepState = "waiting" | "queued" | "running" | "paused" | "succeeded" | "failed" | "skipped";

/** A launch step as `launchProgress` returns it. `notBuilt` and `employee` are optional so an older backend still reads. */
export type DashStep = {
  readonly key: string;
  readonly title: string;
  readonly employee?: string;
  readonly notBuilt?: boolean;
  readonly state: DashStepState;
  readonly reason?: string;
};

/** A pending review as `pendingReviews` returns it. */
export type DashReview = {
  readonly approvalId: string;
  readonly kind: ArtifactKind;
  readonly title: string;
  readonly changeRound: bigint | number;
  readonly expiresAt: number;
  readonly href: string;
};

export type DashHired = { readonly role: RoleKey; readonly name: string; readonly roleLabel: string };

const isRoleKey = (value: string): value is RoleKey => (ROLE_KEYS as readonly string[]).includes(value);

/** The hired team with role keys narrowed (an unknown key, never expected, is dropped). */
export function hiredTeam(launch: LaunchView): DashHired[] {
  if (launch.state !== "ready") return [];
  const hired: DashHired[] = [];
  for (const entry of launch.hired as readonly LaunchHiredRole[]) {
    if (isRoleKey(entry.roleKey)) hired.push({ role: entry.roleKey, name: entry.employeeName, roleLabel: entry.roleLabel });
  }
  return hired;
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

/** The step key each review kind belongs to. */
const REVIEW_STEP: Readonly<Partial<Record<ArtifactKind, string>>> = Object.freeze({
  blueprint: "blueprint",
  roster_plan: "roster",
  brand_kit: "brand_kit",
  email_sequence: "email_sequence",
  social_pack: "social_pack",
  landing_spec: "landing_spec",
  seo_pack: "seo_pack",
  launch_plan: "launch_plan",
  ads_drafts: "ads_drafts",
  build_pack: "build_pack",
});

/** Reviews still open: the query never reads the clock, so a card past `expiresAt` is left out here. */
export function openReviews<T extends { readonly expiresAt: number }>(reviews: readonly T[], now: number): T[] {
  return reviews.filter((review) => review.expiresAt > now);
}

/** Steps that exist in this beta: not "coming later" and not skipped by the roster. */
export function countedSteps(steps: readonly DashStep[]): DashStep[] {
  return steps.filter((step) => step.notBuilt !== true && step.state !== "skipped");
}

export function reviewStepKeys(reviews: readonly Pick<DashReview, "kind">[]): Set<string> {
  const keys = new Set<string>();
  for (const review of reviews) {
    const key = REVIEW_STEP[review.kind];
    if (key !== undefined) keys.add(key);
  }
  return keys;
}

// ---------------------------------------------------------------------------
// Launch banner
// ---------------------------------------------------------------------------

export type BannerVariant = "not_started" | "assembling" | "failed" | "ready";

export type BannerCopy = {
  readonly variant: BannerVariant;
  readonly lead: string;
  readonly tail?: string;
  readonly status: string;
  readonly done: number;
  readonly total: number;
};

const lower = (text: string): string => text.charAt(0).toLowerCase() + text.slice(1);

function joinList(items: readonly string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 * One plain line about what is happening now, built from real step states:
 * "Ready for your OK: brand kit and waitlist emails. Drafting: social posts."
 */
export function statusLine(steps: readonly DashStep[], reviews: readonly Pick<DashReview, "kind" | "title">[]): string {
  const counted = countedSteps(steps);
  const parts: string[] = [];
  if (reviews.length > 0) parts.push(`Ready for your OK: ${joinList(reviews.map((review) => lower(review.title)))}.`);
  const drafting = counted.filter((step) => step.state === "running" || step.state === "queued");
  if (drafting.length > 0) parts.push(`Drafting: ${joinList(drafting.map((step) => lower(step.title)))}.`);
  const paused = counted.filter((step) => step.state === "paused");
  if (paused.length > 0) parts.push(`Paused: ${joinList(paused.map((step) => lower(step.title)))}. Resume in Team HQ.`);
  const failed = counted.filter((step) => step.state === "failed");
  if (failed.length > 0) parts.push(`Did not finish: ${joinList(failed.map((step) => lower(step.title)))}. Try again in Team HQ.`);
  if (parts.length === 0) {
    const done = counted.filter((step) => step.state === "succeeded").length;
    parts.push(done > 0 && done === counted.length ? "Everything the crew can build so far is done." : "Nothing is running right now.");
  }
  return parts.join(" ");
}

export function bannerCopy(input: {
  readonly launch: LaunchView;
  readonly started: boolean;
  readonly steps: readonly DashStep[];
  readonly reviews: readonly Pick<DashReview, "kind" | "title">[];
  readonly lead: string;
}): BannerCopy {
  const { launch, started, steps, reviews, lead } = input;
  if (launch.state === "not_started" || !started) {
    return {
      variant: "not_started",
      lead: "Your launch hasn't started yet.",
      status: "There is no team and no plan until your co-founder starts it.",
      done: 0,
      total: 0,
    };
  }
  if (launch.state === "assembling") {
    return {
      variant: "assembling",
      lead: "Your team is being put together.",
      status: `${lead} is writing your team now. This takes about a minute.`,
      done: 0,
      total: 0,
    };
  }
  if (launch.state === "failed") {
    return {
      variant: "failed",
      lead: "Your launch needs a hand.",
      status: launch.retryable
        ? `${lead} couldn't put your team together this time. Try again in Team HQ. Nothing was charged.`
        : `${lead} couldn't put your team together from what this business has so far. Your business is saved.`,
      done: 0,
      total: 0,
    };
  }
  const counted = countedSteps(steps);
  const done = counted.filter((step) => step.state === "succeeded").length;
  const failed = counted.filter((step) => step.state === "failed").length;
  const paused = counted.filter((step) => step.state === "paused").length;
  const needs = reviews.length;
  let tail: string | undefined;
  if (failed > 0) tail = failed === 1 ? "1 did not finish." : `${failed} did not finish.`;
  else if (paused > 0) tail = paused === 1 ? "1 is paused." : `${paused} are paused.`;
  else if (needs > 0) tail = needs === 1 ? "1 needs you." : `${needs} need you.`;
  return {
    variant: "ready",
    lead: counted.length === 0 ? "No steps to show yet." : `${done} of ${counted.length} ready.`,
    ...(tail === undefined ? {} : { tail }),
    status: statusLine(steps, reviews),
    done,
    total: counted.length,
  };
}

export type SegmentTone = "done" | "needs_you" | "working" | "problem" | "idle";

export type Segment = { readonly key: string; readonly title: string; readonly tone: SegmentTone; readonly label: string };

/** One bar segment per counted step, with the words a screen reader hears. */
export function segments(steps: readonly DashStep[], reviews: readonly Pick<DashReview, "kind">[]): Segment[] {
  const needs = reviewStepKeys(reviews);
  return countedSteps(steps).map((step): Segment => {
    if (needs.has(step.key) && step.state === "succeeded") return { key: step.key, title: step.title, tone: "needs_you", label: "ready for your OK" };
    switch (step.state) {
      case "succeeded":
        return { key: step.key, title: step.title, tone: "done", label: "done" };
      case "running":
        return { key: step.key, title: step.title, tone: "working", label: "in progress" };
      case "queued":
        return { key: step.key, title: step.title, tone: "working", label: "waiting for a free slot" };
      case "paused":
        return { key: step.key, title: step.title, tone: "problem", label: "paused" };
      case "failed":
        return { key: step.key, title: step.title, tone: "problem", label: "did not finish" };
      default:
        return { key: step.key, title: step.title, tone: "idle", label: "waiting" };
    }
  });
}

// ---------------------------------------------------------------------------
// Team strip
// ---------------------------------------------------------------------------

/** "9 on it, 4 need you": hired roles, and the distinct hired roles that own an open review. */
export function teamCounts(hired: readonly DashHired[], reviews: readonly Pick<DashReview, "kind">[]): { onIt: number; needYou: number } {
  const owners = new Set<RoleKey>();
  for (const review of reviews) owners.add(REVIEW_OWNER[review.kind]);
  return { onIt: hired.length, needYou: hired.filter((entry) => owners.has(entry.role)).length };
}

export function teamHeadingTail(counts: { onIt: number; needYou: number }): string {
  return counts.needYou > 0 ? `${counts.onIt} on it, ${counts.needYou} need you` : `${counts.onIt} on it`;
}

// ---------------------------------------------------------------------------
// Pending approvals
// ---------------------------------------------------------------------------

/** "Change round 1. " is added by the caller; this is the closing phrase. */
export function approvalOwner(review: Pick<DashReview, "kind">, hired: readonly DashHired[], roleLabels: Readonly<Record<RoleKey, string>>): string {
  const role = REVIEW_OWNER[review.kind];
  const found = hired.find((entry) => entry.role === role);
  return found === undefined ? roleLabels[role] : `${found.name} · ${found.roleLabel}`;
}

// ---------------------------------------------------------------------------
// What's ready (the checklist)
// ---------------------------------------------------------------------------

export type ChecklistStatus =
  | { readonly set: "step"; readonly status: "waiting" | "queued" | "working" | "paused" | "done" | "failed" | "coming_soon" | "skipped"; readonly label?: string }
  | { readonly set: "output"; readonly status: "ready" };

export type ChecklistRow = {
  readonly id: string;
  readonly title: string;
  readonly detail: string;
  readonly status: ChecklistStatus;
  readonly href?: string;
  readonly linkLabel?: string;
};

function stepStatus(step: DashStep | undefined, needsReview: boolean, drafted: string): ChecklistStatus {
  if (step === undefined || step.notBuilt === true) return { set: "step", status: "coming_soon" };
  if (needsReview && step.state === "succeeded") return { set: "output", status: "ready" };
  switch (step.state) {
    case "running":
      return { set: "step", status: "working" };
    case "succeeded":
      return { set: "step", status: "done", label: drafted };
    case "skipped":
      return { set: "step", status: "skipped" };
    default:
      return { set: "step", status: step.state };
  }
}

/**
 * The checklist, from real state: the workspace, the team, the blueprint, the
 * brand kit, the four emails and the seven posts, then "Your site", which is
 * not built in this beta and says so.
 */
export function checklistRows(input: {
  readonly projectId: string;
  readonly launch: LaunchView;
  readonly steps: readonly DashStep[];
  readonly reviews: readonly Pick<DashReview, "kind">[];
}): ChecklistRow[] {
  const { projectId, launch, steps, reviews } = input;
  const needs = reviewStepKeys(reviews);
  const find = (key: string): DashStep | undefined => steps.find((step) => step.key === key);
  const teamStatus: ChecklistStatus =
    launch.state === "ready"
      ? { set: "step", status: "done", label: "Ready" }
      : launch.state === "failed"
        ? { set: "step", status: "failed" }
        : launch.state === "assembling"
          ? { set: "step", status: "working" }
          : { set: "step", status: "waiting" };
  return [
    {
      id: "workspace",
      title: "Your business and workspace",
      detail: "Saved. Nothing sends, posts or spends without your OK.",
      status: { set: "step", status: "done", label: "Set up" },
    },
    {
      id: "team",
      title: "Your team",
      detail: "Hired and skipped roles, with the reasons.",
      status: teamStatus,
      href: workspacePath(projectId, "team"),
      linkLabel: "Open Team HQ",
    },
    {
      id: "blueprint",
      title: "Blueprint",
      detail: "Who it is for, the one loop, and what is left out.",
      status: stepStatus(find("blueprint"), needs.has("blueprint"), "Drafted"),
      href: workspacePath(projectId, "team"),
      linkLabel: "Open the blueprint",
    },
    {
      id: "brand",
      title: "Brand kit",
      detail: "Name, palette, type and voice, drafted for you to review.",
      status: stepStatus(find("brand_kit"), needs.has("brand_kit"), "Drafted"),
      href: workspacePath(projectId, "brand"),
      linkLabel: "Open Brand kit",
    },
    {
      id: "email",
      title: "Four waitlist emails",
      detail: "Drafts only. Sending is off during the beta.",
      status: stepStatus(find("email_sequence"), needs.has("email_sequence"), "Drafted"),
      href: workspacePath(projectId, "email"),
      linkLabel: "Open Email",
    },
    {
      id: "social",
      title: "Seven launch posts",
      detail: "Copy to post yourself. Nothing is posted for you.",
      status: stepStatus(find("social_pack"), needs.has("social_pack"), "Drafted"),
      href: workspacePath(projectId, "social"),
      linkLabel: "Open Social",
    },
    {
      id: "site",
      title: "Your site",
      detail: "The landing page and waitlist come later. Nothing is published in this beta.",
      status: { set: "step", status: "coming_soon" },
    },
  ];
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export const DASHBOARD_ERROR_COPY = "Your dashboard can't load right now. Reload the page to try again.";
export const DASHBOARD_AI_OFF_COPY = "AI work is switched off right now, so your launch can't be shown. Your business is safe. Check back later.";

/** A plain-words reason for a failed read; never the raw error. */
export function dashboardErrorCopy(error: unknown): string {
  if (error instanceof ConvexError && typeof error.data === "object" && error.data !== null) {
    const data: { code?: unknown } = error.data;
    if (data.code === "AI_DISABLED") return DASHBOARD_AI_OFF_COPY;
  }
  return DASHBOARD_ERROR_COPY;
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

export const DASHBOARD_TAIL = "Here is where your launch stands.";

export function dashboardSummary(input: { readonly launch: LaunchView; readonly lead: string }): string {
  const { launch, lead } = input;
  switch (launch.state) {
    case "not_started":
      return "Your launch hasn't started yet.";
    case "assembling":
      return `${lead} is putting your team together.`;
    case "failed":
      return `${lead} needs a hand to finish your team.`;
    case "ready":
      return `${lead} is running your launch. Nothing sends, posts or spends without your OK.`;
  }
}
