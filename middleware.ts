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
  // Canonicalization stays the first hop, including for auth endpoints.
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
