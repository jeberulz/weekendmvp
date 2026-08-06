/**
 * WP28-S1. Host classification for tenant routing.
 *
 * Pure string logic — no I/O, no Convex, no `next/server` import — so it is
 * testable from `node --test` and reusable by middleware, the tenant route,
 * and the publish path. Mirrors the split `lib/canonical-path.ts` already uses.
 *
 * This module decides what an arbitrary `Host:` header is allowed to be. It
 * is deliberately fail-closed: anything it cannot classify with certainty is
 * `unknown`, and WP28-S2 turns `unknown` into a real 404 from middleware.
 * Guessing here would mean serving the platform at a host we did not intend.
 *
 * Nothing in this file changes behaviour on its own. It is inert until S2
 * wires it into `middleware.ts`.
 */

// Explicit `.ts` extension: this module is imported directly by a
// `node --test --experimental-strip-types` suite, and Node's ESM resolver does
// not add extensions. `moduleResolution: "bundler"` accepts the form, and Next
// resolves it unchanged.
import { PROD_APEX_HOST, PROD_WWW_HOST } from "./canonical-path.ts";

/** Tenant sites live at `{slug}.weekendmvp.app` (ruled 2026-08-05). */
export const PLATFORM_HOST_SUFFIX = `.${PROD_APEX_HOST}`;

/** Vercel preview deployments, which must never be treated as a tenant. */
export const PLATFORM_PREVIEW_SUFFIX = ".vercel.app";

export const TENANT_SLUG_MIN_LENGTH = 3;
/** A DNS label cannot exceed 63 octets. */
export const TENANT_SLUG_MAX_LENGTH = 63;

/**
 * Subdomains a tenant may never claim. Two overlapping reasons: some are
 * infrastructure we run or may run (`api`, `admin`, `staging`), and some are
 * names a visitor reasonably trusts to be us (`billing`, `security`,
 * `support`) and which would otherwise be available for phishing.
 *
 * Proposed at the WP28 story freeze and pending owner ruling — see
 * `docs/wp/wp28-stories.md`, open ruling #1. Treat as provisional until it is
 * recorded in `docs/wp/RULINGS.md`.
 */
export const RESERVED_SUBDOMAINS: ReadonlySet<string> = new Set([
  "abuse",
  "admin",
  "api",
  "app",
  "assets",
  "auth",
  "billing",
  "blog",
  "cdn",
  "dashboard",
  "dev",
  "docs",
  "ftp",
  "help",
  "img",
  "imap",
  "internal",
  "login",
  "mail",
  "mx",
  "ns1",
  "ns2",
  "pay",
  "postmaster",
  "preview",
  "root",
  "security",
  "smtp",
  "staging",
  "static",
  "status",
  "stripe",
  "support",
  "system",
  "test",
  "webhook",
  "webhooks",
  "webmaster",
  "weekendmvp",
  "www",
]);

export type HostClassification =
  | { kind: "apex" }
  | { kind: "www" }
  | { kind: "tenant"; slug: string }
  | { kind: "reserved"; label: string }
  | { kind: "platform-preview" }
  | { kind: "local" }
  | { kind: "unknown" };

/** Hosts that mean "this developer's machine", never a tenant. */
const LOCAL_HOSTS: ReadonlySet<string> = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
]);

/**
 * Characters that must never survive into a classified host. A `Host` header
 * is attacker-controlled, so anything carrying credentials (`@`), a path, a
 * query, a fragment, or whitespace is rejected outright rather than trimmed —
 * trimming invites two spellings of one host, and the publish path keys off
 * the exact string via the `by_hostname` index.
 */
const FORBIDDEN_HOST_CHARS = /[^a-z0-9.:[\]-]/;

/**
 * Normalizes a raw `Host` header to a bare lowercase hostname, or `null` when
 * it cannot be trusted.
 *
 * Rejections that may look overly strict, and why:
 *
 * - **Trailing dot.** `weekendmvp.app.` is a legitimate fully-qualified
 *   spelling, but accepting it would give every host two forms while
 *   `site_configs.hostname` stores exactly one. Fail closed instead.
 * - **`xn--` labels.** Punycode is where homograph attacks live. We issue no
 *   IDN hostnames, so any `xn--` label is either a mistake or an attack.
 * - **IPv6 literals.** Bracketed hosts are never tenants; `::1` is the only
 *   one with a meaning here and it is local.
 */
