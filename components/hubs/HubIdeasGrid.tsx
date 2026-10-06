import type { IdeaDoc } from "@/components/hubs/hub-data";
import { PublicIdeaCard } from "@/components/public/IdeaCards";
import { toPublicIdeas } from "@/lib/public/ideas";
import { SITE } from "@/lib/seo";

/**
 * Plain idea card grid for hub pages that don't need the Cards/Rows switch
 * (the pages themselves use `IdeaBrowser`). Renders the kit's card.
 */
export function HubIdeasGrid({ ideas }: { ideas: IdeaDoc[] }) {
  if (ideas.length === 0) return null;
  return (
    <ul className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
      {toPublicIdeas(ideas).map((idea) => (
        <li key={idea.slug}>
          <PublicIdeaCard idea={idea} />
        </li>
      ))}
    </ul>
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
      url: `${SITE}/ideas/${idea.slug}`,
    })),
  };
}
