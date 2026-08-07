import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { validateLeadBody } from "../../app/api/tenant/lead/_server.ts";

/**
 * WP28-S5. The lead endpoint stores no real lead (owner ruling 2026-08-07),
 * so the property under test is *refusal*, not capture.
 *
 * Comments are stripped before static asserts: these files document their own
 * guardrails, so matching prose would let deleting a comment turn a test
 * green.
 */
async function readCode(path) {
  const source = await readFile(new URL(`../../${path}`, import.meta.url), "utf8");
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*)/.test(line))
    .join("\n");
}

test("an empty body is the accepted shape", () => {
  assert.deepEqual(validateLeadBody({}), { ok: true });
  assert.deepEqual(validateLeadBody(null), { ok: true });
  assert.deepEqual(validateLeadBody(undefined), { ok: true });
});

test("a personal-data key is refused even when its value is empty", () => {
  // The key's presence means the caller believes this endpoint takes one.
  for (const key of ["email", "Email", "e-mail", "e_mail", "EMAIL_ADDRESS"]) {
    const verdict = validateLeadBody({ [key]: "" });
    assert.equal(verdict.ok, false, key);
    assert.equal(verdict.code, "TENANT_LEAD_PERSONAL_DATA_REFUSED", key);
    assert.equal(verdict.status, 422, key);
  }
});

test("every personal-data field family is refused", () => {
  for (const key of [
    "name",
    "firstName",
    "last_name",
    "fullname",
    "phone",
    "telephone",
    "mobile",
    "company",
    "message",
    "comments",
    "notes",
    "address",
    "postcode",
    "zip",
    "city",
    "country",
    "ip",
    "user_id",
  ]) {
    const verdict = validateLeadBody({ [key]: "x" });
    assert.equal(verdict.ok, false, key);
    assert.equal(verdict.code, "TENANT_LEAD_PERSONAL_DATA_REFUSED", key);
  }
});

test("an email-shaped value is refused under any key name", () => {
  // Key allowlisting alone is not enough — the value is what matters.
  for (const key of ["ref", "source", "campaign", "q"]) {
    const verdict = validateLeadBody({ [key]: "someone@example.com" });
    assert.equal(verdict.ok, false, key);
    assert.equal(verdict.code, "TENANT_LEAD_PERSONAL_DATA_REFUSED", key);
  }
});

test("free text is refused however it is labelled", () => {
  const verdict = validateLeadBody({ ref: "x".repeat(41) });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.code, "TENANT_LEAD_PERSONAL_DATA_REFUSED");
  // Just under the bound is fine.
  assert.deepEqual(validateLeadBody({ ref: "x".repeat(40) }), { ok: true });
});

test("nested objects and arrays are refused rather than walked", () => {
  // A recursive scan is exactly where a bypass hides.
  assert.equal(validateLeadBody({ nested: { email: "a@b.co" } }).ok, false);
  assert.equal(validateLeadBody({ nested: ["a@b.co"] }).ok, false);
  assert.equal(validateLeadBody([{ email: "a@b.co" }]).ok, false);
  assert.equal(validateLeadBody("email"). ok, false);
});

test("an oversized body is refused", () => {
  const body = Object.fromEntries(
    Array.from({ length: 9 }, (_, i) => [`k${i}`, "v"]),
  );
  assert.equal(validateLeadBody(body).ok, false);
});

test("the mutation derives every identifier from the hostname", async () => {
  const source = await readCode("convex/platform/sites/leads.ts");
  // Scoped to the write mutation. `listForProject` legitimately takes a
  // `projectId` — it is an owner-scoped read that proves ownership against
  // `requireCurrentPlatformUser` before touching the index, which is a
  // different contract from the anonymous write path asserted here.
  const start = source.indexOf("export const recordSynthetic");
  const end = source.indexOf("export const listForProject");
  assert.ok(start !== -1 && end > start, "could not isolate recordSynthetic");
  const write = source.slice(start, end);

  assert.match(write, /args:\s*\{\s*hostname:\s*v\.string\(\),\s*rateLimitKey:\s*v\.string\(\)\s*\}/);
  // A forged body must not be able to attach a lead to another owner.
  assert.doesNotMatch(write, /args\.(ownerId|projectId|siteConfigId|userId)/);
  assert.match(write, /ownerId:\s*site\.ownerId/);
  assert.match(write, /projectId:\s*site\.projectId/);
  assert.match(write, /siteConfigId:\s*site\._id/);
});

test("only a published site accepts a lead", async () => {
  const source = await readCode("convex/platform/sites/leads.ts");
  assert.match(source, /status !== "published"/);
  assert.match(source, /currentVersionId === undefined/);
  assert.match(source, /version\.status !== "published"/);
});

test("no lead is ever stored with personal data", async () => {
  const source = await readCode("convex/platform/sites/leads.ts");
  assert.match(source, /synthetic:\s*true/);
  // The frozen schema has optional `email` and `payload` columns. Neither may
  // be written here at all — not even blanked, which would make a synthetic
  // row indistinguishable from a real lead whose contents were lost.
  const insert = source.slice(source.indexOf('insert("leads"'));
  assert.doesNotMatch(insert.slice(0, 400), /email:/);
  assert.doesNotMatch(insert.slice(0, 400), /payload:/);
  assert.doesNotMatch(source, /synthetic:\s*false/);
});

test("the rate limit is consumed before the write and throws", async () => {
  const source = await readCode("convex/platform/sites/leads.ts");
  const burstAt = source.indexOf("tenantLeadBurst");
  const insertAt = source.indexOf('insert("leads"');
  assert.ok(burstAt !== -1 && insertAt !== -1);
  assert.ok(burstAt < insertAt, "the lead is written before the limit is consumed");
  assert.match(source, /throws:\s*true/);
});

test("leads are readable only through an owner-scoped query", async () => {
  const source = await readCode("convex/platform/sites/leads.ts");
  assert.match(source, /requireCurrentPlatformUser\(ctx\)/);
  assert.match(source, /project\.ownerId !== user\._id/);
  // Re-checked per row, not trusted from the index alone.
  assert.match(source, /lead\.ownerId === user\._id/);
});

test("the route re-derives the host and never trusts the rewrite", async () => {
  const source = await readCode("app/api/tenant/lead/route.ts");
  assert.match(source, /classifyHost\(request\.headers\.get\("host"\)\)/);
  assert.match(source, /classification\.kind !== "tenant"/);
  assert.doesNotMatch(source, /body\.(hostname|slug|projectId|ownerId)/);
});

test("the endpoint is unreachable from a platform host", async () => {
  const source = await readCode("middleware.ts");
  assert.match(source, /pathname === "\/api\/tenant\/lead"/);
  assert.match(source, /pathname\.startsWith\("\/api\/tenant\/"\)/);
  assert.match(source, /pathname === TENANT_LEAD_PATH/);
});

test("the response echoes nothing about the lead", async () => {
  const source = await readCode("app/api/tenant/lead/route.ts");
  assert.doesNotMatch(source, /console\./);
  assert.match(source, /Response\.json\(\{ ok: true \}, \{ status: 202 \}\)/);
  // Errors carry a code only — never the hostname, body, or a lead id.
  assert.match(source, /Response\.json\(\{ ok: false, code \}/);
});

test("the published templates stay inert — no form was added", async () => {
  const source = await readCode("components/preview/templates/index.tsx");
  // The ruling makes real capture a WP31 item, so rendering a live form here
  // would submit into an endpoint that refuses every genuine visitor.
  assert.doesNotMatch(source, /<form/);
  assert.doesNotMatch(source, /__lead/);
  assert.match(source, /type="button"/);
});
