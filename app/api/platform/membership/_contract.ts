/**
 * WP64-S6. The contract between the dashboard and the membership billing
 * routes. The Checkout route (S3) and the Billing Portal route (S5) import it
 * and must answer in this shape. Pure: the browser imports it too.
 *
 * The browser sends only a term and an idempotency key, never an amount,
 * currency, Price ID, seat or owner (frozen contract 1). It follows only a
 * Stripe-hosted URL (frozen contract 4).
 */

export const MEMBERSHIP_CHECKOUT_PATH = "/api/platform/membership/checkout";
export const MEMBERSHIP_PORTAL_PATH = "/api/platform/membership/portal";

/** Where Stripe sends the member back. S3 builds its success and cancel URLs from these. */
export const MEMBERSHIP_RETURN_PATH = "/dashboard/billing";
export const CHECKOUT_RETURN_PARAM = "checkout";
export const CHECKOUT_RETURN_VALUES = ["return", "cancelled"] as const;
export type CheckoutReturnState = (typeof CHECKOUT_RETURN_VALUES)[number];

export const MEMBERSHIP_TERMS = ["monthly", "annual", "lifetime"] as const;
export type MembershipTerm = (typeof MEMBERSHIP_TERMS)[number];

/** The whole request body. The route rejects any other key. */
export type MembershipCheckoutRequest = { term: MembershipTerm; idempotencyKey: string };

/** The subscription terms a member can switch between. */
export const MEMBERSHIP_SWITCH_TERMS = ["monthly", "annual"] as const;
export type MembershipSwitchTerm = (typeof MEMBERSHIP_SWITCH_TERMS)[number];

/** One change made on a Stripe page for it: a term switch, or cancelling. */
export type MembershipPortalIntent = { switchTo: MembershipSwitchTerm } | { cancel: true };

/**
 * The Billing Portal body: `{}` opens the portal, `{ switchTo }` opens Stripe's
 * confirmation for that one plan switch, and `{ cancel: true }` opens Stripe's
 * cancel confirmation. Never a customer, subscription, price or address.
 */
export type MembershipPortalRequest = Record<string, never> | MembershipPortalIntent;

/** Back from a completed cancel, Stripe returns to Plan and billing with `?plan=cancelled`. */
export const PLAN_RETURN_PARAM = "plan";
export const PLAN_CANCELLED = "cancelled";

/** Letters, digits, `_`, `-` and `:`, 16 to 80 characters. */
export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_:-]{16,80}$/;

/**
 * Error codes the routes answer with, as `{ ok: false, code }`. HTTP status:
 * 401 AUTHENTICATION_REQUIRED, 403 EMAIL_NOT_VERIFIED and ACCOUNT_REVIEW,
 * 409 SOLD_OUT, ALREADY_SUBSCRIBED and NOT_YET_ELIGIBLE (with `opensAt` in
 * milliseconds when known), 429 RATE_LIMITED, 400 INVALID_REQUEST, and 503
 * BILLING_UNAVAILABLE while `MEMBERSHIP_BILLING_MODE` is unset or `off`.
 */
export const MEMBERSHIP_ERROR_CODES = [
  "AUTHENTICATION_REQUIRED",
  "EMAIL_NOT_VERIFIED",
  "ACCOUNT_REVIEW",
  "SOLD_OUT",
  "ALREADY_SUBSCRIBED",
  "NOT_YET_ELIGIBLE",
  "RATE_LIMITED",
  "INVALID_REQUEST",
  "BILLING_UNAVAILABLE",
] as const;
export type MembershipErrorCode = (typeof MEMBERSHIP_ERROR_CODES)[number];

/** What the browser makes of any answer, including a network failure or a route not deployed yet. */
export type MembershipRedirectResult =
  | { ok: true; url: string }
  | { ok: false; code: MembershipErrorCode | "UNKNOWN"; opensAt?: number };

/** Checkout and the Billing Portal are both hosted by Stripe on these hosts. */
export const STRIPE_REDIRECT_HOSTS = ["checkout.stripe.com", "billing.stripe.com"] as const;

export function isStripeRedirect(value: unknown): value is string {
  if (typeof value !== "string") return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return (
    url.protocol === "https:" &&
    url.username === "" &&
    url.password === "" &&
    url.port === "" &&
    (STRIPE_REDIRECT_HOSTS as readonly string[]).includes(url.hostname)
  );
}

/** Reads a route answer. Anything off-contract is UNKNOWN, and a missing route reads as unavailable. */
export function readMembershipRedirect(status: number, body: unknown): MembershipRedirectResult {
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  if (status >= 200 && status < 300 && record.ok === true && isStripeRedirect(record.url)) {
    return { ok: true, url: record.url };
  }
  if (status === 404 || status === 503) return { ok: false, code: "BILLING_UNAVAILABLE" };
  const code = (MEMBERSHIP_ERROR_CODES as readonly unknown[]).includes(record.code)
    ? (record.code as MembershipErrorCode)
    : "UNKNOWN";
  const opensAt =
    code === "NOT_YET_ELIGIBLE" && typeof record.opensAt === "number" && Number.isFinite(record.opensAt)
      ? record.opensAt
      : undefined;
  return opensAt === undefined ? { ok: false, code } : { ok: false, code, opensAt };
}
