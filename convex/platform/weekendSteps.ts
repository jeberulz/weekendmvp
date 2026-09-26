/**
 * WP44-S9 weekend plan steps. Pure: the Convex mutations validate step keys
 * against this list, and the UI renders from it. Stage titles, days and
 * hours come from the homepage's `WEEKEND_PLAN` (components/home/content.ts),
 * in the same order.
 */

export const STAGES = [
  {
    id: "fri",
    steps: [
      { key: "fri-research", label: "Read the research" },
      { key: "fri-scope", label: "Write down the one core feature you will build" },
    ],
  },
  {
    id: "sat",
    steps: [
      { key: "sat-setup", label: "Paste the setup prompt into your AI tool" },
      { key: "sat-core", label: "Build the one screen that does the job" },
    ],
  },
  {
    id: "sun",
    steps: [
      { key: "sun-landing", label: "Add a landing page and a waitlist" },
      { key: "sun-live", label: "Put it live and save the link" },
      { key: "sun-share", label: "Share the link with ten people" },
    ],
  },
  {
    id: "mon",
    steps: [{ key: "mon-feedback", label: "Read what your first users said" }],
  },
] as const;

export type StageId = (typeof STAGES)[number]["id"];
export type StepKey = (typeof STAGES)[number]["steps"][number]["key"];

export const STEP_KEYS: readonly StepKey[] = STAGES.flatMap((stage) => stage.steps.map((step) => step.key));

export function isStepKey(value: string): value is StepKey {
  return (STEP_KEYS as readonly string[]).includes(value);
}

export function stageOf(key: StepKey): StageId {
  return STAGES.find((stage) => stage.steps.some((step) => step.key === key))!.id;
}

/** The first stage with an unchecked step, or Monday once everything is done. */
export function currentStage(done: readonly string[]): StageId {
  const open = STAGES.find((stage) => stage.steps.some((step) => !done.includes(step.key)));
  return open?.id ?? "mon";
}

export function nextStepLabel(done: readonly string[]): string | null {
  for (const stage of STAGES) {
    for (const step of stage.steps) if (!done.includes(step.key)) return step.label;
  }
  return null;
}

export function progress(done: readonly string[]) {
  const doneCount = STEP_KEYS.filter((key) => done.includes(key)).length;
  return { done: doneCount, total: STEP_KEYS.length };
}

export const CORE_FEATURE_MAX = 140;
/** Builds lists this many finished plans, newest first. */
export const FINISHED_LIST_LIMIT = 20;
export const LIVE_URL_MAX = 300;

/** A shipped link: http or https only, no credentials, bounded length. */
export function normalizeLiveUrl(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === "" || trimmed.length > LIVE_URL_MAX) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password || !url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}
