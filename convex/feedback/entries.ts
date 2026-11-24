import { ConvexError, v } from "convex/values";

import { mutation } from "../_generated/server";
import { requireCurrentPlatformUserForMutation, requireOwnedProjectForMutation } from "../platform/authz";
import {
  FEEDBACK_SURFACES,
  checkNote,
  isValidRating,
  sanitizeBuildVersion,
  sanitizeRoute,
  sanitizeStepStates,
} from "../../lib/feedback/contracts";

/**
 * WP95-S1. In-app feedback from a founder: a short note, an optional 1 to 5
 * rating and the context the app attaches (masked route, launch step states,
 * build version, the business id when the founder owns it).
 *
 * - The owner id comes from the session. A business id is accepted only for
 *   its owner; anyone else gets the same refusal as a missing business.
 * - Chat text is never read here. The note is what the founder typed into the
 *   feedback dialog.
 */

/** Feedback sent per owner per hour. Beta testers write a few lines, not a stream. */
export const FEEDBACK_PER_HOUR_MAX = 10;
const HOUR_MS = 60 * 60 * 1000;

export const submit = mutation({
  args: {
    surface: v.union(...FEEDBACK_SURFACES.map((value) => v.literal(value))),
    note: v.string(),
    rating: v.optional(v.number()),
    route: v.string(),
    projectId: v.optional(v.id("projects")),
    stepStates: v.array(v.object({ key: v.string(), state: v.string() })),
    buildVersion: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireCurrentPlatformUserForMutation(ctx);
    const checked = checkNote(args.note);
    if (!checked.ok) throw new ConvexError({ code: "INVALID_FEEDBACK", reason: checked.reason });
    if (args.rating !== undefined && !isValidRating(args.rating)) {
      throw new ConvexError({ code: "INVALID_FEEDBACK", reason: "rating" });
    }
    const project = args.projectId === undefined ? null : await requireOwnedProjectForMutation(ctx, args.projectId);

    const now = Date.now();
    const recent = await ctx.db
      .query("feedback_entries")
      .withIndex("by_ownerId_and_createdAt", (q) => q.eq("ownerId", user._id).gt("createdAt", now - HOUR_MS))
      .take(FEEDBACK_PER_HOUR_MAX);
    if (recent.length >= FEEDBACK_PER_HOUR_MAX) throw new ConvexError({ code: "RATE_LIMITED" });

    await ctx.db.insert("feedback_entries", {
      ownerId: user._id,
      ...(project === null ? {} : { projectId: project._id }),
      surface: args.surface,
      note: checked.note,
      ...(args.rating === undefined ? {} : { rating: args.rating }),
      route: sanitizeRoute(args.route),
      stepStates: sanitizeStepStates(args.stepStates),
      buildVersion: sanitizeBuildVersion(args.buildVersion),
      createdAt: now,
    });
    return null;
  },
});
