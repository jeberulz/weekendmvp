/**
 * Pure copy helpers for the dashboard Home (WP44-S4, PRD 6.2 and 6.8). They
 * take the browser's local time as input, so the greeting and the date line
 * match the member's day, not the server's.
 */

/** A personal module that failed to load (PRD 6.8). Details go to the console. */
export const MODULE_ERROR_COPY = "We can’t load your ideas right now. Try again in a minute.";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

export function timeOfDay(hour: number): "morning" | "afternoon" | "evening" {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  return "evening";
}

/** "Good evening, John." or "Good evening." when there is no name. */
export function greeting(hour: number, firstName: string | null): string {
  const opener = `Good ${timeOfDay(hour)}`;
  return firstName ? `${opener}, ${firstName}.` : `${opener}.`;
}

/** ISO 8601 week number of a local calendar date. */
export function isoWeek(date: Date): number {
  const day = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const weekday = day.getUTCDay() || 7;
  day.setUTCDate(day.getUTCDate() + 4 - weekday);
  const yearStart = Date.UTC(day.getUTCFullYear(), 0, 1);
  return Math.ceil(((day.getTime() - yearStart) / 86_400_000 + 1) / 7);
}

/** "Thu 24 Sep · Week 39". Shown in capitals through CSS. */
export function dateLine(date: Date): string {
  return `${DAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]} · Week ${isoWeek(date)}`;
}

function weekendLine(weekday: number): string {
  if (weekday === 5) return "Your weekend starts tonight.";
  if (weekday === 6) return "It’s Saturday. Build day.";
  if (weekday === 0) return "It’s Sunday. Ship day.";
  return "Your weekend starts Friday.";
}

/** The line under the greeting. */
export function statusLine(saved: { count: number; capped: boolean }, weekday: number): string {
  if (saved.count === 0) return "Let’s find an idea worth your weekend.";
  const count = `${saved.count}${saved.capped ? "+" : ""}`;
  const noun = saved.count === 1 && !saved.capped ? "saved idea" : "saved ideas";
  return `${count} ${noun}. ${weekendLine(weekday)}`;
}

type StepInput = {
  savedCount: number;
  setupDone: boolean;
  setupSkipped: boolean;
  /** An active weekend plan exists (WP44-S9). */
  building?: boolean;
  /** A plan finished in the last week, by the browser's clock (WP44-S9). */
  finishedRecently?: boolean;
};

export type NextStep = "setup" | "start" | "choosing" | "building" | "finished";

/**
 * Module 1's card (PRD 6.2). A running plan wins, then a plan that just
 * finished, then the shortlist. The setup questions show until they are
 * answered or skipped (R7).
 */
export function nextStep({ savedCount, setupDone, setupSkipped, building, finishedRecently }: StepInput): NextStep {
  if (building) return "building";
  if (finishedRecently) return "finished";
  if (savedCount > 0) return "choosing";
  return setupDone || setupSkipped ? "start" : "setup";
}

/** The `dashboard_viewed` state: "set_up" only when the questions were answered. */
export function viewedState(input: StepInput): "new" | "set_up" | "choosing" | "building" | "finished" {
  const step = nextStep(input);
  if (step === "setup" || step === "start") return input.setupDone ? "set_up" : "new";
  return step;
}
