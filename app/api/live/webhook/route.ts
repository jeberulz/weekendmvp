import { ConvexHttpClient } from "convex/browser";
import { revalidateTag } from "next/cache";
import type Stripe from "stripe";
import { api } from "@/convex/_generated/api";
import { LIVE_EVENT_KEY } from "@/lib/live/config";
import { LIVE_SEATS_CACHE_TAG, LIVE_WORKSHOP_PURPOSE } from "@/lib/live/stripe-catalog";
import { signLiveWorkshopEvent } from "@/lib/live/workshop-bridge";
import {
  createLiveWorkshopStripe,
  readLiveWorkshopWebhookConfig,
} from "../_server";

const MAX_BODY_LENGTH = 512 * 1024;
const reply = (body: string, status: number) => new Response(body, { status });

/**
 * POST /api/live/webhook — Build-Along ticket sales only.
 * Routes on metadata.purpose=weekendmvp_workshop_v1.
 * Does not touch legacy ship·able, membership, or credit-pack handlers.
 */
export async function POST(request: Request) {
  let config: ReturnType<typeof readLiveWorkshopWebhookConfig>;
  try {
    config = readLiveWorkshopWebhookConfig(process.env);
  } catch {
    return reply("Webhook unavailable", 503);
  }
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) return reply("Webhook unavailable", 503);

  const signature = request.headers.get("stripe-signature");
  if (!signature) return reply("Invalid signature", 400);
  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY_LENGTH) return reply("Invalid signature", 400);

  const stripe = createLiveWorkshopStripe(config);
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, config.webhookSecret);
  } catch {
    return reply("Invalid signature", 400);
  }
  if (event.livemode !== config.livemode) return reply("Mode mismatch", 400);

  const convex = new ConvexHttpClient(convexUrl);
  const send = (payload: Parameters<typeof signLiveWorkshopEvent>[0]) =>
    convex.action(
      api.live.workshopBridge.accept,
      signLiveWorkshopEvent(payload, config.bridgeSecret),
    );

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.metadata?.purpose !== LIVE_WORKSHOP_PURPOSE) {
        return reply("Ignored", 200);
      }
      if (session.payment_status !== "paid" && session.status !== "complete") {
        return reply("Ignored", 200);
      }
      const priceId =
        (await retrievePriceId(stripe, session.id)) ??
        session.metadata?.price_key ??
        "";

      await send({
        kind: "mark_paid",
        issuedAt: Date.now(),
        checkoutSessionId: session.id,
        stripeEventId: event.id,
        priceId,
      });
      revalidateTag(LIVE_SEATS_CACHE_TAG, "max");
      return reply("OK", 200);
    }

    if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.metadata?.purpose !== LIVE_WORKSHOP_PURPOSE) {
        return reply("Ignored", 200);
      }
      await send({
        kind: "mark_expired",
        issuedAt: Date.now(),
        checkoutSessionId: session.id,
      });
      revalidateTag(LIVE_SEATS_CACHE_TAG, "max");
      return reply("OK", 200);
    }

    if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;
      const sessionId = await sessionIdFromCharge(stripe, charge);
      if (!sessionId) return reply("Ignored", 200);
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.metadata?.purpose !== LIVE_WORKSHOP_PURPOSE) {
        return reply("Ignored", 200);
      }
      await send({
        kind: "mark_refunded",
        issuedAt: Date.now(),
        checkoutSessionId: session.id,
        stripeEventId: event.id,
      });
      revalidateTag(LIVE_SEATS_CACHE_TAG, "max");
      return reply("OK", 200);
    }

    return reply("Ignored", 200);
  } catch (error) {
    console.error("live workshop webhook failed", {
      type: event.type,
      name: error instanceof Error ? error.name : "Error",
    });
    return reply("Retry", 500);
  }
}

async function retrievePriceId(stripe: Stripe, sessionId: string): Promise<string | null> {
  try {
    const full = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["line_items.data.price"],
    });
    const price = full.line_items?.data?.[0]?.price;
    return typeof price === "object" && price ? price.id : null;
  } catch {
    return null;
  }
}

async function sessionIdFromCharge(stripe: Stripe, charge: Stripe.Charge): Promise<string | null> {
  const pi =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id;
  if (!pi) return null;
  try {
    const sessions = await stripe.checkout.sessions.list({ payment_intent: pi, limit: 1 });
    return sessions.data[0]?.id ?? null;
  } catch {
    return null;
  }
}

void LIVE_EVENT_KEY;
