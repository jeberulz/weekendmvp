import { v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import { mutation } from "../_generated/server";
import { requireCurrentPlatformUserForMutation, requireOwnedProjectForMutation } from "../platform/authz";
import {
  ERROR_SOURCES,
  sanitizeBuildVersion,
  sanitizeDedupeKey,
  sanitizeErrorClass,
  sanitizeRoute,
} from "../../lib/feedback/contracts";

/**
 * WP95-S1. The beta's private error log: a client error that reached a route
 * boundary, a Convex action the founder saw fail, or a Wren reply that could
 * not finish. Route, business id and error class only. No message, stack,
 * query string or text the founder typed.
 *
 * `report` is best effort and never throws: the caller is already handling a
 * failure, and a second one must not reach the founder. Anything it cannot
 * trust (no session, a business that is not theirs, an error class that is a
 * sentence) is dropped or stored without that field.
 */

/** Rows per owner per minute. A render loop must not fill the table. */
export const ERRORS_PER_MINUTE_MAX = 30;
const MINUTE_MS = 60 * 1000;

export const report = mutation({
  args: {
    source: v.union(...ERROR_SOURCES.map((value) => v.literal(value))),
    errorClass: v.string(),
    route: v.string(),
    /** A string, not an id validator: a malformed id must not make the report itself fail. */
    projectId: v.optional(v.string()),
    buildVersion: v.string(),
    /** One row per key and owner, e.g. the Wren message id of a failed reply. */
    dedupeKey: v.optional(v.string()),
  },
  returns: v.object({ recorded: v.boolean() }),
  handler: async (ctx, args) => {
    try {
      const errorClass = sanitizeErrorClass(args.errorClass);
      if (errorClass === null) return { recorded: false };
      const user = await requireCurrentPlatformUserForMutation(ctx);

      const dedupeKey = args.dedupeKey === undefined ? null : sanitizeDedupeKey(args.dedupeKey);
      if (dedupeKey !== null) {
        const seen = await ctx.db
          .query("client_errors")
          .withIndex("by_ownerId_and_dedupeKey", (q) => q.eq("ownerId", user._id).eq("dedupeKey", dedupeKey))
          .first();
        if (seen !== null) return { recorded: false };
      }

      const now = Date.now();
      const recent = await ctx.db
        .query("client_errors")
        .withIndex("by_ownerId_and_createdAt", (q) => q.eq("ownerId", user._id).gt("createdAt", now - MINUTE_MS))
        .take(ERRORS_PER_MINUTE_MAX);
      if (recent.length >= ERRORS_PER_MINUTE_MAX) return { recorded: false };

      let projectId: Id<"projects"> | null = null;
      const claimed = args.projectId === undefined ? null : ctx.db.normalizeId("projects", args.projectId);
      if (claimed !== null) {
        try {
          projectId = (await requireOwnedProjectForMutation(ctx, claimed))._id;
        } catch {
          // Not theirs, or gone: keep the error, drop the id.
        }
      }

      await ctx.db.insert("client_errors", {
        ownerId: user._id,
        ...(projectId === null ? {} : { projectId }),
        source: args.source,
        errorClass,
        route: sanitizeRoute(args.route),
        buildVersion: sanitizeBuildVersion(args.buildVersion),
        ...(dedupeKey === null ? {} : { dedupeKey }),
        createdAt: now,
      });
      return { recorded: true };
    } catch {
      return { recorded: false };
    }
  },
});
