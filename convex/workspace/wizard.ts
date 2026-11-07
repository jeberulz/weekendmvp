import { ConvexError, v, type Infer } from "convex/values";
import type { ZodType } from "zod";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import { assertFeatureEnabled } from "../ops/settings";
import { checkLimit } from "../platform/limits";
import { isEngineDraftSlug } from "../platform/catalogPolicy";
import {
  requireCurrentPlatformUser,
  requireCurrentPlatformUserForMutation,
  requireOwnedWizardSession,
} from "../platform/authz";
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
import { businessAllowance } from "./business";
import { mirrorSignal, recordFounderSignal } from "./signals";

/**
 * WP74-S1 launch wizard: eight steps (C-WIZARD `WIZARD_STEPS`, D10 — no SMS
 * step, no phone number) with a suggested default on each, progress kept in
 * `wizard_sessions`.
 *
 * Rules:
 * - Every public function checks the C-OPS `workspace` feature and cohort
 *   (`assertFeatureEnabled`) and the signed-in user (C-AUTHZ
 *   `requireCurrentPlatformUser*`). A call on an existing session goes
 *   through C-AUTHZ `requireOwnedWizardSession`: owner-only, never abandoned,
 *   and a session that already made its business only where `allowLinked`
 *   says so (`getSession`, and the `createBusiness` replay). A missing
 *   session, someone else's, and a linked one whose business is missing,
 *   archived or not linked back all answer the same `RESOURCE_NOT_FOUND`.
 * - Writers store only `wizardAnswersProgressSchema.parse()` output, and
 *   completion stores `wizardAnswersSchema.parse()` output, so the blueprint
 *   must be accepted (`looks_good`). `step` is the C-WIZARD step key.
 * - Each step mutation names the step it answers. A call for any other step
 *   (a double click, a stale tab) changes nothing and returns the current
 *   state, so a decision is applied and logged once.
 * - One active session per owner per idea: starting again resumes it.
 * - No business or project is created here: `business.ts:createBusiness` does
 *   that from a completed session (WP74-S4).
 */

const DENIAL_CODES: ReadonlySet<string> = new Set(["UNAUTHENTICATED", "RESOURCE_NOT_FOUND", "WORKSPACE_DISABLED"]);


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
  origin: v.union(v.literal("library"), v.literal("own_fixture"), v.literal("own_drafted"), v.literal("own_fallback")),
  removedClaims: v.number(),
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
  /** The business this session created (WP74-S4), or null before "Create my business". */
  business: v.union(
    v.null(),
    v.object({ projectId: v.id("projects"), name: v.string(), slug: v.string() }),
  ),
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

/**
 * The library idea's public row, or null when unknown, removed or an engine
 * draft (`engine-draft-*`: never an entry point, WP54-S5), so neither the
 * route gate nor `startOrResume` accepts it or reveals its title.
 */
async function libraryIdea(ctx: Pick<QueryCtx, "db">, slug: string): Promise<Doc<"ideas"> | null> {
  if (isEngineDraftSlug(slug)) return null;
  const idea = await ctx.db
    .query("ideas")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .first();
  return idea === null || idea.editorialVisibility === "removed" ? null : idea;
}

