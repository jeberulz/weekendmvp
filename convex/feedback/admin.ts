import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";

import type { Doc } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { requireSuperAdmin } from "../admin/superAdmin";
import type { CountBy, ErrorRow, FeedbackOverview, FeedbackRow } from "../../lib/feedback/types";

/**
 * WP95-S1. Owner-only reads behind `/admin/feedback`.
 *
 * - Every query starts with `requireSuperAdmin` (one generic `FORBIDDEN`).
 * - Every read is bounded: pages stop at `PAGE_MAX`, and the overview reads at
 *   most `OVERVIEW_ROWS_MAX` rows per table and says when it stopped short.
 * - No chat text exists in these tables. The founder's own note is the only
 *   free-form field, and it is shown to the owner only.
 */

export const PAGE_MAX = 100;
export const OVERVIEW_ROWS_MAX = 1_000;
/** Groups returned per breakdown; the long tail is dropped, never the counts above. */
const GROUPS_MAX = 12;

function assertPageSize(numItems: number): void {
  if (!Number.isSafeInteger(numItems) || numItems < 1 || numItems > PAGE_MAX) {
    throw new ConvexError({ code: "INVALID_PAGE_SIZE", max: PAGE_MAX });
  }
}

export function toFeedbackRow(row: Doc<"feedback_entries">): FeedbackRow {
  return {
    id: row._id,
    ownerId: row.ownerId,
    projectId: row.projectId ?? null,
    surface: row.surface,
    note: row.note,
    rating: row.rating ?? null,
    route: row.route,
    stepStates: row.stepStates,
    buildVersion: row.buildVersion,
    createdAt: row.createdAt,
  };
}

export function toErrorRow(row: Doc<"client_errors">): ErrorRow {
  return {
    id: row._id,
    ownerId: row.ownerId,
    projectId: row.projectId ?? null,
    source: row.source,
    errorClass: row.errorClass,
    route: row.route,
    buildVersion: row.buildVersion,
    createdAt: row.createdAt,
  };
}

function groupCounts(values: readonly string[]): CountBy[] {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, GROUPS_MAX);
}

const feedbackRowValidator = v.object({
  id: v.string(),
  ownerId: v.string(),
  projectId: v.union(v.string(), v.null()),
  surface: v.union(v.literal("workspace"), v.literal("wizard")),
  note: v.string(),
  rating: v.union(v.number(), v.null()),
  route: v.string(),
  stepStates: v.array(v.object({ key: v.string(), state: v.string() })),
  buildVersion: v.string(),
  createdAt: v.number(),
});

const errorRowValidator = v.object({
  id: v.string(),
  ownerId: v.string(),
  projectId: v.union(v.string(), v.null()),
  source: v.union(v.literal("boundary"), v.literal("action"), v.literal("wren")),
  errorClass: v.string(),
  route: v.string(),
  buildVersion: v.string(),
  createdAt: v.number(),
});

const countByValidator = v.object({ key: v.string(), count: v.number() });

/** Feedback, newest first. */
export const listFeedback = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.object({
    page: v.array(feedbackRowValidator),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    assertPageSize(args.paginationOpts.numItems);
    const result = await ctx.db.query("feedback_entries").withIndex("by_createdAt").order("desc").paginate(args.paginationOpts);
    return { page: result.page.map(toFeedbackRow), isDone: result.isDone, continueCursor: result.continueCursor };
  },
});

/** Errors, newest first. */
export const listErrors = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.object({
    page: v.array(errorRowValidator),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    assertPageSize(args.paginationOpts.numItems);
    const result = await ctx.db.query("client_errors").withIndex("by_createdAt").order("desc").paginate(args.paginationOpts);
    return { page: result.page.map(toErrorRow), isDone: result.isDone, continueCursor: result.continueCursor };
  },
});

/**
 * Counts since `sinceMs` (the caller passes the clock, because queries do not
 * read it): feedback by rating, errors by class, route and source.
 */
export const overview = query({
  args: { sinceMs: v.number() },
  returns: v.object({
    feedback: v.object({
      count: v.number(),
      ratingAverage: v.union(v.number(), v.null()),
      ratingCounts: v.array(v.number()),
      unrated: v.number(),
      truncated: v.boolean(),
    }),
    errors: v.object({
      count: v.number(),
      byClass: v.array(countByValidator),
      byRoute: v.array(countByValidator),
      bySource: v.array(countByValidator),
      truncated: v.boolean(),
    }),
  }),
  handler: async (ctx, args): Promise<FeedbackOverview> => {
    await requireSuperAdmin(ctx);
    if (!Number.isFinite(args.sinceMs) || args.sinceMs < 0) throw new ConvexError({ code: "INVALID_RANGE" });

    const feedbackRows = await ctx.db
      .query("feedback_entries")
      .withIndex("by_createdAt", (q) => q.gt("createdAt", args.sinceMs))
      .order("desc")
      .take(OVERVIEW_ROWS_MAX + 1);
    const errorRows = await ctx.db
      .query("client_errors")
      .withIndex("by_createdAt", (q) => q.gt("createdAt", args.sinceMs))
      .order("desc")
      .take(OVERVIEW_ROWS_MAX + 1);

    const feedbackTruncated = feedbackRows.length > OVERVIEW_ROWS_MAX;
    const errorsTruncated = errorRows.length > OVERVIEW_ROWS_MAX;
    const feedbackKept = feedbackRows.slice(0, OVERVIEW_ROWS_MAX);
    const errorsKept = errorRows.slice(0, OVERVIEW_ROWS_MAX);

    const ratingCounts = [0, 0, 0, 0, 0];
    let ratingSum = 0;
    let rated = 0;
    for (const row of feedbackKept) {
      if (row.rating === undefined) continue;
      const slot = Math.round(row.rating) - 1;
      if (slot < 0 || slot > 4) continue;
      ratingCounts[slot] = (ratingCounts[slot] ?? 0) + 1;
      ratingSum += row.rating;
      rated += 1;
    }

    return {
      feedback: {
        count: feedbackKept.length,
        ratingAverage: rated === 0 ? null : ratingSum / rated,
        ratingCounts,
        unrated: feedbackKept.length - rated,
        truncated: feedbackTruncated,
      },
      errors: {
        count: errorsKept.length,
        byClass: groupCounts(errorsKept.map((row) => row.errorClass)),
        byRoute: groupCounts(errorsKept.map((row) => row.route)),
        bySource: groupCounts(errorsKept.map((row) => row.source)),
        truncated: errorsTruncated,
      },
    };
  },
});
