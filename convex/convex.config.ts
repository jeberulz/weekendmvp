import rateLimiter from "@convex-dev/rate-limiter/convex.config";
import { defineApp } from "convex/server";
import { v } from "convex/values";

const app = defineApp({
  env: {
    PLATFORM_BILLING_BRIDGE_SECRET: v.string(),
    // WP63-S1. Signs the legacy ship·able payment log hand-off. Optional so a
    // deploy without it boots; `paymentsBridge.accept` fails closed when it is
    // unset or under 32 characters. Set it in Convex before Vercel.
    LEGACY_PAYMENTS_BRIDGE_SECRET: v.optional(v.string()),
    // WP27-S2. Gates anonymous preview generation so the Next.js route,
    // which is the only place a client IP is observable and therefore the
    // only place a per-IP limit can be applied, is the sole path to artifact
    // creation. Without it the generation mutation is directly callable and
    // the rate limit is trivially bypassable. Optional so that existing
    // local and CI deployments keep booting; generation fails closed when it
    // is unset rather than running unprotected.
    PLATFORM_PREVIEW_BRIDGE_SECRET: v.optional(v.string()),
    // WP46-E4a. The owner's sign-in email, read only by the internal
    // `admin/superAdmin:bootstrapOwner` mutation to bind the super-admin
    // capability to that verified account's user ID. Deployment configuration
    // only — never committed, never compared at request time. Optional: with
    // it unset, bootstrap refuses and the editorial workspace stays closed.
    SUPER_ADMIN_BOOTSTRAP_EMAIL: v.optional(v.string()),
    // WP46-E7. Release settings stay optional while publication is disabled;
    // the worker refuses to advance a release until the target is configured.
    EDITORIAL_PUBLIC_SITE_URL: v.optional(v.string()),
    EDITORIAL_READER_COMMIT: v.optional(v.string()),
    // Only isolated, non-serving cloud restore drills may set these values.
    // The worker requires an exact backend match before sending the bypass
    // token to a protected, pinned Vercel deployment.
    EDITORIAL_STAGING_BACKEND_URL: v.optional(v.string()),
    EDITORIAL_STAGING_BYPASS_SECRET: v.optional(v.string()),
  },
});

// WP27-S2. Per the Convex guidelines, hand-rolled counters race under
// concurrency and lose quota when a mutation fails. Anonymous preview
// generation is the one endpoint a stranger can drive, so it uses the
// component rather than a bespoke window scan.
app.use(rateLimiter);

export default app;
