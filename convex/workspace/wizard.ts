import { ConvexError, v, type Infer } from "convex/values";
import type { ZodType } from "zod";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import { assertFeatureEnabled } from "../ops/settings";
import { requireCurrentPlatformUser, requireCurrentPlatformUserForMutation } from "../platform/authz";
import schema from "../schema";
import {
  WIZARD_STEPS,
  wizardAnswersProgressSchema,
  wizardAnswersSchema,
  wizardIdeaSchema,
  type WizardAnswersProgress,
  type WizardStep,
} from "../../lib/workspace/contracts/wizard";
import {
  isDefaultAnswer,
  isRewrittenAnswer,
  nameAnswerFor,
  stepKey,
  wizardSeedFor,
  type WizardIdea,
  type WizardSeed,
} from "../../lib/workspace/wizard/defaults";
import { summarizeStep, type FounderSignalAction } from "../../lib/workspace/wizard/labels";
import { mirrorSignal, recordFounderSignal } from "./signals";

/**
 * WP74-S1 launch wizard: eight steps (C-WIZARD `WIZARD_STEPS`, D10 — no SMS
 * step, no phone number) with a suggested default on each, progress kept in
 * `wizard_sessions`.
 *
 * Rules:
 * - Every public function checks the C-OPS `workspace` feature and cohort
 *   (`assertFeatureEnabled`) and the signed-in user (C-AUTHZ
 *   `requireCurrentPlatformUser*`). A session is owner-only: a missing session
 *   and someone else's session answer the same `RESOURCE_NOT_FOUND`.
 * - Writers store only `wizardAnswersProgressSchema.parse()` output, and
 *   completion stores `wizardAnswersSchema.parse()` output, so the blueprint
 *   must be accepted (`looks_good`). `step` is the C-WIZARD step key.
 * - Each step mutation names the step it answers. A call for any other step
 *   (a double click, a stale tab) changes nothing and returns the current
 *   state, so a decision is applied and logged once.
 * - One active session per owner per idea: starting again resumes it.
 * - No business or project is created here (that is WP74-S4).
 */

const DENIAL_CODES: ReadonlySet<string> = new Set(["UNAUTHENTICATED", "RESOURCE_NOT_FOUND", "WORKSPACE_DISABLED"]);

/** How many of the owner's latest sessions the resume lookup reads. */
const RESUME_WINDOW = 50;
/** New sessions an owner may start in a rolling day. */
const MAX_NEW_SESSIONS_PER_DAY = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

const answersValidator = schema.tables.wizard_sessions.validator.fields.answers;

const stepValidator = v.union(
  v.literal("idea"),
  v.literal("blueprint"),
  v.literal("platform"),
  v.literal("commercial_model"),
  v.literal("goal"),
  v.literal("name"),
  v.literal("partner_personality"),
  v.literal("partner_name"),
);

const ideaValidator = v.union(
  v.object({ source: v.literal("library"), ideaSlug: v.string() }),
  v.object({ source: v.literal("own_idea"), text: v.string() }),
);

/**
 * Any one step's answer. Convex objects reject unknown fields, so a phone
 * number (or any other extra key) fails here; the step-specific shape, bounds
 * and strictness are then enforced by the C-WIZARD zod parse.
 */
const stepAnswerValidator = v.union(
  ideaValidator,
  v.object({ decision: v.literal("looks_good") }),
  v.object({ decision: v.literal("rework"), notes: v.optional(v.string()) }),
  v.object({ kind: v.literal("native") }),
  v.object({ kind: v.literal("web") }),
  v.object({ kind: v.literal("custom"), description: v.string() }),
  v.union(v.literal("free"), v.literal("freemium"), v.literal("subscription"), v.literal("one_time")),
  v.object({
    kind: v.union(
      v.literal("waitlist"),
      v.literal("first_sale"),
      v.literal("mrr_500"),
      v.literal("replace_income"),
      v.literal("just_testing"),
    ),
    timeframe: v.union(v.literal("weekend"), v.literal("2w"), v.literal("30d"), v.literal("none")),
    paidPush: v.optional(v.object({ dailyBudgetUsd: v.number() })),
  }),
  v.object({ chosen: v.string(), alternatives: v.array(v.string()) }),
  v.union(v.literal("hustler"), v.literal("strategist"), v.literal("creative"), v.literal("operator")),
  v.object({ kind: v.literal("preset"), name: v.union(v.literal("Wren"), v.literal("Juno"), v.literal("Ridge")) }),
  v.object({ kind: v.literal("custom"), name: v.string() }),
);

