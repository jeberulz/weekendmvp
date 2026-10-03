/**
 * Catalogue visibility for Convex reads. Two rules, both enforced at read
 * time so already-stored rows need no backfill or deletion:
 *
 * - Retired ideas (WP44): publication status comes from the canonical
 *   manifest (`_retiredAt`), never a second list. They leave the member
 *   catalogue and new weekend plans; their public page still renders.
 * - Engine drafts (WP54-S5, review F3): the rule in lib/engine-drafts.ts.
 *   They leave every discovery query and count, public and member, and no
 *   new plan, project, preview or prompt export starts from one.
 *
 * Existing saves, notes, collections and plans stay readable by their owner
 * either way: member reads fetch rows by id, never through these filters.
 */
import type { ExpressionOrValue, FilterBuilder, NamedTableInfo } from "convex/server";
import manifest from "../../ideas/manifest.json";
import { ENGINE_DRAFT_PREFIX, ENGINE_DRAFT_SLUG_END, isEngineDraftSlug } from "../../lib/engine-drafts";
import type { DataModel } from "../_generated/dataModel";

export { isEngineDraftSlug };

const retired = new Set(
  manifest.ideas.filter((idea) => "_retiredAt" in idea && idea._retiredAt).map((idea) => idea.slug),
);
export function isRetiredIdea(slug: string): boolean {
  return retired.has(slug);
}

/** Retired or draft ideas are neither listed in the member catalogue nor open for new weekend plans. */
export function inMemberCatalogue(slug: string): boolean {
  return !isRetiredIdea(slug) && !isEngineDraftSlug(slug);
}

/**
 * The draft rule as a database filter: `slug` outside the draft range
 * [ENGINE_DRAFT_PREFIX, ENGINE_DRAFT_SLUG_END). Discovery reads use indexes
 * ordered by publish date or category, where slug cannot be part of the index
 * range, so this runs as a `.filter()` in front of `.paginate()`, `.take()`,
 * `.first()` or `.collect()`. Native pagination then fills each page from the
 * rows that pass and returns a real continuation cursor. A read bound
 * (`maximumRowsRead`) can still end a page short, or empty, with `isDone`
 * false; callers continue from `continueCursor` as usual.
 */
export function excludeEngineDrafts(
  q: FilterBuilder<NamedTableInfo<DataModel, "ideas">>,
): ExpressionOrValue<boolean> {
  return q.or(q.lt(q.field("slug"), ENGINE_DRAFT_PREFIX), q.gte(q.field("slug"), ENGINE_DRAFT_SLUG_END));
}
