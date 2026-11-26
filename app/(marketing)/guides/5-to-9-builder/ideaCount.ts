import manifest from "@/ideas/manifest.json";
import { mergeHomeIdeas } from "@/lib/home/data";
import { liveIdeas } from "@/lib/home/library";
import type { ManifestIdea } from "@/lib/home/types";

type Publications = Parameters<typeof mergeHomeIdeas>[1];

/**
 * Same membership rule the homepage uses in getHomeData:
 * liveIdeas(mergeHomeIdeas(manifest, publications)).
 * This static page does not call Convex, so the editorial overlay is empty
 * here — the same fallback publicIdeaSlugs uses when the listing is down.
 */
export function guideLiveIdeaCount(publications: Publications = []): number {
  return liveIdeas(mergeHomeIdeas(manifest.ideas as ManifestIdea[], publications)).length;
}
