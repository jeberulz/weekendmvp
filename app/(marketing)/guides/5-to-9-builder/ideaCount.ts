import manifest from "@/ideas/manifest.json";
import { liveIdeas } from "@/lib/home/library";
import type { ManifestIdea } from "@/lib/home/types";

export function guideLiveIdeaCount(): number {
  return liveIdeas(manifest.ideas as ManifestIdea[]).length;
}
