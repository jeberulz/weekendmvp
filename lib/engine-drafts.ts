/**
 * Idea-engine spot-check drafts (`engine-draft-*`): the one visibility rule
 * for them (WP54-S5, review finding F3). Their source lives in engine/drafts/.
 *
 * - Not discoverable. No archive, hub, related rail, homepage list, sitemap,
 *   dashboard catalogue, search, facet or count includes one.
 * - Not eligible for new entry points. The idea page answers 404, and no
 *   weekend plan, repository project, preview or prompt export starts from one.
 * - Existing member work keeps its rows. Saves, notes, collections and plans
 *   that reference a draft stay owner-scoped and readable, and show the
 *   research as retired instead of linking to the withheld page.
 *
 * Rows seeded while the drafts were public (2026-09-24) are still stored.
 * Every reader enforces this rule at read time, so no backfill is needed.
 * Pure, with no imports: Next.js, Convex functions and Node tests all load it.
 * Keep in sync with scripts/lib/idea-quality.mjs; a test checks they agree.
 */
export const ENGINE_DRAFT_PREFIX = "engine-draft-";

/**
 * Exclusive upper bound of the draft slug range. A string starts with the
 * prefix exactly when `ENGINE_DRAFT_PREFIX <= slug < ENGINE_DRAFT_SLUG_END`
 * (the prefix with its last character incremented: "engine-draft."), so a
 * Convex filter can drop drafts with two comparisons on any index.
 */
export const ENGINE_DRAFT_SLUG_END =
  ENGINE_DRAFT_PREFIX.slice(0, -1) +
  String.fromCharCode(ENGINE_DRAFT_PREFIX.charCodeAt(ENGINE_DRAFT_PREFIX.length - 1) + 1);

/** True for draft slugs and their file names (`engine-draft-x.mdx`). */
export function isEngineDraftSlug(slug: string): boolean {
  return slug.startsWith(ENGINE_DRAFT_PREFIX);
}

/**
 * The public research page for an idea, or null when that page is withheld
 * (engine drafts answer 404). Member views link through this, so saved or
 * planned drafts never send anyone to a page that does not exist.
 */
export function publicIdeaPath(slug: string): string | null {
  return isEngineDraftSlug(slug) ? null : `/ideas/${slug}`;
}
