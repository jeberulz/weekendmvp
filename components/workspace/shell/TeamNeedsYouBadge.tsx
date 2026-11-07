"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { QuietErrorBoundary, WhenConvexReady } from "@/components/platform/client-gates";
import { useNow } from "@/components/workspace/kit/useNow";
import { needsYouCount } from "@/lib/workspace/needsYou";

/** The text the Team HQ nav row shows; "" when nothing is waiting (the badge is then omitted). */
export function needsYouLabel(count: number): string {
  return count > 0 ? `${count.toString()} need you` : "";
}

function Count({ projectId }: { projectId: Id<"projects"> }) {
  const reviews = useQuery(api.workspace.reviews.pendingReviews, { projectId });
  const now = useNow();
  if (reviews === undefined) return null;
  const count = needsYouCount(reviews, now);
  if (count === 0) return null;
  return (
    <span className="ml-auto shrink-0 font-mono text-[11px] text-home-orange-ink">
      {needsYouLabel(count)}
      <span className="sr-only"> to review</span>
    </span>
  );
}

/**
 * "N need you" inside the Team HQ nav link. Reads `pendingReviews` (the same
 * rows Team HQ lists as waiting). Renders nothing while loading, at zero, or
 * if the read fails: the badge is a hint and must never take the nav down.
 */
export function TeamNeedsYouBadge({ projectId }: { projectId: Id<"projects"> }) {
  return (
    <WhenConvexReady>
      <QuietErrorBoundary>
        <Count projectId={projectId} />
      </QuietErrorBoundary>
    </WhenConvexReady>
  );
}
