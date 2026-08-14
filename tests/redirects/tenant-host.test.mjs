import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import {
  classifyHost,
  isTenantHost,
  isValidTenantSlug,
  normalizeHost,
  PLATFORM_HOST_SUFFIX,
  RESERVED_SUBDOMAINS,
  tenantHostForSlug,
  TENANT_SLUG_MAX_LENGTH,
} from "../../lib/tenant-host.ts";

/**
 * WP28-S1. The classifier decides what an attacker-controlled `Host:` header
 * is allowed to be, so the cases that matter most are the rejections. Every
 * assertion below that expects `unknown` is guarding a host that must 404 in
 * WP28-S2 rather than fall through to the application.
 */

const kindOf = (host) => classifyHost(host).kind;

describe("normalizeHost", () => {
  it("lowercases and strips a port", () => {
    assert.equal(normalizeHost("WeekendMVP.App"), "weekendmvp.app");
    assert.equal(normalizeHost("weekendmvp.app:3000"), "weekendmvp.app");
    assert.equal(normalizeHost("  weekendmvp.app:443  "), "weekendmvp.app");
  });

  it("rejects a trailing dot rather than normalizing it away", () => {
    // Accepting the FQDN form would give every host two spellings while
    // site_configs.hostname stores exactly one.
    assert.equal(normalizeHost("weekendmvp.app."), null);
    assert.equal(normalizeHost("acme.weekendmvp.app."), null);
  });

  it("rejects credentials, paths, queries, and whitespace", () => {
    assert.equal(normalizeHost("evil.com@weekendmvp.app"), null);
    assert.equal(normalizeHost("weekendmvp.app/dashboard"), null);
    assert.equal(normalizeHost("weekendmvp.app?x=1"), null);
    assert.equal(normalizeHost("weekend mvp.app"), null);
    assert.equal(normalizeHost("weekendmvp.app\n"), "weekendmvp.app");
    assert.equal(normalizeHost("weekendmvp.app\nX-Injected: 1"), null);
  });

  it("rejects punycode labels anywhere in the host", () => {
    assert.equal(normalizeHost("xn--80ak6aa92e.com"), null);
    assert.equal(normalizeHost("xn--e1awd7f.weekendmvp.app"), null);
  });

  it("rejects malformed shapes", () => {
    assert.equal(normalizeHost(""), null);
    assert.equal(normalizeHost("   "), null);
    assert.equal(normalizeHost(null), null);
    assert.equal(normalizeHost(undefined), null);
    assert.equal(normalizeHost("acme..weekendmvp.app"), null);
    assert.equal(normalizeHost(".weekendmvp.app"), null);
    assert.equal(normalizeHost("weekendmvp.app:notaport"), null);
    assert.equal(normalizeHost("weekendmvp.app:80:80"), null);
    assert.equal(normalizeHost(`${"a".repeat(64)}.weekendmvp.app`), null);
    assert.equal(normalizeHost(`${"a".repeat(250)}.weekendmvp.app`), null);
  });

  it("accepts bracketed IPv6 loopback and rejects other literals", () => {
    assert.equal(normalizeHost("[::1]"), "::1");
    assert.equal(normalizeHost("[::1]:3000"), "::1");
    assert.equal(normalizeHost("[2001:db8::1]"), null);
    assert.equal(normalizeHost("[::1"), null);
  });
});

describe("classifyHost — platform hosts", () => {
  it("classifies apex and www, with www winning over the reserved list", () => {
    assert.equal(kindOf("weekendmvp.app"), "apex");
    assert.equal(kindOf("WEEKENDMVP.APP"), "apex");
    assert.equal(kindOf("weekendmvp.app:3000"), "apex");
    // `www` is in RESERVED_SUBDOMAINS but must classify as the canonical host
    // so the existing WP13 canonicalization keeps working unchanged.
    assert.equal(kindOf("www.weekendmvp.app"), "www");
  });

  it("classifies local development hosts", () => {
    for (const host of [
      "localhost",
      "localhost:3000",
      "127.0.0.1:3210",
      "0.0.0.0",
      "[::1]:3000",
      "acme.localhost:3000",
    ]) {
      assert.equal(kindOf(host), "local", host);
    }
  });

  it("classifies Vercel preview deployments as platform, never tenant", () => {
    assert.equal(kindOf("weekendmvp-git-branch-jeberulz.vercel.app"), "platform-preview");
    assert.equal(kindOf("anything.vercel.app"), "platform-preview");
  });
});

