import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

// L1-C2. Unbuilt workspace areas say "Coming soon" in words, in the nav and
// on their page; built L1 areas never do; no placeholder claims a state the
// page does not check.

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard/b/proj1", notFound: () => { throw new Error("404"); } }));
vi.mock("@/lib/workspace/access", () => ({
  requireWorkspaceAccess: async (projectId: string) => ({ _id: projectId, name: "HydroTrail" }),
}));

import {
  COMING_SOON_LINES,
  PENDING_PAGE_LINES,
  PlaceholderBody,
  RoutePlaceholder,
} from "@/app/(launch-workspace)/dashboard/b/[projectId]/_scaffold/placeholder";
import { WorkspaceFrame } from "@/components/workspace/shell";
import { REVIEW_TARGETS, reviewHref } from "@/lib/workspace/reviews";
import { ARTIFACT_KINDS } from "@/lib/workspace/contracts/artifacts";
import { COMING_SOON_LABEL, WORKSPACE_ROUTES, workspaceRoute, type WorkspaceRouteSlug } from "@/lib/workspace/routes";

const root = path.resolve(__dirname, "../..");
const routeRoot = path.join(root, "app", "(launch-workspace)", "dashboard", "b", "[projectId]");

/** The L1 plan (`docs/wp/l1-release-plan.md`): what ships Monday. */
const BUILT: readonly WorkspaceRouteSlug[] = ["team", "brand", "", "email", "social", "files"];
const COMING_SOON: readonly WorkspaceRouteSlug[] = ["launch", "build-pack", "tasks", "ads", "studio", "outbound", "settings", "billing"];

/** Claims a placeholder cannot make: it checks nothing. */
const STATE_CLAIMS = [/nothing here/i, /nobody needs you/i, /no emails yet/i, /no account yet/i, /\bunlocks once\b/i, /right now/i];

const text = (markup: string) => markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

describe("L1-C2 the route manifest", () => {
  test("exactly the unbuilt areas are coming soon", () => {
    expect(WORKSPACE_ROUTES.filter((route) => route.comingSoon).map((route) => route.slug).sort()).toEqual([...COMING_SOON].sort());
    expect(WORKSPACE_ROUTES.filter((route) => !route.comingSoon).map((route) => route.slug).sort()).toEqual([...BUILT].sort());
    expect(COMING_SOON_LABEL).toBe("Coming soon");
  });
});

