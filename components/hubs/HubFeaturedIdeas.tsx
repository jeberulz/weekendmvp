import type { ReactNode } from "react";

import { FeaturedIdeas } from "@/components/public/Sections";
import type { PublicIdea } from "@/components/public/types";

/**
 * Editorial "start here" set for a hub page.
 *
 * The Convex tool tags are broad by design (almost every idea is tagged
 * `claude`), so the full list carries no signal about where to begin. Hubs
 * pass a hand-picked slug list (hardcoded in the route's TS config), resolved
 * upstream by `fetchIdeasBySlugs` so curation doesn't depend on the hub
 * query's 30-cap.
 *
 * The cards are the kit's `FeaturedIdeas` (three large cards); this wrapper
 * only adds the `#start-here` anchor the hero's "Start here" link targets.
 * Server component, so the cards stay crawlable.
 */
export function HubFeaturedIdeas({
  id = "start-here",
  headingId = "start-here-heading",
  eyebrow,
  heading,
  intro,
  ideas,
}: {
  id?: string;
  headingId?: string;
  eyebrow?: ReactNode;
  heading: ReactNode;
  intro?: ReactNode;
  ideas: PublicIdea[];
}) {
  // Degrade gracefully: no resolved slugs → no section at all.
  if (ideas.length === 0) return null;
  return (
    <div id={id} className="scroll-mt-24">
      <FeaturedIdeas id={headingId} eyebrow={eyebrow} heading={heading} intro={intro} ideas={ideas} />
    </div>
  );
}
