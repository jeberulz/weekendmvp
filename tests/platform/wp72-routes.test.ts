import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { ROLE_KEYS } from "../../lib/workspace/contracts/roster";
import {
  WORKSPACE_DETAIL_ROUTES,
  WORKSPACE_EMPLOYEE_ROLES,
  WORKSPACE_ROUTES,
  workspaceEmployee,
  workspaceEmployeePath,
  workspacePath,
  workspaceRoutesInGroup,
} from "../../lib/workspace/routes";

const root = fileURLToPath(new URL("../../", import.meta.url));
const routeRoot = path.join(root, "app", "(launch-workspace)", "dashboard", "b", "[projectId]");
const read = (relative: string) => readFileSync(path.join(routeRoot, relative), "utf8");

/** Every folder under the route root that holds a page.tsx, as a slug ("" is the index). */
function pageSegments(dir: string, prefix = ""): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (!statSync(full).isDirectory()) {
      if (entry === "page.tsx") found.push(prefix);
      continue;
    }
    // Next.js private folders (`_name`) never become routes.
    if (entry.startsWith("_")) continue;
    found.push(...pageSegments(full, prefix === "" ? entry : `${prefix}/${entry}`));
  }
  return found;
}

/** Every file under a directory, recursively. */
function allFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    return statSync(full).isDirectory() ? allFiles(full) : [full];
  });
}

describe("WP72-S1 workspace route manifest", () => {
  test("every manifest entry has a route folder, and every route folder is in the manifest", () => {
    const expected = [
      ...WORKSPACE_ROUTES.map((entry) => entry.slug),
      ...WORKSPACE_DETAIL_ROUTES.map((entry) => entry.segment),
    ].sort();
    expect(pageSegments(routeRoot).sort()).toEqual(expected);
  });

  test("ships exactly the boarded pages from extract §9.5, in canvas nav order", () => {
    expect(workspaceRoutesInGroup("This weekend").map((entry) => entry.label)).toEqual([
      "Team HQ", "Launch plan", "Build pack", "Brand kit",
    ]);
    expect(workspaceRoutesInGroup("Workspace").map((entry) => entry.label)).toEqual([
      "Dashboard", "Tasks", "Email", "Ads", "Studio", "Outbound", "Social", "Files", "Settings",
    ]);
    expect(workspaceRoutesInGroup("Account").map((entry) => entry.label)).toEqual(["Billing"]);
    for (const absent of ["chat", "analytics", "products", "orders", "customers", "legal", "activity"]) {
      expect(WORKSPACE_ROUTES.some((entry) => entry.slug === absent)).toBe(false);
    }
    expect(new Set(WORKSPACE_ROUTES.map((entry) => entry.id)).size).toBe(WORKSPACE_ROUTES.length);
    expect(new Set(WORKSPACE_ROUTES.map((entry) => entry.slug)).size).toBe(WORKSPACE_ROUTES.length);
  });

  test("path builders stay under /dashboard/b and encode the project id", () => {
    const team = WORKSPACE_ROUTES.find((entry) => entry.slug === "team");
    const dashboard = WORKSPACE_ROUTES.find((entry) => entry.slug === "");
    expect(dashboard?.path("abc123")).toBe("/dashboard/b/abc123");
    expect(team?.path("abc123")).toBe("/dashboard/b/abc123/team");
    expect(workspacePath("a/b?c")).toBe("/dashboard/b/a%2Fb%3Fc");
    expect(workspaceEmployeePath("abc123", "brand")).toBe("/dashboard/b/abc123/team/brand");
  });

  test("employee segments accept roster role keys only, never the Crew Lead", () => {
    expect(WORKSPACE_EMPLOYEE_ROLES.map((entry) => entry.key)).toEqual(ROLE_KEYS.filter((key) => key !== "lead"));
    expect(workspaceEmployee("brand")).toMatchObject({ employeeName: "Iris", label: "Brand" });
    for (const bad of ["lead", "Brand", "brand ", "", "../brand", "constructor", "__proto__"]) {
      expect(workspaceEmployee(bad), bad).toBeNull();
    }
  });
});

describe("WP72-S1 route scaffold stays dormant and private", () => {
  test("lives in its own route group so the legacy dashboard shell is not an ancestor", () => {
    expect(existsSync(path.join(root, "app", "dashboard", "b"))).toBe(false);
    const layout = read("layout.tsx");
    expect(layout).toContain("await requireWorkspaceAccess(projectId)");
    expect(layout).not.toContain("<WorkspaceShell");
    expect(layout).not.toContain("components/platform/shell");
    expect(layout).toMatch(/robots:\s*\{\s*index:\s*false,\s*follow:\s*false/);
    expect(layout).toContain("export const instant = false");
    expect(layout.match(/<main\b/g)).toHaveLength(1);
  });

  // Hard 404s only. A `loading.*` file or a <Suspense> boundary above the gate
  // makes Next.js stream a shell first, so a later notFound() is a soft 404
  // served with status 200. A cached ("use cache") segment could also replay
  // one visitor's allowed render to someone the gate would refuse.
  test("nothing above the gate can turn a denial into a soft 404", () => {
    const groupRoot = path.join(root, "app", "(launch-workspace)");
    const files = allFiles(groupRoot);
    expect(files.length).toBeGreaterThan(15);
    expect(files.filter((file) => /^loading\./.test(path.basename(file)))).toEqual([]);
    for (const file of allFiles(routeRoot)) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toContain('"use cache"');
      expect(source, file).not.toContain("'use cache'");
    }
    const layout = read("layout.tsx");
    const gateAt = layout.indexOf("await requireWorkspaceAccess(projectId)");
    expect(gateAt).toBeGreaterThan(-1);
    const suspenseAt = layout.indexOf("<Suspense");
    expect(suspenseAt === -1 || suspenseAt > gateAt, "Suspense opens above the gate").toBe(true);
    // Ancestor layouts must not open a boundary either.
    const ancestors = [path.join(root, "app", "layout.tsx"), ...files.filter((file) =>
      path.basename(file).startsWith("layout.") && !file.startsWith(routeRoot))];
    for (const file of ancestors) {
      expect(readFileSync(file, "utf8"), file).not.toContain("<Suspense");
    }
  });

  test("every page gates itself, keeps noindex metadata and authors no landmark", () => {
    const placeholder = read("_scaffold/placeholder.tsx");
    expect(placeholder).toContain("await requireWorkspaceAccess(projectId)");
    expect(placeholder).toMatch(/index: false,\s*follow: false/);
    for (const segment of pageSegments(routeRoot)) {
      const source = read(path.join(segment, "page.tsx"));
      expect(source, segment).toContain("export async function generateMetadata");
      expect(source, segment).toContain("export const instant = false");
      expect(source, segment).not.toMatch(/<main\b/);
      expect(
        source.includes("<RoutePlaceholder") || source.includes("await requireWorkspaceAccess(projectId)"),
        segment,
      ).toBe(true);
    }
    const employee = read("team/[employee]/page.tsx");
    expect(employee).toContain("await requireWorkspaceAccess(projectId)");
    expect(employee).toContain("if (employee === null) notFound()");
  });

  test("the server gate maps every refusal to notFound", () => {
    const gate = readFileSync(path.join(root, "lib", "workspace", "access.ts"), "utf8");
    expect(gate).toContain('import "server-only"');
    expect(gate).toContain("api.workspace.access.getWorkspaceAccess");
    expect(gate).toContain("if (!token) notFound()");
    expect(gate).toContain("unstable_rethrow(error)");
    expect(gate).toContain("if (!access.allowed) notFound()");
  });
});
