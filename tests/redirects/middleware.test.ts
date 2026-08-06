import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import type { NextFetchEvent } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import {
  applySensitiveAuthResponseHeaders,
  canonicalRedirect,
  config,
  hostRoutingDecision,
  middleware,
} from "../../middleware";

function request(url: string, host?: string) {
  return new NextRequest(url, {
    headers: host ? { host } : undefined,
  });
}

const event = {
  waitUntil() {},
  passThroughOnException() {},
} as unknown as NextFetchEvent;

async function runMiddleware(authRequest: NextRequest) {
  const response = await middleware(authRequest, event);
  if (!response) throw new Error("Middleware returned no response");
  return response;
}

describe("canonical host middleware", () => {
  it("redirects a dirty apex URL to the clean www URL in one hop", async () => {
    const response = await runMiddleware(
      request(
        "https://weekendmvp.app/articles/example.html/?source=test",
        "weekendmvp.app",
      ),
    );

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "https://www.weekendmvp.app/articles/example?source=test",
    );
  });

  it("canonicalizes the apex host even when the path is already clean", async () => {
    const response = await runMiddleware(
      request("https://weekendmvp.app/startup-ideas", "WeekendMVP.app:443"),
    );

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "https://www.weekendmvp.app/startup-ideas",
    );
  });

  it("cleans a dirty www path without adding a second redirect", async () => {
    const response = await runMiddleware(
      request(
        "https://www.weekendmvp.app/ideas/example.HTML?ref=legacy",
        "www.weekendmvp.app",
      ),
    );

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "https://www.weekendmvp.app/ideas/example?ref=legacy",
    );
  });

  it.each([
    ["https://preview-123.vercel.app/ideas/example/", "preview-123.vercel.app"],
    ["http://localhost:3000/ideas/example.html", "localhost:3000"],
    // `project.weekendmvp.app` used to be a third case here, asserting that a
    // tenant host got its path cleaned in place. That test was written when no
    // tenant host could exist, and it pinned the fallback WP28-S2 exists to
    // remove: it documented a tenant subdomain being served the marketing
    // application. Tenant hosts are now covered by the isolation suite below.
  ])("cleans %s in place without forcing www", async (url, host) => {
    const response = await runMiddleware(request(url, host));
    const source = new URL(url);
    const location = new URL(response.headers.get("location")!);

    expect(response.status).toBe(308);
    expect(location.host).toBe(source.host);
    expect(location.pathname).toBe("/ideas/example");
  });

  it("passes a clean preview URL through without redirecting", async () => {
    const response = canonicalRedirect(
      request(
        "https://preview-123.vercel.app/ideas/example?draft=1",
        "preview-123.vercel.app",
      ),
    );

    expect(response).toBeNull();
  });
});

