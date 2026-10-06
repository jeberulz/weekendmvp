/**
 * The public idea library: the one membership rule behind every public list
 * and count (WP56). An idea is listed when it is live in `ideas/manifest.json`
 * (not retired, not an engine draft) or released through editorial, and not
 * withdrawn there. This is exactly the homepage's rule, so the homepage, the
 * hubs, `/startup-ideas` and "Browse N ideas" all agree.
 *
 * Convex `ideas` rows are not the source of membership: retired ideas and
 * stale rows (e.g. `ai-built-app-code-audit`, whose page answers 404) still
 * exist there. Lists filter Convex rows through this set.
 */
import { cacheLife, cacheTag } from "next/cache";
import { fetchQuery } from "convex/nextjs";

import { api } from "@/convex/_generated/api";
import manifestJson from "@/ideas/manifest.json";
import { mergeHomeIdeas } from "@/lib/home/data";
import { liveIdeas } from "@/lib/home/library";
import type { ManifestIdea } from "@/lib/home/types";

export function manifestIdeas(): ManifestIdea[] {
  return (manifestJson as unknown as { ideas?: ManifestIdea[] }).ideas ?? [];
}

type Publications = Parameters<typeof mergeHomeIdeas>[1];

/** Pure membership rule: manifest + released publications, minus retired, drafts and withdrawn. */
export function librarySlugs(manifest: ManifestIdea[], publications: Publications): string[] {
  return liveIdeas(mergeHomeIdeas(manifest, publications)).map((idea) => idea.slug);
}

/** Slugs of every publicly listed idea, homepage rule. */
export async function publicIdeaSlugs(): Promise<string[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("ideas");
  try {
    return librarySlugs(manifestIdeas(), await fetchQuery(api.editorial.public.listing, {}));
  } catch {
    return librarySlugs(manifestIdeas(), []);
  }
}

/** Keep only rows that belong to the public library, in their given order. */
export async function onlyPublicIdeas<T extends { slug: string }>(rows: readonly T[]): Promise<T[]> {
  const allowed = new Set(await publicIdeaSlugs());
  return rows.filter((row) => allowed.has(row.slug));
}

/** Total publicly listed ideas — the number every "N ideas" line shows. */
export async function publicLibraryTotal(): Promise<number> {
  return (await publicIdeaSlugs()).length;
}
