import { buildersHubUiEnabled } from "@/convex/platform/plans";

/**
 * WP44-S10. Every Builder's Hub surface checks this first. `NEXT_PUBLIC_*`
 * is inlined at build time, so turning it on needs a fresh build.
 */
export const BUILDERS_HUB_UI = buildersHubUiEnabled(process.env.NEXT_PUBLIC_BUILDERS_HUB);

/**
 * Where the sidebar Plan card's "See Builder's Hub" goes: the ladder on Plan
 * and billing. The upgrade sheet starts checkout itself (WP63-S6).
 */
export const UPGRADE_HREF = "/dashboard/billing#builders-hub";
