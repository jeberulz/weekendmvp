import { convexAuthNextjsMiddleware } from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";
import { api } from "./convex/_generated/api";
import {
  canonicalPath,
  isProdApexHost,
  isProdWwwHost,
  pathNeedsRedirect,
  PROD_WWW_HOST,
} from "./lib/canonical-path";
import {
  authRouteDecision,
  isAuthEntryPath,
  isAuthManagedPath,
  isSensitiveAuthPath,
} from "./lib/auth-return";
import { SESSION_HINT_COOKIE } from "./lib/auth-session-cookie";
import { isOperatorRequestPath } from "./lib/private-paths";
import { isKnownIdeaSlug } from "./lib/idea-slugs.generated";
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

  // Clean slash/.html and apply path aliases (e.g. /ideas → /startup-ideas)
  // in one hop so apex+dirty+rename never chains.
  const destination = canonicalPath(pathname);
  const pathChanged = pathNeedsRedirect(pathname);
  const apex = isProdApexHost(host);
  const www = isProdWwwHost(host);

  if (apex) {
    const dest = new URL(`https://${PROD_WWW_HOST}${destination}${search}`);
    return NextResponse.redirect(dest, 308);
  }

  if (pathChanged && www) {
    const dest = new URL(`https://${PROD_WWW_HOST}${destination}${search}`);
    return NextResponse.redirect(dest, 308);
  }

  // Preview / localhost / other hosts: clean/alias in place when needed.
  // Build a plain URL so NextURL cannot re-introduce slash normalization.
  if (pathChanged) {
    const dest = new URL(
      `${raw.protocol}//${raw.host}${destination}${search}`,
    );
    return NextResponse.redirect(dest, 308);
  }

  return null;
}

/**
 * `/build/{slug}` slug segment, or null when the path is not a build URL.
 * Path must already be canonical (no trailing slash / .html).
 */
export function buildIdeaSlug(pathname: string): string | null {
  const match = /^\/build\/([^/]+)$/.exec(pathname);
  return match?.[1] ?? null;
}

function publicIdeaSlug(pathname: string): string | null {
  const route = /^\/ideas\/([a-z0-9-]+)$/.exec(pathname);
  if (route) return route[1];
  const art = /^\/image\/og\/idea\/([a-z0-9-]+)\.png$/.exec(pathname);
  return art?.[1] ?? null;
}

async function publicIdeaDecision(slug: string): Promise<"legacy" | "released" | "removed" | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timedOut = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), EDITORIAL_GATE_TIMEOUT_MS);
    });
    const result = await Promise.race([fetchQuery(api.editorial.public.visibility, { slug }), timedOut]);
    return result ?? null;
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function publicIdeaUnavailable(): NextResponse {
  return new NextResponse("Temporarily Unavailable", {
    status: 503,
    headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });
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
  } else if (isAuthEntryPath(pathname)) {
    // `/login` and `/signup` can carry a preview capability in
    // `?claimPreview=` and link to the rest of the site. A same-origin
    // navigation sends the full URL as its referrer by default, which
    // consented analytics would collect as `page_referrer` (GA4) and `rl`
    // (Meta).
    response.headers.set("Referrer-Policy", "no-referrer");
  }
  return response;
}

/**
 * WP46-E4e. Operator surfaces are never cached, indexed, sent as a referrer or
 * framed: their URLs carry private record ids, and a signed-in workspace inside
 * another page invites clickjacking.
 */
export function applyOperatorResponseHeaders(pathname: string, response: Response) {
  if (isOperatorRequestPath(pathname)) {
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("Content-Security-Policy", "frame-ancestors 'none'");
  }
  return response;
}

/**
 * The local demo (development only, exact opt-in) has no accounts; its pages
 * gate themselves. A production build inlines NODE_ENV, so this is always
 * false there and no deployable route can skip the check below.
 */
function editorialLocalDemo() {
  return process.env.NODE_ENV !== "production" && process.env.EDITORIAL_FIXTURE_MODE === "local-demo";
}

/** A backend that has not answered by then is treated as unable to vouch. */
export const EDITORIAL_GATE_TIMEOUT_MS = 3_000;

