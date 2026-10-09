import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import type Stripe from "stripe";
import { api } from "@/convex/_generated/api";
import { MEMBERSHIP_BILLING_PURPOSE } from "@/convex/platform/membership/validators";
import { signMembershipBridge } from "@/lib/membership-bridge";
import {
  MEMBERSHIP_RETURN_PATH,
  MEMBERSHIP_SWITCH_TERMS,
  PLAN_CANCELLED,
  PLAN_RETURN_PARAM,
  isStripeRedirect,
  type MembershipPortalRequest,
  type MembershipSwitchTerm,
} from "../_contract";
import { errorSummary } from "../_events";
import {
  assertPriceMatches,
  createMembershipStripe,
  membershipError,
  readMembershipBillingConfig,
  type MembershipBillingConfig,
} from "../_server";

/** `{}`, `{ switchTo }` alone with a subscription term, or `{ cancel: true }` alone. Anything else is refused. */
function parsePortalRequest(value: unknown): MembershipPortalRequest | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const keys = Object.keys(value);
  if (keys.length === 0) return {};
  if (keys.length !== 1) return null;
  if (keys[0] === "cancel") return (value as { cancel: unknown }).cancel === true ? { cancel: true } : null;
  if (keys[0] !== "switchTo") return null;
  const switchTo = (value as { switchTo: unknown }).switchTo;
  return MEMBERSHIP_SWITCH_TERMS.find((term) => term === switchTo) ? { switchTo: switchTo as MembershipSwitchTerm } : null;
}

type Flow = Stripe.BillingPortal.SessionCreateParams.FlowData;
type Found = { customerId: string; subscriptionId: string };

/** The subscription Convex named, or "refused" when it is not this customer's, not ours, or in the other mode. */
async function ownSubscription(
  stripe: Stripe,
  config: MembershipBillingConfig,
  found: Found,
): Promise<Stripe.Subscription | "refused"> {
  const subscription = await stripe.subscriptions.retrieve(found.subscriptionId);
  const customer = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
  if (
    customer !== found.customerId ||
    subscription.metadata?.purpose !== MEMBERSHIP_BILLING_PURPOSE ||
    subscription.livemode !== config.livemode
  ) {
    return "refused";
  }
  return subscription;
}

const ending = (subscription: Stripe.Subscription) => subscription.cancel_at_period_end || subscription.cancel_at !== null;

/**
 * Stripe's confirmation page for one switch on the member's own subscription,
 * to our own Price. Refused when the subscription is not this customer's, not
 * ours, or not one seat. Null, so the portal home opens instead, when there is
 * nothing to switch: the plan is not active, already ends, already has a
 * switch scheduled, or is not on the other term. The portal shows what is set.
 */
async function switchFlow(
  stripe: Stripe,
  config: MembershipBillingConfig,
  found: Found,
  to: MembershipSwitchTerm,
  returnUrl: string,
): Promise<Flow | null | "refused"> {
  await assertPriceMatches(stripe, config, to);
  const subscription = await ownSubscription(stripe, config, found);
  if (subscription === "refused") return "refused";
  const items = subscription.items?.data ?? [];
  if (items.length !== 1 || items[0].quantity !== 1) return "refused";
  const from = to === "annual" ? config.priceIds.monthly : config.priceIds.annual;
  if (subscription.status !== "active" || ending(subscription) || subscription.schedule !== null || items[0].price.id !== from) {
    return null;
  }
  return {
    type: "subscription_update_confirm",
    subscription_update_confirm: {
      subscription: subscription.id,
      items: [{ id: items[0].id, price: config.priceIds[to], quantity: 1 }],
    },
    after_completion: { type: "redirect", redirect: { return_url: returnUrl } },
  };
}

/**
 * Stripe's cancel confirmation for the member's own subscription. The portal
 * configuration cancels at the end of the paid period. Null, so the portal
 * home opens instead, when there is nothing to cancel here: the plan already
 * ends (the portal offers to renew it), is neither active nor past due, or
 * has a switch scheduled (the portal shows it).
 */
