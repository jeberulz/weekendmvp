import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import Stripe from "stripe";
import { api } from "@/convex/_generated/api";
import { PLATFORM_BILLING_PURPOSE } from "@/convex/platform/billing/catalog";
import {
  parseCheckoutRequest,
  readPlatformBillingConfig,
  signBridgePayload,
} from "../_server";

function jsonError(status: number, code: string) {
  return Response.json({ ok: false, code }, { status });
}

export async function POST(request: Request) {
  const token = await convexAuthNextjsToken();
  if (!token) return jsonError(401, "AUTHENTICATION_REQUIRED");

  let input: ReturnType<typeof parseCheckoutRequest>;
  try {
    input = parseCheckoutRequest(await request.json());
  } catch {
    return jsonError(400, "INVALID_CHECKOUT_REQUEST");
  }

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
    const purchase = await convex.mutation(api.platform.billing.checkout.prepare, {
      projectId: input.projectId as never,
      packId: input.packId,
      idempotencyKey: input.idempotencyKey,
    });
    if (purchase.status !== "pending") {
      return jsonError(409, "PURCHASE_ALREADY_SETTLED");
    }

    const stripe = new Stripe(config.stripeKey);
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        line_items: [{ price: config.priceIds[input.packId], quantity: 1 }],
        success_url: `${config.appOrigin}/dashboard/billing?checkout=return`,
        cancel_url: `${config.appOrigin}/dashboard/billing?checkout=cancelled`,
        client_reference_id: purchase.purchaseId,
        metadata: {
          purpose: PLATFORM_BILLING_PURPOSE,
          purchase_id: purchase.purchaseId,
          pack_id: input.packId,
        },
        payment_intent_data: {
          metadata: {
            purpose: PLATFORM_BILLING_PURPOSE,
            purchase_id: purchase.purchaseId,
          },
        },
      },
      { idempotencyKey: `platform-checkout:${purchase.purchaseId}` },
    );
    if (!session.id.startsWith("cs_test_") || !session.url) {
      return jsonError(502, "CHECKOUT_UNAVAILABLE");
    }
    const checkoutUrl = new URL(session.url);
    if (checkoutUrl.protocol !== "https:" || checkoutUrl.hostname !== "checkout.stripe.com") {
      return jsonError(502, "CHECKOUT_UNAVAILABLE");
    }

    const bridge = signBridgePayload(
      {
        kind: "attach_session",
        purchaseId: purchase.purchaseId,
        checkoutSessionId: session.id,
      },
      config.bridgeSecret,
    );
    await convex.action(api.platform.billing.provider.accept, bridge);
    return Response.json({ ok: true, url: checkoutUrl.href });
  } catch {
    return jsonError(503, "CHECKOUT_UNAVAILABLE");
  }
}
