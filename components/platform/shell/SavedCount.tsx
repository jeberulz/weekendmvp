"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { QuietErrorBoundary, WhenConvexReady } from "../client-gates";

function SavedCountValue() {
  const home = useQuery(api.platform.dashboard.home);
  if (!home || home.saved.count === 0) return null;
  const value = home.saved.capped ? `${home.saved.count}+` : String(home.saved.count);

  return (
    <span className="ml-auto font-mono text-[11px] tabular-nums text-home-ink-3">
      <span className="sr-only">, </span>
      {value}
    </span>
  );
}

/** Saved count for the sidebar. Absent while loading, at zero, or on error. */
export function SavedCount() {
  return (
    <WhenConvexReady>
      <QuietErrorBoundary>
        <SavedCountValue />
      </QuietErrorBoundary>
    </WhenConvexReady>
  );
}
