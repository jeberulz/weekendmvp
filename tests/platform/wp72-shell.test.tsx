import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, test, vi } from "vitest";

const nav = vi.hoisted(() => ({ pathname: "/dashboard/b/proj1" as string | null }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));

import { WorkspaceFrame, businessInitial, groupHeadingId, isRouteActive, visibleNavGroups } from "@/components/workspace/shell";
import { BusinessSwitcher, SWITCHER_LIST_ID, switcherLabel } from "@/components/workspace/shell/BusinessSwitcher";
import { listBusinesses } from "@/lib/workspace/businesses";
import { getCreditsSummary } from "@/lib/workspace/credits";
import {
  WORKSPACE_NAV_GROUPS,
  WORKSPACE_ROUTES,
  workspaceRoute,
  workspaceRoutesInGroup,
} from "@/lib/workspace/routes";

const PROJECT = "proj1";
const credits = { balance: 48, max: 50, plan: "free" } as const;
const businesses = listBusinesses({ id: PROJECT, name: "HydroTrail" });

function renderFrame(weekendActive = true): string {
  return renderToStaticMarkup(
    <WorkspaceFrame projectId={PROJECT} businesses={businesses} credits={credits} weekendActive={weekendActive}>
      <main id="workspace-main" tabIndex={-1}>
        Page
      </main>
    </WorkspaceFrame>,
  );
}

