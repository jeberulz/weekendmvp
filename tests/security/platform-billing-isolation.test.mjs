import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const files = {
  platformCheckout: new URL(
    "../../app/api/platform/billing/checkout/route.ts",
    import.meta.url,
  ),
  platformWebhook: new URL(
    "../../app/api/platform/billing/webhook/route.ts",
    import.meta.url,
  ),
  legacyWebhook: new URL("../../app/api/stripe-webhook/route.ts", import.meta.url),
  billingPage: new URL("../../app/dashboard/billing/page.tsx", import.meta.url),
  billingWorkspace: new URL(
    "../../components/platform/billing/BillingWorkspace.tsx",
    import.meta.url,
  ),
  convexConfig: new URL("../../convex/convex.config.ts", import.meta.url),
  billingProvider: new URL(
    "../../convex/platform/billing/provider.ts",
    import.meta.url,
  ),
};

test("platform and legacy Stripe handlers remain purpose-separated", async () => {
  const [platformCheckout, platformWebhook, legacyWebhook] = await Promise.all([
    readFile(files.platformCheckout, "utf8"),
    readFile(files.platformWebhook, "utf8"),
    readFile(files.legacyWebhook, "utf8"),
  ]);

  assert.doesNotMatch(platformCheckout, /api\.payments|beehiiv|shipable/i);
  assert.doesNotMatch(platformWebhook, /api\.payments|beehiiv|shipable/i);
  assert.doesNotMatch(legacyWebhook, /platform\.billing|purchase_grant|credit_ledger/);
  assert.match(platformWebhook, /constructEvent\(/);
  assert.match(platformWebhook, /request\.text\(\)/);
  assert.match(platformCheckout, /mode:\s*"payment"/);
  assert.doesNotMatch(platformCheckout, /charges\.create|paymentMethods\.create/);
});

test("platform bridge secret is declared and read through typed Convex env", async () => {
  const [config, provider, webhook] = await Promise.all([
    readFile(files.convexConfig, "utf8"),
    readFile(files.billingProvider, "utf8"),
    readFile(files.platformWebhook, "utf8"),
  ]);
  assert.match(config, /PLATFORM_BILLING_BRIDGE_SECRET:\s*v\.string\(\)/);
  assert.match(provider, /import \{ action, env \}/);
  assert.match(provider, /env\.PLATFORM_BILLING_BRIDGE_SECRET/);
  assert.doesNotMatch(provider, /process\.env/);
  assert.match(webhook, /Unsupported platform billing policy/);
  assert.match(webhook, /status:\s*422/);
});

test("billing UI is private, server-confirmed, and keyboard-operable", async () => {
  const [page, workspace] = await Promise.all([
    readFile(files.billingPage, "utf8"),
    readFile(files.billingWorkspace, "utf8"),
  ]);
  assert.match(page, /robots:\s*\{\s*index:\s*false/);
  assert.match(workspace, /useQuery\(api\.platform\.billing\.queries\.summary/);
  assert.match(workspace, /webhook, not the redirect/);
  assert.match(workspace, /<button/);
  assert.match(workspace, /<label/);
  assert.match(workspace, /role="alert"/);
  assert.doesNotMatch(workspace, /gradient/i);
  assert.doesNotMatch(workspace, /card_number|payment_method_data|client_secret/i);
});
