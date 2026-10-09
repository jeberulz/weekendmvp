import type Stripe from "stripe";

/**
 * Which Checkout Sessions the legacy ship·able handler may act on (WP64-S1).
 *
 * This endpoint is subscribed to every `checkout.session.completed` on the
 * Stripe account, so it also receives sessions it does not own: Builder's Hub
 * and credit-pack checkouts are created through the API. Acting on those would
 * enroll a buyer in the workshop emails and write to the legacy payment log.
 *
 * ship·able seats are sold through a Payment Link, which always sets
 * `payment_link` on the session. API-created sessions never do. Any session
 * that carries a `purpose` marker belongs to a purpose-separated handler.
 */

export type CheckoutSessionVerdict =
  | { handle: true }
  | { handle: false; reason: "foreign_purpose" | "not_payment_link" };

export function classifyCheckoutSession(
  session: Stripe.Checkout.Session,
): CheckoutSessionVerdict {
  if (session.metadata?.purpose) return { handle: false, reason: "foreign_purpose" };
  if (session.payment_link == null) return { handle: false, reason: "not_payment_link" };
  return { handle: true };
}
