/**
 * WP64-S9. The Builder's Hub Terms, refund policy and privacy section are
 * drafts. They stay out of production until the owner and a lawyer or
 * accountant of the owner's choosing approve the text. Then set this to true
 * in a reviewed commit (WP64-S12 precondition "Terms live and reviewed").
 *
 * A test refuses `true` while any section still names an open decision or a
 * placeholder, so approving cannot ship a draft by accident.
 */
export const MEMBERSHIP_LEGAL_APPROVED = false;

/**
 * Drafts show in local development so the owner can review them. In a
 * production build they 404 until approved. Not tied to the Builder's Hub
 * flag: Stripe needs the Terms live before the first live purchase (S12
 * step 4), which comes before the flag turns on (step 7).
 */
export function legalPagesVisible(nodeEnv: string | undefined = process.env.NODE_ENV): boolean {
  return MEMBERSHIP_LEGAL_APPROVED || nodeEnv !== "production";
}
