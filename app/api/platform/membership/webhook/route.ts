import { ConvexHttpClient } from "convex/browser";
import type Stripe from "stripe";
import { api } from "@/convex/_generated/api";
import { signMembershipBridge } from "@/lib/membership-bridge";
import { errorSummary, normalizeMembershipEvent, performFollowUps } from "../_events";
import { createMembershipStripe, readMembershipWebhookConfig } from "../_server";

/** Stripe events are a few kilobytes. Anything this large is not one. */
const MAX_BODY_LENGTH = 512 * 1024;

const reply = (body: string, status: number) => new Response(body, { status });

/**
 * WP64-S4. POST /api/platform/membership/webhook, Stripe's only way in.
 * Verifies the signature on the raw body, fetches the current Stripe object,
 * settles it in Convex through the signed bridge, then makes any refund or
 * cancellation settlement asks for. 400 for a bad request, 200 once settled or
 * not ours, 500 so Stripe retries anything that failed part way. Never
 * acknowledges an event whose settlement or follow-up failed.
 */
export async function POST(request: Request) {
  let config: ReturnType<typeof readMembershipWebhookConfig>;
  try {
    config = readMembershipWebhookConfig(process.env);
  } catch {
    return reply("Webhook unavailable", 503);
  }
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) return reply("Webhook unavailable", 503);

  const signature = request.headers.get("stripe-signature");
  if (!signature) return reply("Invalid signature", 400);
  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY_LENGTH) return reply("Invalid signature", 400);

  const stripe = createMembershipStripe(config);
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, config.webhookSecret);
  } catch {
    return reply("Invalid signature", 400);
  }
  // A test event never settles against live data, nor the reverse.
  if (event.livemode !== config.livemode) return reply("Mode mismatch", 400);

  try {
    const normalized = await normalizeMembershipEvent(stripe, event, config, Date.now());
    if (!normalized) return reply("Ignored", 200);
    const convex = new ConvexHttpClient(convexUrl);
    const settled = await convex.action(
      api.platform.membership.provider.accept,
      signMembershipBridge({ kind: "event", issuedAt: Date.now(), event: normalized }, config.bridgeSecret),
    );
    if (!("actions" in settled)) return reply("Retry", 500);
    await performFollowUps(stripe, settled.actions);
    return reply("OK", 200);
  } catch (error) {
    // The event type, the class name and Stripe's error code only.
    console.error("membership webhook failed", { type: event.type, ...errorSummary(error) });
    return reply("Retry", 500);
  }
}
