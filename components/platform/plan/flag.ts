import { buildersHubUiEnabled } from "@/convex/platform/plans";

/**
 * WP44-S10. Every Builder's Hub surface checks this first. `NEXT_PUBLIC_*`
 * is inlined at build time, so turning it on needs a fresh build.
 */
export const BUILDERS_HUB_UI = buildersHubUiEnabled(process.env.NEXT_PUBLIC_BUILDERS_HUB);

/**
 * Where "Upgrade to Builder's Hub" goes. Plan and billing says it is not
 * open yet; the subscription work package points this at checkout.
 */
export const UPGRADE_HREF = "/dashboard/billing#builders-hub";
