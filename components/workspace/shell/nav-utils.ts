import {
  WORKSPACE_NAV_GROUPS,
  workspaceRoutesInGroup,
  type WorkspaceNavGroup,
  type WorkspaceRoute,
} from "@/lib/workspace/routes";

/** Stable DOM id for a nav group heading, e.g. `workspace-nav-group-this-weekend`. */
export function groupHeadingId(group: WorkspaceNavGroup): string {
  return `workspace-nav-group-${group.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function trimTrailingSlash(value: string): string {
  return value.length > 1 && value.endsWith("/") ? value.slice(0, -1) : value;
}

/**
 * True when `pathname` is this route or lies under it. The index (Dashboard)
 * matches exactly, otherwise it would stay active on every page.
 * `/dashboard/b/x/team/brand` is under Team HQ.
 */
export function isRouteActive(pathname: string | null, projectId: string, route: WorkspaceRoute): boolean {
  if (pathname === null) return false;
  const current = trimTrailingSlash(pathname);
  const href = route.path(projectId);
  if (route.slug === "") return current === href;
  return current === href || current.startsWith(`${href}/`);
}

/**
 * Groups to render as nav rows, in manifest order. Account (Billing) is not a
 * nav group: Billing is the credits-card link in the footer (canvas 1.7). The
 * weekend group hides when the weekend is over.
 */
export function visibleNavGroups(weekendActive: boolean): readonly {
  readonly group: WorkspaceNavGroup;
  readonly routes: readonly WorkspaceRoute[];
}[] {
  return WORKSPACE_NAV_GROUPS.filter((group) => group !== "Account" && (weekendActive || group !== "This weekend"))
    .map((group) => ({ group, routes: workspaceRoutesInGroup(group) }))
    .filter((entry) => entry.routes.length > 0);
}

export function businessInitial(name: string): string {
  const first = Array.from(name.trim())[0];
  return first === undefined ? "?" : first.toUpperCase();
}
