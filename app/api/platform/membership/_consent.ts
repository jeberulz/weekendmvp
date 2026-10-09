import { MEMBERSHIP_LEGAL_LINKS, PLANS, PRICING, formatUsd, type MembershipTerm } from "@/convex/platform/plans";

/**
 * WP64-S9. The sentence a buyer agrees to on Stripe Checkout, sent by S3 as
 * `custom_text.terms_of_service_acceptance.message` with
 * `consent_collection.terms_of_service: "required"`. One sentence states the
 * price, the renewal and the 30-day refund, and links the Terms and the
 * refund policy (S3 acceptance criteria). Amounts come from `PRICING`.
 *
 * Stripe renders Markdown links in this text and caps it at 1,200 characters.
 */

export const CONSENT_MAX_LENGTH = 1200;

const [TERMS_LINK, REFUND_LINK] = MEMBERSHIP_LEGAL_LINKS;

const PRICE_AND_RENEWAL: Record<MembershipTerm, (amount: string) => string> = {
  monthly: (amount) => `${amount} a month, renewing every month until I cancel`,
  annual: (amount) => `${amount} a year, renewing every year until I cancel`,
  lifetime: (amount) => `${amount} once, with no renewal`,
};

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

/** An https origin, or http on this machine for test mode. Nothing after the host. */
function readOrigin(origin: string): string {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    throw new Error("Consent origin is not a URL");
  }
  const secure = url.protocol === "https:" || (url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname));
  if (!secure || url.origin !== origin) throw new Error("Consent origin must be a bare https origin");
  return url.origin;
}

/** The term's amount. A lifetime seat's price is fixed by its tranche, so S3 passes it. */
function amountFor(term: MembershipTerm, lifetimeAmountMinor: number | undefined): number {
  if (term === "monthly") return PRICING.monthly.amountMinor;
  if (term === "annual") return PRICING.annual.amountMinor;
  const tranche = PRICING.lifetime.tranches.find((t) => t.amountMinor === lifetimeAmountMinor);
  if (!tranche) throw new Error("Lifetime consent needs a tranche amount");
  return tranche.amountMinor;
}

export function checkoutConsentMessage({
  term,
  origin,
  lifetimeAmountMinor,
}: {
  term: MembershipTerm;
  origin: string;
  lifetimeAmountMinor?: number;
}): string {
  const base = readOrigin(origin);
  const price = PRICE_AND_RENEWAL[term](formatUsd(amountFor(term, lifetimeAmountMinor)));
  // A test holds every term under CONSENT_MAX_LENGTH, so copy changes fail in CI, not at checkout.
  return (
    `I agree to the [${PLANS.builders_hub.name} ${TERMS_LINK.label}](${base}${TERMS_LINK.href}): ${price}, ` +
    `with a full refund within 30 days of my first payment under the [${REFUND_LINK.label.toLowerCase()}](${base}${REFUND_LINK.href}).`
  );
}
