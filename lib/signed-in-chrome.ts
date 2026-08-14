export const SIGNED_IN_HREF = {
  home: "/dashboard",
  library: "/dashboard/explore",
} as const;

export const KILLED_DESTINATIONS = [
  "/dashboard/billing",
  "/dashboard/new",
  "/dashboard/projects",
] as const;

export const COLD_OBJECT_LABEL = "Choose an idea";

export function objectHomeHref(projectId: string | undefined): string {
  if (!projectId) return SIGNED_IN_HREF.home;
  return `${SIGNED_IN_HREF.home}?project=${projectId}`;
}

export const LIBRARY_TAB_VIEWS = ["saved", "interested"] as const;

export type ChromeHere = "home" | "library";

export function chromeHere(pathname: string): ChromeHere {
  if (
    pathname === SIGNED_IN_HREF.library ||
    pathname.startsWith(`${SIGNED_IN_HREF.library}/`)
  ) {
    return "library";
  }
  return "home";
}

export function shouldStripLibraryView(view: string | undefined): boolean {
  return (LIBRARY_TAB_VIEWS as readonly string[]).includes(view ?? "");
}

export function isKilledSignedInPath(pathname: string): boolean {
  return (
    pathname === "/dashboard/billing" ||
    pathname === "/dashboard/new" ||
    pathname === "/dashboard/projects" ||
    pathname.startsWith("/dashboard/projects/")
  );
}

export function canonicalSignedInReturn(
  pathname: string,
  search = "",
  hash = "",
): string {
  if (pathname.startsWith("/dashboard/projects/")) {
    const projectId = pathname
      .slice("/dashboard/projects/".length)
      .split("/")[0];
    if (projectId) return objectHomeHref(projectId);
  }
  if (isKilledSignedInPath(pathname)) {
    return SIGNED_IN_HREF.home;
  }

  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  );
  if (
    chromeHere(pathname) === "library" &&
    shouldStripLibraryView(params.get("view") ?? undefined)
  ) {
    return SIGNED_IN_HREF.library;
  }

  return `${pathname}${search}${hash}`;
}
