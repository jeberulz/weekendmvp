import { IdeaCard } from "@/components/primitives/IdeaCard";
import type { IdeaDoc } from "@/components/hubs/hub-data";
import { categoryColor, categoryLabel } from "@/components/hubs/hub-theme";

/**
 * Idea card grid for hub pages. Thin wrapper around the shared IdeaCard
 * primitive (variant="default", surface="translucent") — the per-card
 * category badge tint comes from hub-theme.ts's categoryColor() map.
 */

export function HubIdeaCard({ idea }: { idea: IdeaDoc }) {
  const color = categoryColor(idea.category);
  return (
    <IdeaCard
      surface="translucent"
      idea={{
        slug: idea.slug,
        title: idea.title,
        description: idea.description,
        category: idea.category,
        categoryLabel: categoryLabel(idea.category),
        buildTimeLabel: `~${idea.buildTime || 8} hours`,
        badgeClass: `${color.badge} rounded-full`,
      }}
    />
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
