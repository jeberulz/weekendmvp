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
export type BuildCtaLocation = "home-hero" | "home-idea-of-the-week" | "idea-account-card" | "idea-member-header";

const IDEA_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * A slug the wizard can start from: the shape of an idea slug and not an
 * engine draft (drafts are not eligible for new entry points, WP54-S5).
 */
export function isBuildCtaSlug(slug: unknown): slug is string {
  return typeof slug === "string" && slug.length > 0 && slug.length <= 120 && IDEA_SLUG.test(slug) && !isEngineDraftSlug(slug);
}

/** The wizard route for a library idea. Same-origin, no query. */
export function wizardPath(slug: string): string {
  return `/start/${slug}`;
}

/**
 * Where the CTA links. `/start/*` answers 404 to a signed-out visitor, and the
 * CTA sits on cached anonymous pages that cannot know the auth state. So it
 * goes through sign-up with the wizard as the return target: middleware sends
 * a signed-in visitor on `/signup` straight to `returnTo`, and a signed-out
 * one signs up and then lands on the wizard.
 */
export function buildHref(slug: string): string {
  return `/signup?returnTo=${encodeURIComponent(wizardPath(slug))}`;
}

/**
 * L1-C9: where the CTA links for this request. A page that already knows the
 * visitor is signed in (the member idea page) links straight to the wizard;
 * everyone else goes through sign-up (`buildHref`).
 */
export function buildCtaHref(slug: string, signedIn: boolean): string {
  return signedIn ? wizardPath(slug) : buildHref(slug);
}

/** L1: the homepage side door for a founder who brings their own idea (canvas Main board). */
export const OWN_IDEA_CTA_LABEL = "Start building with it";

/** Where an own-idea click is reported from. */
export type OwnIdeaCtaLocation = "home-hero" | "home-final";

/** The wizard route for the founder's own idea. */
export const OWN_IDEA_PATH = "/start/own";

/** Same sign-up hop as `buildHref`: `/start/own` is a 404 to a signed-out visitor. */
export function ownIdeaHref(): string {
  return `/signup?returnTo=${encodeURIComponent(OWN_IDEA_PATH)}`;
}

/** L1-C9: the member dashboard's entry into the own-idea wizard. */
export const START_BUILDING_LABEL = "Start building";

/** L1-C9: the dashboard's secondary link, to pick an idea from the library. */
export const PICK_LIBRARY_IDEA_LABEL = "Or pick an idea from the library";
