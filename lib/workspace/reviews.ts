/**
 * L1-C6 — where each crew artifact is reviewed, for the "Waiting on you" list
 * (`api.workspace.reviews.pendingReviews`). Pure, relative imports only: the
 * Convex bundler loads this file, so it cannot import `lib/workspace/routes.ts`
 * (which uses the `@/` alias). `tests/platform/l1-coming-soon.test.tsx`
 * checks every slug here against the route manifest. Wren's approval cards
 * mirror this map in `lib/workspace/wrenCards.ts` (`documentReviewRoute`; that
 * file may not import it), and `tests/platform/workspace-wren-cards.test.ts`
 * keeps the two equal.
 *
 * Only pages that ship a review (Brand kit, Email, Social) get their own
 * route. Everything else, the blueprint included, is reviewed on Team HQ,
 * which lists every pending card with its approve and ask-for-changes actions
 * and holds the blueprint's read-only view.
 */
import { ARTIFACT_KINDS, type ArtifactKind } from "./contracts/artifacts";

/** A route segment under `/dashboard/b/{projectId}` (a subset of `WorkspaceRouteSlug`). */
export type ReviewRouteSlug = "team" | "brand" | "email" | "social";

export const REVIEW_TARGETS: Readonly<Record<ArtifactKind, { readonly title: string; readonly slug: ReviewRouteSlug }>> =
  Object.freeze({
    blueprint: { title: "Blueprint", slug: "team" },
    roster_plan: { title: "Team plan", slug: "team" },
    brand_kit: { title: "Brand kit", slug: "brand" },
    landing_spec: { title: "Landing page", slug: "team" },
    email_sequence: { title: "Waitlist emails", slug: "email" },
    social_pack: { title: "Social posts", slug: "social" },
    seo_pack: { title: "SEO pack", slug: "team" },
    launch_plan: { title: "Launch plan", slug: "team" },
    ads_drafts: { title: "Ad drafts", slug: "team" },
    build_pack: { title: "Build pack", slug: "team" },
  });

export function isArtifactKind(kind: string): kind is ArtifactKind {
  return (ARTIFACT_KINDS as readonly string[]).includes(kind);
}

/** `/dashboard/b/{projectId}/{slug}`, the id encoded as `workspacePath` does. */
export function reviewHref(projectId: string, kind: ArtifactKind): string {
  return `/dashboard/b/${encodeURIComponent(projectId)}/${REVIEW_TARGETS[kind].slug}`;
}
