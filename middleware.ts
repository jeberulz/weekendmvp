import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  cleanPath,
  isProdApexHost,
  isProdWwwHost,
  pathNeedsCleaning,
  PROD_WWW_HOST,
} from "./lib/canonical-path";

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
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
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
  if (dirtyPath) {
    const url = request.nextUrl.clone();
    url.pathname = cleaned;
    return NextResponse.redirect(url, 308);
  }

  return NextResponse.next();
}

export const config = {
  // Skip Next internals and common static asset extensions.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|woff2?|css|js|map)$).*)",
  ],
};
