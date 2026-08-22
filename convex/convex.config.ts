import rateLimiter from "@convex-dev/rate-limiter/convex.config";
import { defineApp } from "convex/server";
import { v } from "convex/values";

const app = defineApp({
  env: {
    PLATFORM_BILLING_BRIDGE_SECRET: v.string(),
    // WP27-S2. Gates anonymous preview generation so the Next.js route,
    // which is the only place a client IP is observable and therefore the
    // only place a per-IP limit can be applied, is the sole path to artifact
    // creation. Without it the generation mutation is directly callable and
    // the rate limit is trivially bypassable. Optional so that existing
    // local and CI deployments keep booting; generation fails closed when it
    // is unset rather than running unprotected.
    PLATFORM_PREVIEW_BRIDGE_SECRET: v.optional(v.string()),
    // WP39. Anonymous Starter Kit feedback is accepted only through the
    // Next.js route that can derive a per-IP rate-limit key. Optional keeps
    // existing deployments bootable; feedback fails closed when it is unset.
    STARTER_KIT_FEEDBACK_BRIDGE_SECRET: v.optional(v.string()),
  },
});

// WP27-S2. Per the Convex guidelines, hand-rolled counters race under
// concurrency and lose quota when a mutation fails. Anonymous preview
// generation is the one endpoint a stranger can drive, so it uses the
// component rather than a bespoke window scan.
app.use(rateLimiter);

export default app;
