/**
 * WP44-S9 weekend plan helpers. Pure, so tests can import them. Relative
 * imports on purpose: the test runner has no `@/` alias.
 */
import { WEEKEND_PLAN } from "../../home/content";
import { STAGES, type StageId, type StepKey, currentStage } from "../../../convex/platform/weekendSteps";
import type { DashboardSource } from "../../../lib/track";

export { BUILDS_PATH, planHref, startPlanHref } from "./plan-links";

/** Each stage's day, hours, title and line, from the homepage plan. */
export const STAGE_COPY: Record<StageId, (typeof WEEKEND_PLAN)[number]> = {
  fri: WEEKEND_PLAN[0],
  sat: WEEKEND_PLAN[1],
  sun: WEEKEND_PLAN[2],
  mon: WEEKEND_PLAN[3],
};

/** "Friday night", from the homepage's "FRIDAY NIGHT". */
export function dayName(stage: StageId): string {
  const day = STAGE_COPY[stage].day.toLowerCase();
  return day.charAt(0).toUpperCase() + day.slice(1);
}

export type StageStatus = "done" | "current" | "upcoming";

export function stageStatus(stage: StageId, done: readonly string[]): StageStatus {
  const steps = STAGES.find((s) => s.id === stage)!.steps;
  if (steps.every((step) => done.includes(step.key))) return "done";
  return currentStage(done) === stage ? "current" : "upcoming";
}

export const STAGE_STATUS_LABEL: Record<StageStatus, string> = {
  done: "Done",
  current: "Now",
  upcoming: "Up next",
};

/**
 * The stage that checking `key` completes, if any. `weekend_step_completed`
 * fires once per stage, when its last step is checked.
 */
export function completesStage(done: readonly string[], key: StepKey): StageId | null {
  const stage = STAGES.find((s) => s.steps.some((step) => step.key === key))!;
  const others = stage.steps.filter((step) => step.key !== key);
  if (done.includes(key)) return null;
  return others.every((step) => done.includes(step.key)) ? stage.id : null;
}

export function progressLine({ done, total }: { done: number; total: number }): string {
  return `${done} of ${total} steps done`;
}

const SOURCES: readonly DashboardSource[] = ["home", "ideas", "saved", "idea_page"];

/** Where a plan was started from. Unknown values count as the Ideas page. */
export function planSource(value: string | string[] | undefined): DashboardSource {
  return typeof value === "string" && (SOURCES as readonly string[]).includes(value)
    ? (value as DashboardSource)
    : "ideas";
}

/** Home shows "You shipped." for a week after a plan finishes. */
export const FINISHED_SHOWN_MS = 7 * 24 * 60 * 60 * 1000;

export function finishedRecently(completedAt: number | null | undefined, now: number): boolean {
  return typeof completedAt === "number" && now - completedAt >= 0 && now - completedAt < FINISHED_SHOWN_MS;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function shortDate(ms: number): string {
  const date = new Date(ms);
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** The link as people read it: no scheme, no trailing slash. */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}
