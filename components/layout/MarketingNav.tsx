"use client";

import { usePathname } from "next/navigation";
import { MegaNav } from "@/components/layout/MegaNav";

/**
 * Light-themed pages whose legacy nav used the cream shell
 * (bg-[#fcfaf7]/85 + black logo): the workshop landing pages and the
 * starter-kit guide (its legacy nav-starter-kit.html header was cream).
 */
const CREAM_PATHS = new Set(["/shipable", "/dare", "/starter-kit"]);

/** Picks the MegaNav variant per route for the (marketing) layout. */
export function MarketingNav() {
  const pathname = usePathname();
  const normalized = pathname.replace(/\/$/, "") || "/";
  return (
    <MegaNav variant={CREAM_PATHS.has(normalized) ? "cream" : "dark"} />
  );
}
