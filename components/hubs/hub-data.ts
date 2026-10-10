/**
 * Convex data access for the hub pages, with build-safe fallbacks.
 *
 * Every helper swallows fetch errors and returns an empty/null fallback:
 * during `next build` the local Convex deployment may be down, in which
 * case hubs render hero copy from their static const maps and suppress the
 * ideas grid. Callers run inside "use cache" scopes (tagged `ideas` /
 * `ref-tables`), so a later revalidation re-fetches the live data.
 *
 * Every idea list here passes through `onlyPublicIdeas` (WP56): Convex keeps
 * retired and stale rows, but hubs list only the public library, so their
 * counts match the homepage and no card links to a withheld page.
 */

import { cacheLife, cacheTag } from "next/cache";
import { fetchQuery } from "convex/nextjs";

import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { normalizeCategorySlug } from "@/components/ideas/idea-meta";
import {
  manifestIdeas,
  onlyPublicIdeas,
  publicIdeaSlugs,
  publicLibraryTotal,
} from "@/lib/public/library";

export type IdeaDoc = Doc<"ideas">;

async function safe<T>(run: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await run();
  } catch {
    return fallback;
  }
}

/** One audience reference row, or null when absent/unreachable. */
export async function fetchAudienceReference(
  slug: string,
): Promise<Doc<"audiences"> | null> {
  return safe(
    () => fetchQuery(api.referenceTables.audienceBySlug, { slug }),
    null,
  );
}

/** One tool reference row, or null when absent/unreachable. */
export async function fetchToolReference(
  slug: string,
): Promise<Doc<"tools"> | null> {
  return safe(() => fetchQuery(api.referenceTables.toolBySlug, { slug }), null);
}

/** Hub grids show at most this many ideas (matches legacy). */
const HUB_CAP = 30;
/**
 * Small over-fetch so `onlyPublicIdeas` can replace a few filtered rows
 * without shrinking the grid. Must stay ≤ Convex `MAX_FACET_LIMIT` (48):
 * requesting 1000 made popular tools (cursor ≈ every idea) re-read the
 * whole catalogue on every cache miss.
 */
const HUB_FETCH = 48;

/** byAudience — builder_confidence sort, 30 cap (matches legacy). */
export async function fetchIdeasByAudience(
  audience: string,
): Promise<IdeaDoc[]> {
  const rows = await safe(() => fetchQuery(api.ideas.byAudience, { audience, limit: HUB_FETCH }), []);
  return (await onlyPublicIdeas(rows)).slice(0, HUB_CAP);
}

/** byTool — builder_confidence sort, 30 cap (matches legacy sync). */
export async function fetchIdeasByTool(tool: string): Promise<IdeaDoc[]> {
  const rows = await safe(() => fetchQuery(api.ideas.byTool, { tool, limit: HUB_FETCH }), []);
  return (await onlyPublicIdeas(rows)).slice(0, HUB_CAP);
}

/**
 * Resolve an editorial slug list to ideas, preserving the given order.
 *
 * Deliberately indexed point lookups rather than filtering a hub's own
 * result set: `byTool`/`byAudience` cap at 30 by builder_confidence, so a
 * hand-picked slug silently vanishes from a curated rail once enough
 * higher-scoring ideas ship. Curation must not depend on that cap.
 * Missing slugs are dropped so a stale pick degrades instead of throwing.
 */
export async function fetchIdeasBySlugs(
  slugs: readonly string[] | undefined,
): Promise<IdeaDoc[]> {
  if (!slugs || slugs.length === 0) return [];
  const found = await Promise.all(
    slugs.map((slug) => safe(() => fetchQuery(api.ideas.bySlug, { slug }), null)),
  );
  const seen = new Set<string>();
  return onlyPublicIdeas(
    found.filter((idea): idea is IdeaDoc => {
      if (!idea || seen.has(idea.slug)) return false;
      seen.add(idea.slug);
      return true;
    }),
  );
}

/**
 * Category hub lookup via the `by_category_publishedAt` index. Seed normalizes
 * categories to lowercase slugs; keep a normalize filter so any legacy casing
 * in an indexed miss does not leak a wrong card.
 */
export async function fetchIdeasByCategory(
  category: string,
): Promise<IdeaDoc[]> {
  const canonical = normalizeCategorySlug(category);
  const rows = await safe(
    () => fetchQuery(api.ideas.byCategory, { category: canonical }),
    [],
  );
  return onlyPublicIdeas(
    rows
      .filter((idea) => normalizeCategorySlug(idea.category) === canonical)
      .sort((a, b) => b.publishedAt - a.publishedAt),
  );
}

export async function fetchIdeasByRevenueGoal(
  revenueGoal: string,
): Promise<IdeaDoc[]> {
  return onlyPublicIdeas(await safe(() => fetchQuery(api.ideas.byRevenueGoal, { revenueGoal }), []));
}

/**
 * Full idea set (≤ a few hundred rows). Cached under `ideas` so every
 * collection / solve / archive caller shares one Convex drain per miss —
 * previously each CachedCollectionHub slug drained `ideas.list` separately
 * (~20× on every tag revalidation).
 */
export async function fetchAllIdeas(): Promise<IdeaDoc[]> {
  "use cache";
  cacheTag("ideas");
  cacheLife("days");
  const ideas: IdeaDoc[] = [];
  let cursor: string | null = null;
  try {
    do {
      const result: {
        page: IdeaDoc[];
        isDone: boolean;
        continueCursor: string;
      } = await fetchQuery(api.ideas.list, {
        limit: 200,
        cursor,
      });
      ideas.push(...result.page);
      cursor = result.isDone ? null : result.continueCursor;
    } while (cursor);
  } catch {
    return onlyPublicIdeas(ideas);
  }
  return onlyPublicIdeas(ideas);
}

/**
 * Category tab counts without a Convex catalogue drain — same public
 * membership rule as hubs (manifest ∩ editorial listing).
 */
export async function publicCategoryCounts(): Promise<{
  counts: Map<string, number>;
  total: number;
}> {
  "use cache";
  cacheTag("ideas");
  cacheLife("days");
  const [allowed, total] = await Promise.all([
    publicIdeaSlugs().then((slugs) => new Set(slugs)),
    publicLibraryTotal(),
  ]);
  const counts = new Map<string, number>();
  for (const idea of manifestIdeas()) {
    if (!allowed.has(idea.slug)) continue;
    const category = normalizeCategorySlug(idea.category ?? "");
    if (!category) continue;
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  return { counts, total };
}
