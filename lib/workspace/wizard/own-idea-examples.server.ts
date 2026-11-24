import "server-only";

import { fetchQuery } from "convex/nextjs";
import { cacheLife, cacheTag } from "next/cache";

import { api } from "@/convex/_generated/api";
import { mergeHomeIdeas } from "@/lib/home/data";
import { manifestIdeas } from "@/lib/public/library";
import { drawOwnIdeaExamples, ownIdeaExamplePool, type OwnIdeaExample } from "./own-idea-examples";

/**
 * WP99. Every library idea that can be an own-idea chip, with the same
 * membership rule as `/ideas` and the homepage (`publicIdeaSlugs`): the
 * manifest merged with editorial releases, minus retired, drafts and withdrawn.
 *
 * Cached under the `ideas` tag, like every other library read. If the
 * editorial listing is unreachable, the manifest-only pool is cached for
 * minutes, not hours, so a short outage cannot pin it for long.
 */
export async function ownIdeaExamplePoolCached(): Promise<OwnIdeaExample[]> {
  "use cache";
  cacheTag("ideas");
  try {
    const publications = await fetchQuery(api.editorial.public.listing, {});
    cacheLife("hours");
    return ownIdeaExamplePool(mergeHomeIdeas(manifestIdeas(), publications));
  } catch {
    cacheLife("minutes");
    return ownIdeaExamplePool(manifestIdeas());
  }
}

/**
 * Three chips for this request, drawn fresh from the cached pool. Call it only
 * after `connection()`: the draw is random per visit. Never throws: with no
 * pool, the static fallback lines are returned, so the page always renders.
 */
export async function ownIdeaExamplesForRequest(random: () => number = Math.random): Promise<OwnIdeaExample[]> {
  try {
    return drawOwnIdeaExamples(await ownIdeaExamplePoolCached(), random);
  } catch {
    return drawOwnIdeaExamples([], random);
  }
}
