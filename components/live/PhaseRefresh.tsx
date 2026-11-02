"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Calls router.refresh() at the next session phase boundary so an open tab
 * flips from upcoming → live → replay-pending without a full reload.
 * Same idea as HideAfter: server HTML stays correct; the client only
 * re-requests when the clock crosses a known instant.
 */
export function PhaseRefresh({ atMs }: { atMs: number | null }) {
  const router = useRouter();

  useEffect(() => {
    if (atMs === null) return;
    const ms = atMs - Date.now();
    if (ms <= 0) {
      router.refresh();
      return;
    }
    const id = window.setTimeout(
      () => router.refresh(),
      Math.min(ms, 2_147_483_647),
    );
    return () => window.clearTimeout(id);
  }, [atMs, router]);

  return null;
}
