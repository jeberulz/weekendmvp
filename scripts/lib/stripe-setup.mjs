/**
 * WP64-S10. The logic behind `scripts/membership-stripe-setup.mjs`, with the
 * Stripe client passed in so tests can use a fake. Test mode only: the key
 * must be a test key, and any live object stops the run.
 *
 * It creates only what is missing (two products, four prices) and never
 * edits an amount, a currency or an interval. A price that differs from
 * `PRICING` is reported for the operator to replace by hand.
 */
import {
  MEMBERSHIP_ENV,
  MEMBERSHIP_PRICES,
  MEMBERSHIP_PRODUCTS,
  MEMBERSHIP_TAX_CODE_CANDIDATES,
  MEMBERSHIP_WEBHOOK_EVENTS,
  MEMBERSHIP_WEBHOOK_PATH,
  priceMetadata,
  productMetadata,
  reviewPrice,
} from "../../lib/membership/stripe-catalog.ts";
import { MEMBERSHIP_BILLING_PURPOSE } from "../../convex/platform/membership/validators.ts";

const TEST_KEY = /^(sk|rk)_test_[A-Za-z0-9]+$/;
const TAX_BEHAVIORS = ["exclusive", "inclusive"];

/** Stripe masks keys in its messages; this strips any key-shaped text anyway. */
export function redactKeys(message) {
  return message.replace(/\b(sk|rk|pk)_(test|live)_[A-Za-z0-9*]+/g, "[key]");
}

/** The setup key, or an error that never repeats the value. */
export function readSetupKey(env) {
  const key = env[MEMBERSHIP_ENV.setupKey] ?? "";
  if (key === "") throw new Error(`Set ${MEMBERSHIP_ENV.setupKey} to a test-mode key (sk_test_ or rk_test_).`);
  if (!TEST_KEY.test(key)) {
    throw new Error(`${MEMBERSHIP_ENV.setupKey} must be a test-mode key. WP64-S10 never touches live mode.`);
  }
  return key;
}

export function readOptions(argv) {
  const value = (prefix) => argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  const known = /^--(apply|tax-code=.+|tax-behavior=.+)$/;
  const unknown = argv.filter((arg) => !known.test(arg));
  if (unknown.length > 0) throw new Error(`Unknown argument: ${unknown[0]}`);
  const taxCode = value("--tax-code=");
  if (taxCode !== undefined && !(taxCode in MEMBERSHIP_TAX_CODE_CANDIDATES)) {
    throw new Error(`--tax-code must be one of ${Object.keys(MEMBERSHIP_TAX_CODE_CANDIDATES).join(", ")} (decision O1).`);
  }
  const taxBehavior = value("--tax-behavior=");
  if (taxBehavior !== undefined && !TAX_BEHAVIORS.includes(taxBehavior)) {
    throw new Error("--tax-behavior must be exclusive or inclusive (decision O1).");
  }
  return { apply: argv.includes("--apply"), taxCode, taxBehavior };
}

const isOurs = (object, key, value) =>
  object.metadata?.purpose === MEMBERSHIP_BILLING_PURPOSE && object.metadata?.[key] === value;
const idOf = (ref) => (typeof ref === "string" ? ref : ref?.id);

function assertTestMode(objects) {
  if (objects.some((object) => object.livemode)) {
    throw new Error("Stripe returned a live-mode object. Stopping: WP64-S10 is test mode only.");
  }
}

/**
 * What to create or set, from the products and prices already in Stripe.
 * `findings` are problems the script will not fix on its own.
 */
