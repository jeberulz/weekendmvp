/**
 * WP64-S9. The Builder's Hub Terms, refund policy and privacy section.
 * Approved by the owner on 2026-10-09 (rulings "WP64 / Terms sign-off" and
 * "WP64 / legal pages live"), so they show in production, in the footer and
 * in the sitemap. Set back to false to hide them again.
 *
 * A test refuses `true` while any section still names an open decision or a
 * placeholder, so approving cannot ship a draft by accident.
 */
export const MEMBERSHIP_LEGAL_APPROVED = true;

/**
 * Drafts show in local development so the owner can review them. In a
 * production build they 404 until approved. Not tied to the Builder's Hub
 * flag: Stripe needs the Terms live before the first live purchase (S12
 * step 4), which comes before the flag turns on (step 7).
 */
export function legalPagesVisible(nodeEnv: string | undefined = process.env.NODE_ENV): boolean {
  return MEMBERSHIP_LEGAL_APPROVED || nodeEnv !== "production";
}
