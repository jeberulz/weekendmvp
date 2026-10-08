import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

// Static pins for WP63-S1: the legacy ship·able payment path stays isolated,
// the log it writes never decides access, and its hand-off is signed.

const root = fileURLToPath(new URL("../../", import.meta.url));

async function read(relativePath) {
  return await readFile(path.join(root, relativePath), "utf8");
}

/** Strips comments so a pinned phrase cannot be satisfied by documentation. */
function code(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

async function sourceFiles(relativeDir, extensions = [".ts", ".tsx"]) {
  const out = [];
  async function walk(dir) {
    for (const entry of await readdir(path.join(root, dir), { withFileTypes: true })) {
      const next = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "_generated" || entry.name === "node_modules") continue;
        await walk(next);
      } else if (
        extensions.some((extension) => entry.name.endsWith(extension)) &&
        !/\.test\.[a-z]+$/.test(entry.name)
      ) {
        out.push(next);
      }
    }
  }
  await walk(relativeDir);
  return out;
}

test("the legacy handler classifies the session before it records or enrolls", async () => {
  const route = code(await read("app/api/stripe-webhook/route.ts"));
  const guard = code(await read("app/api/stripe-webhook/_guard.ts"));

  assert.match(route, /from "\.\/_guard"/);
  const classify = route.indexOf("classifyCheckoutSession(");
  assert.ok(classify > 0, "route must call classifyCheckoutSession");
  for (const later of ["signLegacyPaymentEvent(", "api.payments.recordEvent", "enrollPaidSubscriber(email"]) {
    const at = route.indexOf(later);
    assert.ok(at > classify, `${later} must come after the guard`);
  }
  assert.match(guard, /session\.payment_link == null/);
  assert.match(guard, /session\.metadata\?\.purpose/);
});

test("the legacy handler and the purpose-separated handlers do not reach into each other", async () => {
  const legacy = code(await read("app/api/stripe-webhook/route.ts")) +
    code(await read("app/api/stripe-webhook/_guard.ts"));
  assert.doesNotMatch(legacy, /platform\.billing|platform\.membership|credit_ledger|purchase_grant|plan_grants|plan_subscriptions/);

  const files = [
    ...(await sourceFiles("app/api/platform")),
    ...(await sourceFiles("convex/platform")),
  ];
  assert.ok(files.length > 5, "expected to scan the platform billing files");
  for (const file of files) {
    const source = code(await read(file));
    assert.doesNotMatch(
      source,
      /stripe-webhook|api\.payments|internal\.payments|paymentsBridge|legacy-payments-bridge|from "[^"]*\/payments"/,
      `${file} must not use the legacy payment log or hand-off`,
    );
  }
});

test("the legacy payment log never decides access, entitlement or eligibility", async () => {
  for (const file of await sourceFiles("convex/platform")) {
    const source = code(await read(file));
    assert.doesNotMatch(source, /stripe_events/, `${file} must not read the legacy payment log`);
    if (file !== path.join("convex", "platform", "dashboard.ts")) {
      // The one allowed read is the Home offer card hiding the free Starter Kit
      // card once the member subscribed. It grants nothing. Both tables are
      // publicly writable today, so neither may ever be trusted for access.
      assert.doesNotMatch(
        source,
        /["']subscriptions["']/,
        `${file} must not read the email-list log`,
      );
    }
  }
  for (const file of [
    "convex/platform/plans.ts",
    "convex/platform/planResolver.ts",
    "convex/platform/entitlements.ts",
  ]) {
    assert.doesNotMatch(code(await read(file)), /stripe_events|["']subscriptions["']/, file);
  }
});

test("api.payments.recordEvent has exactly one caller until the contract step removes it", async () => {
  const callers = [];
  for (const dir of ["app", "lib", "components", "convex", "scripts"]) {
    for (const file of await sourceFiles(dir, [".ts", ".tsx", ".mjs", ".js"])) {
      if (code(await read(file)).includes("api.payments.recordEvent")) callers.push(file);
    }
  }
  assert.deepEqual(callers, [path.join("app", "api", "stripe-webhook", "route.ts")]);
});

test("the payment log hand-off is signed, internal and fails closed", async () => {
  const bridge = code(await read("convex/paymentsBridge.ts"));
  const raw = await read("convex/paymentsBridge.ts");
  const payments = code(await read("convex/payments.ts"));
  const config = await read("convex/convex.config.ts");

  assert.match(raw.trimStart(), /^"use node";/);
  assert.match(bridge, /env\.LEGACY_PAYMENTS_BRIDGE_SECRET/);
  assert.doesNotMatch(bridge, /process\.env/);
  const verify = bridge.indexOf("verifyLegacyPaymentEvent(");
  const record = bridge.indexOf("ctx.runMutation(");
  assert.ok(verify > 0 && record > verify, "signature must be verified before recording");
  assert.match(bridge, /internal\.payments\.recordEventInternal/);
  assert.doesNotMatch(bridge, /api\.payments/);

  assert.match(payments, /export const recordEventInternal = internalMutation\(/);
  assert.match(payments, /recordEventInternal = internalMutation\(\{\s*args: eventFields,/);
  assert.match(config, /LEGACY_PAYMENTS_BRIDGE_SECRET:\s*v\.optional\(v\.string\(\)\)/);
});
