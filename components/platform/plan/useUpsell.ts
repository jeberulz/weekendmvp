"use client";

import { useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { upgradeSheetAllowed, upsellVisible } from "@/convex/platform/plans";
import { BUILDERS_HUB_UI } from "./flag";

/**
 * The member's plan as the server reports it, and what that allows on
 * screen. Only mirrors entitlements: the server still refuses gated actions.
 * Call it behind a Convex gate. With the flag off it reads nothing and allows nothing.
 */
export function useUpsell() {
  // No subscription at all while the flag is off.
  const entitlements = useQuery(api.platform.entitlements.mine, BUILDERS_HUB_UI ? {} : "skip");
  // Browser-only (behind a Convex gate), so the local clock is safe to read.
  const [now] = useState(() => Date.now());
  if (entitlements === undefined) return { entitlements, showUpsell: false, sheetAllowed: false };
  return {
    entitlements,
    showUpsell: upsellVisible({ flagOn: BUILDERS_HUB_UI, plan: entitlements.plan, joinedAt: entitlements.joinedAt, now }),
    sheetAllowed: upgradeSheetAllowed({ flagOn: BUILDERS_HUB_UI, plan: entitlements.plan }),
  };
}