export function normalizeHost(rawHost: string | null | undefined): string | null {
  if (typeof rawHost !== "string") {
    return null;
  }

  const host = rawHost.trim().toLowerCase();
  if (host.length === 0 || host.length > 253) {
    return null;
  }

  // IPv6 literals arrive bracketed (`[::1]:3000`). Handled before the port
  // split, whose `:` heuristic would otherwise mangle them.
  if (host.startsWith("[")) {
    const close = host.indexOf("]");
    if (close === -1) {
      return null;
    }
    const literal = host.slice(1, close);
    const rest = host.slice(close + 1);
    if (rest.length > 0 && !isPortSuffix(rest)) {
      return null;
    }
    return LOCAL_HOSTS.has(literal) ? literal : null;
  }

  const withoutPort = stripPort(host);
  if (withoutPort === null) {
    return null;
  }

  if (FORBIDDEN_HOST_CHARS.test(withoutPort)) {
    return null;
  }
  // A `:` surviving the port strip means a second colon — malformed.
  if (withoutPort.includes(":")) {
    return null;
  }
  if (withoutPort.startsWith(".") || withoutPort.endsWith(".")) {
    return null;
  }

  const labels = withoutPort.split(".");
  for (const label of labels) {
    if (label.length === 0 || label.length > 63) {
      return null;
    }
    if (label.startsWith("xn--")) {
      return null;
    }
  }

  return withoutPort;
}

function isPortSuffix(value: string): boolean {
  return /^:\d{1,5}$/.test(value);
}

/** Removes a `:port` suffix, or returns `null` if what follows `:` is not a port. */
function stripPort(host: string): string | null {
  const colon = host.lastIndexOf(":");
  if (colon === -1) {
    return host;
  }
  if (!isPortSuffix(host.slice(colon))) {
    return null;
  }
  return host.slice(0, colon);
}

/**
 * A tenant slug is a single DNS label we are willing to hand to a stranger.
 *
 * The `--` check at positions 3-4 is RFC 5891's reserved form: labels shaped
 * `ab--cdef` are where IDN/punycode prefixes live, so they stay unavailable
 * even though `xn--` specifically is already rejected during normalization.
 */
export function isValidTenantSlug(slug: string): boolean {
  if (slug.length < TENANT_SLUG_MIN_LENGTH || slug.length > TENANT_SLUG_MAX_LENGTH) {
    return false;
  }
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(slug)) {
    return false;
  }
  if (slug.slice(2, 4) === "--") {
    return false;
  }
  return !RESERVED_SUBDOMAINS.has(slug);
}

/**
 * Classifies a raw `Host` header.
 *
 * Order matters: `www` is both the canonical platform host and a member of
 * the reserved set, and it must classify as `www` so the existing WP13
 * canonicalization keeps working unchanged.
 */
export function classifyHost(rawHost: string | null | undefined): HostClassification {
  const host = normalizeHost(rawHost);
  if (host === null) {
    return { kind: "unknown" };
  }

  if (LOCAL_HOSTS.has(host) || host.endsWith(".localhost")) {
    return { kind: "local" };
  }
  if (host === PROD_WWW_HOST) {
    return { kind: "www" };
  }
  if (host === PROD_APEX_HOST) {
    return { kind: "apex" };
  }
  if (host.endsWith(PLATFORM_PREVIEW_SUFFIX)) {
    return { kind: "platform-preview" };
  }

  if (!host.endsWith(PLATFORM_HOST_SUFFIX)) {
    return { kind: "unknown" };
  }

  const label = host.slice(0, -PLATFORM_HOST_SUFFIX.length);
  // `a.b.weekendmvp.app` is not a tenant. We issue single-label subdomains
  // only, and a wildcard certificate does not cover a second level anyway.
  if (label.length === 0 || label.includes(".")) {
    return { kind: "unknown" };
  }
  if (RESERVED_SUBDOMAINS.has(label)) {
    return { kind: "reserved", label };
  }
  if (!isValidTenantSlug(label)) {
    return { kind: "unknown" };
  }

  return { kind: "tenant", slug: label };
}

/** True when the host must not reach any platform surface (WP28-S2). */
export function isTenantHost(rawHost: string | null | undefined): boolean {
  return classifyHost(rawHost).kind === "tenant";
}

/** The hostname a published tenant site is stored and served under. */
export function tenantHostForSlug(slug: string): string | null {
  if (!isValidTenantSlug(slug)) {
    return null;
  }
  return `${slug}${PLATFORM_HOST_SUFFIX}`;
}
