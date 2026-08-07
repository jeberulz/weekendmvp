import { convexAuthNextjsMiddleware } from "@convex-dev/auth/nextjs/server";
import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";
import {
  cleanPath,
  isProdApexHost,
  isProdWwwHost,
  pathNeedsCleaning,
  PROD_WWW_HOST,
} from "./lib/canonical-path";
import {
  authRouteDecision,
  isAuthManagedPath,
  isSensitiveAuthPath,
} from "./lib/auth-return";
import { classifyHost, tenantHostForSlug } from "./lib/tenant-host";
import { checkTenantSitePublished } from "./lib/tenant-publish-check";

/**
 * One-hop host + path canonicalization.
 *
 * - Apex production host always 308s to www with a cleaned path.
 * - www only redirects when the path is dirty (.html / trailing slash).
 * - Preview / localhost: path cleanup only (same host), no www force.
 *
 * Deploy this before clearing the Vercel Domains API apex→www redirect
 * (see WP13-S3). While that domain redirect is still on, apex never reaches
 * this middleware; www dirty URLs still get a single hop here.
 */
export function canonicalRedirect(request: NextRequest) {
  // Prefer the raw request URL — NextURL can normalize away a trailing slash
  // even when skipTrailingSlashRedirect is set (see next.js#66738).
  const raw = new URL(request.url);
  const pathname = raw.pathname;
  const search = raw.search;
  const host = request.headers.get("host")?.split(":")[0] ?? "";

  const cleaned = cleanPath(pathname);
  const dirtyPath = pathNeedsCleaning(pathname);
  const apex = isProdApexHost(host);
  const www = isProdWwwHost(host);

  if (apex) {
    const dest = new URL(`https://${PROD_WWW_HOST}${cleaned}${search}`);
    return NextResponse.redirect(dest, 308);
  }

  if (dirtyPath && www) {
    const dest = new URL(`https://${PROD_WWW_HOST}${cleaned}${search}`);
    return NextResponse.redirect(dest, 308);
  }

  // Preview / localhost / other hosts: clean path in place when needed.
  // Build a plain URL so NextURL cannot re-introduce slash normalization.
  if (dirtyPath) {
    const dest = new URL(`${raw.protocol}//${raw.host}${cleaned}${search}`);
    return NextResponse.redirect(dest, 308);
  }

  return null;
}

/**
 * WP28-S2. What a given `Host:` header is allowed to reach.
 *
 * Before this, the host space was apex, www, and *everything else*, where
 * everything else fell through to the full application. That was safe only
 * while no other host resolved. Once `*.weekendmvp.app` resolves, the old
 * fallback would serve the marketing site and `/dashboard` at every tenant
 * and unknown subdomain.
 */
export type HostRoutingDecision =
  | { kind: "platform" }
  | { kind: "tenant"; slug: string }
  | { kind: "reject" };

export function hostRoutingDecision(
  rawHost: string | null,
): HostRoutingDecision {
  const classification = classifyHost(rawHost);

  switch (classification.kind) {
    case "apex":
    case "www":
    case "platform-preview":
    case "local":
      return { kind: "platform" };
    case "tenant":
      return { kind: "tenant", slug: classification.slug };
    case "reserved":
    case "unknown":
      return { kind: "reject" };
  }
}

/**
 * A genuine 404, issued from middleware rather than by `notFound()`.
 *
 * This is not a style choice. Under `cacheComponents`, PPR flushes a 200
 * shell before `notFound()` executes, so a route-level 404 is soft — proven
 * on WP27 for `/preview/{token}` and `/build/{slug}`. Middleware runs before
 * the route and can set a real status, which is the only way to satisfy
 * "unknown tenant is 404".
 *
 * The body is deliberately bare: an unrecognized host gets no branding, no
 * application shell, and nothing that confirms what else runs here.
 */
/**
 * The single extra path a tenant host serves, besides `/`. Deliberately
 * dunder-prefixed so it cannot collide with anything in a customer's own
 * page and is obviously not part of their content.
 */
export const TENANT_LEAD_PATH = "/__lead";