describe("classifyHost — tenant hosts", () => {
  it("accepts well-formed single-label slugs", () => {
    for (const slug of ["acme", "acme-co", "a1b2c3", "my-weekend-mvp", "abc"]) {
      const result = classifyHost(`${slug}${PLATFORM_HOST_SUFFIX}`);
      assert.equal(result.kind, "tenant", slug);
      assert.equal(result.slug, slug);
    }
  });

  it("carries the slug through case and port variance", () => {
    const result = classifyHost("ACME-Co.WeekendMVP.App:443");
    assert.equal(result.kind, "tenant");
    assert.equal(result.slug, "acme-co");
  });

  it("never classifies a multi-label subdomain as a tenant", () => {
    // A wildcard certificate does not cover a second level, and we issue
    // single-label subdomains only.
    assert.equal(kindOf("a.b.weekendmvp.app"), "unknown");
    assert.equal(kindOf("evil.acme.weekendmvp.app"), "unknown");
  });

  it("never classifies a lookalike parent domain as a tenant", () => {
    for (const host of [
      "weekendmvp.app.evil.com",
      "notweekendmvp.app",
      "acme.weekendmvp.com",
      "acme.weekendmvpxapp",
      "evil.com",
    ]) {
      assert.equal(kindOf(host), "unknown", host);
    }
  });

  it("rejects malformed slugs", () => {
    for (const slug of [
      "-acme",
      "acme-",
      "ac",
      "ACME_CO",
      "acme_co",
      "ab--cdef",
      "a".repeat(TENANT_SLUG_MAX_LENGTH + 1),
    ]) {
      assert.equal(kindOf(`${slug}${PLATFORM_HOST_SUFFIX}`), "unknown", slug);
    }
  });

  it("treats the bare suffix as unknown", () => {
    assert.equal(kindOf(".weekendmvp.app"), "unknown");
  });
});

describe("classifyHost — reserved subdomains", () => {
  it("reserves every name in the frozen list", () => {
    assert.ok(RESERVED_SUBDOMAINS.size >= 40, "reserved list shrank unexpectedly");
    for (const label of RESERVED_SUBDOMAINS) {
      const host = `${label}${PLATFORM_HOST_SUFFIX}`;
      const result = classifyHost(host);
      // `www` is the one member that is a real platform host.
      const expected = label === "www" ? "www" : "reserved";
      assert.equal(result.kind, expected, host);
      assert.notEqual(result.kind, "tenant", host);
    }
  });

  it("covers the names most useful for phishing our own users", () => {
    for (const label of ["admin", "billing", "login", "security", "support", "stripe"]) {
      assert.ok(RESERVED_SUBDOMAINS.has(label), `${label} must stay reserved`);
    }
  });

  it("refuses a reserved name through isValidTenantSlug too", () => {
    // The publish path (WP28-S4) re-checks server-side; the two must agree.
    for (const label of RESERVED_SUBDOMAINS) {
      assert.equal(isValidTenantSlug(label), false, label);
    }
  });
});

describe("isTenantHost and tenantHostForSlug", () => {
  it("agrees with classifyHost", () => {
    assert.equal(isTenantHost("acme.weekendmvp.app"), true);
    assert.equal(isTenantHost("www.weekendmvp.app"), false);
    assert.equal(isTenantHost("admin.weekendmvp.app"), false);
    assert.equal(isTenantHost("evil.com"), false);
    assert.equal(isTenantHost(null), false);
  });

  it("round-trips a valid slug and refuses an invalid one", () => {
    assert.equal(tenantHostForSlug("acme"), "acme.weekendmvp.app");
    const result = classifyHost(tenantHostForSlug("acme"));
    assert.equal(result.kind, "tenant");
    assert.equal(result.slug, "acme");

    assert.equal(tenantHostForSlug("admin"), null);
    assert.equal(tenantHostForSlug("-acme"), null);
  });
});

describe("WP28-S2 wiring", () => {
  /**
   * S1 asserted the opposite of this: that the classifier was *not* wired into
   * middleware, so the story could land without touching the routing seam.
   * S2 is the story that wires it, so that assertion was deliberately
   * replaced rather than deleted — its tripwire fired exactly as intended.
   *
   * Comments are stripped first: this repo documents its own guardrails, so
   * matching prose would let deleting a comment change the result.
   */
  const readMiddleware = async () =>
    (await readFile(new URL("../../middleware.ts", import.meta.url), "utf8"))
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .filter((line) => !/^\s*(\/\/|\*)/.test(line))
      .join("\n");

  it("classifies the host before canonicalizing the path", async () => {
    const source = await readMiddleware();
    const body = source.slice(source.indexOf("export async function middleware"));
    const decidedAt = body.indexOf("hostRoutingDecision(");
    const canonicalAt = body.indexOf("canonicalRedirect(request)");

    assert.ok(decidedAt !== -1, "middleware does not classify the host");
    assert.ok(canonicalAt !== -1, "middleware no longer canonicalizes");
    // Ordering is the security property: canonicalizing first would hand a
    // tenant or unknown host a 308 into the platform before anything checked
    // whether that host was ours to serve.
    assert.ok(
      decidedAt < canonicalAt,
      "canonicalization runs before host classification",
    );
  });

  it("rejects a host with a real status, never notFound()", async () => {
    const source = await readMiddleware();
    // notFound() would produce a 200 PPR shell under cacheComponents.
    assert.doesNotMatch(source, /notFound\(/);
    assert.match(source, /status:\s*404/);
  });
});
