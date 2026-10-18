import { ConvexHttpClient } from "convex/browser";
import { revalidateTag } from "next/cache";
import type Stripe from "stripe";
import { api } from "@/convex/_generated/api";
import { LIVE_SEATS_CACHE_TAG, LIVE_WORKSHOP_PURPOSE } from "@/lib/live/stripe-catalog";
import { signLiveWorkshopEvent } from "@/lib/live/workshop-bridge";
import {
  createLiveWorkshopStripe,
  readLiveWorkshopWebhookConfig,
} from "../_server";

const MAX_BODY_LENGTH = 512 * 1024;
const reply = (body: string, status: number) => new Response(body, { status });

export class LiveWorkshopLookupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LiveWorkshopLookupError";
  }
}

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
      // Cards-only checkout; still require paid — never take a seat on unpaid / pending.
      if (session.payment_status !== "paid") {
        return reply("Ignored", 200);
      }
      await markPaid(send, stripe, session, event.id);
      return reply("OK", 200);
    }

    if (event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.metadata?.purpose !== LIVE_WORKSHOP_PURPOSE) {
        return reply("Ignored", 200);
      }
      if (session.payment_status !== "paid") {
        return reply("Ignored", 200);
      }
      await markPaid(send, stripe, session, event.id);
      return reply("OK", 200);
    }

    if (event.type === "checkout.session.async_payment_failed") {
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
      // Full refunds only — partial refunds leave the seat taken.
      if (charge.refunded !== true) {
        return reply("Ignored", 200);
      }
      const resolved = await resolveWorkshopRefund(stripe, charge);
      if (resolved.kind === "foreign") return reply("Ignored", 200);
      await send({
        kind: "mark_refunded",
        issuedAt: Date.now(),
        checkoutSessionId: resolved.checkoutSessionId,
        stripeEventId: event.id,
      });
      revalidateTag(LIVE_SEATS_CACHE_TAG, "max");
      return reply("OK", 200);
    }

    // charge.dispute.* is not handled here — free seats manually until implemented.
    return reply("Ignored", 200);
  } catch (error) {
    console.error("live workshop webhook failed", {
      type: event.type,
      name: error instanceof Error ? error.name : "Error",
    });
    // Lookup failures and Convex/transient errors → 500 so Stripe retries.
    return reply("Retry", 500);
  }
}

async function markPaid(
  send: (payload: Parameters<typeof signLiveWorkshopEvent>[0]) => Promise<unknown>,
  stripe: Stripe,
  session: Stripe.Checkout.Session,
  stripeEventId: string,
) {
  const priceId =
    (await retrievePriceId(stripe, session.id)) ?? session.metadata?.price_key ?? "";
  await send({
    kind: "mark_paid",
    issuedAt: Date.now(),
    checkoutSessionId: session.id,
    stripeEventId,
    priceId,
  });
  revalidateTag(LIVE_SEATS_CACHE_TAG, "max");
}

/**
 * Confirm the charge belongs to a workshop Checkout Session.
 * Throws LiveWorkshopLookupError on Stripe failures so the route returns 500.
 */
export async function resolveWorkshopRefund(
  stripe: Stripe,
  charge: Stripe.Charge,
): Promise<{ kind: "ours"; checkoutSessionId: string } | { kind: "foreign" }> {
  if (charge.metadata?.purpose === LIVE_WORKSHOP_PURPOSE) {
    const sessionId = await sessionIdFromCharge(stripe, charge);
    if (!sessionId) {
      throw new LiveWorkshopLookupError("workshop charge missing checkout session");
    }
    return { kind: "ours", checkoutSessionId: sessionId };
  }

  const piId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id;
  if (piId) {
    let intent: Stripe.PaymentIntent;
    try {
      intent = await stripe.paymentIntents.retrieve(piId);
    } catch {
      throw new LiveWorkshopLookupError("payment_intent retrieve failed");
    }
    if (intent.metadata?.purpose === LIVE_WORKSHOP_PURPOSE) {
      const sessionId = await sessionIdFromCharge(stripe, charge);
      if (!sessionId) {
        throw new LiveWorkshopLookupError("workshop payment_intent missing checkout session");
      }
      return { kind: "ours", checkoutSessionId: sessionId };
    }
  }

  let sessionId: string | null;
  try {
    sessionId = await sessionIdFromCharge(stripe, charge);
  } catch {
    throw new LiveWorkshopLookupError("checkout session list failed");
  }
  if (!sessionId) return { kind: "foreign" };

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch {
    throw new LiveWorkshopLookupError("checkout session retrieve failed");
  }
  if (session.metadata?.purpose !== LIVE_WORKSHOP_PURPOSE) {
    return { kind: "foreign" };
  }
  return { kind: "ours", checkoutSessionId: session.id };
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
  const sessions = await stripe.checkout.sessions.list({ payment_intent: pi, limit: 1 });
  return sessions.data[0]?.id ?? null;
}
