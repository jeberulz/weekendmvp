import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import { PLATFORM_AUTH_ERROR, requireCurrentPlatformUser } from "./authz";
import { getEntitlements, upgradeRequired } from "./entitlements";
import { hoursOf } from "./ideaCards";
import { CORE_FEATURE_MAX, FINISHED_LIST_LIMIT, isStepKey, normalizeLiveUrl } from "./weekendSteps";

/**
 * WP44-S9 weekend plans (PRD 6.3, FR-15 to FR-20). Owner-scoped: identity
 * comes from the session and every plan read checks its owner. A plan is
 * active, done or archived. Only an active plan can change. How many plans
 * may run at once comes from entitlements (S10): 1 on Free (ruling R2).
 */

/** Active plans read at once. Free holds 1; Builder's Hub has no limit, so bound the read. */
export const ACTIVE_LIST_LIMIT = 20;
// Writing the core feature and saving the live link are steps in themselves,
// so saving either one checks its step.
const SCOPE_STEP = "fri-scope";
const LIVE_STEP = "sun-live";

function withStep(plan: Doc<"weekend_plans">, key: string, now: number) {
  if (plan.steps.some((step) => step.key === key)) return {};
  return { steps: [...plan.steps, { key, doneAt: now }] };
}

export const planStatusValidator = v.union(v.literal("active"), v.literal("done"), v.literal("archived"));

export const planSummaryValidator = v.object({
  planId: v.id("weekend_plans"),
  status: planStatusValidator,
  slug: v.string(),
  title: v.string(),
  doneKeys: v.array(v.string()),
  coreFeature: v.union(v.string(), v.null()),
  liveUrl: v.union(v.string(), v.null()),
  startedAt: v.number(),
  completedAt: v.union(v.number(), v.null()),
});

/** Active plans, most recently touched first. */
export async function activePlansOf(ctx: QueryCtx, ownerId: Id<"users">) {
  return await ctx.db
    .query("weekend_plans")
    .withIndex("by_ownerId_and_status_and_updatedAt", (q) =>
      q.eq("ownerId", ownerId).eq("status", "active"),
    )
    .order("desc")
    .take(ACTIVE_LIST_LIMIT);
}

export async function activePlanOf(ctx: QueryCtx, ownerId: Id<"users">) {
  return await ctx.db
    .query("weekend_plans")
    .withIndex("by_ownerId_and_status_and_updatedAt", (q) =>
      q.eq("ownerId", ownerId).eq("status", "active"),
    )
    .order("desc")
    .first();
}

export async function latestDonePlanOf(ctx: QueryCtx, ownerId: Id<"users">) {
  return await ctx.db
    .query("weekend_plans")
    .withIndex("by_ownerId_and_status_and_updatedAt", (q) =>
      q.eq("ownerId", ownerId).eq("status", "done"),
    )
    .order("desc")
    .first();
}

/** Summary for Home and Builds. Null when the idea row is gone. */
export async function summarize(ctx: QueryCtx, plan: Doc<"weekend_plans">) {
  const idea = await ctx.db.get("ideas", plan.ideaId);
  if (idea === null) return null;
  return {
    planId: plan._id,
    status: plan.status,
    slug: idea.slug,
    title: idea.title,
    doneKeys: plan.steps.map((step) => step.key),
    coreFeature: plan.coreFeature ?? null,
    liveUrl: plan.liveUrl ?? null,
    startedAt: plan.startedAt,
    completedAt: plan.completedAt ?? null,
  };
}

/** Missing and someone else's plans answer the same, so ids cannot be probed. */
async function ownedPlan(ctx: QueryCtx, ownerId: Id<"users">, rawId: string) {
  const planId = ctx.db.normalizeId("weekend_plans", rawId);
  const plan = planId ? await ctx.db.get("weekend_plans", planId) : null;
  if (plan === null || plan.ownerId !== ownerId) {
    throw new ConvexError({ code: PLATFORM_AUTH_ERROR.notFound });
  }
  return plan;
}

