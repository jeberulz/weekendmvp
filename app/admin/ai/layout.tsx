import type { Metadata } from "next";
import type { ReactNode } from "react";

import { assertEditorialRoutesEnabled } from "@/lib/editorial/runtime/route-guard";

/**
 * WP93. The owner's AI cost console. Middleware already answers every
 * `/admin/*` request from anyone but the bound super admin with a real 404;
 * each page checks again on the server (`requireAiCostSource`) and every
 * Convex read checks `requireSuperAdmin`. Never indexed, never in the
 * sitemap, linked from nowhere outside `/admin`.
 */
export async function generateMetadata(): Promise<Metadata> {
  assertEditorialRoutesEnabled();
  return {
    title: { absolute: "AI costs — Weekend MVP" },
    robots: {
      index: false,
      follow: false,
      noarchive: true,
      nocache: true,
      googleBot: { index: false, follow: false, noarchive: true, noimageindex: true },
    },
    referrer: "no-referrer",
  };
}

export default function AiCostsLayout({ children }: { children: ReactNode }) {
  assertEditorialRoutesEnabled();
  return children;
}
