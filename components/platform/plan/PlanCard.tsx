"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { PLANS } from "@/convex/platform/plans";
import { QuietErrorBoundary, WhenConvexReady } from "@/components/platform/client-gates";
import { trackDashboardEvent } from "@/lib/track";
import { BUILDERS_HUB_UI, UPGRADE_HREF } from "./flag";
import { useUpsell } from "./useUpsell";

function LivePlanCard() {
  const { entitlements, showUpsell } = useUpsell();
  const viewed = useRef(false);

  useEffect(() => {
    if (!showUpsell || viewed.current) return;
    viewed.current = true;
    trackDashboardEvent({ name: "upgrade_prompt_viewed", props: { surface: "sidebar", feature: "weekend_plan" } });
  }, [showUpsell]);

  if (!entitlements || !showUpsell) return null;
  const limit = entitlements.limits.activeWeekendPlans ?? 0;
  const used = Math.min(entitlements.usage.activeWeekendPlans, limit);
  const noun = limit === 1 ? "weekend plan" : "weekend plans";

  return (
    <div className="flex flex-col gap-2 rounded-[12px] bg-home-panel p-4 text-home-d1">
      <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-home-d2">{PLANS.free.name} plan</p>
      <p className="text-sm">
        {used} of {limit} {noun} in use
      </p>
      <div aria-hidden className="h-1 overflow-hidden rounded-full bg-home-dr">
        <div
          className="h-full rounded-full bg-home-orange-light"
          style={{ width: `${limit > 0 ? (used / limit) * 100 : 0}%` }}
        />
      </div>
      <p className="text-[13px] leading-[1.45] text-home-d2">
        {PLANS.builders_hub.name} adds collections, prompt packs and unlimited weekend plans.
      </p>
      <Link
        href={UPGRADE_HREF}
        onClick={() =>
          trackDashboardEvent({ name: "upgrade_clicked", props: { surface: "sidebar", feature: "weekend_plan" } })
        }
        className="inline-flex min-h-11 items-center self-start text-sm font-medium text-home-d1 underline underline-offset-4 hover:text-home-orange-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-light"
      >
        See {PLANS.builders_hub.name}
      </Link>
    </div>
  );
}

/**
 * PRD 6.6 surface 1: the Plan card in the sidebar footer. Usage first, one
 * line about Builder's Hub, one link. Free members only, flag on, not in the
 * first day, and not in the collapsed rail. Quiet if it fails to load.
 */
export function PlanCard({ collapsed }: { collapsed: boolean }) {
  if (!BUILDERS_HUB_UI || collapsed) return null;
  return (
    <WhenConvexReady>
      <QuietErrorBoundary>
        <LivePlanCard />
      </QuietErrorBoundary>
    </WhenConvexReady>
  );
}

function LivePlanName() {
  const { entitlements } = useUpsell();
  if (!entitlements) return null;
  return (
    <span className="block text-[12px] font-normal text-home-ink-3">
      {entitlements.plan === "builders_hub" ? PLANS.builders_hub.name : `${PLANS.free.name} plan`}
    </span>
  );
}

/** The plan under "Account" in the sidebar chip (PRD 7.1 and 7.2). Flag on only. */
export function PlanName() {
  if (!BUILDERS_HUB_UI) return null;
  return (
    <WhenConvexReady>
      <QuietErrorBoundary>
        <LivePlanName />
      </QuietErrorBoundary>
    </WhenConvexReady>
  );
}
