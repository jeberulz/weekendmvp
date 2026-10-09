import type { FunctionReturnType } from "convex/server";
import {
  MEMBERSHIP_CHECKOUT_PATH,
  MEMBERSHIP_PORTAL_PATH,
  readMembershipRedirect,
  type CheckoutReturnState,
  type MembershipErrorCode,
  type MembershipRedirectResult,
  type MembershipTerm,
} from "@/app/api/platform/membership/_contract";
import type { api } from "@/convex/_generated/api";
import { PLANS, lifetimeTrancheForSeat } from "@/convex/platform/plans";
import type { DashboardEvent } from "@/lib/track";

/**
 * WP63-S6. Browser side of membership checkout. Plain functions, so the
 * rules are tested without a DOM: post only `{ term, idempotencyKey }`,
 * follow only a Stripe URL, and never treat the return URL as proof of
 * payment. Only `entitlements.mine` confirms a purchase.
 */

export type Entitlements = FunctionReturnType<typeof api.platform.entitlements.mine>;

type Fetch = (input: string, init: RequestInit) => Promise<Response>;

async function postForRedirect(path: string, body: object, fetchImpl: Fetch): Promise<MembershipRedirectResult> {
  try {
    const response = await fetchImpl(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      credentials: "same-origin",
      cache: "no-store",
    });
    let parsed: unknown = null;
    try {
      parsed = await response.json();
    } catch {
      parsed = null;
    }
    return readMembershipRedirect(response.status, parsed);
  } catch {
    return { ok: false, code: "UNKNOWN" };
  }
}

export function requestCheckout(term: MembershipTerm, idempotencyKey: string, fetchImpl: Fetch = fetch) {
  return postForRedirect(MEMBERSHIP_CHECKOUT_PATH, { term, idempotencyKey }, fetchImpl);
}

export function requestPortal(fetchImpl: Fetch = fetch) {
  return postForRedirect(MEMBERSHIP_PORTAL_PATH, {}, fetchImpl);
}

/** One key per checkout attempt. A retry of the same attempt reuses it, so Stripe returns the same session. */
export function newIdempotencyKey(): string {
  return `membership:${crypto.randomUUID()}`;
}

const HUB = PLANS.builders_hub.name;

/** "November 4, 2026 at 5:00 PM", in the member's own time zone. */
export function formatOpening(ms: number): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeStyle: "short" }).format(ms);
}

/** Plain words for each refusal. Every message says what happened to the money. */
export function checkoutMessage(code: MembershipErrorCode | "UNKNOWN", opensAt?: number): string {
  switch (code) {
    case "BILLING_UNAVAILABLE":
      return "Checkout isn’t open yet. Nothing was charged.";
    case "SOLD_OUT":
      return "All founding seats are taken. Monthly and annual are still open. Nothing was charged.";
    case "ALREADY_SUBSCRIBED":
      return `You already have ${HUB}. Reload this page to see your plan.`;
    case "NOT_YET_ELIGIBLE":
      return opensAt === undefined
        ? "Founding Lifetime isn’t open for your account yet. Nothing was charged."
        : `Founding Lifetime opens for you on ${formatOpening(opensAt)}. Nothing was charged.`;
    case "EMAIL_NOT_VERIFIED":
      return "Confirm your email address first, then try again. Nothing was charged.";
    case "ACCOUNT_REVIEW":
      return "This account can’t start a new purchase right now. Please contact support. Nothing was charged.";
    case "AUTHENTICATION_REQUIRED":
      return "Your session ended. Sign in again, then try again. Nothing was charged.";
    case "RATE_LIMITED":
      return "Too many tries in a row. Wait a minute, then try again. Nothing was charged.";
    default:
      return "Checkout didn’t start. Nothing was charged. Please try again.";
  }
}

export function portalMessage(code: MembershipErrorCode | "UNKNOWN"): string {
  if (code === "BILLING_UNAVAILABLE") return "Billing management isn’t open yet.";
  if (code === "AUTHENTICATION_REQUIRED") return "Your session ended. Sign in again, then try again.";
  return "Billing management didn’t open. Please try again.";
}

// The checkout this tab started, kept until the return page confirms it.
// Session storage only: it never leaves this tab, and it is not proof of payment.

const PENDING_KEY = "wmvp:membership-checkout";
const PENDING_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type PendingCheckout = { term: MembershipTerm; startedAt: number };

function sessionStore(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function rememberPendingCheckout(term: MembershipTerm, now: number, store = sessionStore()): void {
  try {
    store?.setItem(PENDING_KEY, JSON.stringify({ term, startedAt: now }));
  } catch {
    // Private windows can refuse storage. The return page still confirms from the server.
  }
}

export function readPendingCheckout(now: number, store = sessionStore()): PendingCheckout | null {
  try {
    const raw = store?.getItem(PENDING_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<PendingCheckout>;
    const termOk = value.term === "monthly" || value.term === "annual" || value.term === "lifetime";
    const fresh = typeof value.startedAt === "number" && now - value.startedAt >= 0 && now - value.startedAt < PENDING_MAX_AGE_MS;
    return termOk && fresh ? { term: value.term as MembershipTerm, startedAt: value.startedAt as number } : null;
  } catch {
    return null;
  }
}

export function clearPendingCheckout(store = sessionStore()): void {
  try {
    store?.removeItem(PENDING_KEY);
  } catch {
    // Nothing to clear.
  }
}

/** After this long, the return page says the payment may still be processing. */
export const CONFIRM_SLOW_AFTER_MS = 90_000;

export type ReturnStatus = "cancelled" | "confirmed" | "slow" | "confirming";

/**
 * The server decides. Confirmed only when `entitlements.mine` reports
 * Builder's Hub, on the term this tab bought when it knows one.
 */
export function checkoutReturnStatus({
  state,
  entitlements,
  pending,
  slow,
}: {
  state: CheckoutReturnState;
  entitlements: Entitlements;
  pending: PendingCheckout | null;
  slow: boolean;
}): ReturnStatus {
  if (state === "cancelled") return "cancelled";
  const confirmed =
    entitlements.plan === "builders_hub" && (pending === null || entitlements.billing.term === pending.term);
  if (confirmed) return "confirmed";
  return slow ? "slow" : "confirming";
}

/** The paid events for one confirmed checkout. Empty without a pending checkout, so a reload fires nothing. */
export function completionEvents(pending: PendingCheckout | null, entitlements: Entitlements): DashboardEvent[] {
  if (pending === null) return [];
  if (entitlements.plan !== "builders_hub" || entitlements.billing.term !== pending.term) return [];
  const events: DashboardEvent[] = [{ name: "checkout_completed", props: { term: pending.term } }];
  if (pending.term === "lifetime" && entitlements.billing.foundingSeat !== null) {
    const tranche = lifetimeTrancheForSeat(entitlements.billing.foundingSeat);
    if (tranche) events.push({ name: "founding_seat_taken", props: { tranche: tranche.priceKey } });
  }
  return events;
}
