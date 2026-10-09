import type Stripe from "stripe";
import type { FollowUp, MembershipEvent, SubscriptionSnapshot } from "@/convex/platform/membership/events";
import { MEMBERSHIP_BILLING_PURPOSE } from "@/convex/platform/membership/validators";
import { MEMBERSHIP_WEBHOOK_EVENTS } from "@/lib/membership/stripe-catalog";
import type { MembershipWebhookConfig } from "./_server";

/**
 * WP64-S4. Turns a verified Stripe event into the normalized snapshot Convex
 * settles (`convex/platform/membership/events.ts`), and performs the Stripe
 * calls settlement asks for. Thin events, fat fetch (frozen contract 6): the
 * event only names the object, and the current object is read from Stripe,
 * so a late or repeated delivery always carries today's state.
 *
 * Field moves on the pinned API version (`2026-05-27.dahlia`): the period end
 * lives on the subscription item, an invoice reaches its subscription through
 * `parent.subscription_details`, and a payment reaches its invoice through
 * `invoicePayments`. Never logs or returns an email, a key or a payload.
 */

type StripeClient = Pick<
  Stripe,
  "checkout" | "subscriptions" | "charges" | "disputes" | "paymentIntents" | "invoicePayments" | "invoices" | "refunds"
>;

type Header = { eventId: string; eventType: string; livemode: boolean };

const HANDLED: ReadonlySet<string> = new Set(MEMBERSHIP_WEBHOOK_EVENTS);
const ORDER_ID = /^[A-Za-z0-9_;]{1,64}$/;
/** Subscriptions Stripe will never bill again. */
const ENDED: ReadonlySet<string> = new Set(["canceled", "incomplete_expired"]);
/** A closed dispute that did not take the money back. */
const DISPUTE_WON: ReadonlySet<string> = new Set(["won", "warning_closed", "prevented"]);

const idOf = (value: string | { id: string } | null | undefined): string | null =>
  typeof value === "string" ? value : (value?.id ?? null);

const ours = (metadata: Stripe.Metadata | null | undefined) => metadata?.purpose === MEMBERSHIP_BILLING_PURPOSE;

function orderIdOf(value: string | null | undefined): string | null {
  return typeof value === "string" && ORDER_ID.test(value) ? value : null;
}

const seconds = (value: number | null | undefined) => (typeof value === "number" ? value * 1000 : null);

/** The snapshot Convex stores. One item at one of our Prices, or settlement rejects it. */
export function subscriptionSnapshot(
  subscription: Stripe.Subscription,
  priceKeys: MembershipWebhookConfig["priceKeys"],
  now: number,
): SubscriptionSnapshot {
  const items = subscription.items?.data ?? [];
  const item = items.length === 1 ? items[0] : null;
  return {
    subscriptionId: subscription.id,
    customerId: idOf(subscription.customer) ?? "",
    orderId: orderIdOf(subscription.metadata?.order_id),
    status: subscription.status,
    priceKey: item ? (priceKeys[item.price.id] ?? null) : null,
    quantity: item?.quantity ?? 0,
    currentPeriodEnd: seconds(item?.current_period_end),
    // The portal may set a cancel date instead of the flag. Either way it ends.
    cancelAtPeriodEnd: subscription.cancel_at_period_end || subscription.cancel_at !== null,
    endedAt: seconds(subscription.ended_at),
    snapshotAt: now,
  };
}

async function ourSubscription(stripe: StripeClient, subscriptionId: string, config: MembershipWebhookConfig, now: number) {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  return ours(subscription.metadata) ? subscriptionSnapshot(subscription, config.priceKeys, now) : null;
}

/** Which membership purchase a payment belongs to, or null for anyone else's. */
async function paymentTarget(
  stripe: StripeClient,
  paymentIntentId: string,
): Promise<{ target: "lifetime" | "subscription"; orderId: string | null; subscriptionId: string | null } | null> {
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (ours(intent.metadata)) return { target: "lifetime", orderId: orderIdOf(intent.metadata.order_id), subscriptionId: null };
  // A subscription payment carries no metadata of its own. Its invoice names the subscription.
  const payments = await stripe.invoicePayments.list({ payment: { type: "payment_intent", payment_intent: paymentIntentId }, limit: 1 });
  const invoiceId = idOf(payments.data[0]?.invoice);
  if (!invoiceId) return null;
  const invoice = await stripe.invoices.retrieve(invoiceId);
  const details = invoice.parent?.subscription_details;
  const subscriptionId = idOf(details?.subscription);
  if (!subscriptionId) return null;
  if (!ours(details?.metadata) && !ours((await stripe.subscriptions.retrieve(subscriptionId)).metadata)) return null;
  return { target: "subscription", orderId: null, subscriptionId };
}

async function checkoutEvent(stripe: StripeClient, header: Header, sessionId: string, config: MembershipWebhookConfig, now: number) {
  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["line_items"] });
  if (!ours(session.metadata)) return null;
  const orderId = orderIdOf(session.metadata?.order_id ?? session.client_reference_id);
  if (!orderId) return null;
  const lines = session.line_items?.data ?? [];
  const line = lines.length === 1 ? lines[0] : null;
  const subscriptionId = session.mode === "subscription" ? idOf(session.subscription) : null;
  const event: MembershipEvent = {
    kind: "checkout",
    ...header,
    orderId,
    sessionId: session.id,
    status: session.status ?? "open",
    paymentStatus: session.payment_status,
    failed: header.eventType === "checkout.session.async_payment_failed",
    customerId: idOf(session.customer),
    paymentIntentId: idOf(session.payment_intent),
    priceKey: line?.price ? (config.priceKeys[line.price.id] ?? null) : null,
    quantity: line?.quantity ?? 0,
    amountTotal: session.amount_total,
    currency: session.currency,
    subscription: subscriptionId ? await ourSubscription(stripe, subscriptionId, config, now) : null,
  };
  return event;
}

