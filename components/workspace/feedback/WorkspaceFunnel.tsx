"use client";

import { useQuery } from "convex/react";
import { useEffect } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { QuietErrorBoundary } from "@/components/platform/client-gates";
import { useAnalyticsReady } from "@/components/workspace/feedback/useAnalyticsReady";
import { useNow } from "@/components/workspace/kit/useNow";
import { openReviews } from "@/lib/workspace/needsYou";
import { trackWorkspaceEventOnce, trackWorkspaceReturn } from "@/lib/track";

/**
 * WP95-S4. The workspace-wide funnel events that no single screen owns: coming
 * back on a later day, and each launch piece reaching "Waiting on you". It
 * reads the same `pendingReviews` rows the nav badge reads, sends enums only,
 * and draws nothing.
 */
function Live({ projectId }: { projectId: Id<"projects"> }) {
  const ready = useAnalyticsReady();
  const reviews = useQuery(api.workspace.reviews.pendingReviews, { projectId });
  const now = useNow();

  useEffect(() => {
    if (ready) trackWorkspaceReturn();
  }, [ready]);

  useEffect(() => {
    if (!ready || reviews === undefined) return;
    for (const review of openReviews(reviews, now)) {
      trackWorkspaceEventOnce(projectId, { name: "launch_piece_waiting", props: { piece: review.kind } });
    }
  }, [ready, reviews, now, projectId]);

  return null;
}

export function WorkspaceFunnel({ projectId }: { projectId: Id<"projects"> }) {
  return (
    <QuietErrorBoundary>
      <Live projectId={projectId} />
    </QuietErrorBoundary>
  );
}
