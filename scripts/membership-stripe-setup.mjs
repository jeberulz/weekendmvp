#!/usr/bin/env node

/**
 * WP64-S10. Creates and checks the Builder's Hub catalog in Stripe test mode.
 * Read-only unless --apply. Never touches live mode.
 *
 *   STRIPE_MEMBERSHIP_SETUP_KEY=sk_test_... npm run membership:stripe-setup
 *   STRIPE_MEMBERSHIP_SETUP_KEY=sk_test_... npm run membership:stripe-setup -- --apply \
 *     [--tax-code=txcd_10103000] [--tax-behavior=exclusive]
 *
 * --apply creates the products and prices that are missing, from `PRICING`
 * through `lib/membership/stripe-catalog.ts`, and prints the price ids for
 * `.env.local`. Tax code and tax behavior follow decision O1; leave them out
 * until it is ruled. The key needs write access to products and prices, so
 * it is an operator key, not the runtime restricted key. Keep it in your
 * shell, never in a file or on Vercel.
 *
 * The rest of the setup is Dashboard work: docs/wp/evidence/wp64-stripe-setup.md.
 */
import Stripe from "stripe";

import { MEMBERSHIP_STRIPE_API_VERSION } from "../lib/membership/stripe-catalog.ts";
import {
  applyPlan,
  planCatalog,
  readCatalog,
  readOptions,
  readSetupKey,
  redactKeys,
  reviewSettings,
} from "./lib/stripe-setup.mjs";

async function main() {
  const options = readOptions(process.argv.slice(2));
  const stripe = new Stripe(readSetupKey(process.env), {
    apiVersion: MEMBERSHIP_STRIPE_API_VERSION,
    maxNetworkRetries: 2,
    appInfo: { name: "weekendmvp-membership-setup" },
  });

  const catalog = await readCatalog(stripe);
  const plan = planCatalog(catalog, options);

  console.log(`WP64-S10 Stripe setup, test mode, ${new Date().toISOString().slice(0, 10)}`);
  console.log(`API version ${MEMBERSHIP_STRIPE_API_VERSION}. ${options.apply ? "Applying." : "Dry run: nothing changes."}\n`);
  console.log(plan.steps.length ? "To do:" : "Catalog: nothing to create.");
  for (const step of plan.steps) {
    console.log(`  - ${step.kind} ${step.priceKey ?? step.productKey}`);
  }
  if (plan.findings.length) {
    console.log("\nFix by hand:");
    for (const finding of plan.findings) console.log(`  - ${finding}`);
  }

  if (options.apply) {
    const envLines = await applyPlan(stripe, plan, catalog);
    console.log("\nPrice ids for .env.local (test mode, not secrets):");
    for (const [name, id] of Object.entries(envLines)) console.log(`${name}=${id}`);
  }

  console.log("\nSettings:");
  for (const line of await reviewSettings(stripe)) console.log(`  - ${line}`);
  if (plan.findings.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(redactKeys(error instanceof Error ? error.message : "Stripe setup failed"));
  process.exitCode = 1;
});