const blueprintPreviewValidator = v.object({
  pitch: v.string(),
  oneUser: v.string(),
  oneLoop: v.string(),
  features: v.array(v.string()),
  scopeCuts: v.array(v.string()),
  validated: v.boolean(),
});

const sessionViewValidator = v.object({
  sessionId: v.id("wizard_sessions"),
  step: stepValidator,
  stepIndex: v.number(),
  totalSteps: v.number(),
  completed: v.boolean(),
  ideaTitle: v.string(),
  answers: answersValidator,
  defaults: answersValidator,
  suggestedNames: v.array(v.string()),
  blueprint: blueprintPreviewValidator,
  seedSource: v.union(v.literal("fixture_hydrotrail"), v.literal("fixture_generic"), v.literal("fixture_own_idea")),
});
export type WizardSessionView = Infer<typeof sessionViewValidator>;

const stepResultValidator = v.object({
  applied: v.boolean(),
  step: stepValidator,
  completed: v.boolean(),
  action: v.union(v.literal("kept"), v.literal("changed"), v.literal("skipped"), v.literal("rewrote"), v.null()),
});
type StepResult = Infer<typeof stepResultValidator>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deny(code: "RESOURCE_NOT_FOUND" | "SESSION_COMPLETE" | "INVALID_STEP"): never {
  throw new ConvexError({ code });
}

/** Parses with a C-WIZARD schema; a failure is a `INVALID_ANSWER` ConvexError, never a raw write. */
function parseOrThrow<T>(schemaToUse: ZodType<T>, value: unknown): T {
  const result = schemaToUse.safeParse(value);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new ConvexError({
      code: "INVALID_ANSWER",
      message: issue ? `${issue.path.join(".") || "answer"}: ${issue.message}` : "Invalid answer",
    });
  }
  return result.data;
}

function isWizardStep(value: string): value is WizardStep {
  return (WIZARD_STEPS as readonly string[]).includes(value);
}

function sessionStep(session: Doc<"wizard_sessions">): WizardStep {
  return isWizardStep(session.step) ? session.step : "idea";
}

function isActive(session: Doc<"wizard_sessions">): boolean {
  return session.abandonedAt === undefined && session.projectId === undefined;
}

function sameIdea(session: Doc<"wizard_sessions">, idea: WizardIdea): boolean {
  return idea.source === "library"
    ? session.ideaSlug === idea.ideaSlug && session.ownIdeaText === undefined
    : session.ownIdeaText === idea.text && session.ideaSlug === undefined;
}

/** The library idea's public row, or null when unknown or removed. */
async function libraryIdea(ctx: Pick<QueryCtx, "db">, slug: string): Promise<Doc<"ideas"> | null> {
  const idea = await ctx.db
    .query("ideas")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .first();
  return idea === null || idea.editorialVisibility === "removed" ? null : idea;
}

async function seedFor(ctx: Pick<QueryCtx, "db">, idea: WizardIdea): Promise<{ seed: WizardSeed; title: string }> {
  if (idea.source === "own_idea") return { seed: wizardSeedFor({ idea }), title: idea.text };
  const row = await libraryIdea(ctx, idea.ideaSlug);
  const title = row?.title ?? idea.ideaSlug;
  return { seed: wizardSeedFor({ idea, ideaTitle: title }), title };
}

function storedAnswers(session: Doc<"wizard_sessions">): WizardAnswersProgress {
  return parseOrThrow(wizardAnswersProgressSchema, session.answers);
}

function sessionIdea(answers: WizardAnswersProgress): WizardIdea {
  if (!answers.idea) throw new ConvexError({ code: "INVALID_ANSWER", message: "idea: missing" });
  return answers.idea;
}

