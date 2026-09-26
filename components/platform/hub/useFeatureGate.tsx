"use client";

import { useConvex } from "convex/react";
import { ConvexError } from "convex/values";
import { useCallback, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import { UPGRADE_REQUIRED, type GatedFeature } from "@/convex/platform/plans";
import { BUILDERS_HUB_UI } from "@/components/platform/plan/flag";
import { UpgradeSheet } from "@/components/platform/plan/UpgradeSheet";

type HubFeature = Exclude<GatedFeature, "weekend_plan">;

export function isUpgradeRequired(error: unknown): boolean {
  return error instanceof ConvexError && (error.data as { code?: string } | null)?.code === UPGRADE_REQUIRED;
}

/**
 * WP44-S11. Before a Builder's Hub form or view opens, ask the server. A Free
 * member gets the upgrade sheet at the click, not after typing a name. The
 * real gate stays in each mutation, query and route, which check again.
 * Render `sheet` once where the hook is used.
 */
export function useFeatureGate() {
  const convex = useConvex();
  const [feature, setFeature] = useState<HubFeature | null>(null);
  const trigger = useRef<HTMLElement | null>(null);

  const openSheet = useCallback((next: HubFeature, from?: HTMLElement | null) => {
    if (from) trigger.current = from;
    if (BUILDERS_HUB_UI) setFeature(next);
  }, []);

  const run = useCallback(
    async (next: HubFeature, action: () => void, from?: HTMLElement | null) => {
      trigger.current = from ?? null;
      try {
        await convex.query(api.platform.entitlements.check, { feature: next });
        action();
      } catch (error) {
        if (isUpgradeRequired(error)) openSheet(next);
        else console.error("Checking the plan failed", error);
      }
    },
    [convex, openSheet],
  );

  const sheet = BUILDERS_HUB_UI ? (
    <UpgradeSheet
      open={feature !== null}
      onOpenChange={(open) => {
        if (!open) setFeature(null);
      }}
      feature={feature ?? "collections"}
      returnFocusTo={trigger}
    />
  ) : null;

  return { run, openSheet, sheet };
}
