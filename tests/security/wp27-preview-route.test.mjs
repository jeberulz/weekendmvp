import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { isAllowedPreviewOrigin } from "../../app/api/platform/preview/_server.ts";

/**
 * WP27-S4. `/preview/{token}` is the one page an unauthenticated stranger
 * can cause this system to render, and its URL is its own authorization.
 * These tests cover the properties that are structural rather than
 * behavioural — the ones a live browser pass would not catch if a future
 * edit reintroduced them.
 */

/**
 * Reads a source file with its comments removed.
 *
 * Every assertion below is about what the code *does*, and these files
 * document their own guardrails — a prose note saying "no fetch here" would
 * otherwise fail a `doesNotMatch(/fetch\(/)` and, worse, deleting the comment
 * would turn the test green without changing any behaviour. Strip first so a
 * failure always means real code.
 */
async function readCode(path) {
  const source = await readFile(new URL(`../../${path}`, import.meta.url), "utf8");
  return source
    // Block, JSDoc, and `{/* … */}` JSX comments.
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*)/.test(line))
    .join("\n");
}

async function previewHeaders() {
  // `next.config.ts` reads `__dirname`, which Next's own loader provides and
  // a bare ESM import does not. Shimming it is what lets this assert against
  // the real exported config rather than pattern-matching its source text.
  globalThis.__dirname = new URL("../../", import.meta.url).pathname;
  const config = (await import("../../next.config.ts")).default;
  const rules = await config.headers();
  const rule = rules.find((entry) => entry.source === "/preview/:token");
  assert.ok(rule, "no header rule matches /preview/:token");
  return new Map(rule.headers.map(({ key, value }) => [key.toLowerCase(), value]));
}

test("a preview response is never stored by a shared cache", async () => {
  const headers = await previewHeaders();
  const cacheControl = headers.get("cache-control");
  assert.ok(cacheControl, "no Cache-Control on /preview/:token");
  assert.match(cacheControl, /\bno-store\b/);
  assert.match(cacheControl, /\bprivate\b/);
  // `public` would let a CDN hold one visitor's private artifact and hand it
  // to the next caller of the same URL.
  assert.doesNotMatch(cacheControl, /\bpublic\b/);
});

test("a preview is non-indexable at the header level, not only in the document", async () => {
  const headers = await previewHeaders();
  const robots = headers.get("x-robots-tag");
  assert.ok(robots, "no X-Robots-Tag on /preview/:token");
  for (const directive of ["noindex", "nofollow", "noarchive"]) {
    assert.match(robots, new RegExp(`\\b${directive}\\b`));
  }
  // The token lives in the path, so it must not ride along in a Referer.
  assert.equal(headers.get("referrer-policy"), "no-referrer");
});

