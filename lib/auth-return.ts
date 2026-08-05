export const DEFAULT_AUTH_RETURN = "/dashboard";

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
    pathname === "/signin" ||
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
      target: `/signin?returnTo=${encodeURIComponent(returnTo)}`,
    };
  }

  if (
    authenticated &&
    (url.pathname === "/signin" || url.pathname === "/auth/callback")
  ) {
    return {
      kind: "redirect",
      target: safePlatformReturn(url.searchParams.get("returnTo")),
    };
  }

  return { kind: "next" };
}
