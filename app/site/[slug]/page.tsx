import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { parseSiteRenderSpec } from "@/convex/platform/preview/renderSpec";
import { PreviewTemplateRenderer } from "@/components/preview/templates";
import { isValidTenantSlug, tenantHostForSlug } from "@/lib/tenant-host";

/**
 * WP28-S3. A published customer site.
 *
 * **This route is never reachable by URL.** `middleware.ts` rewrites `/` on a
 * tenant host to `/site/{slug}`, and 404s `/site/*` on every platform host, so
 * `www.weekendmvp.app/site/acme` does not serve a customer's page. The path is
 * an internal rewrite target, not an address.
 *
 * What separates this from WP27's `/preview/{token}`:
 *
 * - **Public and indexable.** A preview is private, `noindex`, and expires. A
 *   published site is the customer's real page, so it is self-canonical to
 *   its own host and carries no platform robots directives.
 * - **No preview chrome.** `showPreviewChrome={false}` removes the watermark
 *   and the "this is a private preview" notice. The renderer is reused
 *   unchanged rather than forked — one template surface, one security matrix.
 * - **No claim bar, no analytics, no platform navigation.** Nothing here can
 *   walk a customer's visitor back onto our marketing site.
 *
 * Lead capture is WP28-S5. The templates' call to action is an inert
 * `<button type="button">` and this route adds no form, action, or fetch.
 */

const DEFAULT_TITLE = "Weekend MVP site";

/**
 * The canonical is built from the slug, never from the incoming `Host`
 * header. A header-derived canonical would let anyone who can reach this
 * deployment mint a canonical pointing wherever they like.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const host = tenantHostForSlug(slug);
  if (host === null) {
    return { title: { absolute: DEFAULT_TITLE } };
  }

  const spec = await loadRenderSpec(slug);
  const origin = `https://${host}`;

  return {
    // Overrides the root layout's platform `metadataBase`, so no relative URL
    // on this page can resolve against `weekendmvp.app`.
    metadataBase: new URL(origin),
    // `absolute`, not a bare string. The root layout defines
    // `template: "%s | Weekend MVP"`, which would stamp our brand onto a
    // customer's own page title — caught live, the first build emitted
    // "…| Weekend MVP" in the tenant <title>.
    title: { absolute: spec?.siteInput.headline ?? DEFAULT_TITLE },
    description: spec?.siteInput.subheadline,
    alternates: { canonical: origin },
    openGraph: {
      title: spec?.siteInput.headline ?? DEFAULT_TITLE,
      description: spec?.siteInput.subheadline,
      url: origin,
      type: "website",
    },
    // Deliberately no `robots` block: a published customer site is meant to be
    // indexed. The platform's own `noindex` surfaces do not apply here.
  };
}

/**
 * Rendered per request, never prerendered.
 *
 * A published site changes when its owner publishes a new version, and the
 * pointer swap in `site_configs.currentVersionId` is the only thing that
 * makes it live. Caching this read would keep serving a retired version after
 * a rollback — which is exactly the failure a rollback exists to fix.
 */
export const instant = false;

async function loadRenderSpec(slug: string) {
  // Shape-check before the round trip, and reject reserved names here too, so
  // this route cannot serve anything the host classifier would not route.
  if (!isValidTenantSlug(slug)) return null;
  const hostname = tenantHostForSlug(slug);
  if (hostname === null) return null;

  try {
    const site = await fetchQuery(api.platform.sites.read.resolvePublishedSite, {
      hostname,
    });
    if (site === null) return null;
    // Re-validated at the render boundary, exactly as the preview route does.
    return parseSiteRenderSpec(site.renderSpec);
  } catch {
    // Transport failure or an unparseable stored spec collapses into the same
    // outcome as "no such site". Fail closed: serving a partial or
    // unvalidated page under a customer's own domain is worse than serving
    // nothing.
    return null;
  }
}

export default async function TenantSitePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const spec = await loadRenderSpec(slug);
  if (spec === null) notFound();

  return (
    <div className="min-h-screen bg-black">
      <PreviewTemplateRenderer spec={spec} showPreviewChrome={false} />
    </div>
  );
}
