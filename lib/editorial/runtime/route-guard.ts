import { notFound } from "next/navigation";

import { isValidPlatformConvexUrl } from "@/lib/platform-convex-url";

/**
 * Build-time gate for every editorial layout, page and metadata function.
 *
 * A production build without a Convex backend has no workspace at all, so
 * every editorial path answers exactly like any other missing page: a static
 * 404 with nothing serialised. Both conditions are inlined at build time
 * (`NODE_ENV`, `NEXT_PUBLIC_CONVEX_URL`), so the rest of each caller is dead
 * code then. Layouts render in parallel with their pages, so every page and
 * metadata function calls this first.
 *
 * With a backend (WP46-E4e), pages render per request. Middleware refuses
 * everyone but the bound super-admin with a real 404 before rendering starts
 * (a `notFound()` after the PPR shell would be soft), and every page, action
 * and Convex function checks again.
 */
export function assertEditorialRoutesEnabled(): void {
  if (process.env.NODE_ENV === "production" && !isValidPlatformConvexUrl(process.env.NEXT_PUBLIC_CONVEX_URL)) notFound();
}