export function planCatalog({ products, prices }, options) {
  assertTestMode([...products, ...prices]);
  const steps = [];
  const findings = [];
  const productIds = {};

  for (const spec of MEMBERSHIP_PRODUCTS) {
    const matches = products.filter((product) => product.active && isOurs(product, "product_key", spec.key));
    if (matches.length > 1) {
      findings.push(`${matches.length} active products are tagged ${spec.key}. Archive the extras in Stripe.`);
      continue;
    }
    const [product] = matches;
    if (!product) {
      steps.push({
        kind: "createProduct",
        productKey: spec.key,
        params: {
          name: spec.name,
          description: spec.description,
          metadata: productMetadata(spec.key),
          ...(options.taxCode ? { tax_code: options.taxCode } : {}),
        },
      });
      continue;
    }
    productIds[spec.key] = product.id;
    if (options.taxCode && idOf(product.tax_code) !== options.taxCode) {
      steps.push({ kind: "setProductTaxCode", productKey: spec.key, id: product.id, taxCode: options.taxCode });
    }
  }

  for (const spec of MEMBERSHIP_PRICES) {
    const price = prices.find((candidate) => candidate.lookup_key === spec.lookupKey);
    if (!price) {
      steps.push({
        kind: "createPrice",
        priceKey: spec.priceKey,
        productKey: spec.productKey,
        params: {
          currency: spec.currency,
          unit_amount: spec.unitAmount,
          ...(spec.recurring
            ? { recurring: { interval: spec.recurring.interval, interval_count: spec.recurring.intervalCount } }
            : {}),
          lookup_key: spec.lookupKey,
          nickname: spec.nickname,
          metadata: priceMetadata(spec.priceKey),
          ...(options.taxBehavior ? { tax_behavior: options.taxBehavior } : {}),
        },
      });
      continue;
    }
    const review = reviewPrice(price, spec.priceKey, false);
    for (const item of review.blocking) findings.push(`${spec.priceKey}: ${item}. Create a replacement price by hand.`);
    for (const item of review.warnings) findings.push(`${spec.priceKey}: ${item}.`);
    const productId = productIds[spec.productKey];
    if (productId && idOf(price.product) !== productId) {
      findings.push(`${spec.priceKey}: the price sits on another product than ${spec.productKey}.`);
    }
    if (options.taxBehavior && price.tax_behavior !== options.taxBehavior) {
      if (!price.tax_behavior || price.tax_behavior === "unspecified") {
        steps.push({ kind: "setPriceTaxBehavior", priceKey: spec.priceKey, id: price.id, taxBehavior: options.taxBehavior });
      } else {
        findings.push(
          `${spec.priceKey}: tax behavior is fixed at ${price.tax_behavior}. Stripe cannot change it; create a replacement price.`,
        );
      }
    }
  }
  return { steps, findings };
}

/** Runs the plan. Returns the price ids by env name, for `.env.local`. */
export async function applyPlan(stripe, plan, { products, prices }) {
  const productIds = Object.fromEntries(
    MEMBERSHIP_PRODUCTS.map((spec) => [
      spec.key,
      products.find((product) => product.active && isOurs(product, "product_key", spec.key))?.id,
    ]),
  );
  const priceIds = Object.fromEntries(
    MEMBERSHIP_PRICES.map((spec) => [spec.priceKey, prices.find((price) => price.lookup_key === spec.lookupKey)?.id]),
  );
  for (const step of plan.steps) {
    if (step.kind === "createProduct") {
      const created = await stripe.products.create(step.params);
      assertTestMode([created]);
      productIds[step.productKey] = created.id;
    } else if (step.kind === "setProductTaxCode") {
      assertTestMode([await stripe.products.update(step.id, { tax_code: step.taxCode })]);
    } else if (step.kind === "createPrice") {
      const product = productIds[step.productKey];
      if (!product) throw new Error(`No product for ${step.productKey}; resolve the findings first.`);
      const created = await stripe.prices.create({ ...step.params, product });
      assertTestMode([created]);
      priceIds[step.priceKey] = created.id;
    } else if (step.kind === "setPriceTaxBehavior") {
      assertTestMode([await stripe.prices.update(step.id, { tax_behavior: step.taxBehavior })]);
    }
  }
  return Object.fromEntries(MEMBERSHIP_PRICES.map((spec) => [spec.envName, priceIds[spec.priceKey] ?? ""]));
}

