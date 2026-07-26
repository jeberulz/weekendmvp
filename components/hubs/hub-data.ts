/**
 * Convex data access for the hub pages, with build-safe fallbacks.
 *
 * Every helper swallows fetch errors and returns an empty/null fallback:
 * during `next build` the local Convex deployment may be down, in which
 * case hubs render hero copy from their static const maps and suppress the
 * ideas grid. Callers run inside "use cache" scopes (tagged `ideas` /
 * `ref-tables`), so a later revalidation re-fetches the live data.
 */

import { fetchQuery } from "convex/nextjs";

import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { normalizeCategorySlug } from "@/components/ideas/idea-meta";

export type IdeaDoc = Doc<"ideas">;

export type RefTables = {
  categories: Doc<"categories">[];
  revenueGoals: Doc<"revenue_goals">[];
  audiences: Doc<"audiences">[];
  buildTimes: Doc<"build_times">[];
  tools: Doc<"tools">[];
  problems: Doc<"problems">[];
};

async function safe<T>(run: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await run();
  } catch {
    return fallback;
  }
}

/** All reference tables, or null when Convex is unreachable. */
export async function fetchRefTables(): Promise<RefTables | null> {
  return safe(() => fetchQuery(api.referenceTables.all, {}), null);
}

/** byAudience — builder_confidence sort, 30 cap (matches legacy). */
export async function fetchIdeasByAudience(
  audience: string,
): Promise<IdeaDoc[]> {
  return safe(() => fetchQuery(api.ideas.byAudience, { audience }), []);
}

/** byTool — builder_confidence sort, 30 cap (matches legacy sync). */
export async function fetchIdeasByTool(tool: string): Promise<IdeaDoc[]> {
  return safe(() => fetchQuery(api.ideas.byTool, { tool }), []);
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
  return found.filter((idea): idea is IdeaDoc => {
    if (!idea || seen.has(idea.slug)) return false;
    seen.add(idea.slug);
    return true;
  });
}

/**
 * Category hub lookup. Convex indexes are exact-match on `category`, but
 * historical rows used display casing ("SaaS"). Drain the archive and
 * filter with normalizeCategorySlug so hubs stay complete until a reseed.
 */
export async function fetchIdeasByCategory(
  category: string,
): Promise<IdeaDoc[]> {
  const canonical = normalizeCategorySlug(category);
  const all = await fetchAllIdeas();
  return all
    .filter((idea) => normalizeCategorySlug(idea.category) === canonical)
    .sort((a, b) => b.publishedAt - a.publishedAt);
}

export async function fetchIdeasByRevenueGoal(
  revenueGoal: string,
): Promise<IdeaDoc[]> {
  return safe(() => fetchQuery(api.ideas.byRevenueGoal, { revenueGoal }), []);
}

/**
 * Full idea set (≤ a few hundred rows) — used by the collection hubs whose
 * legacy filters don't map to a single index (build-time pages, the
 * quick-wins / 10k-month fallbacks in generate-programmatic-pages.js).
 * Drains pagination so we don't silently drop ideas past the first page.
 */
export async function fetchAllIdeas(): Promise<IdeaDoc[]> {
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
    return ideas;
  }
  return ideas;
}
