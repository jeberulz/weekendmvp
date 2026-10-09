import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

// WP64-S3 static pins. Hosted Checkout only, one mutation per seat
// reservation, and no crossing between the membership, WP24 and legacy paths.

const root = fileURLToPath(new URL("../../", import.meta.url));
const read = (relativePath) => readFile(path.join(root, relativePath), "utf8");
const code = (source) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

async function sourceFiles(relativeDir) {
  const out = [];
  async function walk(dir) {
    let entries;
    try {
      entries = await readdir(path.join(root, dir), { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const next = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (["_generated", "node_modules", ".next"].includes(entry.name)) continue;
        await walk(next);
      } else if (/\.(ts|tsx|mjs|js)$/.test(entry.name) && !/\.test\.[a-z]+$/.test(entry.name)) {
        out.push(next);
      }
    }
  }
  await walk(relativeDir);
  return out;
}

const ROUTE = "app/api/platform/membership/checkout/route.ts";
const SERVER = "app/api/platform/membership/_server.ts";
const CHECKOUT = "convex/platform/membership/checkout.ts";

test("hosted Checkout only: no client secret, embedded mode, Elements or direct charges", async () => {
  const server = code((await read(ROUTE)) + (await read(SERVER)));
  assert.doesNotMatch(server, /client_secret|ui_mode|embedded|charges\.create|paymentIntents\.create|subscriptions\.create/);
  assert.deepEqual([...new Set(server.match(/mode: subscription \? "subscription" : "payment"/g))], [
    'mode: subscription ? "subscription" : "payment"',
  ]);
  for (const dir of ["components", "app"]) {
    for (const file of await sourceFiles(dir)) {
      if (file.startsWith(path.join("app", "api"))) continue;
      const source = code(await read(file));
      assert.doesNotMatch(source, /@stripe\/stripe-js|loadStripe|client_secret|from "stripe"/, file);
    }
  }
});

test("the route pins the API version, uses an idempotency key per order and logs no detail", async () => {
  const route = code(await read(ROUTE));
  const server = code(await read(SERVER));
  assert.match(server, /apiVersion: MEMBERSHIP_STRIPE_API_VERSION/);
  assert.match(route, /idempotencyKey: `membership-checkout:\$\{begun\.orderId\}`/);
  const logs = route.match(/console\.\w+\([^;]*\);/g) ?? [];
  assert.equal(logs.length, 1);
  assert.doesNotMatch(logs[0], /email|token|message|body|payload|input/);
});

test("a seat is read and reserved inside the one begin mutation", async () => {
  const checkout = code(await read(CHECKOUT));
  const start = checkout.indexOf("export const begin = internalMutation(");
  const end = checkout.indexOf("export const attachSession");
  assert.ok(start > 0 && end > start, "begin must be an internal mutation before attachSession");
  const begin = checkout.slice(start, end);
  assert.match(begin, /\.query\("founding_seats"\)/);
  assert.match(begin, /ctx\.db\.patch\("founding_seats", seat\._id/);
  assert.match(begin, /assertFoundingEligible\(ctx, member, now\)/);
  // No other file writes a seat except the operator seed and the S4 settlement.
  const EVENTS = path.join("convex", "platform", "membership", "events.ts");
  for (const file of await sourceFiles("convex")) {
    if (file === CHECKOUT || file === EVENTS || file === path.join("convex", "platform", "membership", "seats.ts")) continue;
    assert.doesNotMatch(code(await read(file)), /ctx\.db\.(insert|patch|replace|delete)\(\s*"founding_seats"/, file);
  }
  // Settlement takes or frees a seat. It never reserves, inserts or deletes one.
  const events = code(await read(EVENTS));
  assert.doesNotMatch(events, /ctx\.db\.(insert|replace|delete)\(\s*"founding_seats"/);
  const patches = [...events.matchAll(/ctx\.db\.patch\("founding_seats", [^,]+, \{\s*status: "(\w+)"/g)].map((m) => m[1]);
  assert.ok(patches.length >= 2, "settlement patches seats");
  assert.deepEqual([...new Set(patches)].sort(), ["free", "taken"]);
  assert.equal(events.match(/ctx\.db\.patch\("founding_seats"/g)?.length, patches.length, "every seat patch sets a status first");
});

test("membership, WP24 credits and the legacy ship·able handler never import each other", async () => {
  const membership = [...(await sourceFiles("app/api/platform/membership")), CHECKOUT, "convex/platform/membership/provider.ts"];
  for (const file of membership) {
    assert.doesNotMatch(code(await read(file)), /platform\/billing|stripe-webhook|legacy-payments-bridge/, file);
  }
  const others = [
    ...(await sourceFiles("app/api/platform/billing")),
    ...(await sourceFiles("app/api/stripe-webhook")),
    ...(await sourceFiles("convex/platform/billing")),
  ];
  for (const file of others) {
    assert.doesNotMatch(code(await read(file)), /membership/, file);
  }
});

test("the bridge never carries an owner: Convex reads it from the member's own session", async () => {
  const bridge = code(await read("lib/membership-bridge.ts"));
  assert.doesNotMatch(bridge, /ownerId|userId|email/);
  const checkout = code(await read(CHECKOUT));
  assert.equal(checkout.match(/requireCurrentPlatformUserForMutation\(ctx\)/g)?.length, 3);
  assert.doesNotMatch(checkout, /args\.ownerId|args\.userId/);
});