async function ownedSession(
  ctx: Pick<QueryCtx, "db">,
  ownerId: Id<"users">,
  sessionId: Id<"wizard_sessions">,
): Promise<Doc<"wizard_sessions">> {
  const session = await ctx.db.get("wizard_sessions", sessionId);
  if (session === null || session.ownerId !== ownerId || !isActive(session)) return deny("RESOURCE_NOT_FOUND");
  return session;
}

function unchanged(session: Doc<"wizard_sessions">): StepResult {
  return { applied: false, step: sessionStep(session), completed: session.completedAt !== undefined, action: null };
}

function nextStep(step: WizardStep): WizardStep | null {
  const index = WIZARD_STEPS.indexOf(step);
  return index >= 0 && index < WIZARD_STEPS.length - 1 ? WIZARD_STEPS[index + 1] : null;
}

/**
 * Applies one step decision: parse the merged answers, log the founder signal
 * and mirror it, move to the next step (or complete through the strict
 * schema), all in this transaction.
 */
async function commitStep(
  ctx: MutationCtx,
  user: Doc<"users">,
  session: Doc<"wizard_sessions">,
  step: WizardStep,
  stepAnswer: unknown,
  forcedAction: FounderSignalAction | null,
  options: { readonly hadSuggestion: boolean } = { hadSuggestion: true },
): Promise<StepResult> {
  const current = storedAnswers(session);
  const key = stepKey(step);
  const merged = parseOrThrow(wizardAnswersProgressSchema, { ...current, [key]: stepAnswer });
  const idea = sessionIdea(merged);

  // The idea step may keep the session's idea or replace it with the
  // founder's own; switching to another library idea is a new session.
  if (step === "idea") {
    const previous = sessionIdea(current);
    if (idea.source === "library" && (previous.source !== "library" || previous.ideaSlug !== idea.ideaSlug)) {
      throw new ConvexError({ code: "INVALID_ANSWER", message: "idea: start a new session for another library idea" });
    }
  }

  // Classify against the seed the session had before this decision.
  const { seed } = await seedFor(ctx, sessionIdea(current));
  const action: FounderSignalAction =
    forcedAction ??
    (isDefaultAnswer(step, merged, seed) ? "kept" : isRewrittenAnswer(step, merged, seed) ? "rewrote" : "changed");
  const before = options.hadSuggestion ? summarizeStep(step, seed.defaults) : undefined;
  const after = summarizeStep(step, merged);
  const now = Date.now();

  await recordFounderSignal(ctx, { ownerId: user._id, session, step, action, before, after, now });
  const withSignals = parseOrThrow(wizardAnswersProgressSchema, {
    ...merged,
    signals: mirrorSignal(merged.signals, step, action, before, after),
  });

  // Rework sends the blueprint back: the session stays on the review step.
  const reworked = step === "blueprint" && withSignals.blueprintDecision?.decision === "rework";
  const following = reworked ? step : nextStep(step);
  const ideaFields =
    idea.source === "library"
      ? { ideaSlug: idea.ideaSlug, ownIdeaText: undefined }
      : { ideaSlug: undefined, ownIdeaText: idea.text };

  if (following === null) {
    const completed = parseOrThrow(wizardAnswersSchema, withSignals);
    await ctx.db.patch("wizard_sessions", session._id, {
      ...ideaFields,
      answers: completed,
      step,
      updatedAt: now,
      completedAt: now,
    });
    return { applied: true, step, completed: true, action };
  }

  await ctx.db.patch("wizard_sessions", session._id, {
    ...ideaFields,
    answers: withSignals,
    step: following,
    updatedAt: now,
    completedAt: undefined,
  });
  return { applied: true, step: following, completed: false, action };
}

/** Builds the free-text answer a Rewrite writes; enum-only steps have none. */
function rewriteAnswer(step: WizardStep, text: string, seed: WizardSeed): unknown {
  switch (step) {
    case "idea":
      return { source: "own_idea", text };
    case "blueprint":
      return { decision: "rework", notes: text };
    case "platform":
      return { kind: "custom", description: text };
    case "name":
      return nameAnswerFor(text, seed);
    case "partner_name":
      return { kind: "custom", name: text };
    case "commercial_model":
    case "goal":
    case "partner_personality":
      return deny("INVALID_STEP");
  }
}

