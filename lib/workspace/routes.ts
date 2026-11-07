/**
 * WP72-S1 workspace route manifest: the one list the workspace nav (S2) and
 * the route scaffold under `/dashboard/b/[projectId]` both read.
 *
 * Entries and order follow the canvas extract (`docs/wp/wp72-canvas-extract.md`
 * §1, §2 and orchestrator decision §9.5): only pages with a board ship. Chat,
 * Analytics, Products, Orders, Customers, Legal and Activity stay out until a
 * WP designs them. Billing is the credits-card link in the nav footer, so it
 * sits in its own `Account` group rather than a nav row group.
 */
import { ROLE_CATALOGUE, type RoleCatalogueEntry } from "@/convex/crew/roles";
import type { RoleKey } from "@/lib/workspace/contracts/roster";

export const WORKSPACE_BASE_PATH = "/dashboard/b";

export type WorkspaceNavGroup = "This weekend" | "Workspace" | "Account";

export const WORKSPACE_NAV_GROUPS: readonly WorkspaceNavGroup[] = [
  "This weekend",
  "Workspace",
  "Account",
];

/** Route segment under `/dashboard/b/[projectId]`; `""` is the index (Dashboard). */
export type WorkspaceRouteSlug =
  | ""
  | "team"
  | "launch"
  | "build-pack"
  | "brand"
  | "tasks"
  | "email"
  | "ads"
  | "studio"
  | "outbound"
  | "social"
  | "files"
  | "settings"
  | "billing";

/** The canvas nav `active` id for each page (extract §1). */
export type WorkspaceNavId =
  | "dashboard"
  | "team"
  | "launch"
  | "pack"
  | "brand"
  | "tasks"
  | "email"
  | "ads"
  | "studio"
  | "outbound"
  | "social"
  | "files"
  | "settings"
  | "billing";

export type WorkspaceRoute = {
  readonly id: WorkspaceNavId;
  readonly slug: WorkspaceRouteSlug;
  readonly label: string;
  readonly group: WorkspaceNavGroup;
  /**
   * L1-C2: not built for the L1 private beta. The nav labels the row "Coming
   * soon" in visible text and the page renders the coming-soon placeholder.
   */
  readonly comingSoon: boolean;
  readonly path: (projectId: string) => string;
};

/** `/dashboard/b/{projectId}` plus an optional segment, with the id encoded. */
export function workspacePath(projectId: string, slug: string = ""): string {
  const base = `${WORKSPACE_BASE_PATH}/${encodeURIComponent(projectId)}`;
  return slug === "" ? base : `${base}/${slug}`;
}

type RouteState = "built" | "coming_soon";

function route(
  id: WorkspaceNavId,
  slug: WorkspaceRouteSlug,
  label: string,
  group: WorkspaceNavGroup,
  state: RouteState,
): WorkspaceRoute {
  return Object.freeze({
    id,
    slug,
    label,
    group,
    comingSoon: state === "coming_soon",
    path: (projectId: string) => workspacePath(projectId, slug),
  });
}

/**
 * Nav order within each group matches the canvas Nav board. L1 (the
 * 2026-11-09 private beta, `docs/wp/l1-release-plan.md`) ships Team HQ (the
 * roster and the reviews waiting, plus a page per specialist at
 * `team/{role}`), Brand kit, Dashboard (Wren chat), Email, Social and Files;
 * every other row is "Coming soon".
 */
export const WORKSPACE_ROUTES: readonly WorkspaceRoute[] = Object.freeze([
  route("team", "team", "Team HQ", "This weekend", "built"),
  route("launch", "launch", "Launch plan", "This weekend", "coming_soon"),
  route("pack", "build-pack", "Build pack", "This weekend", "coming_soon"),
  route("brand", "brand", "Brand kit", "This weekend", "built"),
  route("dashboard", "", "Dashboard", "Workspace", "built"),
  route("tasks", "tasks", "Tasks", "Workspace", "coming_soon"),
  route("email", "email", "Email", "Workspace", "built"),
  route("ads", "ads", "Ads", "Workspace", "coming_soon"),
  route("studio", "studio", "Studio", "Workspace", "coming_soon"),
  route("outbound", "outbound", "Outbound", "Workspace", "coming_soon"),
  route("social", "social", "Social", "Workspace", "built"),
  route("files", "files", "Files", "Workspace", "built"),
  route("settings", "settings", "Settings", "Workspace", "coming_soon"),
  route("billing", "billing", "Billing", "Account", "coming_soon"),
]);

/** The visible nav and page label for an unbuilt area (L1-C2). */
export const COMING_SOON_LABEL = "Coming soon";

export function workspaceRoute(slug: WorkspaceRouteSlug): WorkspaceRoute {
  const found = WORKSPACE_ROUTES.find((entry) => entry.slug === slug);
  if (found === undefined) throw new Error(`Unknown workspace route: ${slug}`);
  return found;
}

export function workspaceRoutesInGroup(group: WorkspaceNavGroup): readonly WorkspaceRoute[] {
  return WORKSPACE_ROUTES.filter((entry) => entry.group === group);
}

/**
 * Detail routes that are not nav rows. `team/[employee]` is one workstream
 * panel per hired specialist, reached from Team HQ.
 */
export const WORKSPACE_DETAIL_ROUTES = Object.freeze([
  Object.freeze({ segment: "team/[employee]", parent: "team" as const }),
]);

/**
 * Specialists with a workstream page: every catalogue role except the Crew
 * Lead, who has no workstream (chat stays with the lead, extract §4).
 */
export const WORKSPACE_EMPLOYEE_ROLES: readonly RoleCatalogueEntry[] = Object.freeze(
  ROLE_CATALOGUE.filter((entry) => entry.key !== "lead"),
);

export function workspaceEmployee(value: string): RoleCatalogueEntry | null {
  return WORKSPACE_EMPLOYEE_ROLES.find((entry) => entry.key === value) ?? null;
}

export function workspaceEmployeePath(projectId: string, roleKey: Exclude<RoleKey, "lead">): string {
  return workspacePath(projectId, `team/${roleKey}`);
}
