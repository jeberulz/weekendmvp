import { hasDotSegmentInTarget, isAllowedAuthReturnPath, isBareReturnPath } from "./private-paths";

export const DEFAULT_AUTH_RETURN = "/dashboard";

const AUTH_ENTRY_PATHS = new Set(["/login", "/signup", "/signin"]);

/** The sign-in and sign-up pages, which can carry `?claimPreview=`. */
export function isAuthEntryPath(pathname: string) {
  return AUTH_ENTRY_PATHS.has(pathname);
}

/**
 * WP27-S5. Same shape as `normalizeCapabilityToken`
 * (`convex/platform/preview/capabilities.ts`). Kept local because client
 * components import this module and must not pull in the Convex package.
 */
function carriesClaimPreview(url: URL) {
  const raw = url.searchParams.get("claimPreview");
  return raw !== null && /^[0-9a-f]{64}$/.test(raw.trim().toLowerCase());
}

/**
 * Restrict post-auth navigation to the private namespaces: the member
 * dashboard and the editorial workspace (its "confirm it's you" sign-in).
 */
export function safePlatformReturn(value: unknown) {
  if (typeof value !== "string" || value.includes("\\") || hasDotSegmentInTarget(value)) {
    return DEFAULT_AUTH_RETURN;
  }

  try {
    const target = new URL(value, "https://platform.weekendmvp.invalid");
    if (
      target.origin === "https://platform.weekendmvp.invalid" &&
      isAllowedAuthReturnPath(target.pathname)
    ) {
      if (isBareReturnPath(target.pathname)) {
        return target.search || target.hash ? DEFAULT_AUTH_RETURN : target.pathname;
      }
      return `${target.pathname}${target.search}${target.hash}`;
    }
  } catch {
    // Use the bounded default below.
  }

  return DEFAULT_AUTH_RETURN;
}

export function authCallbackTarget(returnTo: unknown) {
  const safeReturnTo = safePlatformReturn(returnTo);
  return `/auth/callback?returnTo=${encodeURIComponent(safeReturnTo)}`;
}

/**
 * Idea 4 — the full requests list. Only for users who have created an
 * account or are currently signed in; anonymous visitors are sent to
 * signup (see authRouteDecision below). The page itself is a static
 * route, so the middleware idea-slug gate must also exempt it (see
 * middleware.ts publicIdeaSlug) — otherwise it 404s before auth runs.
 */
export const IDEA_REQUESTS_PATH = "/ideas/requests";

export function isAuthManagedPath(pathname: string) {
  return (
    AUTH_ENTRY_PATHS.has(pathname) ||
    pathname === "/auth/callback" ||
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === IDEA_REQUESTS_PATH
  );
}

/** Sensitive auth URLs must never load consented analytics scripts. */
export function isSensitiveAuthPath(pathname: string) {
  return (
    pathname === "/email-signin" ||
    pathname.startsWith("/email-signin/") ||
    pathname === "/auth/callback" ||
    pathname.startsWith("/auth/callback/")
  );
}

export function authRouteDecision(
  url: URL,
  authenticated: boolean,
): { kind: "next" } | { kind: "redirect"; target: string } {
  const protectedRoute =
    url.pathname === "/dashboard" || url.pathname.startsWith("/dashboard/");

  if (protectedRoute && !authenticated) {
    const returnTo = safePlatformReturn(`${url.pathname}${url.search}`);
    return {
      kind: "redirect",
      target: `/login?returnTo=${encodeURIComponent(returnTo)}`,
    };
  }

  // Idea 4 — /ideas/requests is for account holders only. Unlike the
  // dashboard (which sends anonymous visitors to /login), this page
  // sends them to create an account, and returns them here afterwards:
  // safePlatformReturn already admits /ideas/requests (see
  // lib/private-paths.ts isIdeaReturnPath), so the returnTo survives
  // signup instead of silently collapsing to /dashboard.
  if (url.pathname === IDEA_REQUESTS_PATH && !authenticated) {
    const returnTo = safePlatformReturn(IDEA_REQUESTS_PATH);
    return {
      kind: "redirect",
      target: `/signup?returnTo=${encodeURIComponent(returnTo)}`,
    };
  }

  if (authenticated && (AUTH_ENTRY_PATHS.has(url.pathname) || url.pathname === "/auth/callback")) {
    // A signed-in visitor who follows "Keep this site" still needs the page to
    // render once so `PreviewClaimStash` can record the capability. The page
    // then continues to the dashboard, where the claim runs. Redirecting here
    // would drop the capability before anything could store it.
    if (AUTH_ENTRY_PATHS.has(url.pathname) && carriesClaimPreview(url)) {
      return { kind: "next" };
    }
    return {
      kind: "redirect",
      target: safePlatformReturn(url.searchParams.get("returnTo")),
    };
  }

  return { kind: "next" };
}
