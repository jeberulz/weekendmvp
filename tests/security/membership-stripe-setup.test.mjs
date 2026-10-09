import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  MEMBERSHIP_ENV,
  MEMBERSHIP_PRICES,
  MEMBERSHIP_PRODUCTS,
  MEMBERSHIP_STRIPE_API_VERSION,
  MEMBERSHIP_WEBHOOK_EVENTS,
  priceSpec,
  reviewPrice,
} from "../../lib/membership/stripe-catalog.ts";
import { PLANS, PRICING } from "../../convex/platform/plans.ts";
import {
  applyPlan,
  planCatalog,
  readCatalog,
  readOptions,
  readSetupKey,
  redactKeys,
  reviewSettings,
} from "../../scripts/lib/stripe-setup.mjs";

// WP64-S10. The Stripe catalog and the test-mode setup script.

const root = new URL("../../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const PURPOSE = "weekendmvp_membership_v1";
const NO_OPTIONS = { apply: false };

function stripePrice(priceKey, overrides = {}) {
  const spec = priceSpec(priceKey);
  return {
    id: `price_${priceKey}`,
    product: spec.productKey === "builders_hub" ? "prod_hub" : "prod_lifetime",
    active: true,
    livemode: false,
    currency: "usd",
    unit_amount: spec.unitAmount,
    billing_scheme: "per_unit",
    type: spec.recurring ? "recurring" : "one_time",
    recurring: spec.recurring
      ? { interval: spec.recurring.interval, interval_count: 1, usage_type: "licensed" }
      : null,
    lookup_key: spec.lookupKey,
    metadata: { purpose: PURPOSE, price_key: priceKey },
    tax_behavior: "unspecified",
    ...overrides,
  };
}

const PRODUCTS = [
  { id: "prod_hub", active: true, livemode: false, metadata: { purpose: PURPOSE, product_key: "builders_hub" } },
  { id: "prod_lifetime", active: true, livemode: false, metadata: { purpose: PURPOSE, product_key: "founding_lifetime" } },
];
const PRICES = MEMBERSHIP_PRICES.map((spec) => stripePrice(spec.priceKey));

function fakeStripe({ products = [], prices = [], account = {}, endpoints = [], portal = [], denied = [], live = false } = {}) {
  const calls = [];
  let n = 0;
  const guard = (name) => {
    if (denied.includes(name)) throw Object.assign(new Error("denied"), { code: "permission_error" });
  };
  return {
    calls,
    products: {
      list: (params) => {
        calls.push(["products.list", params]);
        return (async function* () {
          for (const product of products) yield product;
        })();
      },
      create: async (params) => {
        calls.push(["products.create", params]);
        return { id: `prod_new${++n}`, active: true, livemode: live, ...params };
      },
      update: async (id, params) => {
        calls.push(["products.update", id, params]);
        return { id, livemode: false, ...params };
      },
    },
    prices: {
      list: async (params) => {
        calls.push(["prices.list", params]);
        return { data: prices.filter((price) => params.lookup_keys.includes(price.lookup_key)) };
      },
      create: async (params) => {
        calls.push(["prices.create", params]);
        return { id: `price_new${++n}`, livemode: live, ...params };
      },
      update: async (id, params) => {
        calls.push(["prices.update", id, params]);
        return { id, livemode: false, ...params };
      },
    },
    accounts: {
      retrieve: async () => {
        guard("account");
        return account;
      },
    },
    webhookEndpoints: {
      list: async () => {
        guard("webhooks");
        return { data: endpoints };
      },
    },
    billingPortal: {
      configurations: {
        list: async () => {
          guard("portal");
          return { data: portal };
        },
      },
    },
  };
}

test("the catalog is PRICING: four prices on two products, unique lookup keys and env names", () => {
  assert.deepEqual(
    MEMBERSHIP_PRICES.map((spec) => [spec.priceKey, spec.unitAmount, spec.recurring?.interval ?? "once", spec.productKey]),
    [
      ["monthly", PRICING.monthly.amountMinor, "month", "builders_hub"],
      ["annual", PRICING.annual.amountMinor, "year", "builders_hub"],
      ["lifetime_t1", PRICING.lifetime.tranches[0].amountMinor, "once", "founding_lifetime"],
      ["lifetime_t2", PRICING.lifetime.tranches[1].amountMinor, "once", "founding_lifetime"],
    ],
  );
  assert.equal(new Set(MEMBERSHIP_PRICES.map((spec) => spec.lookupKey)).size, 4);
  assert.ok(MEMBERSHIP_PRICES.every((spec) => spec.currency === "usd" && spec.lookupKey.startsWith("weekendmvp_membership_")));
  assert.deepEqual(
    MEMBERSHIP_PRODUCTS.map((spec) => spec.name),
    [PLANS.builders_hub.name, `${PLANS.builders_hub.name} Founding Lifetime`],
  );
});

test("every env name is documented, unique and separate from the legacy and WP24 names", async () => {
  const example = await read(".env.example");
  const names = [...Object.values(MEMBERSHIP_ENV), ...MEMBERSHIP_PRICES.map((spec) => spec.envName)];
  assert.equal(new Set(names).size, names.length);
  for (const name of names) assert.match(example, new RegExp(`^${name}=$`, "m"), name);
  for (const name of names.filter((name) => name !== "CRON_SECRET")) {
    assert.match(name, /MEMBERSHIP/, name);
    assert.doesNotMatch(name, /^STRIPE_(SECRET_KEY|WEBHOOK_SECRET)$|PLATFORM/, name);
  }
  // Dormant: no value, so the mode is off.
  assert.match(example, /^MEMBERSHIP_BILLING_MODE=$/m);
});

test("the webhook subscribes to exactly the twelve events S4 handles", async () => {
  assert.equal(MEMBERSHIP_WEBHOOK_EVENTS.length, 12);
  assert.equal(new Set(MEMBERSHIP_WEBHOOK_EVENTS).size, 12);
  const stories = await read("docs/wp/wp64-stories.md");
  const handled = stories.match(/Handled events: (.+?)\. Everything else/)[1];
  assert.deepEqual([...handled.matchAll(/`([a-z_.]+)`/g)].map((m) => m[1]), [...MEMBERSHIP_WEBHOOK_EVENTS]);
});

test("the API version is the one the installed Stripe SDK ships with", async () => {
  const sdk = await read("node_modules/stripe/esm/apiVersion.js");
  assert.match(sdk, new RegExp(`ApiVersion = '${MEMBERSHIP_STRIPE_API_VERSION}'`));
  assert.match(MEMBERSHIP_STRIPE_API_VERSION, /^\d{4}-\d{2}-\d{2}\.[a-z]+$/);
});

test("reviewPrice: a matching price is clean; money differences block; labels only warn", () => {
  for (const spec of MEMBERSHIP_PRICES) {
    assert.deepEqual(reviewPrice(stripePrice(spec.priceKey), spec.priceKey, false), { blocking: [], warnings: [] });
  }
  const blocking = (overrides, key = "monthly", live = false) => reviewPrice(stripePrice(key, overrides), key, live).blocking;
  assert.deepEqual(blocking({ unit_amount: 2_800 }), ["amount 2800, expected 2900 ($29)"]);
  assert.deepEqual(blocking({ currency: "gbp" }), ["currency gbp, expected usd"]);
  assert.deepEqual(blocking({ active: false }), ["price is archived"]);
  assert.deepEqual(blocking({}, "monthly", true), ["price is test mode"]);
  assert.deepEqual(blocking({ billing_scheme: "tiered" }), ["billing scheme tiered, expected per_unit"]);
  assert.deepEqual(blocking({ recurring: { interval: "year", interval_count: 1 } }), ["interval year, expected month"]);
  assert.deepEqual(blocking({ recurring: { interval: "month", interval_count: 3 } }), ["interval count 3, expected 1"]);
  assert.deepEqual(blocking({ recurring: { interval: "month", interval_count: 1, usage_type: "metered" } }), [
    "usage type metered, expected licensed",
  ]);
  assert.deepEqual(blocking({ type: "one_time", recurring: null }), ["type one_time, expected recurring"]);
  assert.deepEqual(blocking({ type: "recurring" }, "lifetime_t1"), ["type recurring, expected one_time"]);
  const review = reviewPrice(stripePrice("annual", { lookup_key: null, metadata: {} }), "annual", false);
  assert.deepEqual(review.blocking, []);
  assert.deepEqual(review.warnings, [
    "lookup key none, expected weekendmvp_membership_annual",
    "metadata purpose is missing, expected weekendmvp_membership_v1",
    "metadata price_key is missing, expected annual",
  ]);
});

test("the setup key must be a test key, and errors never repeat it", () => {
  // Built at runtime so secret scanners never see a key-shaped literal.
  const secret = ["sk", "live", "51NOTAREALKEY"].join("_");
  assert.throws(() => readSetupKey({}), /Set STRIPE_MEMBERSHIP_SETUP_KEY/);
  for (const key of [secret, "rk_live_abc", "pk_test_abc", "sk_test_", "sk_test_abc def"]) {
    assert.throws(
      () => readSetupKey({ STRIPE_MEMBERSHIP_SETUP_KEY: key }),
      (error) => /test-mode key/.test(error.message) && !error.message.includes(key),
      key,
    );
  }
  assert.equal(readSetupKey({ STRIPE_MEMBERSHIP_SETUP_KEY: "sk_test_abc" }), "sk_test_abc");
  assert.equal(readSetupKey({ STRIPE_MEMBERSHIP_SETUP_KEY: "rk_test_abc" }), "rk_test_abc");
});

test("errors from Stripe are printed with any key stripped", async () => {
  assert.equal(
    redactKeys("Invalid API Key provided: sk_test_****abcd; also rk_live_51ABC and pk_test_x"),
    "Invalid API Key provided: [key]; also [key] and [key]",
  );
  assert.equal(redactKeys("No such price: 'price_123'"), "No such price: 'price_123'");
  const cli = await read("scripts/membership-stripe-setup.mjs");
  assert.match(cli, /console\.error\(redactKeys\(/);
  assert.equal(cli.match(/console\.error\(/g).length, 1);
});

test("options: dry run by default, tax choices limited to O1's candidates", () => {
  assert.deepEqual(readOptions([]), { apply: false, taxCode: undefined, taxBehavior: undefined });
  assert.deepEqual(readOptions(["--apply", "--tax-code=txcd_10103000", "--tax-behavior=exclusive"]), {
    apply: true,
    taxCode: "txcd_10103000",
    taxBehavior: "exclusive",
  });
  assert.throws(() => readOptions(["--live"]), /Unknown argument: --live/);
  assert.throws(() => readOptions(["--tax-code=txcd_99999999"]), /decision O1/);
  assert.throws(() => readOptions(["--tax-behavior=unspecified"]), /decision O1/);
});

test("an empty account plans two products and four prices, exactly from the catalog", () => {
  const plan = planCatalog({ products: [], prices: [] }, NO_OPTIONS);
  assert.deepEqual(plan.findings, []);
  assert.deepEqual(
    plan.steps.map((step) => `${step.kind} ${step.priceKey ?? step.productKey}`),
    [
      "createProduct builders_hub",
      "createProduct founding_lifetime",
      "createPrice monthly",
      "createPrice annual",
      "createPrice lifetime_t1",
      "createPrice lifetime_t2",
    ],
  );
  assert.deepEqual(plan.steps[2].params, {
    currency: "usd",
    unit_amount: 2_900,
    recurring: { interval: "month", interval_count: 1 },
    lookup_key: "weekendmvp_membership_monthly",
    nickname: "Monthly",
    metadata: { purpose: PURPOSE, price_key: "monthly" },
  });
  assert.deepEqual(plan.steps[4].params, {
    currency: "usd",
    unit_amount: 24_900,
    lookup_key: "weekendmvp_membership_lifetime_t1",
    nickname: "Founding Lifetime, seats 1 to 15",
    metadata: { purpose: PURPOSE, price_key: "lifetime_t1" },
  });
  assert.deepEqual(plan.steps[0].params.metadata, { purpose: PURPOSE, product_key: "builders_hub" });
  // No tax choice until O1 is ruled.
  assert.ok(plan.steps.every((step) => !("tax_code" in step.params) && !("tax_behavior" in step.params)));
});

test("with O1's choices, new objects carry them and existing ones get them where Stripe allows", () => {
  const options = { apply: true, taxCode: "txcd_10103000", taxBehavior: "exclusive" };
  const fresh = planCatalog({ products: [], prices: [] }, options);
  assert.equal(fresh.steps[0].params.tax_code, "txcd_10103000");
  assert.equal(fresh.steps[2].params.tax_behavior, "exclusive");

  const existing = planCatalog(
    { products: PRODUCTS, prices: [...PRICES.slice(0, 3), stripePrice("lifetime_t2", { tax_behavior: "inclusive" })] },
    options,
  );
  assert.deepEqual(
    existing.steps.map((step) => `${step.kind} ${step.priceKey ?? step.productKey}`),
    [
      "setProductTaxCode builders_hub",
      "setProductTaxCode founding_lifetime",
      "setPriceTaxBehavior monthly",
      "setPriceTaxBehavior annual",
      "setPriceTaxBehavior lifetime_t1",
    ],
  );
  assert.deepEqual(existing.findings, [
    "lifetime_t2: tax behavior is fixed at inclusive. Stripe cannot change it; create a replacement price.",
  ]);
});

test("a complete catalog plans nothing; a wrong price is reported, never edited", () => {
  assert.deepEqual(planCatalog({ products: PRODUCTS, prices: PRICES }, NO_OPTIONS), { steps: [], findings: [] });
  const wrong = planCatalog(
    { products: PRODUCTS, prices: [stripePrice("monthly", { unit_amount: 1_900 }), ...PRICES.slice(1)] },
    NO_OPTIONS,
  );
  assert.deepEqual(wrong.steps, []);
  assert.deepEqual(wrong.findings, ["monthly: amount 1900, expected 2900 ($29). Create a replacement price by hand."]);
  const moved = planCatalog(
    { products: PRODUCTS, prices: [stripePrice("annual", { product: "prod_lifetime" }), ...PRICES.filter((p) => p.id !== "price_annual")] },
    NO_OPTIONS,
  );
  assert.deepEqual(moved.findings, ["annual: the price sits on another product than builders_hub."]);
});

test("foreign products are ignored, duplicates are reported, live objects stop the run", () => {
  const foreign = { id: "prod_shipable", active: true, livemode: false, metadata: { purpose: "something_else", product_key: "builders_hub" } };
  const archived = { ...PRODUCTS[0], id: "prod_old", active: false };
  const plan = planCatalog({ products: [foreign, archived], prices: [] }, NO_OPTIONS);
  assert.equal(plan.steps.filter((step) => step.kind === "createProduct").length, 2);

  const duplicate = planCatalog({ products: [...PRODUCTS, { ...PRODUCTS[0], id: "prod_hub2" }], prices: PRICES }, NO_OPTIONS);
  assert.deepEqual(duplicate.findings, ["2 active products are tagged builders_hub. Archive the extras in Stripe."]);

  assert.throws(() => planCatalog({ products: [{ ...PRODUCTS[0], livemode: true }], prices: [] }, NO_OPTIONS), /live-mode/);
  assert.throws(() => planCatalog({ products: [], prices: [{ ...PRICES[0], livemode: true }] }, NO_OPTIONS), /live-mode/);
});

test("apply creates products first, prices on them, and returns the env lines", async () => {
  const stripe = fakeStripe();
  const catalog = { products: [], prices: [] };
  const env = await applyPlan(stripe, planCatalog(catalog, NO_OPTIONS), catalog);
  const created = stripe.calls.filter(([name]) => name.endsWith(".create"));
  assert.deepEqual(created.map(([name]) => name), [
    "products.create",
    "products.create",
    "prices.create",
    "prices.create",
    "prices.create",
    "prices.create",
  ]);
  assert.deepEqual(created.slice(2).map(([, params]) => params.product), ["prod_new1", "prod_new1", "prod_new2", "prod_new2"]);
  assert.deepEqual(env, {
    STRIPE_MEMBERSHIP_PRICE_MONTHLY: "price_new3",
    STRIPE_MEMBERSHIP_PRICE_ANNUAL: "price_new4",
    STRIPE_MEMBERSHIP_PRICE_LIFETIME_T1: "price_new5",
    STRIPE_MEMBERSHIP_PRICE_LIFETIME_T2: "price_new6",
  });

  const existing = fakeStripe();
  const done = { products: PRODUCTS, prices: PRICES };
  assert.deepEqual(await applyPlan(existing, planCatalog(done, NO_OPTIONS), done), {
    STRIPE_MEMBERSHIP_PRICE_MONTHLY: "price_monthly",
    STRIPE_MEMBERSHIP_PRICE_ANNUAL: "price_annual",
    STRIPE_MEMBERSHIP_PRICE_LIFETIME_T1: "price_lifetime_t1",
    STRIPE_MEMBERSHIP_PRICE_LIFETIME_T2: "price_lifetime_t2",
  });
  assert.deepEqual(existing.calls, []);

  const live = fakeStripe({ live: true });
  await assert.rejects(applyPlan(live, planCatalog(catalog, NO_OPTIONS), catalog), /live-mode/);
  assert.equal(live.calls.length, 1, "stops after the first live object");
});

test("readCatalog keeps only membership products and asks for our lookup keys", async () => {
  const foreign = { id: "prod_x", active: true, livemode: false, metadata: {} };
  const stripe = fakeStripe({ products: [foreign, ...PRODUCTS], prices: [...PRICES, { ...PRICES[0], lookup_key: "other" }] });
  const catalog = await readCatalog(stripe);
  assert.deepEqual(catalog.products.map((product) => product.id), ["prod_hub", "prod_lifetime"]);
  assert.equal(catalog.prices.length, 4);
  const [, params] = stripe.calls.find(([name]) => name === "prices.list");
  assert.deepEqual(params.lookup_keys, MEMBERSHIP_PRICES.map((spec) => spec.lookupKey));
});

test("settings review says set or MISSING, never the value, and survives a key without access", async () => {
  const stripe = fakeStripe({
    account: {
      business_profile: { name: "Seller Ltd", support_email: "help@example.com", url: null },
      settings: { payments: { statement_descriptor: "WEEKENDMVP" }, branding: { icon: "file_1", primary_color: null } },
    },
    endpoints: [
      {
        id: "we_1",
        status: "enabled",
        url: "https://example.com/api/platform/membership/webhook",
        livemode: false,
        enabled_events: [...MEMBERSHIP_WEBHOOK_EVENTS.slice(1), "payment_intent.created"],
      },
      { id: "we_legacy", status: "enabled", url: "https://example.com/api/stripe-webhook", livemode: false, enabled_events: ["*"] },
    ],
    denied: ["portal"],
  });
  const lines = await reviewSettings(stripe);
  const text = lines.join("\n");
  assert.ok(lines.includes("Public business name: set"));
  assert.ok(lines.includes("Support email: set"));
  assert.ok(lines.includes("Business website: MISSING"));
  assert.ok(lines.includes("Branding color: MISSING"));
  assert.ok(lines.includes("Webhook endpoint we_1 (enabled): missing checkout.session.completed; extra payment_intent.created"));
  assert.ok(lines.includes("Customer portal: not readable with this key (permission_error)"));
  assert.doesNotMatch(text, /Seller Ltd|help@example\.com|WEEKENDMVP|we_legacy/);

  const portal = await reviewSettings(
    fakeStripe({
      portal: [
        {
          livemode: false,
          features: {
            subscription_cancel: { enabled: true, mode: "at_period_end" },
            payment_method_update: { enabled: true },
            invoice_history: { enabled: true },
            subscription_pause: { enabled: false },
            subscription_update: { enabled: true, products: [{ product: "prod_hub", adjustable_quantity: { enabled: true } }] },
          },
        },
      ],
    }),
  );
  assert.ok(portal.includes("Portal cancel: at_period_end (want at_period_end)"));
  assert.ok(portal.includes("Portal quantity change: on (want off: one seat per member)"));
  assert.ok(portal.includes("Portal pause: off (want off)"));

  const none = await reviewSettings(fakeStripe({ portal: [] }));
  assert.ok(none.some((line) => line.startsWith("Webhook endpoint for /api/platform/membership/webhook: none")));
  assert.ok(none.includes("Customer portal: no default configuration"));
});

test("the script never deletes, archives or edits money, and never prints a key", async () => {
  const sources = (await read("scripts/lib/stripe-setup.mjs")) + (await read("scripts/membership-stripe-setup.mjs"));
  assert.doesNotMatch(sources, /\.del\(|\.archive|active: false|transfer_lookup_key/);
  // The only amount the script sends is the catalog's, on a new price.
  assert.deepEqual(sources.match(/unit_amount: [^,]+/g), ["unit_amount: spec.unitAmount"]);
  assert.doesNotMatch(sources, /console\.\w+\([^)]*(\bkey\b|readSetupKey|process\.env)/);
  assert.match(sources, /apiVersion: MEMBERSHIP_STRIPE_API_VERSION/);
  // Updates only ever set a tax code or a tax behavior.
  const updates = [...sources.matchAll(/\.update\(step\.id, (\{[^}]+\})\)/g)].map((m) => m[1]);
  assert.deepEqual(updates, ["{ tax_code: step.taxCode }", "{ tax_behavior: step.taxBehavior }"]);
});
