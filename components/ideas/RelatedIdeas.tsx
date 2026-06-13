/**
 * Related ideas card grid (server component) — legacy {{RELATED_IDEAS}}
 * block, now driven by the Convex `api.ideas.relatedFor` query (same
 * category first, then shared audiences). Convex-unavailable → renders
 * nothing, the page still works.
 */

import { fetchQuery } from "convex/nextjs";

import { api } from "@/convex/_generated/api";
import { IdeaCard } from "@/components/primitives/IdeaCard";
import { categoryName } from "@/components/ideas/idea-meta";

type RelatedIdea = {
  slug: string;
  title: string;
  category: string;
};

export async function RelatedIdeas({
  slug,
  limit = 4,
}: {
  slug: string;
  limit?: number;
}) {
  let related: RelatedIdea[] = [];
  try {
    related = await fetchQuery(api.ideas.relatedFor, { slug, limit });
  } catch {
    // Convex unavailable (e.g. at build time) — skip the section.
    return null;
  }
  if (related.length === 0) return null;

  return (
    <div>
      <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-3">
        Related ideas
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {related.map((idea) => (
          <IdeaCard
            key={idea.slug}
            variant="compact"
            theme="cream"
            idea={{
              slug: idea.slug,
              title: idea.title,
              category: idea.category,
              categoryLabel: categoryName(idea.category),
            }}
          />
        ))}
      </div>
    </div>
  );
}