/** Reads the products tagged for membership and the prices with our lookup keys. */
export async function readCatalog(stripe) {
  const products = [];
  for await (const product of stripe.products.list({ limit: 100 })) {
    if (product.metadata?.purpose === MEMBERSHIP_BILLING_PURPOSE) products.push(product);
  }
  const prices = (
    await stripe.prices.list({ lookup_keys: MEMBERSHIP_PRICES.map((spec) => spec.lookupKey), limit: 10 })
  ).data;
  return { products, prices };
}

const set = (value) => (value ? "set" : "MISSING");

/**
 * Account, webhook and portal settings the API can read. Values are never
 * printed, only whether they are set. A key without read access says so.
 */
export async function reviewSettings(stripe) {
  const lines = [];
  const attempt = async (label, read) => {
    try {
      await read();
    } catch (error) {
      lines.push(`${label}: not readable with this key (${error?.code ?? error?.type ?? "error"})`);
    }
  };
  await attempt("Account", async () => {
    const account = await stripe.accounts.retrieve();
    lines.push(`Public business name: ${set(account.business_profile?.name)}`);
    lines.push(`Support email: ${set(account.business_profile?.support_email)}`);
    lines.push(`Business website: ${set(account.business_profile?.url)}`);
    lines.push(`Statement descriptor: ${set(account.settings?.payments?.statement_descriptor)}`);
    lines.push(`Branding icon or logo: ${set(account.settings?.branding?.icon || account.settings?.branding?.logo)}`);
    lines.push(`Branding color: ${set(account.settings?.branding?.primary_color)}`);
  });
  await attempt("Webhook endpoints", async () => {
    const endpoints = (await stripe.webhookEndpoints.list({ limit: 100 })).data.filter((endpoint) =>
      new URL(endpoint.url).pathname.endsWith(MEMBERSHIP_WEBHOOK_PATH),
    );
    assertTestMode(endpoints);
    if (endpoints.length === 0) {
      lines.push(`Webhook endpoint for ${MEMBERSHIP_WEBHOOK_PATH}: none (fine locally with \`stripe listen\`)`);
    }
    for (const endpoint of endpoints) {
      const events = new Set(endpoint.enabled_events);
      const missing = MEMBERSHIP_WEBHOOK_EVENTS.filter((event) => !events.has(event) && !events.has("*"));
      const extra = [...events].filter((event) => !MEMBERSHIP_WEBHOOK_EVENTS.includes(event));
      lines.push(
        `Webhook endpoint ${endpoint.id} (${endpoint.status}): ${missing.length ? `missing ${missing.join(", ")}` : "all events"}` +
          (extra.length ? `; extra ${extra.join(", ")}` : ""),
      );
    }
  });
  await attempt("Customer portal", async () => {
    const [config] = (
      await stripe.billingPortal.configurations.list({
        is_default: true,
        limit: 1,
        expand: ["data.features.subscription_update.products"],
      })
    ).data;
    if (!config) {
      lines.push("Customer portal: no default configuration");
      return;
    }
    assertTestMode([config]);
    const features = config.features ?? {};
    lines.push(
      `Portal cancel: ${features.subscription_cancel?.enabled ? features.subscription_cancel.mode : "off"} (want at_period_end)`,
    );
    lines.push(`Portal payment method update: ${features.payment_method_update?.enabled ? "on" : "off"} (want on)`);
    lines.push(`Portal invoice history: ${features.invoice_history?.enabled ? "on" : "off"} (want on)`);
    lines.push(
      `Portal plan switch: ${features.subscription_update?.enabled ? "on" : "off"} (want on, monthly and annual only)`,
    );
    // Stripe turns quantity changes on by default for a product added to the portal.
    const quantity = (features.subscription_update?.products ?? []).some((item) => item.adjustable_quantity?.enabled);
    lines.push(`Portal quantity change: ${quantity ? "on" : "off"} (want off: one seat per member)`);
    lines.push(`Portal pause: ${features.subscription_pause?.enabled ? "on" : "off"} (want off)`);
  });
  lines.push("Smart Retries, dunning, renewal reminders and failed-payment emails: Dashboard only, check by hand");
  return lines;
}
