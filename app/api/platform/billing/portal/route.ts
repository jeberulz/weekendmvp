import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import Stripe from "stripe";
import { api } from "@/convex/_generated/api";
import { readPlatformBillingConfig } from "../_server";

function jsonError(status: number, code: string) {
  return Response.json({ ok: false, code }, { status });
}

export async function POST() {
  const token = await convexAuthNextjsToken();
  if (!token) return jsonError(401, "AUTHENTICATION_REQUIRED");

  let config: ReturnType<typeof readPlatformBillingConfig>;
  try {
    config = readPlatformBillingConfig(process.env);
  } catch {
    return jsonError(503, "BILLING_NOT_CONFIGURED");
  }
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) return jsonError(503, "BILLING_NOT_CONFIGURED");

  try {
    const convex = new ConvexHttpClient(convexUrl);
    convex.setAuth(token);
    const summary = await convex.query(api.platform.billing.queries.summary, {
      historyLimit: 20,
    });
    const paid = summary.purchases.find(
      (purchase) =>
        purchase.status === "paid" &&
        typeof purchase.providerCheckoutSessionId === "string" &&
        purchase.providerCheckoutSessionId.startsWith("cs_test_"),
    );
    if (!paid?.providerCheckoutSessionId) {
      return jsonError(404, "NO_PAID_PURCHASE");
    }

    const stripe = new Stripe(config.stripeKey);
    const session = await stripe.checkout.sessions.retrieve(
      paid.providerCheckoutSessionId,
    );
    if (typeof session.customer !== "string" || !session.customer.startsWith("cus_")) {
      return jsonError(503, "PORTAL_UNAVAILABLE");
    }

    const portal = await stripe.billingPortal.sessions.create({
      customer: session.customer,
      return_url: `${config.appOrigin}/dashboard`,
    });
    if (!portal.url) return jsonError(502, "PORTAL_UNAVAILABLE");
    const portalUrl = new URL(portal.url);
    if (
      portalUrl.protocol !== "https:" ||
      portalUrl.hostname !== "billing.stripe.com"
    ) {
      return jsonError(502, "PORTAL_UNAVAILABLE");
    }
    return Response.json({ ok: true, url: portalUrl.href });
  } catch {
    return jsonError(503, "PORTAL_UNAVAILABLE");
  }
}