async function cancelFlow(
  stripe: Stripe,
  config: MembershipBillingConfig,
  found: Found,
  returnUrl: string,
): Promise<Flow | null | "refused"> {
  const subscription = await ownSubscription(stripe, config, found);
  if (subscription === "refused") return "refused";
  const running = subscription.status === "active" || subscription.status === "past_due";
  if (!running || ending(subscription) || subscription.schedule !== null) return null;
  return {
    type: "subscription_cancel",
    subscription_cancel: { subscription: subscription.id },
    after_completion: { type: "redirect", redirect: { return_url: `${returnUrl}?${PLAN_RETURN_PARAM}=${PLAN_CANCELLED}` } },
  };
}

/**
 * WP64-S5. POST /api/platform/membership/portal with `{}`, `{ switchTo }` or
 * `{ cancel: true }`. Answers `{ ok: true, url }` with a Stripe Billing Portal
 * URL for the signed-in member's own Stripe customer, or `{ ok: false, code }`
 * as `_contract.ts` describes. The browser names no customer, subscription or
 * Price: Convex finds the customer and subscription from the member's session,
 * and the Price comes from config. The portal returns to Plan and billing on
 * our own origin. While `MEMBERSHIP_BILLING_MODE` is off it answers 503
 * (frozen contract 11).
 *
 * The portal uses the account's default configuration, which the setup
 * script checks (cancel at period end, payment method, invoices, monthly and
 * annual switch, no pause, no quantity). That configuration also decides the
 * switch timing: monthly to annual at once with proration, annual to monthly
 * at renewal. If Stripe refuses a switch or cancel page, the portal home
 * opens instead, so the member can still act there.
 */
export async function POST(request: Request) {
  const token = await convexAuthNextjsToken();
  if (!token) return membershipError("AUTHENTICATION_REQUIRED");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return membershipError("INVALID_REQUEST");
  }
  const input = parsePortalRequest(body);
  if (!input) return membershipError("INVALID_REQUEST");

  let config: ReturnType<typeof readMembershipBillingConfig>;
  try {
    config = readMembershipBillingConfig(process.env);
  } catch {
    return membershipError("BILLING_UNAVAILABLE");
  }
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) return membershipError("BILLING_UNAVAILABLE");

  try {
    const convex = new ConvexHttpClient(convexUrl);
    convex.setAuth(token);
    const found = await convex.action(
      api.platform.membership.provider.accept,
      signMembershipBridge({ kind: "open_portal", livemode: config.livemode }, config.bridgeSecret),
    );
    if (!("customerId" in found)) return membershipError("ok" in found && !found.ok ? found.code : undefined);

    const stripe = createMembershipStripe(config);
    const returnUrl = `${config.appOrigin}${MEMBERSHIP_RETURN_PATH}`;
    let flow: Flow | null | "refused" = null;
    if ("switchTo" in input || "cancel" in input) {
      // An older Convex deploy answers without a subscription id. Never read a path built from nothing.
      if (typeof found.subscriptionId !== "string" || !found.subscriptionId.startsWith("sub_")) {
        flow = "refused";
      } else {
        flow =
          "switchTo" in input
            ? await switchFlow(stripe, config, found, input.switchTo, returnUrl)
            : await cancelFlow(stripe, config, found, returnUrl);
      }
    }
    if (flow === "refused") return membershipError("INVALID_REQUEST");

    const openSession = (flowData: Flow | null) =>
      stripe.billingPortal.sessions.create({
        customer: found.customerId,
        return_url: returnUrl,
        ...(flowData ? { flow_data: flowData } : {}),
      });
    let session: Stripe.BillingPortal.Session;
    try {
      session = await openSession(flow);
    } catch (error) {
      // Stripe refused the switch or cancel page for this subscription. The portal home still lets the member act.
      if (!flow || errorSummary(error).name !== "StripeInvalidRequestError") throw error;
      console.warn("membership portal flow refused", errorSummary(error));
      session = await openSession(null);
    }
    if (session.livemode !== config.livemode || !isStripeRedirect(session.url)) return membershipError("BILLING_UNAVAILABLE");
    if (new URL(session.url).hostname !== "billing.stripe.com") return membershipError("BILLING_UNAVAILABLE");
    return Response.json({ ok: true, url: session.url });
  } catch (error) {
    // The class name and Stripe's error code only. Never a message, an email or a key.
    console.error("membership portal failed", errorSummary(error));
    return membershipError("BILLING_UNAVAILABLE");
  }
}
