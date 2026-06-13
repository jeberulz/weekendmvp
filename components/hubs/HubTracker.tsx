"use client";

import * as React from "react";

import { trackEvent } from "@/lib/track";

/**
 * Fires the legacy page-view analytics event for a hub page on mount —
 * replaces the inline `gtag('event', 'view_audience_page', {...})` (and
 * view_tool_page / view_problem_page / view_category / view_revenue_page)
 * blocks the generators injected into each page <head>.
 *
 * trackEvent no-ops until consent has loaded GA, matching legacy gating.
 */
export function HubTracker({
  event,
  props,
}: {
  event: string;
  props: Record<string, string | number>;
}) {
  const fired = React.useRef(false);
  React.useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    trackEvent(event, props);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
