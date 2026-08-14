import { describe, expect, test } from "vitest";

import workspaceSource from "../../components/platform/projects/ProjectWorkspace.tsx?raw";
import {
  ideaHref,
  publishControl,
  publishErrorMessage,
  slugFieldError,
  suggestedTenantSlug,
  tenantUrlFromSite,
} from "../../components/platform/projects/cockpit";

describe("WP29 cockpit view model", () => {
  test("links repository projects to the canonical idea path", () => {
    expect(ideaHref("collectible-verifier")).toBe("/ideas/collectible-verifier");
    expect(ideaHref(undefined)).toBeNull();
  });

  test("suggests a valid tenant slug from the source slug", () => {
    expect(suggestedTenantSlug("collectible-verifier")).toBe("collectible-verifier");
    expect(suggestedTenantSlug("admin")).toBe("");
    expect(suggestedTenantSlug(undefined)).toBe("");
  });

  test("shows a tenant URL whenever the site stored a hostname", () => {
    expect(
      tenantUrlFromSite({
        status: "published",
        hostname: "acme.weekendmvp.app",
        publishable: true,
        live: true,
      }),
    ).toBe("https://acme.weekendmvp.app");
    expect(
      tenantUrlFromSite({
        status: "published",
        hostname: "acme.weekendmvp.app",
        publishable: true,
        live: false,
      }),
    ).toBe("https://acme.weekendmvp.app");
    expect(
      tenantUrlFromSite({ status: "draft", publishable: true, live: false }),
    ).toBeNull();
  });

  test("labels publish for repository sites and hides it for own ideas", () => {
    expect(publishControl({ source: "own_idea", site: null })).toEqual({
      kind: "hidden",
    });
    expect(publishControl({ source: "repository_idea", site: null })).toEqual({
      kind: "blocked",
      reason: "This project has no site to publish yet. Claim a preview first.",
    });
    expect(
      publishControl({
        source: "repository_idea",
        site: { status: "draft", publishable: false, live: false },
      }),
    ).toEqual({
      kind: "blocked",
      reason: "This project cannot be published yet. There is no site content.",
    });
    expect(
      publishControl({
        source: "repository_idea",
        site: { status: "draft", publishable: true, live: false },
      }),
    ).toEqual({ kind: "ready" });
    expect(
      publishControl({
        source: "repository_idea",
        site: {
          status: "published",
          hostname: "acme.weekendmvp.app",
          publishable: true,
          live: true,
        },
      }),
    ).toEqual({
      kind: "live",
      hostname: "acme.weekendmvp.app",
      url: "https://acme.weekendmvp.app",
    });
  });

  test("labels invalid slugs and mapped publish errors", () => {
    expect(slugFieldError("")).toMatch(/subdomain/);
    expect(slugFieldError("www")).toMatch(/Reserved/);
    expect(slugFieldError("acme")).toBeNull();
    expect(publishErrorMessage(new Error("SITE_SLUG_UNAVAILABLE"))).toMatch(
      /not available/,
    );
    expect(publishErrorMessage(new Error("SITE_NOT_PUBLISHABLE"))).toMatch(
      /cannot be published/,
    );
  });
});

describe("WP29 cockpit UI contract", () => {
  test("the workspace reads server status, credits, publish, tenant URL, and idea link", () => {
    expect(workspaceSource).toContain("api.platform.projects.getOwned");
    expect(workspaceSource).toContain("api.platform.billing.queries.summary");
    expect(workspaceSource).toContain("api.platform.sites.publish.publish");
    expect(workspaceSource).toContain("{project.status}");
    expect(workspaceSource).not.toContain("Brief confirmed");
    expect(workspaceSource).toContain("researchHref");
    expect(workspaceSource).toContain("Tenant URL");
    expect(workspaceSource).toContain("It does not activate DNS");
    expect(workspaceSource).toContain('id="publish-status"');
    expect(workspaceSource).toContain('aria-live="polite"');
    expect(workspaceSource).toContain("Loading credit balance");
  });
});
