/**
 * POST /api/stripe-webhook — Stripe → Convex event log + Beehiiv paid-cohort
 * enrollment (App Router port of api/stripe-webhook.js).
 *
 * Listens for `checkout.session.completed` events from Stripe. On a
 * successful ship·able seat purchase, it records the event in Convex
 * (idempotent by stripeEventId — Stripe retries are acknowledged without a
 * second insert) and enrolls the buyer's email into the dedicated
 * "Ship.able Workshop" Beehiiv automation. The free form-submit waitlist
 * also feeds into this same automation, so anyone who has shown interest in
 * ship·able lands in one cohesive drip regardless of payment status (paid
 * buyers simply re-enroll, which is a no-op for already-enrolled subscribers
 * in Beehiiv).
 *
 * Changes vs the legacy Edge handler (intentional, per migration plan):
 * - Node runtime + `stripe.webhooks.constructEvent` replaces the hand-rolled
 *   Web Crypto HMAC (same 300s default tolerance, less custom crypto).
 * - Convex `payments.recordEvent` provides idempotency by event.id.
 * - DEVIATION from plan U5: Beehiiv enrollment is a direct `beehiivSubscribe`
 *   call rather than a `@convex-dev/workflow` durable workflow. Legacy
 *   best-effort semantics are preserved (ALWAYS return 200 even when Beehiiv
 *   or Convex fails, errors logged for manual reconciliation, so Stripe never
 *   enters a retry loop). Durable retry can be layered in later.
 *
 * Stripe webhook setup (one-time):
 *   1. Stripe Dashboard → Developers → Webhooks → Add endpoint
 *   2. URL:    https://weekendmvp.app/api/stripe-webhook
 *   3. Events: checkout.session.completed
 *   4. Copy the signing secret (whsec_...) into the Vercel env
 */

import Stripe from "stripe";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { beehiivSubscribe } from "@/lib/beehiiv";

async function enrollPaidSubscriber(
  email: string,
  sessionId: string | undefined,
): Promise<void> {
  const paidAutomationId = process.env.BEEHIIV_PAID_AUTOMATION_ID;
  if (!process.env.BEEHIIV_API_KEY || !paidAutomationId) {
    console.error("Beehiiv not configured; cannot enroll paid subscriber", { sessionId });
    return;
  }

  // Mirror the waitlist flow's source + campaign so the same entry condition
  // fires in Beehiiv. utm_medium=paid is the discriminator the internal
  // automation branch uses to route to paid-only emails.
  const result = await beehiivSubscribe({
    email,
    automationIds: [paidAutomationId],
    utmSource: "shipable",
    utmMedium: "paid",
    utmCampaign: "shipable-workshop",
  });

  if (!result.ok) {
    console.error("Beehiiv enrollment failed", {
      sessionId,
      email,
      status: result.status,
      body: result.data,
    });
    return;
  }
  console.log("Paid subscriber enrolled", { sessionId, email });
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET not configured");
    return new Response("Webhook not configured", { status: 500 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  // The SDK constructor requires a string but `webhooks.constructEvent` does
  // signature verification only — it never reaches the Stripe API. Our flow
  // (Payment Link redirect + webhook ack) makes no server-side Stripe API
  // calls, so STRIPE_SECRET_KEY is optional. Set it if you later add
  // checkout.sessions.create, refunds, customer queries, etc.
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_placeholder_unused");

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature ?? "", webhookSecret);
  } catch (error) {
    console.error("Stripe signature verification failed", {
      error: String(error),
    });
    return new Response("Invalid signature", { status: 400 });
  }

  // Acknowledge events we do not handle so Stripe stops retrying.
  if (event.type !== "checkout.session.completed") {
    return new Response("Ignored", { status: 200 });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const email =
    session.customer_details?.email ??
    session.customer_email ??
    session.client_reference_id ??
    null;
  const sessionId = session.id;

  if (!email) {
    console.error("No email on checkout.session.completed", { sessionId });
    return new Response("OK", { status: 200 });
  }

  // Record the event in Convex (idempotent by stripeEventId). A duplicate
  // means Stripe retried an event we already processed — acknowledge and
  // stop before re-enrolling. A Convex failure is logged but must never fail
  // the webhook (legacy semantics: Stripe must not enter a retry loop).
  try {
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (convexUrl) {
      const convex = new ConvexHttpClient(convexUrl);
      const recorded = await convex.mutation(api.payments.recordEvent, {
        stripeEventId: event.id,
        type: event.type,
        email,
        customerId:
          typeof session.customer === "string" ? session.customer : undefined,
        amount: session.amount_total ?? undefined,
        currency: session.currency ?? undefined,
        paymentLinkId:
          typeof session.payment_link === "string" ? session.payment_link : undefined,
      });
      if (recorded.duplicate) {
        return new Response("OK", { status: 200 });
      }
    }
  } catch (error) {
    console.error("Convex payments.recordEvent failed", {
      sessionId,
      email,
      error: String(error),
    });
  }

  // Best-effort: do not fail the webhook even if Beehiiv hiccups, so Stripe
  // does not enter a retry loop. Errors are logged for manual reconciliation.
  await enrollPaidSubscriber(email, sessionId).catch((error) => {
    console.error("Enrollment threw", { sessionId, email, error: String(error) });
  });

  return new Response("OK", { status: 200 });
}