function hostRejectedResponse(): NextResponse {
  return new NextResponse("Not Found", {
    status: 404,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}

export function applySensitiveAuthResponseHeaders(
  pathname: string,
  response: Response,
) {
  if (isSensitiveAuthPath(pathname)) {
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("Cache-Control", "no-store");
  }
  return response;
}

const platformAuthMiddleware = convexAuthNextjsMiddleware(
  async (request, { convexAuth }) => {
    const pathname = request.nextUrl.pathname;
    if (!isAuthManagedPath(pathname)) {
      return NextResponse.next();
    }

    const authenticated = await convexAuth.isAuthenticated();
    const decision = authRouteDecision(request.nextUrl, authenticated);
    if (decision.kind === "redirect") {
      return NextResponse.redirect(new URL(decision.target, request.url));
    }

    return NextResponse.next();
  },
  {
    // OAuth codes are consumed only on the dedicated callback seam. Public
    // pages may use `code` query parameters for unrelated integrations.
    shouldHandleCode: (request) =>
      request.nextUrl.pathname === "/auth/callback",
    // Session cookies stay host-only; Convex Auth does not set a Domain value.
    cookieConfig: { maxAge: null },
  },
);

export async function middleware(
  request: NextRequest,
  event: NextFetchEvent,
) {
  // Host classification precedes every other hop. Canonicalization used to be
  // first, which would hand a tenant or unknown host a 308 into the platform
  // before anything checked whether that host was ours to serve.
  const host = hostRoutingDecision(request.headers.get("host"));
  if (host.kind === "reject") {
    return hostRejectedResponse();
  }
  if (host.kind === "tenant") {
    // A published site is a single landing page, so exactly one path is
    // served and everything else answers identically. Keeping the tenant
    // surface to one path means no platform route can be probed for
    // existence, `/robots.txt` and `/sitemap.xml` cannot be inherited, and
    // the auth middleware never runs — a tenant host never touches a session
    // cookie.
    // Exactly two paths exist on a tenant host: the site itself, and the
    // lead endpoint. Everything else answers identically, so no platform
    // route can be probed and neither robots.txt nor sitemap.xml is
    // inherited.
    if (request.nextUrl.pathname === TENANT_LEAD_PATH) {
      // Rewritten, not redirected, so the request never leaves the customer's
      // host. The route re-derives the hostname from the `Host` header rather
      // than trusting this rewrite.
      return NextResponse.rewrite(new URL("/api/tenant/lead", request.url));
    }
    if (request.nextUrl.pathname !== "/") {
      return hostRejectedResponse();
    }
    // A genuine 404 for a host that is not live. `notFound()` inside the
    // route cannot do this: PPR flushes a 200 shell before it runs, which
    // left an unpublished site answering 200 with a not-found body — a soft
    // 404 on a public customer page.
    //
    // Best-effort and fail-open by design. This is not the authorization
    // boundary; the route independently refuses to render anything
    // unpublished. `null` means "could not tell", and serving the route is
    // the safe answer — failing closed here would take every customer site
    // offline on a single Convex blip.
    const hostname = tenantHostForSlug(host.slug);
    if (hostname !== null) {
      const published = await checkTenantSitePublished(hostname);
      if (published === false) {
        return hostRejectedResponse();
      }
    }

    // Internal rewrite, not a redirect: the visitor's URL stays on the
    // customer's host. `/site/{slug}` is unreachable by address — it is 404ed
    // on every platform host below.
    const target = new URL(`/site/${host.slug}`, request.url);
    return NextResponse.rewrite(target);
  }

  // `/site/*` is the tenant rewrite target and must never be addressable from
  // a platform host, or `www.weekendmvp.app/site/acme` would serve a
  // customer's page under our own domain — duplicating their content at a
  // URL they do not control and breaking their canonical.
  if (
    request.nextUrl.pathname === "/site" ||
    request.nextUrl.pathname.startsWith("/site/") ||
    request.nextUrl.pathname === TENANT_LEAD_PATH ||
    request.nextUrl.pathname === "/api/tenant/lead" ||
    request.nextUrl.pathname.startsWith("/api/tenant/")
  ) {
    return hostRejectedResponse();
  }

  // Canonicalization stays the first hop for platform hosts, including for
  // auth endpoints.
  const canonical = canonicalRedirect(request);
  if (canonical !== null) {
    return applySensitiveAuthResponseHeaders(
      request.nextUrl.pathname,
      canonical,
    );
  }
  const response = await platformAuthMiddleware(request, event);
  return applySensitiveAuthResponseHeaders(
    request.nextUrl.pathname,
    response ?? NextResponse.next(),
  );
}

export const config = {
  // Every private dashboard path must reach auth, even when its final segment
  // resembles a static asset. Ordinary public/internal assets remain skipped.
  matcher: [
    "/dashboard/:path*",
    "/robots.txt",
    "/sitemap.xml",
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|woff2?|css|js|map)$).*)",
  ],
};