async function seedFor(ctx: Pick<QueryCtx, "db">, idea: WizardIdea): Promise<{ seed: WizardSeed; title: string }> {
  if (idea.source === "own_idea") {
    // WP74-S3 seam (Option A, awaiting the owner's ruling): pass the session's
    // stored gateway draft here as `ownIdeaDraft`. `wizardSeedFor` already runs
    // it through `acceptLightBlueprint` and falls back when it is rejected.
    return { seed: wizardSeedFor({ idea }), title: idea.text };
  }
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

/**
 * How many of the owner's newest unfinished sessions a resume looks at.
 * Abandoned and completed-but-unlaunched sessions count toward the window.
 */
export const RESUME_WINDOW = 100;

function sameIdea(session: Doc<"wizard_sessions">, idea: WizardIdea): boolean {
  return idea.source === "library"
    ? session.ideaSlug === idea.ideaSlug && session.ownIdeaText === undefined
    : session.ownIdeaText === idea.text && session.ideaSlug === undefined;
}

/**
 * The owner's active sessions for this idea, newest first, among the owner's
 * newest `RESUME_WINDOW` sessions without a project. Bounded, not exact: a
 * match older than the window is not found, so that founder gets a new
 * session (and the old one stays as it was). An index on the idea (see
 * Needs from Codex in wp74-progress.md) makes this exact.
 */
async function activeSessionsFor(
  ctx: Pick<QueryCtx, "db">,
  ownerId: Id<"users">,
  idea: WizardIdea,
): Promise<Doc<"wizard_sessions">[]> {
  // Within one equal index range rows are ordered by creation time, so a
  // descending read takes the newest sessions.
  const recent = await ctx.db
    .query("wizard_sessions")
    .withIndex("by_ownerId_and_projectId", (q) => q.eq("ownerId", ownerId).eq("projectId", undefined))
    .order("desc")
    .take(RESUME_WINDOW);
  return recent.filter((session) => session.abandonedAt === undefined && sameIdea(session, idea));
}

/** The owner's newest active session for this idea, within the resume window. */
async function activeSessionFor(
  ctx: Pick<QueryCtx, "db">,
  ownerId: Id<"users">,
  idea: WizardIdea,
): Promise<Doc<"wizard_sessions"> | null> {
  const [newest] = await activeSessionsFor(ctx, ownerId, idea);
  return newest ?? null;
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

  await recordFounderSignal(ctx, { ownerId: session.ownerId, session, step, action, before, after, now });
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

  // One active session per (owner, idea): moving this session onto own-idea
  // text that another active session already holds abandons the other one.
  if (step === "idea" && idea.source === "own_idea") {
    const previous = sessionIdea(current);
    if (previous.source !== "own_idea" || previous.text !== idea.text) {
      const duplicates = await activeSessionsFor(ctx, session.ownerId, idea);
      for (const duplicate of duplicates) {
        if (duplicate._id === session._id) continue;
        await ctx.db.patch("wizard_sessions", duplicate._id, { abandonedAt: now, updatedAt: now });
      }
    }
  }

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

export const businessLimitValidator = v.union(
  v.null(),
  v.object({ limit: v.number(), projectId: v.union(v.id("projects"), v.null()) }),
);

export const wizardAccessValidator = v.union(
  v.object({
    allowed: v.literal(true),
    ideaTitle: v.union(v.string(), v.null()),
    /** Set when the plan's businesses are used up: a new wizard would be refused. */
    businessLimit: businessLimitValidator,
  }),
  v.object({ allowed: v.literal(false) }),
);

/**
 * Route gate for `/start/*`. Read-only: `{ allowed: false }` unless the caller
 * is signed in, the workspace is on for their cohort, and (for a library
 * idea) the idea exists. Every denial looks the same. An allowed answer also
 * says when the plan's businesses are used up (`businessLimit`), so the start
 * screen can say so before a new wizard begins.
 */
export const getWizardAccess = query({
  args: { ideaSlug: v.optional(v.string()) },
  returns: wizardAccessValidator,
  handler: async (ctx, args) => {
    try {
      await assertFeatureEnabled(ctx, "workspace");
      const user = await requireCurrentPlatformUser(ctx);
      const allowance = await businessAllowance(ctx, user._id);
      const businessLimit = allowance.full ? { limit: allowance.limit, projectId: allowance.liveProjectId } : null;
      if (args.ideaSlug === undefined) return { allowed: true as const, ideaTitle: null, businessLimit };
      const row = await libraryIdea(ctx, args.ideaSlug);
      if (row === null) return { allowed: false as const };
      return { allowed: true as const, ideaTitle: row.title, businessLimit };
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

    // Completed but not yet a business still counts: S4 creates the business from it.
    const existing = await activeSessionFor(ctx, user._id, idea);
    if (existing) return existing._id;

    // A founder whose plan's businesses are used up hears it on the first
    // screen, before the blueprint spends AI or the start spends the daily
    // allowance. `createBusiness` keeps its own check at the end.
    const allowance = await businessAllowance(ctx, user._id);
    if (allowance.full) {
      throw new ConvexError({
        code: "BUSINESS_LIMIT_REACHED",
        plan: allowance.plan,
        limit: allowance.limit,
        ...(allowance.liveProjectId === null ? {} : { projectId: allowance.liveProjectId }),
      });
    }

    // C-LIMITS: only a new session spends the daily wizard-start allowance. A
    // refusal throws here, so nothing below is written. It also needs the
    // `ai` feature, because the blueprint and roster spend AI right after start.
    await checkLimit(ctx, "wizardStart", user._id);

    const now = Date.now();
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
      await commitStep(ctx, session, "idea", idea, "rewrote", { hadSuggestion: false });
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
    const session = await requireOwnedWizardSession(ctx, args.sessionId, { allowLinked: true });
    const answers = storedAnswers(session);
    const { seed, title } = await seedFor(ctx, sessionIdea(answers));
    const step = sessionStep(session);
    const project = session.projectId === undefined ? null : await ctx.db.get("projects", session.projectId);
    const business = project !== null && project.ownerId === session.ownerId && project.workspace !== undefined
      ? { projectId: project._id, name: project.workspace.name, slug: project.workspace.slug }
      : null;
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
      business,
    };
  },
});

/** Saves the current step's answer (classified as `kept`, `changed` or `rewrote`) and moves on. */
export const saveStep = mutation({
  args: { sessionId: v.id("wizard_sessions"), step: stepValidator, answer: stepAnswerValidator },
  returns: stepResultValidator,
  handler: async (ctx, args) => {
    await assertFeatureEnabled(ctx, "workspace");
    const session = await requireOwnedWizardSession(ctx, args.sessionId);
    if (session.completedAt !== undefined) return deny("SESSION_COMPLETE");
    if (args.step !== sessionStep(session)) return unchanged(session);
    return await commitStep(ctx, session, args.step, args.answer, null);
  },
});

/** Skips the current step: its suggested default is used, logged as `skipped`. */
export const skipStep = mutation({
  args: { sessionId: v.id("wizard_sessions"), step: stepValidator },
  returns: stepResultValidator,
  handler: async (ctx, args) => {
    await assertFeatureEnabled(ctx, "workspace");
    const session = await requireOwnedWizardSession(ctx, args.sessionId);
    if (session.completedAt !== undefined) return deny("SESSION_COMPLETE");
    if (args.step !== sessionStep(session)) return unchanged(session);
    const { seed } = await seedFor(ctx, sessionIdea(storedAnswers(session)));
    return await commitStep(ctx, session, args.step, seed.defaults[stepKey(args.step)], "skipped");
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
    const session = await requireOwnedWizardSession(ctx, args.sessionId);
    if (session.completedAt !== undefined) return deny("SESSION_COMPLETE");
    if (args.step !== sessionStep(session)) return unchanged(session);
    const { seed } = await seedFor(ctx, sessionIdea(storedAnswers(session)));
    return await commitStep(ctx, session, args.step, rewriteAnswer(args.step, args.text, seed), "rewrote");
  },
});

/**
 * Goes back one step from `step`, or straight to the earlier step `to` (the
 * "Choose a different name" link after a `NAME_RESERVED` refusal, WP74-S4).
 * From the finished screen (`completed`), Back reopens the last step, or `to`.
 * Answers are kept; nothing is logged. A `to` that is not earlier changes
 * nothing.
 */
export const goBack = mutation({
  args: { sessionId: v.id("wizard_sessions"), step: stepValidator, to: v.optional(stepValidator) },
  returns: stepResultValidator,
  handler: async (ctx, args) => {
    await assertFeatureEnabled(ctx, "workspace");
    const session = await requireOwnedWizardSession(ctx, args.sessionId);
    const step = sessionStep(session);
    if (args.step !== step) return unchanged(session);
    const now = Date.now();
    const index = WIZARD_STEPS.indexOf(step);
    const completed = session.completedAt !== undefined;
    if (args.to !== undefined) {
      const target = WIZARD_STEPS.indexOf(args.to);
      if (target > index || (target === index && !completed)) return unchanged(session);
      await ctx.db.patch("wizard_sessions", session._id, { step: args.to, completedAt: undefined, updatedAt: now });
      return { applied: true, step: args.to, completed: false, action: null };
    }
    if (completed) {
      await ctx.db.patch("wizard_sessions", session._id, { completedAt: undefined, updatedAt: now });
      return { applied: true, step, completed: false, action: null };
    }
    if (index <= 0) return unchanged(session);
    const previous = WIZARD_STEPS[index - 1];
    await ctx.db.patch("wizard_sessions", session._id, { step: previous, updatedAt: now });
    return { applied: true, step: previous, completed: false, action: null };
  },
});
