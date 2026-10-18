import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

describe("live workshop Stripe isolation", () => {
  test("uses a dedicated purpose and does not touch legacy/membership catalogs", () => {
    const catalog = read("lib/live/stripe-catalog.ts");
    assert.match(catalog, /weekendmvp_workshop_v1/);
    assert.match(catalog, /weekendmvp_buildalong_20261114_early/);
    assert.match(catalog, /weekendmvp_buildalong_20261114_regular/);
    assert.match(catalog, /STRIPE_LIVE_WORKSHOP_PRICE_EARLY/);
    assert.match(catalog, /STRIPE_LIVE_WORKSHOP_PRICE_STANDARD/);
    assert.match(catalog, /automatic_tax/);
    assert.match(catalog, /Rulz&Co/);

    const membership = read("lib/membership/stripe-catalog.ts");
    assert.doesNotMatch(membership, /LIVE_WORKSHOP|build_along|build-along|workshop_v1/);

    const legacyGuard = read("app/api/stripe-webhook/_guard.ts");
    assert.match(legacyGuard, /foreign_purpose/);
    assert.doesNotMatch(legacyGuard, /build_along|LIVE_WORKSHOP|workshop_v1/);

    const liveCheckout = read("app/api/live/checkout/route.ts");
    assert.match(liveCheckout, /LIVE_WORKSHOP|live workshop|begin_checkout/i);
    assert.match(liveCheckout, /convexAuthNextjsToken/);
    assert.doesNotMatch(liveCheckout, /shipable-workshop|BEEHIIV_PAID_AUTOMATION|managed_payments/);

    const liveWebhook = read("app/api/live/webhook/route.ts");
    assert.match(liveWebhook, /LIVE_WORKSHOP_PURPOSE/);
    assert.match(liveWebhook, /checkout\.session\.expired/);
    assert.match(liveWebhook, /checkout\.session\.async_payment_succeeded/);
    assert.match(liveWebhook, /checkout\.session\.async_payment_failed/);
    assert.match(liveWebhook, /payment_status !== "paid"/);
    assert.match(liveWebhook, /charge\.refunded !== true/);
    assert.doesNotMatch(liveWebhook, /recordEvent|paymentsBridge/);

    const catalogEvents = read("lib/live/stripe-catalog.ts");
    assert.match(catalogEvents, /txcd_20060045/);
    assert.match(catalogEvents, /async_payment_succeeded/);

    const server = read("app/api/live/_server.ts");
    assert.match(server, /automatic_tax:\s*\{\s*enabled:\s*true/);
    assert.match(server, /billing_address_collection:\s*"required"/);
    assert.match(server, /payment_method_types:\s*\[\s*"card"\s*\]/);
    assert.doesNotMatch(server, /managed_payments/);
  });

  test("refund policy ships the live workshop section", () => {
    const legal = read("lib/legal/content.ts");
    assert.match(legal, /id: "live-workshop-tickets"/);
    assert.match(legal, /Live workshop tickets/);
    assert.match(legal, /or your workshop replay/);
  });
});
