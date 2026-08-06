import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

/**
 * WP27-S5. The claim handoff carries a capability token across the sign-in
 * boundary, so the properties worth pinning here are about *where the token
 * is allowed to travel* — none of which a Convex test can see.
 *
 * Comments are stripped before asserting: these files document their own
 * guardrails, and matching a prose note would mean deleting a comment could
 * turn a test green. Same lesson as `wp27-preview-route.test.mjs`.
 */
async function readCode(path) {
  const source = await readFile(new URL(`../../${path}`, import.meta.url), "utf8");
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*)/.test(line))
    .join("\n");
}

test("the capability is stashed per-session, never persistently", async () => {
  const source = await readCode("components/preview/PreviewClaimHandoff.tsx");
  // `localStorage` would leave a live capability on a shared machine after
  // the browser is closed; `sessionStorage` dies with the tab session.
  assert.doesNotMatch(source, /localStorage/);
  assert.match(source, /sessionStorage\.setItem/);
  assert.match(source, /sessionStorage\.getItem/);
  assert.match(source, /sessionStorage\.removeItem/);
});

test("the stash is cleared only after the server confirms", async () => {
  const source = await readCode("components/preview/PreviewClaimHandoff.tsx");
  const claimAt = source.indexOf("await claim({ token })");
  assert.ok(claimAt !== -1, "no claim call found");

  // Textual position alone is not execution order — the earlier version of
  // this test compared two `indexOf` results, which would have stayed green
  // if the clear moved into a `finally` block written below the `try`. Assert
  // the structural facts that actually make the ordering hold: every clear
  // sits inside a settled branch, and none sits in a `finally`.
  assert.doesNotMatch(source, /\bfinally\s*\{/);
  for (const [, before] of source.matchAll(/([\s\S]{0,400}?)sessionStorage\.removeItem/g)) {
    assert.ok(
      /await claim\(\{ token \}\)/.test(before) || /\}\s*catch\b[\s\S]*$/.test(before),
      "a stash clear is reachable before the claim settles",
    );
  }
  // And the success-path clear must follow the awaited call, not precede it.
  const successClear = source.indexOf("sessionStorage.removeItem", claimAt);
  assert.ok(successClear > claimAt, "the success path clears before awaiting");
});

test("the token never reaches an analytics payload", async () => {
  const source = await readCode("components/preview/PreviewClaimHandoff.tsx");
  for (const [, payload] of source.matchAll(/trackEvent\([^)]*\)/g)) {
    assert.doesNotMatch(payload ?? "", /token/i);
  }
  assert.match(source, /trackEvent\("signup_completed", \{ source: "preview" \}\)/);
  // `project_created` is gated on a real creation so a replayed claim cannot
  // inflate the funnel.
  assert.match(source, /if \(graph\.created\) \{\s*trackEvent\("project_created"/);
});

test("sign-in shape-checks the token with the server's own normalizer", async () => {
  const source = await readCode("app/signin/page.tsx");
  assert.match(source, /normalizeCapabilityToken\(/);
  assert.match(source, /claimPreview !== null && <PreviewClaimStash/);
  // The capability must not be folded into `returnTo`: that value is echoed
  // into the auth callback URL and, for the email provider, into a link that
  // leaves our origin.
  assert.doesNotMatch(source, /returnTo[^\n]*claimPreview|claimPreview[^\n]*returnTo/);
});

test("the claim derives identity server-side and takes no owner argument", async () => {
  const source = await readCode("convex/platform/preview/claim.ts");
  assert.match(source, /requireCurrentPlatformUser\(ctx\)/);
  assert.match(source, /args:\s*\{\s*token:\s*v\.string\(\)\s*\}/);
  assert.doesNotMatch(source, /args\.(ownerId|userId)/);
  // Server clock: a caller-supplied timestamp would let an expired
  // capability be claimed.
  assert.match(source, /const now = Date\.now\(\)/);
});

test("every claim denial is the same generic not-found", async () => {
  const source = await readCode("convex/platform/preview/claim.ts");
  // One helper, used everywhere, so "someone else owns this" cannot drift
  // apart from "this never existed".
  assert.match(source, /code: PLATFORM_AUTH_ERROR\.notFound/);
  const distinct = source.match(/ConvexError\(\{\s*code:\s*"(?!INCOMPLETE_PROJECT_GRAPH)/g) ?? [];
  assert.equal(
    distinct.length,
    0,
    "the claim path raises a code other than the shared not-found or INCOMPLETE_PROJECT_GRAPH",
  );
});

test("a claimed preview reserves no tenant hostname", async () => {
  const source = await readCode("convex/platform/preview/claim.ts");
  // Host routing is WP28's exclusively.
  assert.doesNotMatch(source, /hostname/);
});
