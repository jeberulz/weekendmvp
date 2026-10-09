import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import type Stripe from "stripe";
import { api } from "@/convex/_generated/api";
import { MEMBERSHIP_BILLING_PURPOSE } from "@/convex/platform/membership/validators";
import { signMembershipBridge } from "@/lib/membership-bridge";
import {
  MEMBERSHIP_RETURN_PATH,
  MEMBERSHIP_SWITCH_TERMS,
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

/** `{}`, or `{ switchTo }` alone with a subscription term. Anything else is refused. */
function parsePortalRequest(value: unknown): MembershipPortalRequest | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const keys = Object.keys(value);
  if (keys.length === 0) return {};
  if (keys.length !== 1 || keys[0] !== "switchTo") return null;
  const switchTo = (value as { switchTo: unknown }).switchTo;
  return MEMBERSHIP_SWITCH_TERMS.find((term) => term === switchTo) ? { switchTo: switchTo as MembershipSwitchTerm } : null;
}

type SwitchFlow = Stripe.BillingPortal.SessionCreateParams.FlowData;

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
  found: { customerId: string; subscriptionId: string },
  to: MembershipSwitchTerm,
  returnUrl: string,
): Promise<SwitchFlow | null | "refused"> {
  // An older Convex deploy answers without a subscription id. Never read a path built from nothing.
  if (typeof found.subscriptionId !== "string" || !found.subscriptionId.startsWith("sub_")) return "refused";
  await assertPriceMatches(stripe, config, to);
  const subscription = await stripe.subscriptions.retrieve(found.subscriptionId);
  const customer = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
  const items = subscription.items?.data ?? [];
  if (
    customer !== found.customerId ||
    subscription.metadata?.purpose !== MEMBERSHIP_BILLING_PURPOSE ||
    subscription.livemode !== config.livemode ||
    items.length !== 1 ||
    items[0].quantity !== 1
  ) {
    return "refused";
  }
  const from = to === "annual" ? config.priceIds.monthly : config.priceIds.annual;
  if (
    subscription.status !== "active" ||
    subscription.cancel_at_period_end ||
    subscription.cancel_at !== null ||
    subscription.schedule !== null ||
    items[0].price.id !== from
  ) {
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
 * WP64-S5. POST /api/platform/membership/portal with `{}` or `{ switchTo }`.
 * Answers `{ ok: true, url }` with a Stripe Billing Portal URL for the
 * signed-in member's own Stripe customer, or `{ ok: false, code }` as
 * `_contract.ts` describes. The browser names no customer, subscription or
 * Price: Convex finds the customer and subscription from the member's session,
 * and the Price comes from config. The portal returns to Plan and billing on
 * our own origin. While `MEMBERSHIP_BILLING_MODE` is off it answers 503
 * (frozen contract 11).
 *
 * The portal uses the account's default configuration, which the setup
 * script checks (cancel at period end, payment method, invoices, monthly and
 * annual switch, no pause, no quantity). That configuration also decides the
 * switch timing: monthly to annual at once with proration, annual to monthly
 * at renewal.
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
    const flow = "switchTo" in input ? await switchFlow(stripe, config, found, input.switchTo, returnUrl) : null;
    if (flow === "refused") return membershipError("INVALID_REQUEST");
    const session = await stripe.billingPortal.sessions.create({
      customer: found.customerId,
      return_url: returnUrl,
      ...(flow ? { flow_data: flow } : {}),
    });
    if (session.livemode !== config.livemode || !isStripeRedirect(session.url)) return membershipError("BILLING_UNAVAILABLE");
    if (new URL(session.url).hostname !== "billing.stripe.com") return membershipError("BILLING_UNAVAILABLE");
    return Response.json({ ok: true, url: session.url });
  } catch (error) {
    // The class name and Stripe's error code only. Never a message, an email or a key.
    console.error("membership portal failed", errorSummary(error));
    return membershipError("BILLING_UNAVAILABLE");
  }
}
