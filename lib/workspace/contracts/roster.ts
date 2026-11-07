import { z } from "zod";

export const ROLE_KEYS = [
  "lead",
  "brand",
  "landing",
  "seo",
  "marketing",
  "email",
  "social",
  "engineering",
  "ads",
  "curriculum",
  "community",
  "merch",
  "outbound",
] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];
export const roleKeySchema = z.enum(ROLE_KEYS);

/**
 * Roster per idea (WP90, owner decision 2026-11-07): the core every business
 * hires, whatever the idea. These are the roles whose launch steps are built
 * (blueprint and roster, brand kit, emails, social posts), so the L1 loop
 * always runs. Every other role is the idea's call: the blueprint proposes
 * it, and `planRoster` applies guardrails and falls back to rules. Replaces
 * the WP69 canvas rule "eight always hired".
 */
export const CORE_ROLE_KEYS = ["lead", "brand", "email", "social"] as const satisfies readonly RoleKey[];
export type CoreRoleKey = (typeof CORE_ROLE_KEYS)[number];

/** The roles the idea decides: hired or skipped, each with a reason. */
export const OPTIONAL_ROLE_KEYS = [
  "landing",
  "seo",
  "marketing",
  "engineering",
  "ads",
  "curriculum",
  "community",
  "merch",
  "outbound",
] as const satisfies readonly RoleKey[];
export type OptionalRoleKey = (typeof OPTIONAL_ROLE_KEYS)[number];

export function isCoreRoleKey(key: string): key is CoreRoleKey {
  return (CORE_ROLE_KEYS as readonly string[]).includes(key);
}

export function isOptionalRoleKey(key: string): key is OptionalRoleKey {
  return (OPTIONAL_ROLE_KEYS as readonly string[]).includes(key);
}

/** Longest reason a team decision may carry (the roster plan's own bound). */
export const TEAM_REASON_MAX = 160;

export const IDEA_KINDS = [
  "app",
  "course",
  "physical_product",
  "service",
  "marketplace",
  "b2b_software",
] as const;
export type IdeaKind = (typeof IDEA_KINDS)[number];
export const ideaKindSchema = z.enum(IDEA_KINDS);

export const BUYERS = ["consumer", "business"] as const;
export type Buyer = (typeof BUYERS)[number];
export const buyerSchema = z.enum(BUYERS);

export const DELIVERY_FORMATS = ["self_serve", "cohort", "one_to_one"] as const;
export type DeliveryFormat = (typeof DELIVERY_FORMATS)[number];
export const deliveryFormatSchema = z.enum(DELIVERY_FORMATS);

export const COMMERCIAL_MODELS = [
  "free",
  "freemium",
  "subscription",
  "one_time",
] as const;
export type CommercialModel = (typeof COMMERCIAL_MODELS)[number];
export const commercialModelSchema = z.enum(COMMERCIAL_MODELS);

export const GOAL_KINDS = [
  "waitlist",
  "first_sale",
  "mrr_500",
  "replace_income",
  "just_testing",
] as const;
export type GoalKind = (typeof GOAL_KINDS)[number];
export const goalKindSchema = z.enum(GOAL_KINDS);

export const ENGINEERING_WEIGHTS = ["full", "light"] as const;
export type EngineeringWeight = (typeof ENGINEERING_WEIGHTS)[number];
export const engineeringWeightSchema = z.enum(ENGINEERING_WEIGHTS);

/**
 * Invisible and bidi-control characters a single line may not contain: zero
 * width space (U+200B), LRM/RLM (U+200E, U+200F), the bidi embeddings and
 * overrides (U+202A–U+202E), word joiner (U+2060), the bidi isolates
 * (U+2066–U+2069) and the BOM (U+FEFF). ZWNJ (U+200C) and ZWJ (U+200D) stay
 * allowed: ZWJ emoji sequences and Persian text need them.
 */