/** Only the bound super-admin passes; anything the backend cannot confirm, or not in time, is refused. */
export async function editorialAccessAllowed(token: string | undefined): Promise<boolean> {
  if (editorialLocalDemo()) return true;
  if (!token) return false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timedOut = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), EDITORIAL_GATE_TIMEOUT_MS);
    });
    const session = await Promise.race([
      fetchQuery(api.editorial.reads.session, { nowMs: Date.now() }, { token }),
      timedOut,
    ]);
    // Only an explicit grant passes; a missing or unexpected shape is a refusal.
    return session !== null && session.signedIn === true && typeof session.editor === "object" && session.editor !== null;
  } catch {
    return false;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * A real 404 rendered exactly like any unknown path. `notFound()` inside the
 * dynamic editorial pages would be soft under Cache Components (PPR flushes
 * a 200 shell first), so the refusal has to happen here. The target is a
 * neutral, nonexistent path: Next.js can expose a rewrite target in response
 * headers (`x-middleware-rewrite` on `next start`, `x-nextjs-rewritten-path`
 * for RSC requests), so the body is identical but those markers are not.
 */
export const EDITORIAL_NOT_FOUND_PATH = "/__not-found";

function editorialNotFound(request: NextRequest) {
  return NextResponse.rewrite(new URL(EDITORIAL_NOT_FOUND_PATH, request.url));
}

/** Convex Auth's session JWT cookie; unprefixed on localhost only. */
const CONVEX_AUTH_JWT_COOKIES = ["__Host-__convexAuthJWT", "__convexAuthJWT"];

/**
 * Convex Auth sets its session JWT `httpOnly`, so the marketing nav cannot
 * see it. Mirror its presence into a readable, non-secret hint so the nav can
 * show "Dashboard" without mounting the auth provider on public pages.
 *
 * A response that writes the JWT (sign-in, refresh, sign-out) wins over the
 * request. The hint is written only when it is out of date, so an anonymous
 * visitor never receives a `Set-Cookie`. Not an authorization check.
 */
export function syncSessionHintCookie(
  request: NextRequest,
  response: Response,
) {
  if (!(response instanceof NextResponse)) {
    return response;
  }

  let signedIn = CONVEX_AUTH_JWT_COOKIES.some((name) =>
    Boolean(request.cookies.get(name)?.value),
  );
  for (const name of CONVEX_AUTH_JWT_COOKIES) {
    const written = response.cookies.get(name);
    if (written !== undefined) {
      signedIn = written.value !== "";
    }
  }

  const hinted = request.cookies.get(SESSION_HINT_COOKIE)?.value === "1";
  if (signedIn && !hinted) {
    response.cookies.set(SESSION_HINT_COOKIE, "1", {
      path: "/",
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
    });
  } else if (!signedIn && hinted) {
    response.cookies.set(SESSION_HINT_COOKIE, "", { path: "/", maxAge: 0 });
  }
  return response;
}

const platformAuthMiddleware = convexAuthNextjsMiddleware(
  async (request, { convexAuth }) => {
    const pathname = request.nextUrl.pathname;
    // WP46-E4e. Pages, RSC and segment requests and server actions anywhere
    // under /admin pass this gate; the pages and actions check again.
    if (isOperatorRequestPath(pathname)) {
      return (await editorialAccessAllowed(await convexAuth.getToken()))
        ? NextResponse.next({ request: { headers: request.headers } })
        : editorialNotFound(request);
    }
    if (!isAuthManagedPath(pathname)) {
      return NextResponse.next({ request: { headers: request.headers } });
    }

    const authenticated = await convexAuth.isAuthenticated();
    const decision = authRouteDecision(request.nextUrl, authenticated);
    if (decision.kind === "redirect") {
      return NextResponse.redirect(new URL(decision.target, request.url));
    }

    return NextResponse.next({ request: { headers: request.headers } });
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
    // The Location of a redirect under /admin repeats the private path.
    return applyOperatorResponseHeaders(
      request.nextUrl.pathname,
      applySensitiveAuthResponseHeaders(request.nextUrl.pathname, canonical),
    );
  }

  // Hard alias: `/signin` → `/login` (Cache Components soft-redirects page
  // `redirect()` as 200). Preserve returnTo / claimPreview for preview claim.
  if (request.nextUrl.pathname === "/signin") {
    const target = new URL("/login", request.url);
    target.search = request.nextUrl.search;
    return NextResponse.redirect(target, 308);
  }

  // Request-time publication gate precedes static MDX and image delivery.
  // PPR may otherwise flush a 200 shell before route-level notFound(), and
  // public/ images bypass React entirely. A backend outage never falls back
  // to an unpublished file or stale CDN response.
  const ideaSlug = publicIdeaSlug(request.nextUrl.pathname);
  if (ideaSlug !== null) {
    const decision = await publicIdeaDecision(ideaSlug);
    if (decision === null) return publicIdeaUnavailable();
    if (decision === "removed") return hostRejectedResponse();
    if (request.nextUrl.pathname.startsWith("/image/og/idea/") && decision === "released") {
      return hostRejectedResponse();
    }
  }

  // Genuine 404 for unknown `/build/{slug}`. Route-level `notFound()` is a
  // soft 404 under cacheComponents (PPR flushes 200 before it runs) — proven
  // on WP27. Middleware can set a real status. Known slugs come from the
  // manifest-derived set so this does not depend on Convex availability.
  const buildSlug = buildIdeaSlug(request.nextUrl.pathname);
  if (buildSlug !== null) {
    const decision = await publicIdeaDecision(buildSlug);
    if (decision === null) return isKnownIdeaSlug(buildSlug) ? publicIdeaUnavailable() : hostRejectedResponse();
    if (decision === "removed" || (decision === "legacy" && !isKnownIdeaSlug(buildSlug))) {
      return hostRejectedResponse();
    }
  }

  const response = await platformAuthMiddleware(request, event);
  return applyOperatorResponseHeaders(
    request.nextUrl.pathname,
    applySensitiveAuthResponseHeaders(
      request.nextUrl.pathname,
      syncSessionHintCookie(request, response ?? NextResponse.next()),
    ),
  );
}

export const config = {
  // Every private dashboard path must reach auth, even when its final segment
  // resembles a static asset. Ordinary public/internal assets remain skipped.
  matcher: [
    "/dashboard/:path*",
    // WP46-E4f. The operator area too: a final segment like `x.js` must not
    // skip the editorial gate and its headers.
    "/admin",
    "/admin/:path*",
    "/robots.txt",
    "/sitemap.xml",
    // `public/llms.txt` is a static file, so the extension exclusion below
    // skips it. Independent review found it answering 200 on every tenant,
    // reserved, and unknown host — publishing our marketing copy under a
    // customer's domain to exactly the AI crawlers this site targets. It is
    // the same crawler-directive class as robots.txt and sitemap.xml, both of
    // which were already re-added here for the same reason.
    "/llms.txt",
    "/image/og/idea/:path*",
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|woff2?|css|js|map)$).*)",
  ],
};
