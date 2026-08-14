/// <reference types="vite/client" />

import { describe, expect, test } from "vitest";
import accountMenuSource from "../../components/platform/shell/AccountMenu.tsx?raw";
import billingPageSource from "../../app/dashboard/billing/page.tsx?raw";
import dashboardLayoutSource from "../../app/dashboard/layout.tsx?raw";
import explorePageSource from "../../app/dashboard/explore/page.tsx?raw";
import newPageSource from "../../app/dashboard/new/page.tsx?raw";
import projectsPageSource from "../../app/dashboard/projects/page.tsx?raw";
import projectPageSource from "../../app/dashboard/projects/[projectId]/page.tsx?raw";
import shellSource from "../../components/platform/shell/SignedInShell.tsx?raw";
import signOutSource from "../../app/dashboard/SignOutButton.tsx?raw";

describe("signed-in product chrome", () => {
  test("keeps the request-time auth boundary and private metadata", () => {
    expect(dashboardLayoutSource).toContain("<AuthPlatformProvider>");
    expect(dashboardLayoutSource).toContain("<SignedInShell>");
    expect(dashboardLayoutSource).not.toContain("WorkspaceShell");
    expect(shellSource).toContain("theme-cream");
    expect(dashboardLayoutSource).toContain("index: false");
    expect(dashboardLayoutSource).toContain("noarchive: true");
    expect(dashboardLayoutSource).toContain("nocache: true");
  });

  test("owns one main landmark and one desktop product bar", () => {
    expect(shellSource.match(/<main\b/g)).toHaveLength(1);
    expect(shellSource).toContain('href="#signed-in-main"');
    expect(shellSource).toContain('aria-current={here ? "page" : undefined}');
    expect(shellSource).toContain("Library");
    expect(shellSource).toContain("AccountMenu");
    expect(shellSource).not.toContain("Workspace");
    expect(shellSource).not.toContain("lg:pl-[19.5rem]");
    expect(shellSource).not.toContain("Search the idea library");
  });

  test("does not expose killed chrome destinations", () => {
    for (const route of [
      "/dashboard/billing",
      "/dashboard/new",
      "/dashboard/projects",
      "view=saved",
      "view=interested",
    ]) {
      expect(shellSource).not.toContain(route);
    }
    expect(shellSource).not.toContain("Billing");
    expect(shellSource).not.toContain("Saved");
    expect(shellSource).not.toContain("Interested");
    expect(shellSource).not.toContain("New idea");
  });

  test("sign out lands on public home", () => {
    expect(signOutSource).toContain('router.replace("/")');
    expect(signOutSource).not.toContain('router.replace("/signin")');
    expect(accountMenuSource).toContain("SignOutButton");
    expect(accountMenuSource).toContain("user?.email");
  });

  test("kill-map routes redirect home and drop their old workspaces", () => {
    expect(billingPageSource).toContain("redirect(SIGNED_IN_HREF.home)");
    expect(billingPageSource).not.toContain("BillingWorkspace");
    expect(newPageSource).toContain("redirect(SIGNED_IN_HREF.home)");
    expect(newPageSource).not.toContain("OwnIdeaIntake");
    expect(projectsPageSource).toContain("redirect(SIGNED_IN_HREF.home)");
    expect(projectPageSource).toContain("redirect(objectHomeHref(projectId))");
    expect(explorePageSource).toContain("shouldStripLibraryView(view)");
  });
});

