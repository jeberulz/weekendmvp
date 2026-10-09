/// <reference types="vite/client" />

import { describe, expect, test } from "vitest";
import {
  ideaReturnFromParam,
  ideaReturnFromReferrerPath,
  resolveIdeaMemberReturn,
  sameOriginReferrerPath,
} from "../../lib/idea-member-return";
import layoutSource from "../../app/ideas/[slug]/layout.tsx?raw";
import pageSource from "../../app/ideas/[slug]/page.tsx?raw";
import collectionSource from "../../app/ideas/[slug]/collection.tsx?raw";
import publicShellSource from "../../components/public/PublicShell.tsx?raw";
import pageNavSource from "../../components/ideas/IdeaPageNav.tsx?raw";
import memberNavSource from "../../components/ideas/IdeaMemberNav.tsx?raw";
import accountSource from "../../components/ideas/IdeaAccountMenu.tsx?raw";
import crumbsSource from "../../components/ideas/IdeaBreadcrumbs.tsx?raw";
import backSource from "../../components/ideas/IdeaBackLink.tsx?raw";
import sidebarSource from "../../components/ideas/IdeaSidebar.tsx?raw";
import { PRIMARY_NAV } from "../../components/platform/shell/workspace-current";

describe("idea member return targets", () => {
  test("maps bounded ?from= values", () => {
    expect(ideaReturnFromParam("home")).toEqual({
      href: "/dashboard",
      label: "Back to Home",
    });
    expect(ideaReturnFromParam("explore")?.href).toBe("/dashboard/explore");
    expect(ideaReturnFromParam("ideas")?.label).toBe("Back to Explore");
    expect(ideaReturnFromParam("builds")?.href).toBe("/dashboard/builds");
    expect(ideaReturnFromParam("saved")?.href).toBe("/dashboard/saved");
    expect(ideaReturnFromParam("evil")).toBeNull();
    expect(ideaReturnFromParam(null)).toBeNull();
  });

  test("maps same-origin dashboard referrer paths", () => {
    expect(ideaReturnFromReferrerPath("/dashboard")?.label).toBe("Back to Home");
    expect(ideaReturnFromReferrerPath("/dashboard/explore")?.href).toBe(
      "/dashboard/explore",
    );
    expect(ideaReturnFromReferrerPath("/dashboard/builds/new")?.href).toBe(
      "/dashboard/builds",
    );
    expect(ideaReturnFromReferrerPath("/dashboard/saved")?.label).toBe(
      "Back to Saved",
    );
    expect(ideaReturnFromReferrerPath("/dashboard/billing")?.href).toBe(
      "/dashboard",
    );
    expect(ideaReturnFromReferrerPath("/startup-ideas")).toBeNull();
    expect(ideaReturnFromReferrerPath(null)).toBeNull();
  });

  test("prefers ?from= over the referrer, then defaults to Home", () => {
    expect(
      resolveIdeaMemberReturn({
        from: "builds",
        referrerPath: "/dashboard/explore",
      }).href,
    ).toBe("/dashboard/builds");
    expect(
      resolveIdeaMemberReturn({
        from: null,
        referrerPath: "/dashboard/explore",
      }).label,
    ).toBe("Back to Explore");
    expect(
      resolveIdeaMemberReturn({ from: null, referrerPath: null }),
    ).toEqual({ href: "/dashboard", label: "Back to Home" });
  });

  test("only trusts same-origin referrers", () => {
    expect(
      sameOriginReferrerPath(
        "https://weekendmvp.app/dashboard/explore",
        "https://weekendmvp.app",
      ),
    ).toBe("/dashboard/explore");
    expect(
      sameOriginReferrerPath(
        "https://evil.example/dashboard",
        "https://weekendmvp.app",
      ),
    ).toBeNull();
    expect(sameOriginReferrerPath("", "https://weekendmvp.app")).toBeNull();
  });
});

describe("idea page member chrome wiring", () => {
  test("individual idea layout swaps shared MegaNav through IdeaPageNav", () => {
    expect(layoutSource).toContain("<IdeaPageNav />");
    expect(layoutSource).not.toMatch(/<IdeaNav\b/);
    expect(layoutSource).toContain("COLLECTION_SLUGS.includes(slug)");
    expect(pageNavSource).toContain("hasSessionHintCookie(document.cookie)");
    expect(pageNavSource).toContain("<IdeaMemberNav />");
    expect(pageNavSource).toContain('<MegaNav variant="cream" id="idea-site-header" />');
    expect(pageNavSource).toMatch(/function readServerSessionHint\(\) \{\s*return false;\s*\}/);
  });

  test("member nav mirrors PRIMARY_NAV and keeps the idea header id", () => {
    expect(PRIMARY_NAV.map((item) => item.href)).toEqual([
      "/dashboard",
      "/dashboard/explore",
      "/dashboard/saved",
      "/dashboard/builds",
    ]);
    expect(memberNavSource).toContain("PRIMARY_NAV.map");
    expect(memberNavSource).toContain('href="/dashboard"');
    expect(memberNavSource).toContain('id="idea-site-header"');
    expect(memberNavSource).toContain("<IdeaAccountMenu />");
    expect(memberNavSource).toContain('aria-label="Workspace"');
    // Do not import AuthConvexClientProvider here: without AuthProvider it
    // crashes ConvexProviderWithAuth on `isLoading` (signed-in idea P0).
    expect(accountSource).not.toMatch(
      /from\s+["']@\/app\/AuthConvexClientProvider["']/,
    );
    expect(accountSource).not.toMatch(
      /from\s+["']@\/app\/dashboard\/SignOutButton["']/,
    );
    expect(accountSource).not.toMatch(/useAuthActions/);
    expect(accountSource).toContain('action: "auth:signOut"');
    expect(accountSource).toContain('fetch("/api/auth"');
    expect(accountSource).toContain("BILLING_NAV.href");
    expect(accountSource).toContain("SETTINGS_NAV.href");
  });

  test("crumbs and back control stay client islands; page stays static", () => {
    expect(pageSource).not.toMatch(/from "next\/headers"/);
    expect(pageSource).not.toContain("AuthPlatformProvider");
    expect(pageSource).toContain("<IdeaBreadcrumbs title={title} />");
    expect(pageSource).toContain("<IdeaBackLink");
    expect(pageSource).toContain('anonymousLabel="See all startup ideas"');
    expect(sidebarSource).toContain("<IdeaBackLink />");
    expect(crumbsSource).toContain('label: "Ideas"');
    expect(crumbsSource).toContain('href: "/dashboard/explore"');
    expect(crumbsSource).toContain('label: "Startup Ideas"');
    expect(crumbsSource).toContain('href: "/startup-ideas"');
    expect(backSource).toContain("resolveIdeaMemberReturn");
    expect(backSource).toContain("hasSessionHintCookie(document.cookie)");
    // JSON-LD stays on the public marketing path for SEO.
    expect(pageSource).toContain('{ label: "Startup Ideas", href: "/startup-ideas" }');
  });

  test("collection hubs still use the public shell / MegaNav, not member chrome", () => {
    // WP56: hubs moved from the dark HubShell to the research-desk PublicShell.
    expect(collectionSource).toContain("<PublicShell");
    expect(publicShellSource).toContain("<MegaNav");
    expect(collectionSource).not.toContain("IdeaPageNav");
    expect(collectionSource).not.toContain("IdeaMemberNav");
  });
});
