/**
 * Where a signed-in member should return from a public `/ideas/{slug}` page.
 * Prefer an explicit `?from=` query; fall back to a same-origin dashboard
 * referrer; otherwise Home. Not an authorization check.
 */

export type IdeaMemberReturn = {
  href: string;
  /** Visible label including the leading cue, e.g. "Back to Home". */
  label: string;
};

const DEFAULT_RETURN: IdeaMemberReturn = {
  href: "/dashboard",
  label: "Back to Home",
};

const FROM_TARGETS: Record<string, IdeaMemberReturn> = {
  home: DEFAULT_RETURN,
  ideas: { href: "/dashboard/explore", label: "Back to Explore" },
  explore: { href: "/dashboard/explore", label: "Back to Explore" },
  saved: { href: "/dashboard/saved", label: "Back to Saved" },
  builds: { href: "/dashboard/builds", label: "Back to Builds" },
};

/** Parse a bounded `?from=` value used on idea pages. */
export function ideaReturnFromParam(value: string | null): IdeaMemberReturn | null {
  if (!value) return null;
  return FROM_TARGETS[value.toLowerCase()] ?? null;
}

/**
 * Map a same-origin referrer pathname under `/dashboard` to a return target.
 * External and non-dashboard paths are ignored.
 */
export function ideaReturnFromReferrerPath(
  pathname: string | null,
): IdeaMemberReturn | null {
  if (!pathname) return null;
  if (pathname === "/dashboard" || pathname === "/dashboard/") {
    return DEFAULT_RETURN;
  }
  if (
    pathname === "/dashboard/explore" ||
    pathname.startsWith("/dashboard/explore/")
  ) {
    return FROM_TARGETS.explore;
  }
  if (
    pathname === "/dashboard/saved" ||
    pathname.startsWith("/dashboard/saved/")
  ) {
    return FROM_TARGETS.saved;
  }
  if (
    pathname === "/dashboard/builds" ||
    pathname.startsWith("/dashboard/builds/")
  ) {
    return FROM_TARGETS.builds;
  }
  // Other /dashboard/* (billing, settings) still return to Home.
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    return DEFAULT_RETURN;
  }
  return null;
}

/** Prefer `?from=`, then a safe dashboard referrer path, else Home. */
export function resolveIdeaMemberReturn(input: {
  from: string | null;
  referrerPath: string | null;
}): IdeaMemberReturn {
  return (
    ideaReturnFromParam(input.from) ??
    ideaReturnFromReferrerPath(input.referrerPath) ??
    DEFAULT_RETURN
  );
}

/**
 * Extract a same-origin pathname from `document.referrer`. Returns null when
 * the referrer is missing, cross-origin, or unparseable.
 */
export function sameOriginReferrerPath(
  referrer: string,
  currentOrigin: string,
): string | null {
  if (!referrer) return null;
  try {
    const url = new URL(referrer);
    if (url.origin !== currentOrigin) return null;
    return url.pathname;
  } catch {
    return null;
  }
}
