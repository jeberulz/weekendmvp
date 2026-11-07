"use client";

import type { Id } from "@/convex/_generated/dataModel";
import { WhenConvexReady } from "@/components/platform/client-gates";
import { ErrorState, LoadingState } from "@/components/workspace/kit/states";
import { BlueprintView } from "@/components/workspace/team/BlueprintView";
import { WaitingOnYou } from "@/components/workspace/team/WaitingOnYou";

/** L1-C6: the review half of Team HQ. Both sections need Convex, so one gate covers them. */
export function TeamHqPanel({ projectId }: { projectId: Id<"projects"> }) {
  return (
    <WhenConvexReady
      fallback={<LoadingState label="Loading your reviews…" />}
      unavailable={<ErrorState message="Your reviews couldn't load right now. Reload the page to try again." />}
    >
      <div className="flex flex-col gap-8">
        <WaitingOnYou projectId={projectId} />
        <BlueprintView projectId={projectId} />
      </div>
    </WhenConvexReady>
  );
}
