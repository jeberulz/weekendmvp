import { defineTable } from "convex/server";
import { v } from "convex/values";

import { ERROR_SOURCES, FEEDBACK_SURFACES } from "../../lib/feedback/contracts";

/**
 * WP95 tables. Spread into `defineSchema` as `...feedbackTables` (Codex owns
 * `convex/schema.ts`; the exact definitions are in `docs/wp/wp95-progress.md`).
 *
 * Neither table holds chat text, business names, idea text or emails. The only
 * free-form field is `feedback_entries.note`, which the founder writes into
 * the feedback dialog.
 */

const surface = v.union(...FEEDBACK_SURFACES.map((value) => v.literal(value)));
const errorSource = v.union(...ERROR_SOURCES.map((value) => v.literal(value)));

export const feedbackTables = {
  feedback_entries: defineTable({
    ownerId: v.id("users"),
    projectId: v.optional(v.id("projects")),
    surface,
    note: v.string(),
    rating: v.optional(v.number()),
    route: v.string(),
    stepStates: v.array(v.object({ key: v.string(), state: v.string() })),
    buildVersion: v.string(),
    createdAt: v.number(),
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_ownerId_and_createdAt", ["ownerId", "createdAt"]),

  client_errors: defineTable({
    ownerId: v.id("users"),
    projectId: v.optional(v.id("projects")),
    source: errorSource,
    errorClass: v.string(),
    route: v.string(),
    buildVersion: v.string(),
    dedupeKey: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_ownerId_and_createdAt", ["ownerId", "createdAt"])
    .index("by_ownerId_and_dedupeKey", ["ownerId", "dedupeKey"]),
};
