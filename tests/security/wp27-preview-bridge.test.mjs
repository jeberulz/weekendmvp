import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import {
  clientRateLimitKey,
  parsePreviewGenerateRequest,
  readPreviewBridgeSecret,
  signPreviewPayload,
} from "../../app/api/platform/preview/_server.ts";

const SECRET = "a-secure-test-only-preview-bridge-secret-123456";

test("bridge secret must be present and long enough", () => {
  assert.equal(readPreviewBridgeSecret({ PLATFORM_PREVIEW_BRIDGE_SECRET: SECRET }), SECRET);
  // Fails closed: an unset or weak secret must never mean "skip the gate".
  assert.throws(() => readPreviewBridgeSecret({}), /PREVIEW_BRIDGE_NOT_CONFIGURED/);
  assert.throws(
    () => readPreviewBridgeSecret({ PLATFORM_PREVIEW_BRIDGE_SECRET: "short" }),
    /PREVIEW_BRIDGE_NOT_CONFIGURED/,
  );
});

test("signature covers the exact serialized payload and never leaks the secret", () => {
  const signed = signPreviewPayload({ slug: "a", clientKey: "ip:1.2.3.4" }, SECRET);
  const expected = createHmac("sha256", SECRET)
    .update(signed.payload)
    .digest("base64url");
  assert.equal(signed.signature, expected);
  assert.ok(!signed.payload.includes(SECRET));
  assert.ok(!signed.signature.includes(SECRET));
});

/**
 * Mirrors the Convex-side `verifyBridgeSignature` with Web Crypto, so this
 * asserts against a real verifier rather than re-deriving an HMAC and
 * comparing it to itself. The earlier version of this test never verified
 * anything and would have passed against a broken verifier.
 */
async function verifyLikeConvex(payload, signature, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  let bytes;
  try {
    const padded = signature.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="));
    bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return false;
  }
  return crypto.subtle.verify("HMAC", key, bytes, new TextEncoder().encode(payload));
}

test("a genuine signature verifies", async () => {
  const signed = signPreviewPayload({ slug: "a", clientKey: "ip:1.2.3.4" }, SECRET);
  assert.equal(await verifyLikeConvex(signed.payload, signed.signature, SECRET), true);
});

test("a tampered payload fails verification", async () => {
  const signed = signPreviewPayload({ slug: "a", clientKey: "ip:1.2.3.4" }, SECRET);
  // The rate-limit key is inside the signed payload precisely so a caller
  // cannot swap buckets without the secret.
  const tampered = signed.payload.replace("ip:1.2.3.4", "ip:9.9.9.9");
  assert.equal(await verifyLikeConvex(tampered, signed.signature, SECRET), false);
});

test("a signature made with the wrong secret fails verification", async () => {
  const signed = signPreviewPayload({ slug: "a" }, `${SECRET}-other`);
  assert.equal(await verifyLikeConvex(signed.payload, signed.signature, SECRET), false);
});

test("malformed signatures fail verification rather than throwing", async () => {
  const signed = signPreviewPayload({ slug: "a" }, SECRET);
  for (const bad of ["", "A", "AAAAA", "!!!!", "AB==CD", "  "]) {
    assert.equal(
      await verifyLikeConvex(signed.payload, bad, SECRET),
      false,
      `expected rejection for signature: ${JSON.stringify(bad)}`,
    );
  }
});

test("a different secret produces a different signature", () => {
  const a = signPreviewPayload({ slug: "a" }, SECRET);
  const b = signPreviewPayload({ slug: "a" }, `${SECRET}-other`);
  assert.notEqual(a.signature, b.signature);
});

test("the trusted Vercel header wins over client-settable x-forwarded-for", () => {
  // The whole point: a caller who sets x-forwarded-for must not be able to
  // choose their own bucket, either to escape a limit by rotating it or to
  // pin a victim's IP and lock them out.
  const headers = new Headers({
    "x-vercel-forwarded-for": "203.0.113.7",
    "x-forwarded-for": "9.9.9.9",
    "x-real-ip": "8.8.8.8",
  });
  assert.equal(clientRateLimitKey(headers), "ip:203.0.113.7");
});

test("rate-limit key takes the first entry of a forwarded chain", () => {
  const headers = new Headers({ "x-forwarded-for": "203.0.113.7, 70.41.3.18" });
  assert.equal(clientRateLimitKey(headers), "ip:203.0.113.7");
});

test("rate-limit key falls back to x-real-ip, then to a shared bucket", () => {
  assert.equal(
    clientRateLimitKey(new Headers({ "x-real-ip": "203.0.113.9" })),
    "ip:203.0.113.9",
  );
  // Absent headers collapse into one shared bucket. A missing IP must
  // degrade to *more* limiting, never to unlimited.
  assert.equal(clientRateLimitKey(new Headers()), "ip:unknown");
  assert.equal(
    clientRateLimitKey(new Headers({ "x-forwarded-for": "   " })),
    "ip:unknown",
  );
});

test("only real IP shapes become keys, bounding bucket cardinality", () => {
  // A length check alone would let a caller mint unlimited distinct buckets,
  // inflating the limiter's tables and diluting every bucket.
  for (const junk of [
    "9".repeat(500),
    "not-an-ip",
    "999.999.999.999",
    "1.2.3",
    "<script>alert(1)</script>",
    "203.0.113.7 extra",
  ]) {
    assert.equal(
      clientRateLimitKey(new Headers({ "x-forwarded-for": junk })),
      "ip:unknown",
      `expected rejection for: ${junk}`,
    );
  }
  assert.equal(
    clientRateLimitKey(new Headers({ "x-forwarded-for": "2001:db8::1" })),
    "ip:2001:db8::1",
  );
});

test("request parser rejects unknown keys rather than dropping them", () => {
  assert.throws(
    () =>
      parsePreviewGenerateRequest({
        slug: "a-slug",
        templateId: "editorial",
        customisation: {},
        rogue: "value",
      }),
    /INVALID_PREVIEW_REQUEST/,
  );
});

test("request parser constrains the slug shape", () => {
  const ok = parsePreviewGenerateRequest({
    slug: "ai-qa-test-case-generator",
    templateId: "editorial",
    customisation: {},
  });
  assert.equal(ok.slug, "ai-qa-test-case-generator");

  for (const slug of ["../../etc/passwd", "Has Spaces", "UPPER", "", "-leading"]) {
    assert.throws(
      () =>
        parsePreviewGenerateRequest({ slug, templateId: "editorial", customisation: {} }),
      /INVALID_PREVIEW_REQUEST/,
      `expected rejection for slug: ${slug}`,
    );
  }
});

test("request parser rejects a non-object body", () => {
  for (const bad of [null, "string", 42, []]) {
    assert.throws(
      () => parsePreviewGenerateRequest(bad),
      /INVALID_PREVIEW_REQUEST/,
    );
  }
});