// ---------------------------------------------------------------------------
// Public functions
// ---------------------------------------------------------------------------

export const wizardAccessValidator = v.union(
  v.object({ allowed: v.literal(true), ideaTitle: v.union(v.string(), v.null()) }),
  v.object({ allowed: v.literal(false) }),
);

/**
 * Route gate for `/start/*`. Read-only: `{ allowed: false }` unless the caller
 * is signed in, the workspace is on for their cohort, and (for a library
 * idea) the idea exists. Every denial looks the same.
 */
export const getWizardAccess = query({
  args: { ideaSlug: v.optional(v.string()) },
  returns: wizardAccessValidator,
  handler: async (ctx, args) => {
    try {
      await assertFeatureEnabled(ctx, "workspace");
      await requireCurrentPlatformUser(ctx);
      if (args.ideaSlug === undefined) return { allowed: true as const, ideaTitle: null };
      const row = await libraryIdea(ctx, args.ideaSlug);
      if (row === null) return { allowed: false as const };
      return { allowed: true as const, ideaTitle: row.title };
    } catch (error) {
      if (error instanceof ConvexError && typeof error.data === "object" && error.data !== null &&
        "code" in error.data && typeof error.data.code === "string" && DENIAL_CODES.has(error.data.code)) {
        return { allowed: false as const };
      }
      throw error;
    }
  },
});

/**
 * Starts a wizard session for a library idea (by slug) or the founder's own
 * idea, or resumes the owner's active session for that idea. A library idea
 * starts on the idea step; an own idea was just written, so it is logged as
 * `rewrote` and the session starts on the blueprint step.
 */
export const startOrResume = mutation({
  args: { idea: ideaValidator },
  returns: v.id("wizard_sessions"),
  handler: async (ctx, args) => {
    await assertFeatureEnabled(ctx, "workspace");
    const user = await requireCurrentPlatformUserForMutation(ctx);
    const idea = parseOrThrow(wizardIdeaSchema, args.idea);
    if (idea.source === "library" && (await libraryIdea(ctx, idea.ideaSlug)) === null) {
      return deny("RESOURCE_NOT_FOUND");
    }

    const now = Date.now();
    const recent = await ctx.db
      .query("wizard_sessions")
      .withIndex("by_ownerId_and_updatedAt", (q) => q.eq("ownerId", user._id))
      .order("desc")
      .take(RESUME_WINDOW);
    // Completed but not yet a business still counts: S4 creates the business from it.
    const existing = recent.find((session) => isActive(session) && sameIdea(session, idea));
    if (existing) return existing._id;
    if (recent.filter((session) => session.startedAt > now - DAY_MS).length >= MAX_NEW_SESSIONS_PER_DAY) {
      throw new ConvexError({ code: "RATE_LIMITED" });
    }

    const answers = parseOrThrow(wizardAnswersProgressSchema, { idea });
    const sessionId = await ctx.db.insert("wizard_sessions", {
      ownerId: user._id,
      ...(idea.source === "library" ? { ideaSlug: idea.ideaSlug } : { ownIdeaText: idea.text }),
      step: "idea" satisfies WizardStep,
      answers,
      startedAt: now,
      updatedAt: now,
    });
    if (idea.source === "own_idea") {
      const session = await ctx.db.get("wizard_sessions", sessionId);
      if (session === null) return deny("RESOURCE_NOT_FOUND");
      // No suggestion preceded an own idea, so the signal has no `before`.
      await commitStep(ctx, user, session, "idea", idea, "rewrote", { hadSuggestion: false });
    }
    return sessionId;
  },
});

/** The session, its suggested defaults and the blueprint preview, for the owner only. */
export const getSession = query({
  args: { sessionId: v.id("wizard_sessions") },
  returns: sessionViewValidator,
  handler: async (ctx, args) => {
    await assertFeatureEnabled(ctx, "workspace");
    const user = await requireCurrentPlatformUser(ctx);
    const session = await ownedSession(ctx, user._id, args.sessionId);
    const answers = storedAnswers(session);
    const { seed, title } = await seedFor(ctx, sessionIdea(answers));
    const step = sessionStep(session);
    return {
      sessionId: session._id,
      step,
      stepIndex: WIZARD_STEPS.indexOf(step),
      totalSteps: WIZARD_STEPS.length,
      completed: session.completedAt !== undefined,
      ideaTitle: title,
      answers,
      defaults: seed.defaults,
      suggestedNames: [...seed.suggestedNames],
      blueprint: { ...seed.blueprint, features: [...seed.blueprint.features], scopeCuts: [...seed.blueprint.scopeCuts] },
      seedSource: seed.source,
    };
  },
});

