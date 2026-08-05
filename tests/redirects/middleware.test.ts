import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import type { NextFetchEvent } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import {
  applySensitiveAuthResponseHeaders,
  canonicalRedirect,
  config,
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
    ["https://project.weekendmvp.app/ideas/example/", "project.weekendmvp.app"],
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
