import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { signMembershipBridge } from "@/lib/membership-bridge";
import { isStripeRedirect } from "../_contract";
import {
  assertPriceMatches,
  checkoutSessionParams,
  createMembershipStripe,
  membershipError,
  parseMembershipCheckoutRequest,
  readMembershipBillingConfig,
} from "../_server";

/**
 * WP64-S3. POST /api/platform/membership/checkout with `{ term, idempotencyKey }`.
 * Answers `{ ok: true, url }` with a Stripe-hosted Checkout URL, or
 * `{ ok: false, code }` as `_contract.ts` describes. The browser never sends
 * an amount, a price, a seat or an owner (frozen contract 1), and nothing is
 * granted here: only a verified webhook grants access (S4).
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
  const input = parseMembershipCheckoutRequest(body);
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
    const begun = await convex.action(
      api.platform.membership.provider.accept,
      signMembershipBridge(
        { kind: "begin_checkout", term: input.term, idempotencyKey: input.idempotencyKey, livemode: config.livemode },
        config.bridgeSecret,
      ),
    );
    if (!("ok" in begun)) return membershipError("BILLING_UNAVAILABLE");
    if (!begun.ok) return membershipError(begun.code, begun.opensAt);

    const stripe = createMembershipStripe(config);
    await assertPriceMatches(stripe, config, begun.priceKey);
    const session = await stripe.checkout.sessions.create(checkoutSessionParams(begun, config), {
      idempotencyKey: `membership-checkout:${begun.orderId}`,
    });
    const sessionMode = config.livemode ? "cs_live_" : "cs_test_";
    if (!session.id.startsWith(sessionMode) || !isStripeRedirect(session.url)) {
      return membershipError("BILLING_UNAVAILABLE");
    }
    if (new URL(session.url).hostname !== "checkout.stripe.com") return membershipError("BILLING_UNAVAILABLE");

    if (begun.checkoutSessionId !== session.id) {
      const attached = await convex.action(
        api.platform.membership.provider.accept,
        signMembershipBridge({ kind: "attach_session", orderId: begun.orderId, checkoutSessionId: session.id }, config.bridgeSecret),
      );
      if (!("attached" in attached)) return membershipError("ok" in attached && !attached.ok ? attached.code : undefined);
    }

    // One live session per member: close the ones this attempt replaces.
    // A session that was already paid or closed refuses, which is fine.
    await Promise.allSettled(
      begun.supersede.filter((id) => id !== session.id).map((id) => stripe.checkout.sessions.expire(id)),
    );
    return Response.json({ ok: true, url: session.url });
  } catch (error) {
    // The class name and Stripe's error code only. Never a message, an email or a key.
    const code = error && typeof error === "object" && "code" in error ? String((error as { code: unknown }).code) : undefined;
    console.error("membership checkout failed", { name: error instanceof Error ? error.name : "unknown", code });
    return membershipError("BILLING_UNAVAILABLE");
  }
}
