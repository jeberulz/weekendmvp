import { v } from "convex/values";

export const starterKitProgressValidator = v.union(
  v.literal("not_started"),
  v.literal("planning"),
  v.literal("building"),
  v.literal("shipped"),
  v.literal("paused"),
);

export const starterKitSectionValidator = v.union(
  v.literal("rules"),
  v.literal("scorecard"),
  v.literal("spec"),
  v.literal("plan"),
  v.literal("ideas"),
  v.literal("prompts"),
  v.literal("templates"),
);

export const starterKitBlockerValidator = v.union(
  v.literal("time"),
  v.literal("scope"),
  v.literal("technical"),
  v.literal("audience"),
  v.literal("motivation"),
  v.literal("other"),
);

export const STARTER_KIT_PROGRESS_VALUES = [
  "not_started",
  "planning",
  "building",
  "shipped",
  "paused",
] as const;

export const STARTER_KIT_SECTION_VALUES = [
  "rules",
  "scorecard",
  "spec",
  "plan",
  "ideas",
  "prompts",
  "templates",
] as const;

export const STARTER_KIT_BLOCKER_VALUES = [
  "time",
  "scope",
  "technical",
  "audience",
  "motivation",
  "other",
] as const;

export type StarterKitProgress = (typeof STARTER_KIT_PROGRESS_VALUES)[number];
export type StarterKitSection = (typeof STARTER_KIT_SECTION_VALUES)[number];
export type StarterKitBlocker = (typeof STARTER_KIT_BLOCKER_VALUES)[number];
