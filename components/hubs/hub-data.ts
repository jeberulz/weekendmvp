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

export async function fetchIdeasByCategory(
  category: string,
): Promise<IdeaDoc[]> {
  return safe(() => fetchQuery(api.ideas.byCategory, { category }), []);
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
 */
export async function fetchAllIdeas(): Promise<IdeaDoc[]> {
  const result = await safe(
    () => fetchQuery(api.ideas.list, { limit: 500 }),
    null,
  );
  return result?.page ?? [];
}
