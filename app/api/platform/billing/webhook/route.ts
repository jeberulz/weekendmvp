import { ConvexHttpClient } from "convex/browser";
import Stripe from "stripe";
import { api } from "@/convex/_generated/api";
import {
  normalizeStripeEvent,
  readPlatformBillingConfig,
  signBridgePayload,
  UnsupportedPlatformBillingPolicyError,
} from "../_server";

export async function POST(request: Request) {
  let config: ReturnType<typeof readPlatformBillingConfig>;
  try {
    config = readPlatformBillingConfig(process.env, { requireWebhook: true });
  } catch {
    return new Response("Webhook unavailable", { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Invalid signature", { status: 400 });
  const rawBody = await request.text();
  const stripe = new Stripe(config.stripeKey);
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      config.webhookSecret!,
    );
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  let normalized: ReturnType<typeof normalizeStripeEvent>;
  try {
    normalized = normalizeStripeEvent(event);
  } catch (error) {
    if (error instanceof UnsupportedPlatformBillingPolicyError) {
      return new Response("Unsupported platform billing policy", { status: 422 });
    }
    return new Response("Invalid platform event", { status: 400 });
  }
  if (!normalized) return new Response("Ignored", { status: 200 });

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) return new Response("Webhook unavailable", { status: 503 });
  try {
    const convex = new ConvexHttpClient(convexUrl);
    const bridge = signBridgePayload(normalized, config.bridgeSecret);
    await convex.action(api.platform.billing.provider.accept, bridge);
    return new Response("OK", { status: 200 });
  } catch {
    // Do not acknowledge a provider event whose required atomic mutation failed.
    // Stripe will retry; the Convex mutation is event-idempotent.
    return new Response("Retry", { status: 500 });
  }
}
