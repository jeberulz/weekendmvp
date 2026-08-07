import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

/**
 * WP28-S3. Properties of the tenant route that no Convex test can see: what
 * the page is allowed to emit, what it must not inherit from the platform,
 * and the fact that its path is a rewrite target rather than an address.
 *
 * Comments are stripped before asserting. These files document their own
 * guardrails, so matching prose would mean deleting a comment could turn a
 * test green — the lesson from `wp27-preview-route.test.mjs`.
 */
async function readCode(path) {
  const source = await readFile(new URL(`../../${path}`, import.meta.url), "utf8");
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*)/.test(line))
    .join("\n");
}

const ROUTE = "app/site/[slug]/page.tsx";

test("the tenant route is unreachable from a platform host", async () => {
  const source = await readCode("middleware.ts");
  // Without this, www.weekendmvp.app/site/acme would serve a customer's page
  // under our domain, duplicating their content at a URL they do not control.
  assert.match(source, /pathname === "\/site"/);
  assert.match(source, /pathname\.startsWith\("\/site\/"\)/);
  assert.match(source, /hostRejectedResponse\(\)/);
});

test("a tenant host is rewritten, never redirected", async () => {
  const source = await readCode("middleware.ts");
  // A redirect would move the visitor off the customer's hostname.
  assert.match(source, /NextResponse\.rewrite\(target\)/);
  assert.doesNotMatch(source, /NextResponse\.redirect\([^)]*site\//);
});

test("a tenant host serves exactly one path", async () => {
  const source = await readCode("middleware.ts");
  // Everything but `/` answers the same rejection, so no platform route can
  // be probed and neither robots.txt nor sitemap.xml can be inherited.
  assert.match(source, /request\.nextUrl\.pathname !== "\/"/);
});

test("the route renders without preview chrome", async () => {
  const source = await readCode(ROUTE);
  assert.match(source, /showPreviewChrome=\{false\}/);
  // The watermark and notice belong to the private preview, not a published
  // customer page.
  assert.doesNotMatch(source, /PreviewWatermark|PreviewNotice/);
  assert.doesNotMatch(source, /claimPreview|PreviewClaimBar/);
});

test("preview chrome is a required prop, so it cannot be defaulted on", async () => {
  const source = await readCode("components/preview/templates/index.tsx");
  // Optional-with-a-default is how a "PREVIEW" watermark ends up on a paying
  // customer's live page.
  assert.match(source, /showPreviewChrome:\s*boolean;/);
  assert.doesNotMatch(source, /showPreviewChrome\?\s*:/);
  assert.doesNotMatch(source, /showPreviewChrome\s*=\s*(true|false)/);
});

test("the canonical is derived from the slug, never from the Host header", async () => {
  const source = await readCode(ROUTE);
  assert.match(source, /tenantHostForSlug\(slug\)/);
  // A header-derived canonical lets anyone who can reach the deployment mint
  // a canonical pointing wherever they like.
  assert.doesNotMatch(source, /headers\(\)/);
  assert.doesNotMatch(source, /x-forwarded-host/i);
});

test("the route never points at the platform host", async () => {
  const source = await readCode(ROUTE);
  assert.doesNotMatch(source, /www\.weekendmvp\.app/);
  // The root layout's platform metadataBase must be overridden, or every
  // relative URL on this page resolves against weekendmvp.app.
  assert.match(source, /metadataBase:\s*new URL\(origin\)/);
  assert.match(source, /alternates:\s*\{\s*canonical:\s*origin\s*\}/);
});

test("a published customer site is indexable", async () => {
  const source = await readCode(ROUTE);
  // The platform's noindex discipline is for private surfaces. A customer's
  // published page is meant to be found.
  assert.doesNotMatch(source, /robots:/);
  assert.doesNotMatch(source, /noindex/);
});

test("the route adds no lead-write path", async () => {
  const source = await readCode(ROUTE);
  // Lead capture is WP28-S5. Structurally absent, not disabled by a flag.
  assert.doesNotMatch(source, /<form|action=|useMutation|fetch\(/);
});

test("the render spec is re-validated at the render boundary", async () => {
  const source = await readCode(ROUTE);
  // Never trust a shape just because it arrived from our own backend.
  assert.match(source, /parseSiteRenderSpec\(/);
  // Reserved and malformed slugs are refused here too, so the route cannot
  // serve anything the host classifier would not route.
  assert.match(source, /isValidTenantSlug\(slug\)/);
});

test("the route is never prerendered", async () => {
  const source = await readCode(ROUTE);
  // A cached read keeps serving a retired version after a rollback, which is
  // the exact failure a rollback exists to fix.
  assert.match(source, /export const instant = false/);
  assert.doesNotMatch(source, /"use cache"/);
});

test("platform chrome is suppressed on a tenant origin", async () => {
  for (const path of [
    "components/consent/ConsentBanner.tsx",
    "components/consent/AnalyticsScripts.tsx",
  ]) {
    const source = await readCode(path);
    assert.match(source, /isTenantHost\(window\.location\.host\)/, path);
  }
});

test("the public resolver exposes only the render spec", async () => {
  const source = await readCode("convex/platform/sites/read.ts");
  assert.match(source, /publishedSiteValidator = v\.object\(\{ renderSpec: v\.string\(\) \}\)/);
  // Every additional field would be a fact about a customer's account served
  // to the open internet.
  for (const leak of ["ownerId:", "projectId:", "status:", "createdAt:"]) {
    assert.doesNotMatch(
      source.slice(source.indexOf("publishedSiteValidator")),
      new RegExp(`return \\{[^}]*${leak}`),
      leak,
    );
  }
});

test("the resolver cannot throw a 500 on duplicate hostnames", async () => {
  const source = await readCode("convex/platform/sites/read.ts");
  // `unique()` throws on two rows, turning a data bug into a public error
  // that also confirms the hostname exists.
  assert.doesNotMatch(source, /\.unique\(\)/);
  assert.match(source, /\.take\(2\)/);
  assert.match(source, /matches\.length !== 1/);
});

test("the tenant route has its own bare not-found boundary", async () => {
  // Without this file, `notFound()` falls through to the root
  // `app/not-found.tsx` — the full marketing 404 with nav, footer, Starter Kit
  // signup and cal.com — which independent review confirmed shipping on every
  // published customer page and at 200 on unclaimed subdomains during a Convex
  // outage.
  const source = await readCode("app/site/[slug]/not-found.tsx");
  assert.doesNotMatch(source, /@\/components/);
  assert.doesNotMatch(source, /MegaNav|SiteFooter|KitSignup|Starter Kit/);
  assert.doesNotMatch(source, /weekendmvp\.app/i);
  assert.doesNotMatch(source, /<a |<Link/);
  // The root layout's title template would otherwise brand it.
  assert.match(source, /title:\s*\{\s*absolute:/);
});

test("llms.txt cannot be inherited by a tenant host", async () => {
  // Same crawler-directive class as robots.txt and sitemap.xml, and the one
  // file AI crawlers fetch by convention. The extension exclusion in the
  // matcher skips `.txt`, so it must be listed explicitly.
  const source = await readCode("middleware.ts");
  assert.match(source, /"\/llms\.txt"/);
  assert.match(source, /"\/robots\.txt"/);
  assert.match(source, /"\/sitemap\.xml"/);
});

test("the render spec is read once per request", async () => {
  const source = await readCode(ROUTE);
  // `generateMetadata` and the body both need it, and `fetchQuery` POSTs so
  // Next's fetch dedupe does not apply — two reads could straddle a publish.
  assert.match(source, /cache\(async \(slug: string\)/);
  assert.match(source, /import \{ cache \} from "react"/);
});

test("the middleware gate and the route resolver cannot diverge", async () => {
  const source = await readCode("convex/platform/sites/read.ts");
  // They checked different conditions; any divergence put a host through the
  // gate that the route then refused, landing on a 200 soft-404.
  assert.match(source, /resolvePublished\(ctx, args\.hostname\)\) !== null/);
  assert.match(source, /await resolvePublished\(ctx, args\.hostname\)/);
  // Exactly one function performs the checks.
  assert.equal((source.match(/site\.status !== "published"/g) ?? []).length, 1);
  assert.equal((source.match(/project\.archivedAt !== undefined/g) ?? []).length, 1);
});
