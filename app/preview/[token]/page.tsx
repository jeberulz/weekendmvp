import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchAction } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { normalizeCapabilityToken } from "@/convex/platform/preview/capabilities";
import { parseSiteRenderSpec } from "@/convex/platform/preview/renderSpec";
import { PreviewTemplateRenderer } from "@/components/preview/templates";
import { PreviewConversion } from "@/components/preview/PreviewConversion";
import { PreviewViewed } from "@/components/preview/PreviewViewed";

/**
 * WP27-S4. The isolated preview surface.
 *
 * Three properties are load-bearing here and each is asserted in
 * `tests/security/wp27-preview-route.test.mjs`.
 *
 * 1. **One observable outcome for every failure.** S1 made resolution
 *    constant-*shape* (malformed, unknown, and expired all return null). This
 *    route owns the observable half: every one of those cases, plus a stored
 *    spec that no longer parses, funnels through the same `notFound()` call,
 *    so the body is identical by construction rather than by three code paths
 *    that happen to agree today. Measured live at equal token length, the
 *    three failure responses are byte-identical. A 404-vs-410 split, or a
 *    message distinguishing "expired" from "never existed", would hand back
 *    the enumeration oracle the null-for-everything design exists to close.
 * 2. **Never cached.** The response carries `private, no-store` and the route
 *    performs uncached I/O per request, so no shared cache, CDN, or Next
 *    cache entry can serve one visitor's preview to another. The headers are
 *    set in `next.config.ts` against `/preview/:token` so they apply to the
 *    not-found responses too — a `Cache-Control` that varied by case would
 *    itself be the oracle.
 * 3. **No lead-write path.** The templates' call to action is an inert
 *    `<button type="button">`; this route adds no form, no action, and no
 *    fetch. Structurally inert, not disabled by a flag someone can flip.
 *
 * Host routing is WP28's exclusively: nothing here reads, resolves, or
 * implies a tenant hostname.
 */

/**
 * Static, not `generateMetadata`. Deriving the title from the capability
 * would leak its existence into the document title — and a metadata call
 * that resolved the token would double the work on every render.
 */
export const metadata: Metadata = {
  title: "Preview",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noarchive: true,
      noimageindex: true,
    },
  },
};

/**
 * Rendered per request, never prerendered. The capability read must not be
 * wrapped in `"use cache"`: a cached preview is a preview served to the
 * wrong person, and expiry would stop being evaluated on every read.
 *
 * Known deviation, measured rather than assumed: under Cache Components the
 * route still emits a Partial Prerendering shell, which is flushed with a
 * 200 before the dynamic part runs, so `notFound()` renders the generic page
 * but cannot set a 404. Every case — valid, unknown, expired, malformed —
 * answers 200. Awaiting `connection()` was tried and did not suppress the
 * shell (`x-nextjs-postponed` stayed set), so it was removed rather than
 * left in as dead code.
 *
 * That is a soft-404, not a leak: because *all four* cases share the status,
 * there is no status oracle at all, which is a stronger property than the
 * story asked for. Non-indexability is carried by `X-Robots-Tag` and the
 * robots metadata rather than by the status code. The shell itself is
 * token-independent — everything derived from the capability lives in the
 * dynamic part, verified by three tokens rendering three different templates
 * and by failures rendering the not-found body.
 */
export const instant = false;

async function loadRenderSpec(token: string) {
  // Shape-check before the round trip. Returns the same null as an unknown
  // token, so this is a cost optimisation with no observable difference.
  if (normalizeCapabilityToken(token) === null) return null;

  try {
    const view = await fetchAction(api.platform.preview.read.view, { token });
    if (view === null) return null;
    // Re-validated at the render boundary. The renderer never trusts a shape
    // just because it arrived from our own backend.
    return parseSiteRenderSpec(view.renderSpec);
  } catch {
    // A transport failure or an unparseable stored spec collapses into the
    // same generic outcome. Surfacing "we found it but could not render it"
    // would confirm the token was real.
    return null;
  }
}

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const spec = await loadRenderSpec(token);
  if (spec === null) notFound();

  return (
    // The bottom padding reserves scroll room under the claim bar. The consent banner is
    // `fixed bottom-0` and shows to every first-time anonymous visitor, so
    // without it the last element on a short page — the signup CTA — sits
    // permanently underneath the banner and cannot be clicked. Verified by
    // hit-testing the CTA's own centre point at both widths; the banner is
    // 308px tall at 375x812, which is why mobile needs the larger value.
    <div className="min-h-[100dvh] bg-[#fcfaf7] pb-96 sm:pb-56">
      {/* Template only: no site nav, no footer, nothing that would let a
          visitor navigate out of the preview into the marketing site. */}
      <PreviewTemplateRenderer spec={spec} showPreviewChrome />
      <PreviewConversion token={token} />
      <PreviewViewed template={spec.templateId} />
    </div>
  );
}
