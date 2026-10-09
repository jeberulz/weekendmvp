import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { signMembershipBridge } from "@/lib/membership-bridge";
import { MEMBERSHIP_RETURN_PATH, isStripeRedirect } from "../_contract";
import { errorSummary } from "../_events";
import { createMembershipStripe, membershipError, readMembershipBillingConfig } from "../_server";

/** The body is `{}`. Anything else is refused. */
function isEmptyBody(value: unknown): boolean {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0;
}

/**
 * WP64-S5. POST /api/platform/membership/portal with `{}`. Answers
 * `{ ok: true, url }` with a Stripe Billing Portal URL for the signed-in
 * member's own Stripe customer, or `{ ok: false, code }` as `_contract.ts`
 * describes. The browser names no customer: Convex finds it from the member's
 * session. The portal returns to Plan and billing on our own origin. While
 * `MEMBERSHIP_BILLING_MODE` is off it answers 503 (frozen contract 11).
 *
 * The portal uses the account's default configuration, which the setup
 * script checks (cancel at period end, payment method, invoices, monthly and
 * annual switch, no pause, no quantity).
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
  if (!isEmptyBody(body)) return membershipError("INVALID_REQUEST");

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
    const session = await stripe.billingPortal.sessions.create({
      customer: found.customerId,
      return_url: `${config.appOrigin}${MEMBERSHIP_RETURN_PATH}`,
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
