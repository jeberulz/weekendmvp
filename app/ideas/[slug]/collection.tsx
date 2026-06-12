import type { ReactNode } from "react";

/**
 * Extension point for /ideas/{collection} hub pages (category, revenue
 * goal, build time — e.g. /ideas/saas, /ideas/1k-month).
 *
 * U10 resolution order in app/ideas/[slug]/page.tsx: MDX body → Convex
 * body → renderCollection(slug) → notFound(). Returning null for every
 * slug keeps those URLs on the legacy fallback rewrite for now.
 *
 * U11 replaces this stub with the real category/revenue/buildTime hub
 * pages WITHOUT restructuring the route.
 */
export async function renderCollection(
  _slug: string,
): Promise<ReactNode | null> {
  return null;
}