function expectIdIntegrity(markup: string) {
  const ids = [...markup.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  expect(new Set(ids).size).toBe(ids.length);
  const refs: string[] = [];
  for (const m of markup.matchAll(/\s(?:aria-describedby|aria-labelledby|aria-controls)="([^"]+)"/g)) refs.push(...m[1].split(/\s+/));
  for (const m of markup.matchAll(/\sfor="([^"]+)"/g)) refs.push(m[1]);
  for (const ref of refs) expect(ids, `dangling reference: ${ref}`).toContain(ref);
  return { ids, refs };
}

beforeEach(() => {
  nav.pathname = `/dashboard/b/${PROJECT}`;
});

describe("isRouteActive", () => {
  const team = workspaceRoute("team");
  const index = workspaceRoute("");

  test("a nested path is under its parent route", () => {
    expect(isRouteActive("/dashboard/b/x/team/brand", "x", team)).toBe(true);
    expect(isRouteActive("/dashboard/b/x/team", "x", team)).toBe(true);
    expect(isRouteActive("/dashboard/b/x/team/", "x", team)).toBe(true);
  });

  test("the index matches exactly and never lights up for child pages", () => {
    expect(isRouteActive("/dashboard/b/x", "x", index)).toBe(true);
    expect(isRouteActive("/dashboard/b/x/", "x", index)).toBe(true);
    expect(isRouteActive("/dashboard/b/x/team", "x", index)).toBe(false);
  });

  test("an encoded project id matches its encoded path", () => {
    const id = "a b/c";
    expect(isRouteActive(team.path(id), id, team)).toBe(true);
    expect(isRouteActive(`${team.path(id)}/brand`, id, team)).toBe(true);
    expect(isRouteActive(index.path(id), id, index)).toBe(true);
    expect(isRouteActive("/dashboard/b/a b/c/team", id, team)).toBe(false);
  });

  test("a sibling prefix or another project does not match", () => {
    expect(isRouteActive("/dashboard/b/x/teams", "x", team)).toBe(false);
    expect(isRouteActive("/dashboard/b/y/team", "x", team)).toBe(false);
    expect(isRouteActive(null, "x", team)).toBe(false);
  });

  test("exactly one manifest route is active for each manifest path", () => {
    for (const route of WORKSPACE_ROUTES) {
      const active = WORKSPACE_ROUTES.filter((other) => isRouteActive(route.path("x"), "x", other));
      expect(active.map((entry) => entry.id)).toEqual([route.id]);
    }
  });
});

describe("shell helpers", () => {
  test("the weekend group hides only when the weekend is over", () => {
    expect(visibleNavGroups(true).map((entry) => entry.group)).toEqual(["This weekend", "Workspace"]);
    expect(visibleNavGroups(false).map((entry) => entry.group)).toEqual(["Workspace"]);
  });

  test("group heading ids are slugs and the initial survives odd names", () => {
    expect(groupHeadingId("This weekend")).toBe("workspace-nav-group-this-weekend");
    expect(businessInitial("  hydroTrail")).toBe("H");
    expect(businessInitial("   ")).toBe("?");
  });
});

describe("data seams", () => {
  test("credits mock is typed, fixed and project-independent", async () => {
    const a = await getCreditsSummary("a");
    const b = await getCreditsSummary("b");
    expect(a).toEqual(b);
    expect(a).toEqual(credits);
  });

  test("the business list is only the current business", () => {
    expect(listBusinesses({ id: "p", name: "N" })).toEqual([{ id: "p", name: "N" }]);
  });
});

describe("WorkspaceFrame markup", () => {
  test("renders every manifest entry under its group with the right hrefs", () => {
    const markup = renderFrame();
    for (const group of WORKSPACE_NAV_GROUPS.filter((entry) => entry !== "Account")) {
      const section = markup.split(`id="${groupHeadingId(group)}"`)[1];
      expect(section, group).toBeDefined();
      const list = section.slice(section.indexOf("<ul"), section.indexOf("</ul>"));
      const hrefs = [...list.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
      expect(hrefs).toEqual(workspaceRoutesInGroup(group).map((route) => route.path(PROJECT)));
      for (const route of workspaceRoutesInGroup(group)) expect(list).toContain(`>${route.label}</a>`);
    }
  });

  test("aria-current marks only the active page", () => {
    nav.pathname = `/dashboard/b/${PROJECT}/team/brand`;
    const markup = renderFrame();
    const current = [...markup.matchAll(/<a [^>]*aria-current="page"[^>]*>([^<]*)<\/a>/g)].map((m) => m[1]);
    expect(current).toEqual(["Team HQ"]);
    nav.pathname = `/dashboard/b/${PROJECT}`;
    const index = [...renderFrame().matchAll(/<a [^>]*aria-current="page"[^>]*>([^<]*)<\/a>/g)].map((m) => m[1]);
    expect(index).toEqual(["Dashboard"]);
  });

  test("skip link targets the main landmark and comes first", () => {
    const markup = renderFrame();
    expect(markup.startsWith('<a href="#workspace-main"')).toBe(true);
    expect(markup).toContain('id="workspace-main"');
  });

  test("one nav landmark named Workspace, one main, one logo image", () => {
    const markup = renderFrame();
    expect(markup.match(/<nav\b/g)).toHaveLength(1);
    expect(markup).toContain('<nav aria-label="Workspace"');
    expect(markup.match(/<main\b/g)).toHaveLength(1);
    expect(markup.match(/role="img" aria-label="Weekend MVP"/g)).toHaveLength(1);
  });

  test("business switcher is a collapsed disclosure whose controls resolve", () => {
    const markup = renderFrame();
    expect(markup).toContain(`aria-label="${switcherLabel("HydroTrail")}"`);
    const button = markup.match(/<button[^>]*aria-controls="workspace-switcher-list"[^>]*>/);
    expect(button?.[0]).toContain('aria-expanded="false"');
    expect(markup).toContain(`id="${SWITCHER_LIST_ID}" hidden=""`);
    expect(markup).toContain("Running a second business needs Growth.");
    expect(markup).not.toContain("aria-disabled");
    expect(markup).not.toMatch(/href="[^"]*(new|pricing)[^"]*"/);
  });

  test("the mobile menu button is collapsed and controls an existing panel", () => {
    const markup = renderFrame();
    const toggle = markup.match(/<button[^>]*aria-controls="workspace-nav-panel"[^>]*>/);
    expect(toggle?.[0]).toContain('aria-expanded="false"');
    expect(markup).toContain('id="workspace-nav-panel"');
  });

  test("the closed mobile panel is hidden below lg and shown on lg", () => {
    const panel = renderFrame().match(/<div id="workspace-nav-panel"[^>]*>/);
    expect(panel?.[0]).toMatch(/class="[^"]*\bhidden\b[^"]*\blg:flex\b/);
  });

  test("Billing is the credits-card link, current on billing, with no Account group", () => {
    const markup = renderFrame();
    expect(markup).not.toContain("Account");
    expect(markup).not.toContain(groupHeadingId("Account"));
    const link = markup.match(/<a [^>]*href="\/dashboard\/b\/proj1\/billing"[^>]*>/);
    expect(link?.[0]).toContain('aria-label="Billing, 48 of 50 credits left"');
    expect(link?.[0]).not.toContain("aria-current");
    // inside the single nav
    const navHtml = markup.slice(markup.indexOf("<nav"), markup.indexOf("</nav>"));
    expect(navHtml).toContain("/dashboard/b/proj1/billing");
    nav.pathname = "/dashboard/b/proj1/billing";
    const active = renderFrame().match(/<a [^>]*href="\/dashboard\/b\/proj1\/billing"[^>]*>/);
    expect(active?.[0]).toContain('aria-current="page"');
  });

  test("the credit meter renders from the mock", () => {
    const markup = renderFrame();
    expect(markup).toContain('role="meter"');
    expect(markup).toContain('aria-valuenow="48"');
    expect(markup).toContain('aria-valuemax="50"');
    expect(markup).toContain("48 left");
    expect(markup).toContain("Free");
  });

  test("the weekend group is dropped when weekendActive is false", () => {
    const markup = renderFrame(false);
    expect(markup).not.toContain("This weekend");
    expect(markup).not.toContain("Team HQ");
    expect(markup).toContain("Dashboard");
  });

  test("id integrity holds and no inline styles are emitted", () => {
    const markup = renderFrame();
    expect(expectIdIntegrity(markup).refs.length).toBeGreaterThan(3);
    expect(markup).not.toMatch(/\sstyle=/);
  });

  test("a business switcher on its own keeps integrity", () => {
    const markup = renderToStaticMarkup(<BusinessSwitcher currentId={PROJECT} businesses={businesses} />);
    expectIdIntegrity(markup);
    expect(markup).toContain("(current)");
    expect(markup).toContain('aria-current="true"');
  });
});

describe("source guards", () => {
  const root = path.resolve(__dirname, "../..");
  const shellDir = path.join(root, "components", "workspace", "shell");
  const layoutPath = path.join(root, "app", "(launch-workspace)", "dashboard", "b", "[projectId]", "layout.tsx");

  function files(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const full = path.join(dir, name);
      return statSync(full).isDirectory() ? files(full) : [full];
    });
  }

  test("usePathname is called only in WorkspaceSidebar.tsx", () => {
    const users = files(shellDir).filter((file) => /usePathname\(/.test(readFileSync(file, "utf8")));
    expect(users.map((file) => path.basename(file))).toEqual(["WorkspaceSidebar.tsx"]);
  });

  test("the layout loads data only after the access gate", () => {
    const layout = readFileSync(layoutPath, "utf8");
    const gate = layout.indexOf("await requireWorkspaceAccess(projectId)");
    expect(gate).toBeGreaterThan(-1);
    expect(layout.indexOf("getCreditsSummary(")).toBeGreaterThan(gate);
    expect(layout.indexOf("listBusinesses(")).toBeGreaterThan(gate);
  });

  test("the data seams are server-only and the shell has no aside", () => {
    for (const file of ["credits.ts", "businesses.ts"]) {
      expect(readFileSync(path.join(root, "lib", "workspace", file), "utf8")).toContain('import "server-only"');
    }
    for (const file of files(shellDir)) expect(readFileSync(file, "utf8"), file).not.toContain("<aside");
  });
});