describe("L1-C2 the workspace nav", () => {
  const markup = renderToStaticMarkup(
    <WorkspaceFrame projectId="proj1" businesses={[{ id: "proj1", name: "HydroTrail" }]} credits={{ balance: 48, max: 50, plan: "free" }}>
      <main id="workspace-main" tabIndex={-1} />
    </WorkspaceFrame>,
  );
  const links = [...markup.matchAll(/<a [^>]*href="\/dashboard\/b\/proj1([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)]
    .map((match) => ({ slug: match[1].replace(/^\//, ""), text: text(match[2]) }));

  test.each(COMING_SOON.filter((slug) => slug !== "billing"))("%s is labelled Coming soon in visible text", (slug) => {
    expect(links.find((link) => link.slug === slug)?.text).toBe(`${workspaceRoute(slug).label} Coming soon`);
  });

  test.each(BUILT)("%j never says coming soon", (slug) => {
    // The index path is also the business switcher's link, so check every link to it.
    const matching = links.filter((entry) => entry.slug === slug);
    expect(matching.map((entry) => entry.text)).toContain(workspaceRoute(slug).label);
    for (const entry of matching) expect(entry.text).not.toContain("Coming soon");
  });

  test("the credits-and-billing card says Coming soon in visible text", () => {
    const billing = links.find((link) => link.slug === "billing");
    expect(billing?.text).toContain("Credits and billing");
    expect(billing?.text).toContain("Coming soon");
    expect(billing?.text).not.toContain("left");
  });
});

describe("L1-C2 placeholder pages", () => {
  const page = async (slug: WorkspaceRouteSlug) =>
    text(renderToStaticMarkup(await RoutePlaceholder({ params: Promise.resolve({ projectId: "proj1" }), slug })));

  test.each(COMING_SOON)("%s says Coming soon and what it will do", async (slug) => {
    const body = await page(slug);
    expect(body).toContain("Coming soon");
    expect(COMING_SOON_LINES[slug]).toBeDefined();
    expect(body).toContain(COMING_SOON_LINES[slug] ?? "missing");
    expect((COMING_SOON_LINES[slug] ?? "").split(/[.!?](\s|$)/).filter((part) => part.trim().length > 1)).toHaveLength(1);
  });

  test.each(["team", "brand"] as const)("%s is truthful: no coming soon, no state it does not check", async (slug) => {
    const body = await page(slug);
    expect(body).not.toContain("Coming soon");
    expect(body).toContain(PENDING_PAGE_LINES[slug] ?? "missing");
    for (const claim of STATE_CLAIMS) expect(body).not.toMatch(claim);
  });

  test("exactly the built pages that still render the placeholder have a pending line", () => {
    const usesPlaceholder = BUILT.filter((slug) => slug !== "").filter((slug) =>
      readFileSync(path.join(routeRoot, slug, "page.tsx"), "utf8").includes("<RoutePlaceholder"));
    expect(Object.keys(PENDING_PAGE_LINES).sort()).toEqual([...usesPlaceholder].sort());
  });

  test("Social is its real page (the pack panel), not the placeholder", () => {
    const social = readFileSync(path.join(routeRoot, "social", "page.tsx"), "utf8");
    expect(social).toContain("<SocialPackPanel");
    expect(social).not.toContain("RoutePlaceholder");
    expect(social).not.toContain("Coming soon");
  });

  test("a built page with no pending line says it is not ready rather than inventing a line", async () => {
    // Email has its own page, so it has no pending line; rendered through the placeholder it falls back to coming soon.
    const body = await page("email");
    expect(body).toContain("Coming soon");
    expect(body).toContain("Email is not ready yet.");
  });

  test("no placeholder line claims a state", () => {
    for (const line of [...Object.values(COMING_SOON_LINES), ...Object.values(PENDING_PAGE_LINES)]) {
      for (const claim of STATE_CLAIMS) expect(line).not.toMatch(claim);
    }
    const source = readFileSync(path.join(routeRoot, "_scaffold", "placeholder.tsx"), "utf8");
    for (const claim of STATE_CLAIMS) expect(source).not.toMatch(claim);
  });

  test("the body shows Coming soon only when asked", () => {
    expect(renderToStaticMarkup(<PlaceholderBody eyebrow="E" heading="H" emptyState="Line." comingSoon />)).toContain("Coming soon");
    expect(renderToStaticMarkup(<PlaceholderBody eyebrow="E" heading="H" emptyState="Line." />)).not.toContain("Coming soon");
  });

  test("Team pages beyond the roster are coming soon", () => {
    const employee = readFileSync(path.join(routeRoot, "team", "[employee]", "page.tsx"), "utf8");
    expect(employee).toMatch(/<PlaceholderBody[\s\S]*comingSoon[\s\S]*\/>/);
    for (const claim of STATE_CLAIMS) expect(employee).not.toMatch(claim);
  });
});

describe("L1-C6 review targets point at built workspace routes", () => {
  test.each(ARTIFACT_KINDS)("%s", (kind) => {
    const target = REVIEW_TARGETS[kind];
    const route = workspaceRoute(target.slug);
    expect(route.comingSoon).toBe(false);
    expect(reviewHref("p 1", kind)).toBe(route.path("p 1"));
  });

  test("the pages that ship a review get their own route; the blueprint goes to Team HQ", () => {
    expect(REVIEW_TARGETS.brand_kit).toEqual({ title: "Brand kit", slug: "brand" });
    expect(REVIEW_TARGETS.email_sequence).toEqual({ title: "Waitlist emails", slug: "email" });
    expect(REVIEW_TARGETS.social_pack).toEqual({ title: "Social posts", slug: "social" });
    expect(REVIEW_TARGETS.blueprint).toEqual({ title: "Blueprint", slug: "team" });
  });
});
