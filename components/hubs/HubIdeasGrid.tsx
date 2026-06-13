import Link from "next/link";

import type { IdeaDoc } from "@/components/hubs/hub-data";
import { categoryColor, categoryLabel } from "@/components/hubs/hub-theme";

/**
 * Idea card grid matching the legacy generated markup
 * (generateIdeasGrid in scripts/generate-programmatic-pages.js /
 * renderCards in scripts/sync-build-with.js): category badge + ~hours,
 * title, two-line description.
 */

function truncate(text: string, max = 120): string {
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

export function HubIdeaCard({ idea }: { idea: IdeaDoc }) {
  const color = categoryColor(idea.category);
  return (
    <Link
      href={`/ideas/${idea.slug}`}
      className="group p-6 bg-white/5 border border-white/10 rounded-2xl hover:border-white/20 hover:bg-white/[0.07] transition-all"
    >
      <div className="flex items-center gap-2 mb-4">
        <span
          className={`px-2 py-1 ${color.badge} text-[10px] font-bold uppercase rounded-full`}
        >
          {categoryLabel(idea.category)}
        </span>
        <span className="text-neutral-600 text-xs">
          ~{idea.buildTime || 8} hours
        </span>
      </div>
      <h3 className="text-white font-medium mb-2 group-hover:text-neutral-200 transition-colors">
        {idea.title}
      </h3>
      <p className="text-neutral-500 text-sm line-clamp-2">
        {truncate(idea.description)}
      </p>
    </Link>
  );
}

export function HubIdeasGrid({ ideas }: { ideas: IdeaDoc[] }) {
  if (ideas.length === 0) return null;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {ideas.map((idea) => (
        <HubIdeaCard key={idea.slug} idea={idea} />
      ))}
    </div>
  );
}

/** schema.org ItemList element array for the hub's mainEntity. */
export function ideasItemList(ideas: IdeaDoc[]) {
  return {
    "@type": "ItemList",
    numberOfItems: ideas.length,
    itemListElement: ideas.map((idea, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: idea.title,
      url: `https://weekendmvp.app/ideas/${idea.slug}`,
    })),
  };
}
