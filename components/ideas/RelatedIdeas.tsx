/**
 * Related ideas card grid (server component) — legacy {{RELATED_IDEAS}}
 * block, now driven by the Convex `api.ideas.relatedFor` query (same
 * category first, then shared audiences). Convex-unavailable → renders
 * nothing, the page still works.
 */

import Link from "next/link";
import { fetchQuery } from "convex/nextjs";

import { api } from "@/convex/_generated/api";
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
          <Link
            key={idea.slug}
            href={`/ideas/${idea.slug}`}
            className="idea-card group p-4 bg-neutral-100 border border-neutral-200 rounded-2xl hover:border-neutral-300 transition-all"
          >
            <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
              {categoryName(idea.category)}
            </span>
            <h4 className="idea-title text-sm font-medium text-neutral-900 group-hover:text-black transition-colors mt-1">
              {idea.title}
            </h4>
          </Link>
        ))}
      </div>
    </div>
  );
}
