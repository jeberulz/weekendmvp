/**
 * Idea-engine spot-check drafts (`engine-draft-*`). They live in
 * engine/drafts/, but if one is ever compiled into a content dir it must
 * still never render, reach the sitemap, or be seeded into Convex.
 * Keep in sync with scripts/lib/idea-quality.mjs.
 */
export const ENGINE_DRAFT_PREFIX = "engine-draft-";

export function isEngineDraftSlug(slug: string): boolean {
  return slug.startsWith(ENGINE_DRAFT_PREFIX);
}
