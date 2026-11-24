import type { Metadata } from "next";
import type { ReactNode } from "react";

import { assertEditorialRoutesEnabled } from "@/lib/editorial/runtime/route-guard";

/**
 * WP95. The owner's beta feedback page. Middleware already answers every
 * `/admin/*` request from anyone but the bound super admin with a real 404;
 * the page checks again on the server (`requireFeedbackSource`) and every
 * Convex read checks `requireSuperAdmin`. Never indexed, never in the sitemap,
 * linked from nowhere outside `/admin` (the owner links it later).
 */
export async function generateMetadata(): Promise<Metadata> {
  assertEditorialRoutesEnabled();
  return {
    title: { absolute: "Feedback — Weekend MVP" },
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

export default function FeedbackLayout({ children }: { children: ReactNode }) {
  assertEditorialRoutesEnabled();
  return children;
}
