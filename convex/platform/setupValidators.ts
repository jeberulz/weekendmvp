import { v } from "convex/values";

/**
 * WP44-S8. Convex validators for the setup answers, spelled out so the
 * generated types stay exact. Tests check they match `setupOptions.ts`.
 */
export const setupToolValidator = v.union(
  v.literal("cursor"),
  v.literal("claude"),
  v.literal("bolt"),
  v.literal("v0"),
  v.literal("lovable"),
  v.literal("replit"),
  v.literal("windsurf"),
  v.literal("no-code"),
);

export const setupHoursValidator = v.union(
  v.literal("8"),
  v.literal("12"),
  v.literal("20"),
  v.literal("more"),
);

export const setupGoalValidator = v.union(
  v.literal("side-income"),
  v.literal("learn"),
  v.literal("portfolio"),
  v.literal("replace-job"),
);

/** Why an idea is in For you. Each kind maps to exactly one ranking input. */
export const pickReasonValidator = v.union(
  v.object({ kind: v.literal("saved_like"), title: v.string() }),
  v.object({ kind: v.literal("goal"), goal: setupGoalValidator }),
  v.object({
    kind: v.literal("hours"),
    hours: v.union(v.literal("8"), v.literal("12"), v.literal("20")),
  }),
  v.object({ kind: v.literal("tool"), tool: setupToolValidator }),
);
