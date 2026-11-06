/**
 * WP74-S5: the "Build this idea, free" CTA, pure and dependency-free so the
 * server pages, the client link and the tests share it.
 *
 * The CTA only exists behind the launch-workspace flag
 * (`lib/workspace/build-cta-access.ts`). With the flag off none of this is
 * rendered and the public pages are byte-for-byte what they were.
 */
import { isEngineDraftSlug } from "@/lib/engine-drafts";

export const BUILD_CTA_LABEL = "Build this idea, free";

/** Where a click is reported from, so the funnel reads per surface. */
export type BuildCtaLocation = "home-hero" | "home-idea-of-the-week" | "idea-account-card";

const IDEA_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * A slug the wizard can start from: the shape of an idea slug and not an
 * engine draft (drafts are not eligible for new entry points, WP54-S5).
 */
export function isBuildCtaSlug(slug: unknown): slug is string {
  return typeof slug === "string" && slug.length > 0 && slug.length <= 120 && IDEA_SLUG.test(slug) && !isEngineDraftSlug(slug);
}

/** The wizard route for a library idea. Same-origin, no query. */
export function buildHref(slug: string): string {
  return `/start/${slug}`;
}