test("the header rule is path-scoped so it also covers the not-found response", async () => {
  const page = await readCode("app/preview/[token]/page.tsx");
  // Headers set inside the page would apply only to a successful render,
  // making Cache-Control itself the oracle that distinguishes a real token
  // from an unknown one. They must come from the path-matched config rule.
  assert.doesNotMatch(page, /Cache-Control|X-Robots-Tag|new Response\(/);
});

test("every failure mode reaches one notFound call", async () => {
  const page = await readCode("app/preview/[token]/page.tsx");
  const calls = page.match(/notFound\(\)/g) ?? [];
  // One call site, not three that agree today: malformed, unknown, expired,
  // and unparseable-spec all collapse to null before it and share the exact
  // same response by construction.
  assert.equal(calls.length, 1, `expected a single notFound() call, saw ${calls.length}`);
  assert.doesNotMatch(page, /status:\s*410|redirect\(|permanentRedirect\(/);
});

test("the generic page never says which failure happened", async () => {
  const notFoundPage = await readCode("app/preview/[token]/not-found.tsx");
  // Saying "expired" confirms the token was once real, which is exactly the
  // enumeration signal the capability design withholds.
  for (const word of ["expired", "has expired", "no longer valid", "invalid", "unknown token"]) {
    assert.doesNotMatch(
      notFoundPage,
      new RegExp(word, "i"),
      `not-found copy distinguishes a failure case: ${word}`,
    );
  }
});

test("the preview render is never cached by the framework", async () => {
  // Widened at S6: greping the page alone would miss a `"use cache"`
  // introduced in the read path it delegates to, which caches the same data.
  for (const path of [
    "convex/platform/preview/read.ts",
    "convex/platform/preview/capabilities.ts",
  ]) {
    assert.doesNotMatch(await readCode(path), /"use cache"|cacheTag|cacheLife/);
  }
  const page = await readCode("app/preview/[token]/page.tsx");
  // A cached preview is a preview served to the wrong person, and expiry
  // would stop being evaluated per read.
  assert.doesNotMatch(page, /"use cache"|cacheTag|cacheLife|revalidate\s*=/);
  assert.match(page, /export const instant = false/);
  assert.doesNotMatch(page, /generateStaticParams/);
});

test("no lead-write path is reachable from the preview", async () => {
  const sources = await Promise.all([
    readCode("app/preview/[token]/page.tsx"),
    readCode("app/preview/[token]/not-found.tsx"),
    readCode("components/preview/templates/index.tsx"),
    readCode("components/preview/templates/PreviewWatermark.tsx"),
    readCode("components/preview/PreviewConversion.tsx"),
  ]);
  for (const source of sources) {
    // Structurally inert, not disabled by a flag: there is no endpoint to
    // enable. A `<form>`, a server action, or a fetch would each be one.
    assert.doesNotMatch(source, /<form|useActionState|"use server"|leads?\b/i);
    assert.doesNotMatch(source, /fetch\(|useMutation|action=\{/);
  }
});

test("the preview does not resolve or imply a tenant host", async () => {
  const page = await readCode("app/preview/[token]/page.tsx");
  // Host routing is WP28's exclusively. Reading a host here would be the
  // first half of a cutover this package is not authorized to make.
  assert.doesNotMatch(page, /headers\(\)|hostname|subdomain|x-forwarded-host/i);
});

test("the preview route is absent from the sitemap", async () => {
  const sitemap = await readCode("app/sitemap.ts");
  assert.doesNotMatch(sitemap, /["'`]\/preview/);
});

test("the capability clock is server-sourced and not a public argument", async () => {
  const source = await readCode("convex/platform/preview/read.ts");
  // The query that trusts `now` must stay internal. Exported as a public
  // `query`, a caller could pass `now: 0` and revive a capability they held
  // a week ago — the token check alone would not stop them.
  assert.match(source, /export const resolveForView = internalQuery\(/);
  assert.doesNotMatch(source, /export const resolveForView = query\(/);
  // The public entry point takes only a token and reads the clock itself.
  assert.match(source, /export const view = action\(/);
  assert.match(source, /args:\s*\{\s*token:\s*v\.string\(\)\s*\}/);
  assert.match(source, /now:\s*Date\.now\(\)/);
});

test("an Origin header is always compared against something", () => {
  const headers = (values) => new Headers(values);

  // Configured: exact match wins, anything else is refused.
  const configured = { PLATFORM_PREVIEW_APP_ORIGIN: "https://www.weekendmvp.com" };
  assert.equal(
    isAllowedPreviewOrigin(headers({ origin: "https://www.weekendmvp.com" }), configured),
    true,
  );
  assert.equal(
    isAllowedPreviewOrigin(headers({ origin: "https://evil.example" }), configured),
    false,
  );

  // Unconfigured: falls back to the request's own Host rather than skipping
  // the check, which is what the S2 version did.
  assert.equal(
    isAllowedPreviewOrigin(
      headers({ origin: "http://localhost:3000", host: "localhost:3000" }),
      {},
    ),
    true,
  );
  assert.equal(
    isAllowedPreviewOrigin(
      headers({ origin: "https://evil.example", host: "localhost:3000" }),
      {},
    ),
    false,
  );

  // Fails closed when there is nothing to compare against, or the Origin is
  // unparseable.
  assert.equal(isAllowedPreviewOrigin(headers({ origin: "https://a.example" }), {}), false);
  assert.equal(
    isAllowedPreviewOrigin(headers({ origin: "not a url", host: "localhost:3000" }), {}),
    false,
  );

  // No Origin at all: curl and server-to-server still pass. Deliberate —
  // the bridge signature is the real authority and this is defence in depth.
  assert.equal(isAllowedPreviewOrigin(headers({ host: "localhost:3000" }), {}), true);
});

test("the preview API no longer borrows the billing origin variable", async () => {
  const [server, route] = await Promise.all([
    readCode("app/api/platform/preview/_server.ts"),
    readCode("app/api/platform/preview/generate/route.ts"),
  ]);
  assert.doesNotMatch(server, /PLATFORM_BILLING_APP_ORIGIN/);
  assert.doesNotMatch(route, /PLATFORM_BILLING_APP_ORIGIN/);
  assert.match(route, /isAllowedPreviewOrigin\(request\.headers, process\.env\)/);
});

test("preview analytics carry no token and no visitor identity", async () => {
  const source = await readCode("components/preview/PreviewViewed.tsx");
  assert.match(source, /trackEvent\("preview_viewed", \{ template \}\)/);
  assert.doesNotMatch(source, /token|email|userId|capability/i);
});

/**
 * WP27-S6, from the independent review. The capability lives in the URL path,
 * and GA4's automatic `page_view` sends `page_location = location.href`. That
 * exported live preview tokens to Google and Meta for any visitor who had
 * accepted the consent banner — the token sits in the analytics payload body,
 * so `Referrer-Policy: no-referrer` does nothing about it.
 */
test("no vendor ever receives a URL carrying a capability", async () => {
  const source = await readCode("components/consent/AnalyticsScripts.tsx");

  // GA: an explicit, redacted location — never the default, which is href.
  assert.match(source, /page_location:\s*location\.origin \+ path/);
  assert.match(source, /page_path:\s*path/);
  // The literals come from `lib/analytics-redaction.ts` via interpolation,
  // so assert the interpolation is present rather than the resolved string.
  assert.match(source, /q\.delete\('\$\{CLAIM_PARAM\}'\)/);
  assert.match(source, /\$\{REDACTED_PREVIEW_PATH\}/);
  assert.match(source, /\[0-9a-f\]\{64\}/);

  // Meta: the Pixel offers no way to override `dl`, so the automatic
  // PageView must not fire at all on a URL that carries a secret.
  const pixel = source.slice(source.indexOf("fbq('init'"));
  assert.match(pixel, /if \([^)]*preview[\s\S]*?fbq\('track', 'PageView'\)/);
});

test("the redaction covers both channels the token travels in", async () => {
  const { redactCapabilityPath, urlCarriesCapability } = await import(
    "../../lib/analytics-redaction.ts"
  );
  const token = "a".repeat(64);

  assert.equal(redactCapabilityPath(`/preview/${token}`), "/preview/[token]");
  assert.equal(redactCapabilityPath("/ideas/some-idea"), "/ideas/some-idea");
  // A short or non-hex segment is not a capability and must not be mangled.
  assert.equal(redactCapabilityPath("/preview/abc"), "/preview/abc");

  assert.equal(urlCarriesCapability(`/preview/${token}`, ""), true);
  assert.equal(urlCarriesCapability("/signin", `?claimPreview=${token}`), true);
  assert.equal(urlCarriesCapability("/signin", "?returnTo=%2Fdashboard"), false);
  assert.equal(urlCarriesCapability("/starter-kit", ""), false);
});
