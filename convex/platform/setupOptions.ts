/**
 * WP44-S8 setup questions (PRD 6.4, ruling R7). Pure: the Convex functions,
 * the ranking and the client all read these lists, so an answer means the
 * same thing everywhere. No server imports here.
 */

/** Manifest `tools` slugs a member can pick. */
export const SETUP_TOOLS = [
  "cursor",
  "claude",
  "bolt",
  "v0",
  "lovable",
  "replit",
  "windsurf",
  "no-code",
] as const;
export type SetupTool = (typeof SETUP_TOOLS)[number];
export const MAX_SETUP_TOOLS = SETUP_TOOLS.length;

export const SETUP_HOURS = ["8", "12", "20", "more"] as const;
export type SetupHours = (typeof SETUP_HOURS)[number];

export const SETUP_GOALS = ["side-income", "learn", "portfolio", "replace-job"] as const;
export type SetupGoal = (typeof SETUP_GOALS)[number];

export const HOURS_LABEL: Record<SetupHours, string> = {
  "8": "8 hrs",
  "12": "12 hrs",
  "20": "20 hrs",
  more: "More",
};

export const GOAL_LABEL: Record<SetupGoal, string> = {
  "side-income": "Side income",
  learn: "Learn by building",
  portfolio: "Portfolio piece",
  "replace-job": "Replace my job one day",
};

/**
 * Revenue goals each answer points at. Learning and portfolio work have no
 * revenue target, so they never move the ranking or supply a reason.
 */
export const GOAL_REVENUE: Record<SetupGoal, readonly string[]> = {
  "side-income": ["1k-month", "5k-month"],
  learn: [],
  portfolio: [],
  "replace-job": ["10k-month"],
};

/** Whether an idea's build time fits the weekend the member has. */
export function fitsWeekend(buildHours: number, weekly: SetupHours): boolean {
  if (weekly === "more") return true;
  return buildHours > 0 && buildHours <= Number(weekly);
}

/** Why an idea is in For you. Each kind maps to exactly one ranking input. */
export type PickReason =
  | { kind: "saved_like"; title: string }
  | { kind: "goal"; goal: SetupGoal }
  | { kind: "hours"; hours: Exclude<SetupHours, "more"> }
  | { kind: "tool"; tool: SetupTool };

const TOOL_NAME: Record<SetupTool, string> = {
  cursor: "Cursor",
  claude: "Claude",
  bolt: "Bolt",
  v0: "v0",
  lovable: "Lovable",
  replit: "Replit",
  windsurf: "Windsurf",
  "no-code": "no-code tools",
};

export function toolLabel(tool: SetupTool): string {
  return TOOL_NAME[tool];
}

export function reasonText(reason: PickReason): string {
  switch (reason.kind) {
    case "saved_like":
      return `Like ${reason.title}, which you saved`;
    case "goal":
      return reason.goal === "replace-job"
        ? "Aims at $10K a month, for your replace-my-job goal"
        : "Fits your side income goal";
    case "hours":
      return `Fits a ${reason.hours}-hour weekend`;
    case "tool":
      return `You build with ${TOOL_NAME[reason.tool]}`;
  }
}
