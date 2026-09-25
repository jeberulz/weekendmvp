"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { FINISHED_LIST_LIMIT } from "@/convex/platform/weekendSteps";
import { QuietErrorBoundary, WhenConvexReady } from "../client-gates";

function BuildsCountValue() {
  const builds = useQuery(api.platform.weekendPlans.list);
  if (!builds) return null;
  const count = (builds.active ? 1 : 0) + builds.finished.length;
  if (count === 0) return null;
  const capped = builds.finished.length >= FINISHED_LIST_LIMIT;

  return (
    <span className="ml-auto font-mono text-[11px] tabular-nums text-home-ink-3">
      <span className="sr-only">, </span>
      {capped ? `${count}+` : count}
    </span>
  );
}

/** Builds count for the sidebar: the active plan plus finished ones. Quiet on error. */
export function BuildsCount() {
  return (
    <WhenConvexReady>
      <QuietErrorBoundary>
        <BuildsCountValue />
      </QuietErrorBoundary>
    </WhenConvexReady>
  );
}
