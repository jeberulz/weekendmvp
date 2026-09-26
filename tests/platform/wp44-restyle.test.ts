/// <reference types="vite/client" />

import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import billingPageSource from "../../app/dashboard/billing/page.tsx?raw";
import projectsPageSource from "../../app/dashboard/projects/page.tsx?raw";
import planSource from "../../components/platform/billing/PlanAndBilling.tsx?raw";
import projectListSource from "../../components/platform/projects/ProjectList.tsx?raw";
import projectWorkspaceSource from "../../components/platform/projects/ProjectWorkspace.tsx?raw";
import shellSource from "../../components/platform/shell/WorkspaceShell.tsx?raw";
import { PLANS, buildersHubUiEnabled } from "../../convex/platform/plans";

// Vite empties CSS imported with ?raw, so read it from disk.
const globalsCss = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");
const withoutComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/^\s*\/\/.*$/gm, "");

const dashboardRoutes = import.meta.glob("../../app/dashboard/**/*.tsx", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const platformComponents = import.meta.glob("../../components/platform/**/*.tsx", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

// Kept on purpose, unrendered, for when credit packs return (R9).
const PARKED = new Set(["../../components/platform/billing/BillingWorkspace.tsx"]);
const surfaces = Object.entries({ ...dashboardRoutes, ...platformComponents }).filter(
  ([path]) => !PARKED.has(path),
);

describe("WP44-S7 every dashboard route is on the research-desk theme", () => {
  test("no dark-theme classes remain in routes or platform components", () => {
    expect(surfaces.length).toBeGreaterThan(30);
    for (const [path, source] of surfaces) {
      expect(source, path).not.toContain("#050505");
      expect(source, path).not.toMatch(/\bzinc-\d/);
      expect(source, path).not.toMatch(/\bwhite\/(\d|\[)/);
      expect(source, path).not.toMatch(/\b(amber|emerald)-\d/);
    }
  });

  test("the transitional dark surface is gone and shadcn controls read light", () => {
    expect(Object.keys(platformComponents).some((path) => path.includes("LegacyDarkSurface"))).toBe(false);
    expect(shellSource).toContain('className="theme-desk min-h-dvh bg-home-paper');
    expect(globalsCss).toMatch(/\.theme-desk \{[^}]*--primary: #1a1814;/);
    // Field borders need 3:1 against the card (WCAG 1.4.11).
    expect(globalsCss).toMatch(/\.theme-desk \{[^}]*--input: #6b6457;/);
  });

  test("loading states announce through role=status", () => {
    for (const [path, source] of surfaces) {
      expect(source, path).not.toMatch(/<div(?![^>]*\brole=)[^>]*aria-label=/);
    }
  });
});

describe("WP44-S7 Plan and billing", () => {
  test("is titled Plan and billing and leaves the only main to the shell", () => {
    expect(billingPageSource).toContain('title: "Plan and billing"');
    expect(billingPageSource).toMatch(/robots:\s*\{\s*index:\s*false/);
    expect(billingPageSource).not.toMatch(/<main\b/);
    expect(planSource).not.toMatch(/<main\b/);
    expect(planSource).toContain("Plan and billing");
  });

  test("shows the Free plan, and Builder's Hub only behind its flag (S10)", () => {
    expect(planSource).toContain("Current plan");
    // S10: flag on swaps the Free card for the comparison table.
    expect(planSource).toContain("{showBuildersHub ? (");
    expect(planSource).toContain("<PlanComparison />");
    expect(billingPageSource).toContain("buildersHubUiEnabled(process.env.NEXT_PUBLIC_BUILDERS_HUB)");
    expect(buildersHubUiEnabled(undefined)).toBe(false);
    expect(buildersHubUiEnabled("true")).toBe(false);
    expect(buildersHubUiEnabled("on")).toBe(true);
  });

  test("credit packs are hidden, not deleted (R9)", () => {
    expect(billingPageSource).not.toContain("BillingWorkspace");
    expect(billingPageSource).not.toContain("PLATFORM_CREDIT_PACKS");
    expect(withoutComments(planSource)).not.toMatch(/credit|hosting|publish/i);
    expect(Object.keys(platformComponents)).toContain(
      "../../components/platform/billing/BillingWorkspace.tsx",
    );
  });

  test("the plan constant owns the name, price and id", () => {
    expect(PLANS.builders_hub.id).toBe("builders_hub");
    expect(PLANS.builders_hub.name).toBe("Builder’s Hub");
    expect(PLANS.builders_hub.priceMonthlyUsd).toBe(29);
    expect(PLANS.builders_hub.priceLabel).toContain("monthly");
    expect(Object.keys(PLANS)).not.toContain("builder");
  });
});

describe("WP44-S7 parked entry points", () => {
  test("no dashboard surface links to projects or intake (R4, R5)", () => {
    for (const [path, source] of surfaces) {
      if (/\/(projects|intake)\//.test(path) || /\/dashboard\/(projects|new)\//.test(path)) continue;
      expect(source, path).not.toContain('"/dashboard/projects');
      expect(source, path).not.toContain('"/dashboard/new');
      expect(source, path).not.toContain("`/dashboard/projects");
    }
    expect(projectsPageSource).not.toContain("/dashboard/new");
    expect(projectListSource).not.toContain("/dashboard/new");
  });

  test("the project cockpit hides publish and credits without touching the logic", () => {
    expect(projectWorkspaceSource).toContain("const SITE_PUBLISHING_PARKED = true;");
    expect(projectWorkspaceSource).toContain('{!SITE_PUBLISHING_PARKED && control.kind !== "hidden" ? (');
    expect(projectWorkspaceSource).toContain('SITE_PUBLISHING_PARKED ? "skip" : { historyLimit: 1 }');
    expect(projectWorkspaceSource).toContain("api.platform.sites.publish.publish");
  });
});
