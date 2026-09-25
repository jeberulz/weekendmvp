import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { mutation, query, type QueryCtx } from "../_generated/server";
import { requireCurrentPlatformUser } from "./authz";
import { MAX_SETUP_TOOLS, SETUP_TOOLS } from "./setupOptions";
import {
  setupGoalValidator,
  setupHoursValidator,
  setupToolValidator,
} from "./setupValidators";

/**
 * WP44-S8 setup answers: tools, weekend hours, goal (PRD 6.4). One row per
 * member, read and written only through the session's own identity.
 * Skippable (ruling R7) and editable in Settings.
 */

export async function readPreferences(ctx: QueryCtx, ownerId: Id<"users">) {
  return await ctx.db
    .query("user_preferences")
    .withIndex("by_ownerId", (q) => q.eq("ownerId", ownerId))
    .unique();
}

const preferencesValidator = v.object({
  tools: v.array(setupToolValidator),
  weeklyHours: v.union(setupHoursValidator, v.null()),
  goal: v.union(setupGoalValidator, v.null()),
  setupDone: v.boolean(),
  setupSkipped: v.boolean(),
  updatedAt: v.union(v.number(), v.null()),
});

const KNOWN_TOOLS = new Set<string>(SETUP_TOOLS);

/** Stored tools pass through the allowlist again, in its order. */
function knownTools(tools: string[]) {
  return SETUP_TOOLS.filter((tool) => tools.includes(tool));
}

export const get = query({
  args: {},
  returns: preferencesValidator,
  handler: async (ctx) => {
    const user = await requireCurrentPlatformUser(ctx);
    const prefs = await readPreferences(ctx, user._id);
    return {
      tools: knownTools(prefs?.tools ?? []),
      weeklyHours: prefs?.weeklyHours ?? null,
      goal: prefs?.goal ?? null,
      setupDone: prefs?.onboardedAt !== undefined,
      setupSkipped: prefs?.skippedAt !== undefined,
      updatedAt: prefs?.updatedAt ?? null,
    };
  },
});

/** Saves the answers. Any answer may be left out: every one is optional. */
export const saveSetup = mutation({
  args: {
    tools: v.array(v.string()),
    weeklyHours: v.optional(setupHoursValidator),
    goal: v.optional(setupGoalValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireCurrentPlatformUser(ctx);
    if (
      args.tools.length > MAX_SETUP_TOOLS ||
      args.tools.some((tool) => !KNOWN_TOOLS.has(tool))
    ) {
      throw new ConvexError({ code: "INVALID_SETUP" });
    }
    const now = Date.now();
    const existing = await readPreferences(ctx, user._id);
    const answers = {
      tools: knownTools(args.tools),
      // `undefined` clears an answer the member took back.
      weeklyHours: args.weeklyHours,
      goal: args.goal,
      updatedAt: now,
    };
    if (existing === null) {
      await ctx.db.insert("user_preferences", {
        ownerId: user._id,
        ...answers,
        onboardedAt: now,
      });
    } else {
      await ctx.db.patch("user_preferences", existing._id, {
        ...answers,
        onboardedAt: existing.onboardedAt ?? now,
      });
    }
    return null;
  },
});

/** "Skip for now" (R7). Home stops asking. Settings can still answer later. */
export const skipSetup = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const user = await requireCurrentPlatformUser(ctx);
    const now = Date.now();
    const existing = await readPreferences(ctx, user._id);
    if (existing === null) {
      await ctx.db.insert("user_preferences", {
        ownerId: user._id,
        tools: [],
        skippedAt: now,
        updatedAt: now,
      });
    } else if (existing.skippedAt === undefined) {
      await ctx.db.patch("user_preferences", existing._id, { skippedAt: now, updatedAt: now });
    }
    return null;
  },
});