async function ownedActivePlan(ctx: MutationCtx, ownerId: Id<"users">, rawId: string) {
  const plan = await ownedPlan(ctx, ownerId, rawId);
  if (plan.status !== "active") throw new ConvexError({ code: "PLAN_NOT_ACTIVE" });
  return plan;
}

export const start = mutation({
  args: {
    slug: v.string(),
    /**
     * The free way forward at the limit: archive the current plan and start
     * this one. It never raises the limit, so it grants nothing.
     */
    replaceActive: v.optional(v.boolean()),
  },
  returns: v.object({ planId: v.id("weekend_plans"), created: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await requireCurrentPlatformUser(ctx);
    const idea = await ctx.db
      .query("ideas")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (idea === null) throw new ConvexError({ code: PLATFORM_AUTH_ERROR.notFound });

    const now = Date.now();
    const [active, { limits }] = await Promise.all([
      activePlansOf(ctx, user._id),
      getEntitlements(ctx, user._id),
    ]);
    const same = active.find((plan) => plan.ideaId === idea._id);
    if (same) return { planId: same._id, created: false };

    const limit = limits.activeWeekendPlans;
    if (limit !== null && active.length >= limit) {
      if (!args.replaceActive) {
        // The sheet names the plan to archive, the free way forward.
        const current = await ctx.db.get("ideas", active[0].ideaId);
        throw upgradeRequired("weekend_plan", {
          activePlanId: active[0]._id,
          activeTitle: current?.title ?? "your current idea",
        });
      }
      // Archive the least recently touched plans until the new one fits.
      for (const plan of active.slice(Math.max(limit - 1, 0))) {
        await ctx.db.patch("weekend_plans", plan._id, { status: "archived", archivedAt: now, updatedAt: now });
      }
    }
    const planId = await ctx.db.insert("weekend_plans", {
      ownerId: user._id,
      ideaId: idea._id,
      status: "active",
      steps: [],
      startedAt: now,
      updatedAt: now,
    });
    return { planId, created: true };
  },
});

export const toggleStep = mutation({
  args: { planId: v.string(), key: v.string(), done: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireCurrentPlatformUser(ctx);
    if (!isStepKey(args.key)) throw new ConvexError({ code: "INVALID_STEP" });
    const plan = await ownedActivePlan(ctx, user._id, args.planId);
    const now = Date.now();
    const rest = plan.steps.filter((step) => step.key !== args.key);
    const steps = args.done ? [...rest, { key: args.key, doneAt: now }] : rest;
    await ctx.db.patch("weekend_plans", plan._id, { steps, updatedAt: now });
    return null;
  },
});

export const setCoreFeature = mutation({
  args: { planId: v.string(), text: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireCurrentPlatformUser(ctx);
    const text = args.text.trim();
    if (text.length > CORE_FEATURE_MAX) throw new ConvexError({ code: "CORE_FEATURE_TOO_LONG" });
    const plan = await ownedActivePlan(ctx, user._id, args.planId);
    const now = Date.now();
    await ctx.db.patch("weekend_plans", plan._id, {
      coreFeature: text === "" ? undefined : text,
      updatedAt: now,
      ...(text !== "" ? withStep(plan, SCOPE_STEP, now) : {}),
    });
    return null;
  },
});

export const setLiveUrl = mutation({
  args: { planId: v.string(), url: v.string() },
  returns: v.object({ liveUrl: v.union(v.string(), v.null()) }),
  handler: async (ctx, args) => {
    const user = await requireCurrentPlatformUser(ctx);
    const liveUrl = args.url.trim() === "" ? null : normalizeLiveUrl(args.url);
    if (args.url.trim() !== "" && liveUrl === null) throw new ConvexError({ code: "INVALID_LIVE_URL" });
    const plan = await ownedActivePlan(ctx, user._id, args.planId);
    const now = Date.now();
    await ctx.db.patch("weekend_plans", plan._id, {
      liveUrl: liveUrl ?? undefined,
      updatedAt: now,
      ...(liveUrl !== null ? withStep(plan, LIVE_STEP, now) : {}),
    });
    return { liveUrl };
  },
});

export const finish = mutation({
  args: { planId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireCurrentPlatformUser(ctx);
    const plan = await ownedActivePlan(ctx, user._id, args.planId);
    const now = Date.now();
    await ctx.db.patch("weekend_plans", plan._id, { status: "done", completedAt: now, updatedAt: now });
    return null;
  },
});

export const archive = mutation({
  args: { planId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireCurrentPlatformUser(ctx);
    const plan = await ownedActivePlan(ctx, user._id, args.planId);
    const now = Date.now();
    await ctx.db.patch("weekend_plans", plan._id, { status: "archived", archivedAt: now, updatedAt: now });
    return null;
  },
});

const planIdeaValidator = v.object({
  slug: v.string(),
  title: v.string(),
  category: v.string(),
  buildTime: v.number(),
});

/** The start page: the idea about to start, the plan it would replace, and whether the limit bites. */
export const startPreview = query({
  args: { slug: v.string() },
  returns: v.object({
    idea: v.union(planIdeaValidator, v.null()),
    active: v.union(planSummaryValidator, v.null()),
    /** Starting another idea now would throw UPGRADE_REQUIRED. */
    atLimit: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const user = await requireCurrentPlatformUser(ctx);
    const [idea, active, { limits }] = await Promise.all([
      ctx.db
        .query("ideas")
        .withIndex("by_slug", (q) => q.eq("slug", args.slug))
        .unique(),
      activePlansOf(ctx, user._id),
      getEntitlements(ctx, user._id),
    ]);
    const same = idea ? active.find((plan) => plan.ideaId === idea._id) : undefined;
    const shown = same ?? active[0];
    const limit = limits.activeWeekendPlans;
    return {
      idea: idea ? { slug: idea.slug, title: idea.title, category: idea.category, buildTime: hoursOf(idea) } : null,
      active: shown ? await summarize(ctx, shown) : null,
      atLimit: !same && limit !== null && active.length >= limit,
    };
  },
});

/** One plan with its idea, for the plan page. */
export const get = query({
  args: { planId: v.string() },
  returns: v.object({
    plan: planSummaryValidator,
    idea: planIdeaValidator,
  }),
  handler: async (ctx, args) => {
    const user = await requireCurrentPlatformUser(ctx);
    const plan = await ownedPlan(ctx, user._id, args.planId);
    const idea = await ctx.db.get("ideas", plan.ideaId);
    const summary = await summarize(ctx, plan);
    if (idea === null || summary === null) throw new ConvexError({ code: PLATFORM_AUTH_ERROR.notFound });
    return {
      plan: summary,
      idea: { slug: idea.slug, title: idea.title, category: idea.category, buildTime: hoursOf(idea) },
    };
  },
});

/** Builds: active plans and the most recent finished ones. Archived plans stay out. */
export const list = query({
  args: {},
  returns: v.object({
    active: v.array(planSummaryValidator),
    finished: v.array(planSummaryValidator),
  }),
  handler: async (ctx) => {
    const user = await requireCurrentPlatformUser(ctx);
    const [active, done] = await Promise.all([
      activePlansOf(ctx, user._id),
      ctx.db
        .query("weekend_plans")
        .withIndex("by_ownerId_and_status_and_updatedAt", (q) =>
          q.eq("ownerId", user._id).eq("status", "done"),
        )
        .order("desc")
        .take(FINISHED_LIST_LIMIT),
    ]);
    const summaries = async (plans: Doc<"weekend_plans">[]) =>
      (await Promise.all(plans.map((plan) => summarize(ctx, plan)))).filter((plan) => plan !== null);
    return { active: await summaries(active), finished: await summaries(done) };
  },
});
