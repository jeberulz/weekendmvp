import { notFound } from "next/navigation";

/**
 * Build-time gate for every editorial layout, page and metadata function.
 *
 * There is no live adapter yet (WP46-E4), so production builds must answer
 * every editorial path exactly like any other missing page. Layouts render in
 * parallel with their pages, so a layout-only check would still serialise
 * each page's static shell (and resolve its metadata) into the 404 response.
 * Calling this first, synchronously, everywhere prevents that. In production
 * `process.env.NODE_ENV` is inlined, so the rest of each caller is dead code.
 */
export function assertEditorialRoutesEnabled(): void {
  if (process.env.NODE_ENV === "production") notFound();
}