export const INVISIBLE_OR_BIDI_CHARACTERS = /[\u200B\u200E\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/u;

/** At least one letter, number, symbol or punctuation mark. */
const VISIBLE_CHARACTER = /[\p{L}\p{N}\p{S}\p{P}]/u;

/**
 * Single-line text: trimmed, 1..max chars, no control characters or line
 * separators, no invisible or bidi-control characters, and at least one
 * visible character. Keeps founder-supplied values from injecting lines into
 * TEAM.md or reordering text around them.
 */
export function singleLineText(max: number) {
  return z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((value) => !/[\p{Cc}\u2028\u2029]/u.test(value), {
      message: "Must be a single line without control characters",
    })
    .refine((value) => !INVISIBLE_OR_BIDI_CHARACTERS.test(value), {
      message: "Must not contain invisible or bidi-control characters",
    })
    .refine((value) => VISIBLE_CHARACTER.test(value), {
      message: "Must contain at least one visible character",
    });
}

/** Upper bound on a goal target's count. */
export const GOAL_TARGET_COUNT_MAX = 1_000_000;

/** A goal's measurable target, e.g. 50 signups. */
export const goalTargetSchema = z
  .object({
    count: z.number().int().min(1).max(GOAL_TARGET_COUNT_MAX),
    unit: singleLineText(24),
  })
  .strict();
export type GoalTarget = z.infer<typeof goalTargetSchema>;

/** What the blueprint stores. */
export const rosterProfileSchema = z
  .object({
    ideaKind: ideaKindSchema,
    buyer: buyerSchema,
    deliveryFormat: deliveryFormatSchema,
    audiencePlural: singleLineText(40),
  })
  .strict();
export type RosterProfile = z.infer<typeof rosterProfileSchema>;

/**
 * One team decision the blueprint proposed for an optional role, already
 * cleaned (`lib/workspace/crew/teamProposal.ts`): a known optional role, at
 * most once, a single-line reason.
 */
export const teamDecisionSchema = z
  .object({
    roleKey: z.enum(OPTIONAL_ROLE_KEYS),
    hire: z.boolean(),
    reason: singleLineText(TEAM_REASON_MAX),
  })
  .strict();
export type TeamDecision = z.infer<typeof teamDecisionSchema>;

export const rosterInputSchema = rosterProfileSchema
  .extend({
    /**
     * Roster per idea: the Crew Lead's proposal from the blueprint. Absent
     * (an older blueprint, or one without a team block) means the rules decide.
     */
    proposal: z.array(teamDecisionSchema).max(OPTIONAL_ROLE_KEYS.length).optional(),
    commercialModel: commercialModelSchema,
    goal: z
      .object({
        kind: goalKindSchema,
        target: goalTargetSchema.nullable(),
        paidPush: z
          .object({
            dailyBudgetUsd: z.number().min(1).max(100).multipleOf(0.01),
          })
          .strict()
          .nullable(),
      })
      .strict(),
  })
  .strict();
export type RosterInput = z.infer<typeof rosterInputSchema>;

const hiredEntrySchema = z
  .object({
    roleKey: roleKeySchema,
    employeeName: singleLineText(40),
    roleLabel: singleLineText(40),
    hiredBy: z.enum(["rule", "founder"]),
    /** A core role (`CORE_ROLE_KEYS`). The name predates the core and is kept for stored plans. */
    always: z.boolean(),
    weight: engineeringWeightSchema.optional(),
    reason: z.string().trim().min(1).max(TEAM_REASON_MAX),
    /**
     * Roster per idea: "lead" when the Crew Lead's proposal decided this role,
     * absent when a rule did. `hiredBy` stays "rule" until Codex adds a "lead"
     * value to `crew_members.hiredBy` (gap G1).
     */
    decidedBy: z.literal("lead").optional(),
  })
  .strict();

const skippedEntrySchema = z
  .object({
    roleKey: roleKeySchema,
    roleLabel: singleLineText(40),
    reason: z.string().trim().min(1).max(TEAM_REASON_MAX),
    decidedBy: z.literal("lead").optional(),
  })
  .strict();

export const rosterPlanSchema = z
  .object({
    schemaVersion: z.literal(1),
    rulesVersion: singleLineText(32),
    ideaKind: ideaKindSchema,
    hired: z.array(hiredEntrySchema).max(ROLE_KEYS.length),
    skipped: z.array(skippedEntrySchema).max(ROLE_KEYS.length),
  })
  .strict()
  .superRefine((plan, ctx) => {
    const counts = new Map<string, number>();
    for (const h of plan.hired) counts.set(h.roleKey, (counts.get(h.roleKey) ?? 0) + 1);
    for (const s of plan.skipped) counts.set(s.roleKey, (counts.get(s.roleKey) ?? 0) + 1);
    for (const key of ROLE_KEYS) {
      if (counts.get(key) !== 1) {
        ctx.addIssue({
          code: "custom",
          message: `Role "${key}" must appear exactly once across hired and skipped`,
          path: ["hired"],
        });
      }
    }
    if (!plan.hired.some((h) => h.roleKey === "lead")) {
      ctx.addIssue({ code: "custom", message: "lead must be hired", path: ["hired"] });
    }
    const alwaysKeys = new Set<string>(CORE_ROLE_KEYS);
    plan.hired.forEach((h, i) => {
      const isAlways = alwaysKeys.has(h.roleKey);
      if (h.always !== isAlways) {
        ctx.addIssue({
          code: "custom",
          message: `always must be ${isAlways} for "${h.roleKey}"`,
          path: ["hired", i, "always"],
        });
      }
      if (isAlways && h.hiredBy !== "rule") {
        ctx.addIssue({
          code: "custom",
          message: `Core role "${h.roleKey}" must be hired by rule`,
          path: ["hired", i, "hiredBy"],
        });
      }
      if (isAlways && h.decidedBy !== undefined) {
        ctx.addIssue({
          code: "custom",
          message: `Core role "${h.roleKey}" is never the lead's call`,
          path: ["hired", i, "decidedBy"],
        });
      }
      if (h.roleKey === "engineering" && h.weight === undefined) {
        ctx.addIssue({
          code: "custom",
          message: "engineering requires a weight",
          path: ["hired", i, "weight"],
        });
      }
      if (h.roleKey !== "engineering" && h.weight !== undefined) {
        ctx.addIssue({
          code: "custom",
          message: "weight is only valid on engineering",
          path: ["hired", i, "weight"],
        });
      }
    });
    plan.skipped.forEach((s, i) => {
      if (alwaysKeys.has(s.roleKey)) {
        ctx.addIssue({
          code: "custom",
          message: `Core role "${s.roleKey}" cannot be skipped`,
          path: ["skipped", i, "roleKey"],
        });
      }
    });
  });
export type RosterPlan = z.infer<typeof rosterPlanSchema>;