describe("WP28-S2 host isolation", () => {
  /**
   * The paths that must not be reachable from a non-platform host. Each is a
   * real platform surface: the authenticated app, the auth entry points, the
   * anonymous preview funnel, the platform APIs, and the crawler directives
   * that describe the platform's own URL space.
   */
  const PLATFORM_SURFACES = [
    "/dashboard",
    "/dashboard/explore",
    "/signin",
    "/auth/callback",
    "/email-signin",
    "/build/ai-collectible-verification-platform",
    "/preview/" + "a".repeat(64),
    "/api/platform/preview/generate",
    "/robots.txt",
    "/sitemap.xml",
  ];

  const NON_PLATFORM_HOSTS: ReadonlyArray<[string, string]> = [
    ["tenant", "acme.weekendmvp.app"],
    ["reserved", "admin.weekendmvp.app"],
    ["unknown", "evil.com"],
    ["lookalike parent", "weekendmvp.app.evil.com"],
    ["multi-label", "a.b.weekendmvp.app"],
  ];

  it.each(NON_PLATFORM_HOSTS)(
    "answers 404 for every platform surface on a %s host (%s)",
    async (_kind, host) => {
      for (const pathname of PLATFORM_SURFACES) {
        const response = await runMiddleware(
          request(`https://${host}${pathname}`, host),
        );

        expect(response.status, `${host}${pathname}`).toBe(404);
        // No redirect: a 3xx would both leak that the path exists and walk the
        // visitor onto a platform host.
        expect(response.headers.get("location"), `${host}${pathname}`).toBeNull();
        // No session handling ever runs for these hosts.
        expect(response.headers.get("set-cookie"), `${host}${pathname}`).toBeNull();
      }
    },
  );

  it.each(NON_PLATFORM_HOSTS)(
    "is indistinguishable across paths on a %s host (%s)",
    async (_kind, host) => {
      // Existence must not be probeable by comparing a known platform path
      // against a path that has never existed.
      const known = await runMiddleware(request(`https://${host}/dashboard`, host));
      const absent = await runMiddleware(
        request(`https://${host}/nothing-here-at-all`, host),
      );

      expect(known.status).toBe(absent.status);
      expect(await known.text()).toBe(await absent.text());
    },
  );

  it("does not brand or cache the rejection", async () => {
    const response = await runMiddleware(
      request("https://evil.com/ideas/example", "evil.com"),
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-robots-tag")).toContain("noindex");

    const body = await response.text();
    expect(body).not.toContain("Weekend MVP");
    expect(body).not.toContain("<html");
    expect(body).not.toContain("weekendmvp.app");
  });

  it("never redirects a tenant host onto a platform host", async () => {
    // The old fallback cleaned dirty paths on any host, so a tenant URL with a
    // trailing slash produced a 308. Nothing on a tenant host may now redirect.
    const response = await runMiddleware(
      request(
        "https://acme.weekendmvp.app/ideas/example.html/",
        "acme.weekendmvp.app",
      ),
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("location")).toBeNull();
  });

  it("leaves platform hosts classified as platform", () => {
    // Asserted through the pure decision rather than by running the full
    // middleware: `convexAuthNextjsMiddleware` reads `headers()` before our
    // handler, which has no request scope under vitest, so a clean path on a
    // platform host cannot be driven end-to-end here. That a platform host
    // still *serves* is proven by the live production-build matrix recorded
    // in `docs/wp/wp28-progress.md`, not by this unit test.
    for (const host of [
      "weekendmvp.app",
      "www.weekendmvp.app",
      "WWW.WeekendMVP.App:443",
      "localhost:3000",
      "127.0.0.1:3000",
      "p-1.vercel.app",
    ]) {
      expect(hostRoutingDecision(host).kind, host).toBe("platform");
    }
  });

  it("keeps apex canonicalization unchanged", async () => {
    const apex = await runMiddleware(
      request("https://weekendmvp.app/startup-ideas", "weekendmvp.app"),
    );
    expect(apex.status).toBe(308);
    expect(apex.headers.get("location")).toBe(
      "https://www.weekendmvp.app/startup-ideas",
    );
  });

  it("routes tenant, reserved, and unknown hosts away from the platform", () => {
    expect(hostRoutingDecision("acme.weekendmvp.app")).toEqual({
      kind: "tenant",
      slug: "acme",
    });
    expect(hostRoutingDecision("admin.weekendmvp.app").kind).toBe("reject");
    expect(hostRoutingDecision("evil.com").kind).toBe("reject");
    expect(hostRoutingDecision(null).kind).toBe("reject");
  });

  it("classifies hosts case- and port-insensitively", async () => {
    for (const host of ["ACME.WeekendMVP.App", "acme.weekendmvp.app:443"]) {
      const response = await runMiddleware(
        request("https://acme.weekendmvp.app/dashboard", host),
      );
      expect(response.status, host).toBe(404);
    }
  });
});

describe("middleware matcher contract", () => {
  it.each([
    "/robots.txt",
    "/sitemap.xml",
    "/about",
    "/ideas/example",
    "/dashboard/report.js",
  ])(
    "runs for %s",
    (pathname) => {
      expect(
        unstable_doesMiddlewareMatch({
          config,
          url: `https://www.weekendmvp.app${pathname}`,
        }),
      ).toBe(true);
    },
  );

  it.each([
    "/_next/static/chunks/app.js",
    "/_next/image?url=%2Flogo.png&w=640&q=75",
    "/favicon.ico",
    "/assets/logo.svg",
    "/styles/site.css",
    "/scripts/app.js",
    "/fonts/site.woff2",
    "/source.map",
  ])("does not run for static/internal request %s", (pathname) => {
    expect(
      unstable_doesMiddlewareMatch({
        config,
        url: `https://www.weekendmvp.app${pathname}`,
      }),
    ).toBe(false);
  });
});

describe("sensitive auth response headers", () => {
  it.each([
    "https://preview-123.vercel.app/email-signin/?token=secret-reference",
    "https://www.weekendmvp.app/auth/callback/?code=secret-reference",
  ])("applies the policy in middleware composition for %s", async (url) => {
    const response = await runMiddleware(request(url, new URL(url).host));

    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it.each(["/email-signin", "/auth/callback"])(
    "prevents referrer leakage and caching on %s",
    (pathname) => {
      const response = applySensitiveAuthResponseHeaders(
        pathname,
        new Response(null),
      );

      expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
      expect(response.headers.get("Cache-Control")).toBe("no-store");
    },
  );

  it("does not override public-route cache policy", () => {
    const response = applySensitiveAuthResponseHeaders(
      "/startup-ideas",
      new Response(null, { headers: { "Cache-Control": "public, max-age=60" } }),
    );

    expect(response.headers.get("Referrer-Policy")).toBeNull();
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=60");
  });
});