/** Saves the current step's answer (classified as `kept`, `changed` or `rewrote`) and moves on. */
export const saveStep = mutation({
  args: { sessionId: v.id("wizard_sessions"), step: stepValidator, answer: stepAnswerValidator },
  returns: stepResultValidator,
  handler: async (ctx, args) => {
    await assertFeatureEnabled(ctx, "workspace");
    const user = await requireCurrentPlatformUserForMutation(ctx);
    const session = await ownedSession(ctx, user._id, args.sessionId);
    if (session.completedAt !== undefined) return deny("SESSION_COMPLETE");
    if (args.step !== sessionStep(session)) return unchanged(session);
    return await commitStep(ctx, user, session, args.step, args.answer, null);
  },
});

/** Skips the current step: its suggested default is used, logged as `skipped`. */
export const skipStep = mutation({
  args: { sessionId: v.id("wizard_sessions"), step: stepValidator },
  returns: stepResultValidator,
  handler: async (ctx, args) => {
    await assertFeatureEnabled(ctx, "workspace");
    const user = await requireCurrentPlatformUserForMutation(ctx);
    const session = await ownedSession(ctx, user._id, args.sessionId);
    if (session.completedAt !== undefined) return deny("SESSION_COMPLETE");
    if (args.step !== sessionStep(session)) return unchanged(session);
    const { seed } = await seedFor(ctx, sessionIdea(storedAnswers(session)));
    return await commitStep(ctx, user, session, args.step, seed.defaults[stepKey(args.step)], "skipped");
  },
});

/**
 * Rewrites the current step in the founder's own words: an own idea, rework
 * notes for the blueprint, a custom platform, a business name or a custom
 * partner name. Steps with only fixed choices refuse (`INVALID_STEP`).
 */
export const rewriteStep = mutation({
  args: { sessionId: v.id("wizard_sessions"), step: stepValidator, text: v.string() },
  returns: stepResultValidator,
  handler: async (ctx, args) => {
    await assertFeatureEnabled(ctx, "workspace");
    const user = await requireCurrentPlatformUserForMutation(ctx);
    const session = await ownedSession(ctx, user._id, args.sessionId);
    if (session.completedAt !== undefined) return deny("SESSION_COMPLETE");
    if (args.step !== sessionStep(session)) return unchanged(session);
    const { seed } = await seedFor(ctx, sessionIdea(storedAnswers(session)));
    return await commitStep(ctx, user, session, args.step, rewriteAnswer(args.step, args.text, seed), "rewrote");
  },
});

/**
 * Goes back one step from `step`. From the finished screen (`completed`), Back
 * reopens the last step. Answers are kept; nothing is logged.
 */
export const goBack = mutation({
  args: { sessionId: v.id("wizard_sessions"), step: stepValidator },
  returns: stepResultValidator,
  handler: async (ctx, args) => {
    await assertFeatureEnabled(ctx, "workspace");
    const user = await requireCurrentPlatformUserForMutation(ctx);
    const session = await ownedSession(ctx, user._id, args.sessionId);
    const step = sessionStep(session);
    if (args.step !== step) return unchanged(session);
    const now = Date.now();
    if (session.completedAt !== undefined) {
      await ctx.db.patch("wizard_sessions", session._id, { completedAt: undefined, updatedAt: now });
      return { applied: true, step, completed: false, action: null };
    }
    const index = WIZARD_STEPS.indexOf(step);
    if (index <= 0) return unchanged(session);
    const previous = WIZARD_STEPS[index - 1];
    await ctx.db.patch("wizard_sessions", session._id, { step: previous, updatedAt: now });
    return { applied: true, step: previous, completed: false, action: null };
  },
});
