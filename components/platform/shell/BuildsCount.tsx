"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { QuietErrorBoundary, WhenConvexReady } from "../client-gates";

function BuildsCountValue() {
  const entitlements = useQuery(api.platform.entitlements.mine);
  if (!entitlements) return null;
  const count = entitlements.usage.activeWeekendPlans;
  if (count === 0) return null;
  const capped = entitlements.usage.activeWeekendPlansCapped;

  return (
    <span className="ml-auto font-mono text-[11px] tabular-nums text-home-ink-3">
      <span className="sr-only">, active plans: </span>
      {capped ? `${count}+` : count}
    </span>
  );
}

/** Builds count for the sidebar: active plans (a bounded count is marked with +). Quiet on error. */
export function BuildsCount() {
  return (
    <WhenConvexReady>
      <QuietErrorBoundary>
        <BuildsCountValue />
      </QuietErrorBoundary>
    </WhenConvexReady>
  );
}
