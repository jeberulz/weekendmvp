/**
 * Server-side mapping from Convex idea rows to the public list shape (WP56).
 *
 * Art and the N° library number come from `ideas/manifest.json`, the same
 * source the homepage index uses, so a number on a hub matches the number on
 * the homepage. Ideas missing from the manifest (engine publications) simply
 * render without art or a number.
 */
import { cacheLife, cacheTag } from "next/cache";
import { fetchQuery } from "convex/nextjs";

import { api } from "@/convex/_generated/api";
import manifestJson from "@/ideas/manifest.json";
import type { IdeaDoc } from "@/components/hubs/hub-data";
import { categoryName, normalizeCategorySlug, toolName } from "@/components/ideas/idea-meta";
import type { PublicIdea } from "@/components/public/types";
import { mergeHomeIdeas } from "@/lib/home/data";
import { hasOgArt, liveIdeas, ogArtPath, publishOrder } from "@/lib/home/library";
import type { ManifestIdea } from "@/lib/home/types";

type ManifestEntry = { no: number; art: boolean };

let lookup: Map<string, ManifestEntry> | null = null;

function manifestLookup(): Map<string, ManifestEntry> {
  if (lookup) return lookup;
  lookup = new Map(
    publishOrder(liveIdeas(manifestIdeas())).map((idea, i) => [idea.slug, { no: i + 1, art: hasOgArt(idea) }]),
  );
  return lookup;
}

function manifestIdeas(): ManifestIdea[] {
  return (manifestJson as unknown as { ideas?: ManifestIdea[] }).ideas ?? [];
}

/**
 * Total live ideas, counted exactly as the homepage counts them (manifest
 * plus released editorial publications), so "Browse N ideas" matches.
 */
export async function publicLibraryTotal(): Promise<number> {
  "use cache";
  cacheLife("hours");
  cacheTag("ideas");
  try {
    const publications = await fetchQuery(api.editorial.public.listing, {});
    return liveIdeas(mergeHomeIdeas(manifestIdeas(), publications)).length;
  } catch {
    return liveIdeas(manifestIdeas()).length;
  }
}

export function toPublicIdea(idea: IdeaDoc): PublicIdea {
  const entry = manifestLookup().get(idea.slug);
  const category = normalizeCategorySlug(idea.category);
  const s = idea.scores;
  const score = s
    ? Math.round(((s.opportunity + s.pain + s.timing + s.builder_confidence) / 4) * 10) / 10
    : null;
  return {
    slug: idea.slug,
    title: idea.title,
    description: idea.description,
    category,
    categoryName: category ? categoryName(category) : "",
    buildTime: Number(idea.buildTime) || 0,
    revenueGoal: idea.revenueGoal ?? "",
    tools: (idea.tools ?? []).slice(0, 3).map(toolName),
    scores: s
      ? { opportunity: s.opportunity, pain: s.pain, timing: s.timing, builder_confidence: s.builder_confidence }
      : null,
    score,
    libraryNo: entry?.no ?? null,
    art: entry?.art ? ogArtPath(idea.slug) : null,
  };
}

export function toPublicIdeas(ideas: readonly IdeaDoc[]): PublicIdea[] {
  return ideas.map(toPublicIdea);
}
