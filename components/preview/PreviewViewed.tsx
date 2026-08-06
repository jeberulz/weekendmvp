"use client";

import { useEffect, useRef } from "react";
import type { PreviewTemplate } from "@/convex/platform/preview/renderSpec";
import { trackEvent } from "@/lib/track";

/**
 * WP27-S4. Emits `preview_viewed`.
 *
 * Carries the template id and nothing else. The capability token is the
 * secret that authorizes the preview, so it must never reach an analytics
 * payload — and no field here identifies the visitor. `trackEvent` no-ops
 * until consent has loaded `window.gtag`, so this stays consent-gated
 * without a second check.
 *
 * Renders nothing: analytics must not occupy layout or reach the
 * accessibility tree.
 */
export function PreviewViewed({ template }: { template: PreviewTemplate }) {
  const sent = useRef(false);

  useEffect(() => {
    // Guarded against React's development double-invoke of effects, which
    // would otherwise double-count every preview view.
    if (sent.current) return;
    sent.current = true;
    trackEvent("preview_viewed", { template });
  }, [template]);

  return null;
}
