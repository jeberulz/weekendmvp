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

/** Restrict post-auth navigation to the private platform namespace. */
export function safePlatformReturn(value: unknown) {
  if (typeof value !== "string" || value.includes("\\")) {
    return DEFAULT_AUTH_RETURN;
  }

  try {
    const target = new URL(value, "https://platform.weekendmvp.invalid");
    if (
      target.origin === "https://platform.weekendmvp.invalid" &&
      (target.pathname === "/dashboard" ||
        target.pathname.startsWith("/dashboard/"))
    ) {
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

export function isAuthManagedPath(pathname: string) {
  return (
    AUTH_ENTRY_PATHS.has(pathname) ||
    pathname === "/auth/callback" ||
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/")
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