/**
 * The normalized event, or null when it is not ours (another purpose, an
 * unknown subscription, a payment we did not take). Throws on a Stripe error
 * so the route answers 500 and Stripe retries.
 */
export async function normalizeMembershipEvent(
  stripe: StripeClient,
  event: Stripe.Event,
  config: MembershipWebhookConfig,
  now: number,
): Promise<MembershipEvent | null> {
  // Any other type is not ours to settle. Nothing is fetched for it.
  if (!HANDLED.has(event.type)) return null;
  const header: Header = { eventId: event.id, eventType: event.type, livemode: event.livemode };
  const object = event.data.object as { id: string };

  if (event.type.startsWith("checkout.session.")) return await checkoutEvent(stripe, header, object.id, config, now);

  if (event.type.startsWith("customer.subscription.")) {
    const subscription = await ourSubscription(stripe, object.id, config, now);
    return subscription ? { kind: "subscription", ...header, subscription } : null;
  }

  if (event.type.startsWith("invoice.")) {
    // Read on the pinned version, so the endpoint's own API version never hides the subscription link.
    const invoice = await stripe.invoices.retrieve(object.id);
    const subscriptionId = idOf(invoice.parent?.subscription_details?.subscription);
    if (!subscriptionId) return null;
    const subscription = await ourSubscription(stripe, subscriptionId, config, now);
    return subscription ? { kind: "subscription", ...header, subscription } : null;
  }

  if (event.type === "charge.refunded") {
    const charge = await stripe.charges.retrieve(object.id);
    const paymentIntentId = idOf(charge.payment_intent);
    if (!paymentIntentId) return null;
    const target = await paymentTarget(stripe, paymentIntentId);
    // A partial refund changes nothing (frozen contract 9). Settlement logs it as ignored.
    return target ? { kind: "refund", ...header, ...target, paymentIntentId, full: charge.refunded } : null;
  }

  // charge.dispute.created and charge.dispute.closed: the current status decides, so order does not matter.
  const dispute = await stripe.disputes.retrieve(object.id);
  const chargeId = idOf(dispute.charge);
  const paymentIntentId =
    idOf(dispute.payment_intent) ?? (chargeId ? idOf((await stripe.charges.retrieve(chargeId)).payment_intent) : null);
  if (!paymentIntentId) return null;
  const target = await paymentTarget(stripe, paymentIntentId);
  if (!target) return null;
  const outcome = dispute.status === "lost" ? "lost" : DISPUTE_WON.has(dispute.status) ? "won" : "open";
  return { kind: "dispute", ...header, ...target, paymentIntentId, outcome };
}

/** Refunds what is left of a payment, once. Skips one already refunded or under dispute. */
async function refundInFull(stripe: StripeClient, paymentIntentId: string) {
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ["latest_charge"] });
  const charge = typeof intent.latest_charge === "object" ? intent.latest_charge : null;
  if (intent.status !== "succeeded" || !charge || charge.refunded || charge.disputed) return;
  await stripe.refunds.create({ payment_intent: paymentIntentId }, { idempotencyKey: `membership-refund:${paymentIntentId}` });
}

async function cancelNow(stripe: StripeClient, subscriptionId: string) {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  if (ENDED.has(subscription.status)) return;
  await stripe.subscriptions.cancel(subscriptionId, {}, { idempotencyKey: `membership-cancel:${subscriptionId}` });
}

/** The paid payment on a subscription's latest invoice, if any. */
async function latestPayment(stripe: StripeClient, subscriptionId: string) {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const invoiceId = idOf(subscription.latest_invoice);
  if (!invoiceId) return null;
  const payments = await stripe.invoicePayments.list({ invoice: invoiceId, status: "paid", limit: 1 });
  return idOf(payments.data[0]?.payment.payment_intent);
}

/**
 * Performs the Stripe calls settlement asked for, in order, each with an
 * idempotency key and a state check, so a repeat does nothing. Throws on the
 * first failure: the route answers 500, Stripe redelivers, and settlement
 * asks again for whatever is still owed.
 */
export async function performFollowUps(stripe: StripeClient, actions: readonly FollowUp[]): Promise<void> {
  for (const action of actions) {
    if (action.type === "refund_payment") {
      await refundInFull(stripe, action.paymentIntentId);
    } else if (action.type === "cancel_subscription_now") {
      await cancelNow(stripe, action.subscriptionId);
    } else if (action.type === "cancel_at_period_end") {
      // O5: lifetime replaces the subscription when its paid period ends. No refund.
      const subscription = await stripe.subscriptions.retrieve(action.subscriptionId);
      if (ENDED.has(subscription.status) || subscription.cancel_at_period_end || subscription.cancel_at !== null) continue;
      await stripe.subscriptions.update(
        action.subscriptionId,
        { cancel_at_period_end: true },
        { idempotencyKey: `membership-cancel-at-period-end:${action.subscriptionId}` },
      );
    } else {
      // A second subscription: refund first, then cancel. If the cancel fails, the
      // refund's own event cancels it, and a retry finds the refund already made.
      const paymentIntentId = await latestPayment(stripe, action.subscriptionId);
      if (paymentIntentId) await refundInFull(stripe, paymentIntentId);
      await cancelNow(stripe, action.subscriptionId);
    }
  }
}

/** Error class and Stripe code only, for a log line. Never a message. */
export function errorSummary(error: unknown): { name: string; code: string | undefined } {
  const code = error && typeof error === "object" && "code" in error ? String((error as { code: unknown }).code) : undefined;
  return { name: error instanceof Error ? error.name : "unknown", code };
}
